"""Every rejection's feedback in one place (Insights).

Every application with feedback is listed, whatever has happened since, so nothing you wrote drops
out of sight. Its rejection is the latest move to Rejected that still stands (not undone), by when
it happened (`in_time_order`): the date, and the stage it came from. Without one, an application
created at Rejected with nothing filled in before counts its creation. One whose move to Rejected was
undone has no rejection to date, so it's listed only when no period is asked for. A period goes by
the rejection's date, in [since, until).

Which round rejections came after (`by_round`) counts every application whose rejection stands,
feedback or not, by the same rule and period. The round it came after is the last one it *reached*
before that rejection: not cancelled, not waiting for a new time then, and its start (or a
take-home's deadline) at or before the rejection; or, with no start and no deadline yet passed,
marked done by then (a take-home handed in early). When it was marked done comes from its
timeline entries, else (added as done, or older data) from when it was added. So a round booked
for after the rejection, or marked done after it (say, after a reopening), doesn't count.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from jat.db.models import Application, Company, Contact, Event, Interview, Role

from .applications import STAGE_CHANGE, _effective_moves, in_time_order, is_implied
from .workflow import REJECTED


@dataclass
class Rejection:
    application_id: str
    company_id: str
    company_name: str
    role_title: str
    recruiter_id: str | None
    recruiter_name: str | None
    stage: str  # where it is now
    feedback: str
    rejected_at: datetime | None  # None: its move to Rejected was undone
    rejected_from: str | None
    added_at_rejected: bool  # added straight at Rejected: the stage before it was filled in, not real


def _in_period(when: datetime | None, since: datetime | None, until: datetime | None) -> bool:
    """Without a period, everything; with one, a rejection dated in [since, until) (an undone one has no date)."""
    if since is None and until is None:
        return True
    return when is not None and (since is None or when >= since) and (until is None or when < until)


def _stage_events(session: Session, ids: list[str]) -> dict[str, list[Event]]:
    """Each application's stage events, in the order they were recorded."""
    events: dict[str, list[Event]] = defaultdict(list)
    if ids:
        for ev in session.scalars(
            select(Event).where(Event.application_id.in_(ids), Event.kind == STAGE_CHANGE).order_by(Event.seq)
        ):
            events[ev.application_id].append(ev)
    return events


def standing_rejection(events: list[Event]) -> Event | None:
    """The latest move to Rejected that still stands, by when it happened. With none, it may have been
    created there with nothing filled in before (a workflow whose first stage is Rejected, or a row
    migration 0013 left alone): that's its rejection, and creation can't be undone."""
    moves = [ev for ev in in_time_order(_effective_moves(events)) if ev.to_stage == REJECTED]
    if moves:
        return moves[-1]
    return next((ev for ev in events if ev.from_stage is None and ev.to_stage == REJECTED), None)


def rejections(session: Session, *, since: datetime | None = None, until: datetime | None = None) -> list[Rejection]:
    """Applications with feedback, newest rejection first (undone ones last, most recently changed first)."""
    recruiter = aliased(Contact)
    rows = session.execute(
        select(Application, Role, Company, recruiter)
        .join(Role, Application.role_id == Role.id)
        .join(Company, Role.company_id == Company.id)
        .outerjoin(recruiter, Application.recruiter_id == recruiter.id)
        .where(Application.rejection_feedback.is_not(None))
    ).all()
    events = _stage_events(session, [app.id for app, *_ in rows])
    out: list[Rejection] = []
    for app, role, company, person in rows:
        last = standing_rejection(events[app.id])
        when = last.occurred_at if last else None
        if not _in_period(when, since, until):
            continue
        out.append(
            Rejection(
                application_id=app.id,
                company_id=company.id,
                company_name=company.name,
                role_title=role.title,
                recruiter_id=person.id if person else None,
                recruiter_name=person.name if person else None,
                stage=app.stage,
                feedback=app.rejection_feedback or "",
                rejected_at=when,
                rejected_from=last.from_stage if last else None,
                added_at_rejected=bool(last and (is_implied(last) or last.from_stage is None)),
            )
        )
    updated = {app.id: app.updated_at for app, *_ in rows}
    # Newest rejection first; then the undone ones, most recently changed first.
    out.sort(key=lambda r: (r.rejected_at is not None, r.rejected_at or updated[r.application_id]), reverse=True)
    return out


