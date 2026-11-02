"""Calls and meetings with people, booked or had, outside any one application."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal, get_args

from fastapi import APIRouter, Response
from pydantic import AwareDatetime
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from ..db.models import Agency, Application, Company, Contact, Meeting, MeetingMove, Role, Todo
from ..db.types import utcnow
from ..domain import applications as app_svc
from . import schemas as S
from .crud import values
from .deps import SessionDep, WorkflowDep, get_or_404, require
from .errors import CodedError

router = APIRouter(tags=["meetings"])

KIND_NAMES = {"call": "Call", "video": "Video call", "in_person": "Meeting"}

AppCompany = aliased(Company)


def label(meeting: Meeting, contact_name: str) -> str:
    """ "Call with Alex Morgan: market catch-up"."""
    what = f"{KIND_NAMES.get(meeting.kind, meeting.kind)} with {contact_name}"
    return f"{what}: {meeting.title}" if meeting.title else what


def query():
    return (
        select(Meeting, Contact, Agency, Company, Role.title, AppCompany.name)
        .join(Contact, Meeting.contact_id == Contact.id)
        .outerjoin(Agency, Contact.agency_id == Agency.id)
        .outerjoin(Company, Contact.company_id == Company.id)
        .outerjoin(Application, Meeting.application_id == Application.id)
        .outerjoin(Role, Application.role_id == Role.id)
        .outerjoin(AppCompany, Role.company_id == AppCompany.id)
    )


def _moves(session: Session, meeting_ids: list[str]) -> dict[str, list[S.CallMove]]:
    """Each call's moves, oldest first."""
    moves: dict[str, list[S.CallMove]] = {}
    if meeting_ids:
        found = session.scalars(
            select(MeetingMove)
            .where(MeetingMove.meeting_id.in_(meeting_ids))
            .order_by(MeetingMove.created_at, MeetingMove.id)
        )
        for move in found:
            by = move.by if move.by in get_args(S.RescheduleBy) else None  # a hand-edited export: not said
            moves.setdefault(move.meeting_id, []).append(
                S.CallMove(from_at=move.from_at, to_at=move.to_at, by=by, reason=move.reason or None)
            )
    return moves


def outs(session: Session, found) -> list[S.MeetingOut]:
    found = list(found)
    moves = _moves(session, [m.id for m, *_ in found])
    return [
        S.MeetingOut(
            **{f: getattr(m, f) for f in S.MeetingOut.model_fields if hasattr(Meeting, f)},
            moves=moves.get(m.id, []),
            label=label(m, contact.name),
            contact_name=contact.name,
            agency_id=agency.id if agency else None,
            agency_name=agency.name if agency else None,
            company_id=company.id if company else None,
            company_name=company.name if company else None,
            role_title=role_title,
            application_company_name=app_company,
        )
        for m, contact, agency, company, role_title, app_company in found
    ]


def _out(session: Session, meeting_id: str) -> S.MeetingOut:
    found = session.execute(query().where(Meeting.id == meeting_id)).all()
    if not found:
        raise CodedError(404, f"Meeting {meeting_id} not found", "meeting_not_found", {"id": meeting_id})
    return outs(session, found)[0]


def _check(session: Session, data: dict) -> None:
    if data.get("contact_id") is not None:
        require(session, Contact, data["contact_id"], "contact_id")
    if data.get("application_id") is not None:
        require(session, Application, data["application_id"], "application_id")
    starts, ends = data.get("starts_at"), data.get("ends_at")
    if starts and ends and ends < starts:
        raise CodedError(422, "ends_at: can't be before starts_at", "call_ends_before_start")


@router.get("/meetings", response_model=list[S.MeetingOut])
def list_meetings(
    session: SessionDep,
    contact_id: str | None = None,
    agency_id: str | None = None,
    company_id: str | None = None,
    application_id: str | None = None,
    status: S.InterviewStatus | None = None,
    upcoming: bool = False,
    since: AwareDatetime | None = None,
):
    """Calls and meetings, soonest first. `upcoming` keeps scheduled ones from `since` on (the
    start of your local day; defaults to the start of today in UTC), but not those waiting for a
    new time (their time isn't happening). `agency_id` and
    `company_id` match the person's agency or company."""
    stmt = query()
    if contact_id:
        stmt = stmt.where(Meeting.contact_id == contact_id)
    if agency_id:
        stmt = stmt.where(Contact.agency_id == agency_id)
    if company_id:
        stmt = stmt.where(Contact.company_id == company_id)
    if application_id:
        stmt = stmt.where(Meeting.application_id == application_id)
    if status:
        stmt = stmt.where(Meeting.status == status)
    if upcoming:
        start = since or datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        stmt = stmt.where(
            Meeting.status == "scheduled",
            Meeting.needs_new_time_since.is_(None),
            Meeting.starts_at >= start.astimezone(UTC),
        )
    return outs(session, session.execute(stmt.order_by(Meeting.starts_at, Meeting.id)))


