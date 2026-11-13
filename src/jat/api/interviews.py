"""API routes for interview rounds and coding tasks (PRD FR9, FR9a, FR10)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any, Literal

from fastapi import APIRouter, Response
from pydantic import AwareDatetime
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, aliased

from ..db.models import Application, Company, Contact, Event, Interview, InterviewContact, Role, Todo
from ..db.types import utcnow
from ..domain import applications as app_svc
from ..domain import interviews as svc
from ..domain import replies as reply_svc
from . import schemas as S
from .crud import values
from .deps import SessionDep, WorkflowDep, get_or_404
from .errors import CodedError

router = APIRouter(tags=["interviews"])

_WHEN = func.coalesce(Interview.starts_at, Interview.deadline_at, Interview.created_at)
Recruiter = aliased(Contact)


def _query():
    return (
        select(Interview, Role.title, Company.name, Recruiter.id, Recruiter.name)
        .join(Application, Interview.application_id == Application.id)
        .join(Role, Application.role_id == Role.id)
        .join(Company, Role.company_id == Company.id)
        .outerjoin(Recruiter, Application.recruiter_id == Recruiter.id)
    )


def _saved_moves(session: Session, app_ids: set[str]) -> dict[str, list[S.RoundMove]]:
    """Each round's moves with a readable record, in the order they were recorded."""
    moves: dict[str, list[S.RoundMove]] = {}
    if app_ids:
        events = session.execute(
            select(Event.kind, Event.data)
            .where(Event.kind == "interview", Event.application_id.in_(app_ids))
            .order_by(Event.seq)
        )
        for kind, data in events:
            move = S.read_round_move(kind, data)
            round_id = data.get("interview_id") if move is not None else None
            if isinstance(round_id, str):
                moves.setdefault(round_id, []).append(move)
    return moves


def _outs(session: Session, found) -> list[S.InterviewOut]:
    found = list(found)
    ids = [row[0].id for row in found]
    people: dict[str, list[str]] = {}
    if ids:
        links = session.execute(
            select(InterviewContact.interview_id, InterviewContact.contact_id)
            .where(InterviewContact.interview_id.in_(ids))
            .order_by(InterviewContact.id)
        )
        for interview_id, contact_id in links:
            people.setdefault(interview_id, []).append(contact_id)
    moves = _saved_moves(session, {row[0].application_id for row in found})
    return [
        S.InterviewOut(
            **{f: getattr(interview, f) for f in S.InterviewOut.model_fields if hasattr(Interview, f)},
            label=svc.label(interview),
            interviewer_ids=people.get(interview.id, []),
            moves=moves.get(interview.id, []),
            role_title=role_title,
            company_name=company_name,
            recruiter_id=recruiter_id,
            recruiter_name=recruiter_name,
        )
        for interview, role_title, company_name, recruiter_id, recruiter_name in found
    ]


def _out(session: Session, interview_id: str) -> S.InterviewOut:
    found = session.execute(_query().where(Interview.id == interview_id)).all()
    if not found:
        raise CodedError(404, f"Interview {interview_id} not found", "interview_not_found", {"id": interview_id})
    return _outs(session, found)[0]


def _set_interviewers(session: Session, interview: Interview, contact_ids: list[str]) -> None:
    unique = list(dict.fromkeys(contact_ids))
    known = set(session.scalars(select(Contact.id).where(Contact.id.in_(unique)))) if unique else set()
    missing = [c for c in unique if c not in known]
    if missing:
        detail = f"interviewer_ids: Contact {missing[0]} not found"
        raise CodedError(422, detail, "interviewer_not_found", {"id": missing[0]})
    session.execute(delete(InterviewContact).where(InterviewContact.interview_id == interview.id))
    session.add_all(InterviewContact(interview_id=interview.id, contact_id=c) for c in unique)


