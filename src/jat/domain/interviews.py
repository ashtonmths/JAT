"""Interview rounds (PRD FR9, FR9a, FR10).

Each interview for an application is a numbered round with Kai's own description of it:
"Round 2 · Engineering manager chat". The board and list show the application's current round:
the next one still to happen, or, once they have all happened, the latest one.
"""

from collections.abc import Iterable
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, load_only

from jat.db.models import Application, Event, Interview, Offer

from . import applications as svc
from .workflow import Workflow

KIND_NAMES = {
    "screen": "Screen",
    "hiring_manager": "Hiring manager",
    "technical": "Technical",
    "coding_task": "Coding task",
    "system_design": "System design",
    "pairing": "Pairing",
    "behavioural": "Behavioural",
    "onsite": "Onsite",
    "final": "Final",
    "other": "Interview",
}


def label(interview: Interview) -> str:
    """A label such as "Round 2 · System design test"; the kind stands in for a missing description."""
    what = interview.title or KIND_NAMES.get(interview.kind, interview.kind)
    return f"Round {interview.round} · {what}" if interview.round else what


def next_round(session: Session, application_id: str) -> int:
    highest = session.scalar(select(func.max(Interview.round)).where(Interview.application_id == application_id))
    return (highest or 0) + 1


def _when(interview: Interview) -> datetime:
    return interview.starts_at or interview.deadline_at or interview.created_at


def booked_ahead(session: Session, application_ids: Iterable[str], now: datetime) -> set[str]:
    """Applications with any round still scheduled for a time that hasn't come yet, or waiting for a
    new time: that one is on Today's Your move already, so the application hasn't gone quiet."""
    ids = list(set(application_ids))
    if not ids:
        return set()
    when = func.coalesce(Interview.starts_at, Interview.deadline_at)
    stmt = select(Interview.application_id).where(
        Interview.application_id.in_(ids),
        Interview.status == "scheduled",
        (when >= now) | Interview.needs_new_time_since.is_not(None),
    )
    return set(session.scalars(stmt))


def current_rounds(session: Session, application_ids: Iterable[str]) -> dict[str, Interview]:
    """For each application: the next scheduled round, else the latest round that happened."""
    ids = list(set(application_ids))
    if not ids:
        return {}
    by_app: dict[str, list[Interview]] = {}
    # Only what the summary needs: prep, debrief and questions can be long.
    columns = load_only(
        Interview.application_id,
        Interview.round,
        Interview.title,
        Interview.kind,
        Interview.status,
        Interview.starts_at,
        Interview.deadline_at,
        Interview.created_at,
        Interview.updated_at,
        Interview.needs_new_time_since,
        Interview.needs_new_time_by,
    )
    for interview in session.scalars(select(Interview).options(columns).where(Interview.application_id.in_(ids))):
        by_app.setdefault(interview.application_id, []).append(interview)
    out: dict[str, Interview] = {}
    for app_id, interviews in by_app.items():
        upcoming = [i for i in interviews if i.status == "scheduled"]
        if upcoming:
            out[app_id] = min(upcoming, key=_order)
            continue
        happened = [i for i in interviews if i.status == "done"]
        if happened:
            out[app_id] = max(happened, key=_order)
    return out


def _order(interview: Interview) -> tuple[int, datetime, str]:
    return (interview.round or 0, _when(interview), interview.id)


def _marked_done_at(events: list[Event], interview_id: str) -> datetime | None:
    """When a round was last marked done, from its timeline entries as recorded (each saves the round's
    status then): the first entry saying done since the last one that didn't. Later edits of a done
    round don't move it. None for a round with no such entry."""
    done_at: datetime | None = None
    for event in sorted(events, key=lambda e: e.seq):  # the order they were recorded in
        data = event.data or {}
        if data.get("interview_id") != interview_id:
            continue
        done_at = (done_at or event.occurred_at) if data.get("status") == "done" else None
    return done_at


def _happened_at(interview: Interview, events: list[Event]) -> datetime:
    """When a done round happened: its time, or when it was marked done if that's earlier (a take-home
    handed in before its deadline) or it has no time (it was never booked). Without a timeline entry
    for that, when it was last saved stands in."""
    done_at = _marked_done_at(events, interview.id) or interview.updated_at
    when = interview.starts_at or interview.deadline_at
    return min(when, done_at) if when else done_at


