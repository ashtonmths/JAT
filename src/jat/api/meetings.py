"""Calls and meetings with people, booked or had, outside any one application."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import get_args

from fastapi import APIRouter, Response
from pydantic import AwareDatetime
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from ..db.models import Agency, Application, Company, Contact, Meeting, MeetingMove, Role
from ..domain import applications as app_svc
from . import schemas as S
from .crud import values
from .deps import SessionDep, get_or_404, require
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
    start of your local day; defaults to the start of today in UTC). `agency_id` and
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
        stmt = stmt.where(Meeting.status == "scheduled", Meeting.starts_at >= start.astimezone(UTC))
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


def _record_move(session: Session, meeting: Meeting, moved_from: datetime, by: str | None, reason: str) -> None:
    """Keep the move with the call, and, when the call is on an application, put it on that
    application's timeline as a round's move is: "Call with Alex Morgan rescheduled (they needed
    the change): why", saving the call's raw parts so a language can build its own name, and the
    move itself (`data.reschedule`, read like a round's)."""
    session.add(
        MeetingMove(meeting_id=meeting.id, from_at=moved_from, to_at=meeting.starts_at, by=by, reason=reason or None)
    )
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
    if booked and meeting.starts_at != before[1]:
        meeting.rescheduled_count = (meeting.rescheduled_count or 0) + 1
        meeting.rescheduled_from = before[1]
        _record_move(session, meeting, before[1], by, reason)
        session.flush()
    return _out(session, meeting.id)


@router.delete("/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: str, session: SessionDep):
    session.delete(get_or_404(session, Meeting, meeting_id))
    return Response(status_code=204)
