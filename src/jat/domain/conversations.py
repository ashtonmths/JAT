"""Recruiter conversations (Insights): what happens before an application.

A lot of a search happens on calls: a recruiter pitches roles, and you apply for some and pass
on others. This looks at that part:
- **calls**: calls and meetings with people, by status: *held* means marked Happened,
  *booked* is scheduled and still to come (a scheduled call that has passed waits on Next
  actions to be marked, and isn't counted), *waiting* can't go ahead at its time and has no
  new one yet (neither held nor booked); and calls *moved* to another time, with each move's
  who (a waiting call's started move counts, with the who it was marked with);
- **pitched roles**: roles someone told you about (a role with a person). Each is *applied*
  (an application that got to Applied or further), *passed* (you passed, or every
  application was closed before it got to Applied: withdrawn while only *Interested*) or
  *deciding* (neither, including roles you're only *Interested* in);
- **where applied ones went**: the best outcome among a role's applications: an *offer* (an
  offer logged, or a success stage), *in progress* (an active stage), *ghosted* (a
  `reopen_from` stage, Ghosted by default) or *closed* (any other closed stage);
- **time to decide**: days from adding a pitched role to applying (its first application
  being added: its first stage event, so backdated history counts) or passing (the day you
  passed);
- per **person** and per **agency** (a person's agency), and **why you passed**.

Roles and calls count in a period by when they were added and when they happen. Roles you
found yourself (no person) and applications added without a role pitch aren't here: the
scorecard covers applications by recruiter.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from statistics import median

from sqlalchemy import select
from sqlalchemy.orm import Session

from jat.db.models import Agency, Application, Company, Contact, Event, Interview, Meeting, MeetingMove, Offer, Role

from .applications import STAGE_CHANGE
from .insights import role_progress, stage_paths
from .workflow import Workflow

OUTCOMES = ("offer", "in_progress", "closed", "ghosted")  # best first
WHO = ("me", "them", "mutual", "neither")  # who needed a call moved; anything else is not recorded


@dataclass
class Tally:
    """Counts for everyone, one person or one agency."""

    calls_held: int = 0
    calls_booked: int = 0  # scheduled, still to come
    calls_cancelled: int = 0
    calls_waiting: int = 0  # booked, but can't go ahead at its time and has no new one yet
    calls_moved: int = 0  # calls moved to another time at least once (a waiting one has started its move)
    call_moves: int = 0  # their moves: a call that moves twice is one call and two moves
    moves_by: dict[str, int] = field(default_factory=lambda: dict.fromkeys((*WHO, "not_recorded"), 0))
    last_call: datetime | None = None
    pitched: int = 0
    applied: int = 0
    passed: int = 0
    deciding: int = 0
    interviewed: int = 0  # applied roles with an interview round that wasn't cancelled
    outcomes: dict[str, int] = field(default_factory=lambda: dict.fromkeys(OUTCOMES, 0))
    decide_days: list[float] = field(default_factory=list)

    @property
    def median_decide_days(self) -> float | None:
        return round(median(self.decide_days), 1) if self.decide_days else None


@dataclass
class PersonTally(Tally):
    id: str = ""
    name: str = ""
    agency_id: str | None = None
    agency_name: str | None = None
    company_name: str | None = None
    closed_as: str | None = None  # ghosted | not_interested


@dataclass
class AgencyTally(Tally):
    id: str = ""
    name: str = ""
    people: int = 0


@dataclass
class PassReason:
    role_id: str
    role_title: str
    company_name: str
    person_name: str | None
    reason: str
    decided_on: date | None


@dataclass
class Conversations:
    total: Tally
    people: list[PersonTally]
    agencies: list[AgencyTally]
    pass_reasons: list[PassReason]
    people_talked_to: int  # people with a call held or a role pitched in the period


def _aware(when: datetime) -> datetime:
    return when if when.tzinfo else when.replace(tzinfo=UTC)


def _within(when: datetime, since: datetime | None, until: datetime | None) -> bool:
    when = _aware(when)
    return (since is None or when >= since) and (until is None or when < until)


def conversations(
    session: Session,
    workflow: Workflow,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
    now: datetime | None = None,
) -> Conversations:
    now = now or datetime.now(UTC)
    kinds = {s.id: s.kind for s in workflow.stages}
    ghosted_stages = set(workflow.reopen_from)

    total = Tally()
    people: dict[str, PersonTally] = {}
    contacts = {c.id: c for c in session.scalars(select(Contact))}
    agency_names = dict(session.execute(select(Agency.id, Agency.name)).all())
    company_names = dict(session.execute(select(Company.id, Company.name)).all())

    def person(contact_id: str) -> PersonTally:
        if contact_id not in people:
            c = contacts[contact_id]
            people[contact_id] = PersonTally(
                id=c.id,
                name=c.name,
                agency_id=c.agency_id,
                agency_name=agency_names.get(c.agency_id) if c.agency_id else None,
                company_name=company_names.get(c.company_id) if c.company_id else None,
                closed_as=c.closed_as,
            )
        return people[contact_id]

    # Calls, and their moves (a call waiting for a new time has started one, with its who).
    moves: dict[str, list[MeetingMove]] = defaultdict(list)
    for mv in session.scalars(select(MeetingMove)):
        moves[mv.meeting_id].append(mv)
    for m in session.scalars(select(Meeting)):
        if not _within(m.starts_at, since, until) or m.contact_id not in contacts:
            continue
        starts = _aware(m.starts_at)
        waiting = m.status == "scheduled" and m.needs_new_time_since is not None
        made = [mv for mv in moves[m.id] if mv.to_at is not None or waiting]
        for t in (total, person(m.contact_id)):
            if made:
                t.calls_moved += 1
                t.call_moves += len(made)
                for mv in made:
                    t.moves_by[mv.by if mv.by in WHO else "not_recorded"] += 1
            if m.status == "cancelled":
                t.calls_cancelled += 1
            elif m.status == "done":  # marked Happened: trust it, whatever its time
                t.calls_held += 1
                t.last_call = max(t.last_call or starts, starts)
            elif waiting:  # its old time isn't happening: neither held nor booked ahead
                t.calls_waiting += 1
            elif m.status == "scheduled" and starts > now:
                t.calls_booked += 1

    # Pitched roles, and how their applications went.
    roles = [
        r
        for r in session.scalars(select(Role).where(Role.contact_id.is_not(None)))
        if r.contact_id in contacts and _within(r.created_at, since, until)
    ]
    ids = [r.id for r in roles]
    apps: dict[str, list[Application]] = defaultdict(list)
    for a in session.scalars(select(Application).where(Application.role_id.in_(ids))):
        apps[a.role_id].append(a)
    app_ids = [a.id for group in apps.values() for a in group]
    interviewed = set(
        session.scalars(
            select(Interview.application_id).where(
                Interview.application_id.in_(app_ids), Interview.status != "cancelled"
            )
        )
    )
    offered = set(session.scalars(select(Offer.application_id).where(Offer.application_id.in_(app_ids))))
    # When each application was added: its first stage event, so backdated history counts.
    added: dict[str, datetime] = {}
    for app_id, at in session.execute(
        select(Event.application_id, Event.occurred_at).where(
            Event.application_id.in_(app_ids), Event.kind == STAGE_CHANGE, Event.from_stage.is_(None)
        )
    ):
        added[app_id] = min(added.get(app_id, _aware(at)), _aware(at))

    paths = stage_paths(session, app_ids)

    def added_at(a: Application) -> datetime:
        return added.get(a.id, _aware(a.created_at))

    def outcome(a: Application) -> str:
        kind = kinds.get(a.stage, "active")
        if a.id in offered or kind == "success":
            return "offer"
        if kind == "active":
            return "in_progress"
        return "ghosted" if a.stage in ghosted_stages else "closed"

    reasons: list[PassReason] = []
    for r in roles:
        mine = sorted(apps.get(r.id, []), key=added_at)
        targets = (total, person(r.contact_id))
        for t in targets:
            t.pitched += 1
        # As on the Roles page: interested (all still before Applied) is still deciding, and closed
        # before ever applying (withdrawn while interested) counts as passed.
        progress = (
            role_progress(workflow, [(a.stage, paths.get(a.id, []), a.applied_on is not None) for a in mine])
            if mine
            else None
        )
        if progress == "applied":
            best = min((outcome(a) for a in mine), key=OUTCOMES.index)
            days = (added_at(mine[0]) - _aware(r.created_at)).total_seconds() / 86_400
            for t in targets:
                t.applied += 1
                t.outcomes[best] += 1
                t.interviewed += any(a.id in interviewed for a in mine)
                t.decide_days.append(max(days, 0.0))
        elif progress == "closed":
            for t in targets:
                t.passed += 1
        elif r.decision == "passed":
            for t in targets:
                t.passed += 1
                if r.decided_on is not None:
                    t.decide_days.append(max((r.decided_on - _aware(r.created_at).date()).days, 0))
            if r.decision_reason and r.decision_reason.strip():
                reasons.append(
                    PassReason(
                        role_id=r.id,
                        role_title=r.title,
                        company_name=company_names.get(r.company_id, ""),
                        person_name=contacts[r.contact_id].name,
                        reason=r.decision_reason.strip(),
                        decided_on=r.decided_on,
                    )
                )
        else:
            for t in targets:
                t.deciding += 1

    agencies: dict[str, AgencyTally] = {}
    for p in people.values():
        if p.agency_id is None:
            continue
        a = agencies.setdefault(p.agency_id, AgencyTally(id=p.agency_id, name=p.agency_name or ""))
        a.people += 1
        for name in (
            "calls_held",
            "calls_booked",
            "calls_cancelled",
            "calls_waiting",
            "calls_moved",
            "call_moves",
            "pitched",
            "applied",
            "passed",
            "deciding",
            "interviewed",
        ):
            setattr(a, name, getattr(a, name) + getattr(p, name))
        for k, n in p.outcomes.items():
            a.outcomes[k] += n
        for k, n in p.moves_by.items():
            a.moves_by[k] += n
        a.decide_days.extend(p.decide_days)
        if p.last_call and (a.last_call is None or p.last_call > a.last_call):
            a.last_call = p.last_call

    def busiest(t: Tally, name: str):
        return (-t.pitched, -t.calls_held, name.lower())

    # Newest first, undated last; the same day by role title.
    reasons.sort(key=lambda p: p.role_title.lower())
    reasons.sort(key=lambda p: p.decided_on or date.min, reverse=True)
    return Conversations(
        total=total,
        people=sorted(people.values(), key=lambda p: busiest(p, p.name)),
        agencies=sorted(agencies.values(), key=lambda a: busiest(a, a.name)),
        pass_reasons=reasons,
        people_talked_to=sum(1 for p in people.values() if p.calls_held or p.pitched),
    )