@router.get("/interviews", response_model=list[S.InterviewOut])
def list_interviews(
    session: SessionDep,
    application_id: str | None = None,
    status: S.InterviewStatus | None = None,
    upcoming: bool = False,
    since: AwareDatetime | None = None,
):
    """Interviews, soonest first.

    `upcoming` keeps scheduled ones from `since` on, plus those with no date yet, but not those
    waiting for a new time. Pass the start
    of your local day as `since`; it defaults to the start of today in UTC.
    """
    stmt = _query()
    if application_id:
        stmt = stmt.where(Interview.application_id == application_id)
    if status:
        stmt = stmt.where(Interview.status == status)
    if upcoming:
        start = since or datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        stmt = stmt.where(
            Interview.status == "scheduled",
            Interview.needs_new_time_since.is_(None),  # its time isn't happening
            (Interview.starts_at.is_(None) & Interview.deadline_at.is_(None))
            | (func.coalesce(Interview.starts_at, Interview.deadline_at) >= start.astimezone(UTC)),
        )
    return _outs(session, session.execute(stmt.order_by(_WHEN, Interview.round, Interview.id)))


@router.get("/interviews/titles", response_model=list[str])
def interview_titles(session: SessionDep):
    """Round descriptions used before, most used first: suggestions for the next one."""
    stmt = (
        select(Interview.title)
        .where(Interview.title.is_not(None), Interview.title != "")
        .group_by(Interview.title)
        .order_by(func.count().desc(), func.max(Interview.created_at).desc())
        .limit(50)
    )
    return list(session.scalars(stmt))


@router.post("/applications/{app_id}/interviews", response_model=S.InterviewOut, status_code=201)
def create_interview(app_id: str, body: S.InterviewIn, session: SessionDep, today: date | None = None):
    """Booking the next round means they got back to you: a wait to hear back that an earlier round's
    Done started (and that still stands as it set it) ends as heard back, from your `today`
    (YYYY-MM-DD; the server's if not given). A wait you set yourself is left alone."""
    app = get_or_404(session, Application, app_id)
    data = values(body, partial=False)
    interviewer_ids = data.pop("interviewer_ids")
    if data["round"] is None:
        data["round"] = svc.next_round(session, app_id)
    interview = Interview(application_id=app_id, **data)
    session.add(interview)
    session.flush()
    _set_interviewers(session, interview, interviewer_ids)
    svc.record(
        session, app, interview, {"scheduled": "scheduled", "done": "added", "cancelled": "cancelled"}[interview.status]
    )
    if interview.status == "scheduled" and svc.wait_set_by_done(session, app) is not None:
        _heard_back(session, app, today or date.today())
    return _out(session, interview.id)


def _heard_back(session: Session, app: Application, today: date) -> None:
    """The same as pressing Heard back: the reply counts towards the recruiter's reply times."""
    waited_since = app.awaiting_reply_since
    app.awaiting_reply_since = None
    if waited_since is not None:
        reply_svc.record(
            session, contact_id=app.recruiter_id, application_id=app.id, waited_since=waited_since, replied_on=today
        )
    app_svc.log_message(
        session, app, "manual", key="event.heardBack", params={}, summary="Heard back", data={"awaiting_reply": False}
    )


@router.get("/interviews/{interview_id}", response_model=S.InterviewOut)
def get_interview(interview_id: str, session: SessionDep):
    return _out(session, interview_id)


def _one_line(text: str | None) -> str:
    return " ".join((text or "").split())  # for the timeline


def _settle(session: Session, interview: Interview, todo: Literal["done", "delete"]) -> None:
    """The round no longer needs a new time. Its to-do to book one, if still open, is ticked off
    (there's nothing left to book). When the mark is taken back, the to-do is deleted instead, but
    only if it's just as it was made: one you've edited is yours, so it's ticked off. A to-do
    that's gone (deleted by hand) is simply skipped."""
    made = session.get(Todo, interview.rebook_todo_id) if interview.rebook_todo_id else None
    if made is not None and made.done_at is None:
        as_made = _pending_event(session, interview).get("rebook_todo")
        unchanged = isinstance(as_made, dict) and (made.id, made.text, made.due_on) == (
            as_made.get("id"),
            as_made.get("text"),
            _saved_day(as_made.get("due_on")),
        )
        if todo == "delete" and unchanged:
            session.delete(made)
        else:
            made.done_at = utcnow()
    interview.needs_new_time_since = None
    interview.needs_new_time_by = None
    interview.rebook_todo_id = None