@dataclass
class ByRound:
    rejections: int = 0
    no_rounds: int = 0  # rejected before reaching any round
    unnumbered: int = 0  # came after a round with no number
    by_kind: Counter[str] = field(default_factory=Counter)  # the last round's kind
    by_number: Counter[int] = field(default_factory=Counter)  # the last round's number


def _done_at(round_: Interview, marked_done: list[datetime], rejected_at: datetime) -> datetime | None:
    """When a round now marked done was done, if that was by `rejected_at`: the latest time it was
    marked done (its timeline entries) at or before the rejection. One with no such entry (added as
    done before entries said so, or older data) goes by when it was added."""
    if round_.status != "done":
        return None
    if marked_done:
        return max((t for t in marked_done if t <= rejected_at), default=None)
    return round_.created_at if round_.created_at <= rejected_at else None


def _reached(round_: Interview, marked_done: list[datetime], rejected_at: datetime) -> datetime | None:
    """When the round was reached, if it was by `rejected_at` (see the module's docstring)."""
    if round_.status == "cancelled":
        return None
    # Waiting for a new time when you were turned down: it keeps its old time, but didn't go ahead.
    if round_.needs_new_time_since is not None and round_.needs_new_time_since <= rejected_at:
        return None
    if round_.starts_at is not None:
        return round_.starts_at if round_.starts_at <= rejected_at else None
    if round_.deadline_at is not None and round_.deadline_at <= rejected_at:
        return round_.deadline_at
    # No time, or a take-home due after the rejection: reached if it was marked done by then
    # (handed in early). One handed in after a reopening doesn't count against the first rejection.
    return _done_at(round_, marked_done, rejected_at)


def _marked_done(session: Session, app_ids: list[str]) -> dict[str, list[datetime]]:
    """Each round's times it was marked done (or added as done), from the application timelines."""
    out: dict[str, list[datetime]] = defaultdict(list)
    if not app_ids:
        return out
    for ev in session.scalars(select(Event).where(Event.application_id.in_(app_ids), Event.kind == "interview")):
        data = ev.data if isinstance(ev.data, dict) else {}
        if data.get("status") == "done" and isinstance(data.get("interview_id"), str):
            out[data["interview_id"]].append(ev.occurred_at)
    return out


def by_round(session: Session, *, since: datetime | None = None, until: datetime | None = None) -> ByRound:
    """Rejections that stand, in [since, until) by rejection date, by the last round reached before them."""
    rejected = select(Event.application_id).where(Event.kind == STAGE_CHANGE, Event.to_stage == REJECTED)
    events = _stage_events(session, list(session.scalars(rejected.distinct())))
    rounds: dict[str, list[Interview]] = defaultdict(list)
    if events:
        for r in session.scalars(select(Interview).where(Interview.application_id.in_(list(events)))):
            rounds[r.application_id].append(r)
    done = _marked_done(session, list(events))
    out = ByRound()
    for app_id, evs in events.items():
        last = standing_rejection(evs)
        if last is None or not _in_period(last.occurred_at, since, until):
            continue
        out.rejections += 1
        reached = [(when, r) for r in rounds[app_id] if (when := _reached(r, done[r.id], last.occurred_at)) is not None]
        if not reached:
            out.no_rounds += 1
            continue
        # The furthest round: the highest number, then the latest reached.
        _, final = max(reached, key=lambda wr: (wr[1].round or 0, wr[0]))
        out.by_kind[final.kind] += 1
        if final.round:
            out.by_number[final.round] += 1
        else:
            out.unnumbered += 1
    return out