def waiting_to_hear_back(session: Session, current: dict[str, Interview], stages: dict[str, str]) -> set[str]:
    """Applications whose current round is done with nothing heard since: "Waiting to hear back".

    The rule: the current round is done (so no round is still to come; `current_rounds` picks a
    scheduled one first), and since it happened there's been no decision. A decision is any of
      - a stage move: the application's stage now isn't the one it was at when the round happened
        (a move that was undone, or moved away and back, leaves it the same, so it still waits);
        a rejection, a withdrawal and an accepted offer are moves too;
      - an offer recorded after the round;
      - a later round, even a cancelled one (a booked one would be the current round instead).
    `stages` is each application's stage now, by id. An application whose current round isn't done
    (booked, not booked yet, or waiting for a new time) is never in the result.
    """
    done = {app_id: i for app_id, i in current.items() if i.status == "done" and app_id in stages}
    if not done:
        return set()
    ids = list(done)
    moves: dict[str, list[Event]] = {}  # stage moves
    stmt = (
        select(Event)
        .options(
            load_only(Event.application_id, Event.occurred_at, Event.seq, Event.from_stage, Event.to_stage, Event.data)
        )
        .where(Event.application_id.in_(ids), Event.kind.in_((svc.STAGE_CHANGE, "interview")))
        .order_by(Event.occurred_at, Event.seq)
    )
    rounds: dict[str, list[Event]] = {}  # the rounds' own timeline entries
    for event in session.scalars(stmt):
        into = moves if event.kind == svc.STAGE_CHANGE else rounds
        into.setdefault(event.application_id, []).append(event)
    offers: dict[str, list[datetime]] = {}
    for app_id, created in session.execute(
        select(Offer.application_id, Offer.created_at).where(Offer.application_id.in_(ids))
    ):
        offers.setdefault(app_id, []).append(created)
    cancelled: dict[str, list[Interview]] = {}
    columns = load_only(
        Interview.application_id, Interview.round, Interview.starts_at, Interview.deadline_at, Interview.created_at
    )
    for interview in session.scalars(
        select(Interview).options(columns).where(Interview.application_id.in_(ids), Interview.status == "cancelled")
    ):
        cancelled.setdefault(interview.application_id, []).append(interview)

    out: set[str] = set()
    for app_id, interview in done.items():
        at = _happened_at(interview, rounds.get(app_id, []))
        if any(created > at for created in offers.get(app_id, [])):
            continue
        if any(_order(other) > _order(interview) for other in cancelled.get(app_id, [])):
            continue
        if _stage_at(moves.get(app_id, []), at) not in (None, stages[app_id]):
            continue
        out.add(app_id)
    return out


def _stage_at(moves: list[Event], at: datetime) -> str | None:
    """The stage an application was at, at a time, from its stage moves in order (None if it has none)."""
    before = [m for m in moves if m.occurred_at <= at]
    if before:
        return before[-1].to_stage
    # Added after the round (filled in afterwards): the stage it was added at. One added at a later
    # stage than the first has the app's own filled-in steps to it (`svc.is_implied`).
    added = [m for m in moves if m.from_stage is None or svc.is_implied(m)]
    if added:
        return added[-1].to_stage
    return moves[0].from_stage if moves else None


# A round marked done that started the application's wait to hear back saves the day it did in
# its timeline entry, so a later change can tell that wait from one you set yourself.
WAITING_SINCE = "waiting_since"


def wait_after_done(session: Session, workflow: Workflow, app: Application, today: date) -> date | None:
    """Marking a round done starts waiting to hear back, from `today`, when the application is
    open (an active stage, not archived), isn't already waiting or holding a reply to read, and
    `waiting_to_hear_back` agrees: no round is still to come (booked, undated or waiting for a new
    time) and nothing has been decided since. Never touches a wait or reply already there.
    Returns the day it set, or None if it set nothing."""
    if app.archived or app.awaiting_reply_since is not None or app.reply_to_read_since is not None:
        return None
    if not (workflow.has(app.stage) and workflow.stage(app.stage).is_active):
        return None
    if app.id not in waiting_to_hear_back(session, current_rounds(session, [app.id]), {app.id: app.stage}):
        return None
    app.awaiting_reply_since = today
    return today