def _pending_event(session: Session, interview: Interview) -> dict[str, Any]:
    """The data of this round's newest "needs a new time" entry: its record (`reschedule`: where it
    moved from, who and why) and the to-do it made, as made (`rebook_todo`)."""
    found = session.scalars(
        select(Event.data)
        .where(Event.kind == "interview", Event.application_id == interview.application_id)
        .order_by(Event.seq.desc())
    )
    for data in found:
        saved = data.get("reschedule") if isinstance(data, dict) and data.get("interview_id") == interview.id else None
        if isinstance(saved, dict) and saved.get("to") is None:
            return data
    return {}


def _pending_record(session: Session, interview: Interview) -> dict[str, Any]:
    """The newest "needs a new time" record of this round: where it moved from, and why."""
    saved = _pending_event(session, interview).get("reschedule")
    return saved if isinstance(saved, dict) else {}


def _saved_day(value: Any) -> date | None:
    try:
        return date.fromisoformat(value) if isinstance(value, str) else None
    except ValueError:
        return None


def _saved_time(value: Any) -> datetime | None:
    try:
        when = datetime.fromisoformat(value) if isinstance(value, str) else None
    except ValueError:
        return None
    return when if when is not None and when.utcoffset() is not None else None


@router.patch("/interviews/{interview_id}", response_model=S.InterviewOut)
def update_interview(
    interview_id: str, body: S.InterviewPatch, session: SessionDep, workflow: WorkflowDep, today: date | None = None
):
    """A new start for a round that needs one is the move it was waiting for: from its old time,
    with the who and why it was marked with (unless new ones are sent), and its to-do is ticked off.
    Cancelling such a round, or marking it done, ticks the to-do off too.

    Marking a round done starts waiting to hear back on its application, from your `today`
    (YYYY-MM-DD; the server's if not given), when nothing is left to come and nothing has been
    decided since (`wait_after_done` in domain/interviews.py has the rule). Taking the done back
    (Coming up or Cancelled) ends that wait again, if it still stands as the done set it."""
    interview = get_or_404(session, Interview, interview_id)
    data = values(body, partial=True)
    interviewer_ids = data.pop("interviewer_ids", None)
    reason = _one_line(data.pop("reschedule_reason", None))
    by = data.pop("reschedule_by", None)
    before = (interview.status, interview.starts_at, interview.ends_at)
    pending = interview.needs_new_time_since is not None
    for key, value in data.items():
        setattr(interview, key, value)
    session.flush()
    session.refresh(interview)  # stored values: times in UTC, whole seconds
    if interviewer_ids is not None:
        _set_interviewers(session, interview, interviewer_ids)
    app = session.get(Application, interview.application_id)
    if interview.status != before[0]:
        if pending:
            _settle(session, interview, "done")
        extra: dict[str, Any] = {}
        if interview.status == "done":
            if (since := svc.wait_after_done(session, workflow, app, today or date.today())) is not None:
                extra[svc.WAITING_SINCE] = since.isoformat()
        elif before[0] == "done" and svc.wait_set_by_done(session, app) == interview.id:
            app.awaiting_reply_since = None  # taken back, not a reply: no reply time, no Heard back
        svc.record(
            session,
            app,
            interview,
            {"scheduled": "back on", "done": "done", "cancelled": "cancelled"}[interview.status],
            extra=extra,
        )
    elif pending and interview.starts_at is not None and interview.starts_at != before[1]:
        saved = _pending_record(session, interview)
        moved_from = before[1] or _saved_time(saved.get("from"))
        by = by or interview.needs_new_time_by
        reason = reason or _one_line(saved.get("reason") if isinstance(saved.get("reason"), str) else None)
        interview.rescheduled_count = (interview.rescheduled_count or 0) + 1
        interview.rescheduled_from = moved_from
        if "ends_at" not in data and None not in (before[1], before[2]):  # it lasts as long as before
            interview.ends_at = before[2] + (interview.starts_at - before[1])
        _settle(session, interview, "done")
        session.flush()
        svc.record(session, app, interview, "rescheduled", reason=reason, by=by, moved_from=moved_from)
    elif (
        interview.status == "scheduled"
        and None not in (before[1], interview.starts_at)  # adding or clearing a time isn't a reschedule
        and interview.starts_at != before[1]
    ):
        interview.rescheduled_count = (interview.rescheduled_count or 0) + 1
        interview.rescheduled_from = before[1]
        if "ends_at" not in data and before[2] is not None:  # it lasts as long as before
            interview.ends_at = before[2] + (interview.starts_at - before[1])
        session.flush()
        svc.record(session, app, interview, "rescheduled", reason=reason, by=by, moved_from=before[1])
    return _out(session, interview.id)