@router.post("/meetings", response_model=S.MeetingOut, status_code=201)
def create_meeting(body: S.MeetingIn, session: SessionDep):
    data = values(body, partial=False)
    _check(session, data)
    meeting = Meeting(**data)
    session.add(meeting)
    session.flush()
    return _out(session, meeting.id)


@router.get("/meetings/{meeting_id}", response_model=S.MeetingOut)
def get_meeting(meeting_id: str, session: SessionDep):
    return _out(session, meeting_id)


# Who needed a call moved, as for a round: its message without and with a reason, and the words its summary says.
_RESCHEDULED_BY: dict[str, tuple[app_svc.EventMsgKey, app_svc.EventMsgKey, str]] = {
    "me": ("event.callRescheduledByMe", "event.callRescheduledByMeReason", "you needed the change"),
    "them": ("event.callRescheduledByThem", "event.callRescheduledByThemReason", "they needed the change"),
    "mutual": ("event.callRescheduledByMutual", "event.callRescheduledByMutualReason", "you both needed the change"),
    "neither": (
        "event.callRescheduledByNeither",
        "event.callRescheduledByNeitherReason",
        "not down to either of you",
    ),
}


def _record_move(
    session: Session,
    meeting: Meeting,
    moved_from: datetime,
    by: str | None,
    reason: str,
    started: MeetingMove | None = None,
) -> None:
    """Keep the move with the call (completing the one `started` when it needed a new time), and,
    when the call is on an application, put it on that application's timeline as a round's move is:
    "Call with Alex Morgan rescheduled (they needed the change): why", saving the call's raw parts
    so a language can build its own name, and the move itself (`data.reschedule`, read like a round's)."""
    row = started or MeetingMove(meeting_id=meeting.id, from_at=moved_from)
    row.to_at, row.by, row.reason = meeting.starts_at, by, reason or None
    session.add(row)
    app = session.get(Application, meeting.application_id) if meeting.application_id else None
    if app is None:
        return
    contact = session.get(Contact, meeting.contact_id)
    key, params, summary = move_message(meeting, contact.name, by, reason)
    move = {"from": moved_from.isoformat(), "to": meeting.starts_at.isoformat(), "by": by, "reason": reason or None}
    data = {"meeting_id": meeting.id, "status": meeting.status, "reschedule": move}
    app_svc.log_message(session, app, "call", key=key, params=params, summary=summary, data=data)


def move_message(
    meeting: Meeting, contact_name: str, by: str | None, reason: str | None
) -> tuple[app_svc.EventMsgKey, dict[str, str | int | None], str]:
    """A call's move in words: its message key and raw parts, and the English, "Call with Alex
    Morgan rescheduled (they needed the change): why". A `by` the app doesn't know is left unsaid."""
    params: dict[str, str | int | None] = {"kind": meeting.kind, "title": meeting.title, "contact_name": contact_name}
    key: app_svc.EventMsgKey = "event.callRescheduled"
    reason_key: app_svc.EventMsgKey = "event.callRescheduledReason"
    summary = f"{label(meeting, contact_name)} rescheduled"
    if by in _RESCHEDULED_BY:
        key, reason_key, words = _RESCHEDULED_BY[by]
        summary = f"{summary} ({words})"
    if reason:
        key = reason_key
        params["reason"] = reason
        summary = f"{summary}: {reason}"
    return key, params, summary


@router.patch("/meetings/{meeting_id}", response_model=S.MeetingOut)
def update_meeting(meeting_id: str, body: S.MeetingPatch, session: SessionDep):
    """A new start for a booked call is a reschedule, counted as a round's is: it keeps its length
    (unless `ends_at` is sent too), and the move keeps its old and new time, `reschedule_by` and
    `reschedule_reason`. A change of status in the same PATCH isn't a move."""
    meeting = get_or_404(session, Meeting, meeting_id)
    data = values(body, partial=True)
    reason = " ".join((data.pop("reschedule_reason", None) or "").split())  # one line, for the timeline
    by = data.pop("reschedule_by", None)
    before = (meeting.status, meeting.starts_at)
    booked = before[0] == data.get("status", before[0]) == "scheduled"
    if booked and data.get("starts_at") and "ends_at" not in data and meeting.ends_at is not None:
        data["ends_at"] = meeting.ends_at + (data["starts_at"] - meeting.starts_at)  # it lasts as long as before
    _check(session, {"starts_at": meeting.starts_at, "ends_at": meeting.ends_at, **data})
    for field, value in data.items():
        setattr(meeting, field, value)
    session.flush()
    session.refresh(meeting)  # stored values: times in UTC, whole seconds
    pending = _pending_move(session, meeting) if meeting.needs_new_time_since is not None else None
    if meeting.status != before[0] and meeting.needs_new_time_since is not None:
        _settle(session, meeting, "done", pending)  # it happened or it won't: nothing left to book
    elif booked and meeting.starts_at != before[1]:
        meeting.rescheduled_count = (meeting.rescheduled_count or 0) + 1
        meeting.rescheduled_from = before[1]
        if pending is not None:  # the move it was waiting for, with the who and why it was marked with
            by = by or pending.by
            reason = reason or pending.reason or ""
            _settle(session, meeting, "done", None)
        _record_move(session, meeting, before[1], by, reason, pending)
        session.flush()
    return _out(session, meeting.id)