def wait_set_by_done(session: Session, app: Application) -> str | None:
    """The round whose being marked done started the application's wait, if that wait still stands
    just as it was set: the same day, no reply to read, and since then no waiting change of yours
    (I've replied, Heard back, They've replied, Read it) and no stage move. Else None."""
    if app.awaiting_reply_since is None or app.reply_to_read_since is not None:
        return None
    found = session.scalars(
        select(Event)
        .options(load_only(Event.kind, Event.data))
        .where(Event.application_id == app.id, Event.kind.in_(("interview", "manual", svc.STAGE_CHANGE)))
        .order_by(Event.seq.desc())
    )
    for event in found:
        data = event.data or {}
        if event.kind == "interview" and WAITING_SINCE in data:
            set_on, round_id = data.get(WAITING_SINCE), data.get("interview_id")
            same = set_on == app.awaiting_reply_since.isoformat() and isinstance(round_id, str)
            return round_id if same else None
        if event.kind == svc.STAGE_CHANGE or "awaiting_reply" in data or "reply_to_read" in data:
            return None
    return None


_MESSAGES: dict[str, svc.EventMsgKey] = {
    "scheduled": "event.roundScheduled",
    "added": "event.roundAdded",
    "cancelled": "event.roundCancelled",
    "back on": "event.roundBackOn",
    "done": "event.roundDone",
    "removed": "event.roundRemoved",
    "rescheduled": "event.roundRescheduled",
    "no longer needs a new time": "event.roundNewTimeNotNeeded",
}

# A round that can't go ahead at its time, with no new one yet: by who (always said), without and with a reason.
_NEEDS_NEW_TIME_BY: dict[str, tuple[svc.EventMsgKey, svc.EventMsgKey]] = {
    "me": ("event.roundNeedsNewTimeByMe", "event.roundNeedsNewTimeByMeReason"),
    "them": ("event.roundNeedsNewTimeByThem", "event.roundNeedsNewTimeByThemReason"),
    "mutual": ("event.roundNeedsNewTimeByMutual", "event.roundNeedsNewTimeByMutualReason"),
    "neither": ("event.roundNeedsNewTimeByNeither", "event.roundNeedsNewTimeByNeitherReason"),
}


# Who needed a reschedule: its message, its message with a reason, and the words its summary says.
_RESCHEDULED_BY: dict[str, tuple[svc.EventMsgKey, svc.EventMsgKey, str]] = {
    "me": ("event.roundRescheduledByMe", "event.roundRescheduledByMeReason", "you needed the change"),
    "them": ("event.roundRescheduledByThem", "event.roundRescheduledByThemReason", "they needed the change"),
    "mutual": ("event.roundRescheduledByMutual", "event.roundRescheduledByMutualReason", "you both needed the change"),
    "neither": (
        "event.roundRescheduledByNeither",
        "event.roundRescheduledByNeitherReason",
        "not down to either of you",
    ),
}


def record(
    session: Session,
    app: Application,
    interview: Interview,
    what: str,
    reason: str = "",
    by: str | None = None,
    moved_from: datetime | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Put an interview change on the application's timeline ("Round 2 · System design test scheduled").

    The message saves the label's raw parts, not the English label, so a language can build its own
    (`roundLabel` in the frontend's utils/rounds.ts matches `label` above). A reschedule also saves
    `data.reschedule`: this move's own old and new time, who and why (null when not said), so a
    round's history keeps every move. Entries from before this have none of it.

    "needs a new time" (who is required) saves `data.reschedule` with `to` null: the move has started
    and has no new time yet. Setting that time later saves a whole move, from the old time.
    """
    params: dict[str, str | int | None] = {"round": interview.round, "title": interview.title, "kind": interview.kind}
    pending = what == "needs a new time"
    key = _MESSAGES["rescheduled" if pending else what]  # pending: replaced by who, below
    reason_key: svc.EventMsgKey = "event.roundRescheduledReason"
    summary = f"{label(interview)} {what}"
    if by:
        key, reason_key, words = _RESCHEDULED_BY[by]
        if pending:
            key, reason_key = _NEEDS_NEW_TIME_BY[by]
        summary = f"{summary} ({words})"
    elif pending:
        raise ValueError("a round needing a new time says who needed the change")
    if reason:
        key = reason_key
        params["reason"] = reason
        summary = f"{summary}: {reason}"
    data: dict[str, Any] = {"interview_id": interview.id, "round": interview.round, "status": interview.status}
    if pending:
        data["reschedule"] = {
            "from": interview.starts_at.isoformat() if interview.starts_at else None,
            "to": None,
            "by": by,
            "reason": reason or None,
        }
    elif moved_from and interview.starts_at:
        data["reschedule"] = {
            "from": moved_from.isoformat(),
            "to": interview.starts_at.isoformat(),
            "by": by,
            "reason": reason or None,
        }
    svc.log_message(session, app, "interview", key=key, params=params, summary=summary, data={**data, **(extra or {})})