@router.post("/interviews/{interview_id}/needs-new-time", response_model=S.InterviewOut)
def mark_needs_new_time(interview_id: str, body: S.NeedsNewTimeIn, session: SessionDep, workflow: WorkflowDep):
    """A booked round can't go ahead at its time, and no new time is agreed yet. It keeps its old
    time, its timeline says who needed the change and why, and with `todo` an open to-do on the
    application reminds you to book the new one. Setting the new time (PATCH `starts_at`) is the move.
    Not on a closed or archived application: there's nothing left to book there."""
    interview = get_or_404(session, Interview, interview_id)
    if interview.status != "scheduled" or interview.starts_at is None:
        raise CodedError(409, "only a booked round can need a new time", "round_not_booked")
    if interview.needs_new_time_since is not None:
        raise CodedError(409, "this round already needs a new time", "round_needs_new_time_already")
    app = session.get(Application, interview.application_id)
    kind = next((s.kind for s in workflow.stages if s.id == app.stage), "active")
    if app.archived or kind != "active":
        raise CodedError(
            409, "the application is closed or archived, so there's no new time to book", "round_application_closed"
        )
    interview.needs_new_time_since = utcnow()
    interview.needs_new_time_by = body.by
    interview.rebook_todo_id = None
    # The to-do as made, so taking the mark back deletes it only if you haven't changed it since.
    made: dict[str, Any] = {}
    if body.todo is not None:
        text = body.todo.text.strip()
        if not text:
            raise CodedError(422, "text: say what needs doing", "todo_text_required")
        todo = Todo(text=text, due_on=body.todo.due_on, entity_type="application", entity_id=app.id)
        session.add(todo)
        session.flush()
        interview.rebook_todo_id = todo.id
        due = todo.due_on.isoformat() if todo.due_on else None
        made = {"rebook_todo": {"id": todo.id, "text": todo.text, "due_on": due}}
    session.flush()
    svc.record(session, app, interview, "needs a new time", reason=_one_line(body.reason), by=body.by, extra=made)
    return _out(session, interview.id)


@router.delete("/interviews/{interview_id}/needs-new-time", response_model=S.InterviewOut)
def clear_needs_new_time(interview_id: str, session: SessionDep):
    """It can go ahead at its time after all, or you're undoing marking it: the round keeps its
    time, and the to-do made with the mark is deleted if it's still open and just as it was made
    (one you've edited is ticked off instead). The timeline keeps both entries, as with any undo."""
    interview = get_or_404(session, Interview, interview_id)
    if interview.needs_new_time_since is None:
        raise CodedError(409, "this round doesn't need a new time", "round_needs_new_time_not")
    _settle(session, interview, "delete")
    session.flush()
    svc.record(session, session.get(Application, interview.application_id), interview, "no longer needs a new time")
    return _out(session, interview.id)


@router.delete("/interviews/{interview_id}", status_code=204)
def delete_interview(interview_id: str, session: SessionDep):
    interview = get_or_404(session, Interview, interview_id)
    _settle(session, interview, "done")  # nothing left to book
    svc.record(session, session.get(Application, interview.application_id), interview, "removed")
    session.delete(interview)
    session.flush()
    return Response(status_code=204)