def _pending_move(session: Session, meeting: Meeting) -> MeetingMove | None:
    """The move a call waiting for a new time has started: its old time, who and why, and no new time."""
    return session.scalars(
        select(MeetingMove)
        .where(MeetingMove.meeting_id == meeting.id, MeetingMove.to_at.is_(None))
        .order_by(MeetingMove.created_at.desc(), MeetingMove.id.desc())
    ).first()


def _settle(session: Session, meeting: Meeting, todo: Literal["done", "delete"], drop: MeetingMove | None) -> None:
    """The call no longer needs a new time, as a round's `_settle`: its to-do to book one, if still
    open, is ticked off, or deleted when the mark is taken back and it's as it was made (made and
    last changed at the same moment; one you've edited is yours, so it's ticked off). A to-do
    deleted by hand is skipped. `drop` is the started move, when the call didn't move after all."""
    made = session.get(Todo, meeting.rebook_todo_id) if meeting.rebook_todo_id else None
    if made is not None and made.done_at is None:
        if todo == "delete" and made.updated_at == made.created_at:
            session.delete(made)
        else:
            made.done_at = utcnow()
    if drop is not None:
        session.delete(drop)
    meeting.needs_new_time_since = None
    meeting.needs_new_time_by = None
    meeting.rebook_todo_id = None


def _refuse_if_over(session: Session, meeting: Meeting, workflow) -> None:
    """There's no new time to book for a call whose application is closed or archived, or whose
    person's conversation is closed (ghosted or not interested)."""
    app = session.get(Application, meeting.application_id) if meeting.application_id else None
    if app is not None:
        kind = next((s.kind for s in workflow.stages if s.id == app.stage), "active")
        if app.archived or kind != "active":
            raise CodedError(
                409, "the application is closed or archived, so there's no new time to book", "call_application_closed"
            )
    if session.get(Contact, meeting.contact_id).closed_as:
        raise CodedError(
            409, "the conversation with them is closed, so there's no new time to book", "call_person_closed"
        )


@router.post("/meetings/{meeting_id}/needs-new-time", response_model=S.MeetingOut)
def mark_needs_new_time(meeting_id: str, body: S.NeedsNewTimeIn, session: SessionDep, workflow: WorkflowDep):
    """A booked call can't go ahead at its time, and no new time is agreed yet. It keeps its old
    time, the started move keeps who needed the change and why, and with `todo` an open to-do
    reminds you to book the new one: on the call's application, or else on its person. Setting the
    new time (PATCH `starts_at`) is the move."""
    meeting = get_or_404(session, Meeting, meeting_id)
    if meeting.status != "scheduled":
        raise CodedError(409, "only a booked call can need a new time", "call_not_booked")
    if meeting.needs_new_time_since is not None:
        raise CodedError(409, "this call already needs a new time", "call_needs_new_time_already")
    _refuse_if_over(session, meeting, workflow)
    reason = " ".join((body.reason or "").split()) or None
    meeting.needs_new_time_since = utcnow()
    meeting.needs_new_time_by = body.by
    meeting.rebook_todo_id = None
    if body.todo is not None:
        text = body.todo.text.strip()
        if not text:
            raise CodedError(422, "text: say what needs doing", "todo_text_required")
        about = ("application", meeting.application_id) if meeting.application_id else ("contact", meeting.contact_id)
        now = utcnow()  # made and last changed together: so Undo can tell it hasn't been edited
        todo = Todo(text=text, due_on=body.todo.due_on, entity_type=about[0], entity_id=about[1])
        todo.created_at = todo.updated_at = now
        session.add(todo)
        session.flush()
        meeting.rebook_todo_id = todo.id
    session.add(MeetingMove(meeting_id=meeting.id, from_at=meeting.starts_at, to_at=None, by=body.by, reason=reason))
    session.flush()
    return _out(session, meeting.id)


@router.delete("/meetings/{meeting_id}/needs-new-time", response_model=S.MeetingOut)
def clear_needs_new_time(meeting_id: str, session: SessionDep):
    """It can go ahead at its time after all, or you're undoing marking it: the call keeps its time,
    the started move is dropped, and the to-do made with the mark is deleted if it's still open and
    unchanged (one you've edited is ticked off instead)."""
    meeting = get_or_404(session, Meeting, meeting_id)
    if meeting.needs_new_time_since is None:
        raise CodedError(409, "this call doesn't need a new time", "call_needs_new_time_not")
    _settle(session, meeting, "delete", _pending_move(session, meeting))
    session.flush()
    return _out(session, meeting.id)


@router.delete("/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: str, session: SessionDep):
    meeting = get_or_404(session, Meeting, meeting_id)
    _settle(session, meeting, "done", None)  # nothing left to book
    session.delete(meeting)
    return Response(status_code=204)
