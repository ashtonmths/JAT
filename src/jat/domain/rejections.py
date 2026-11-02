"""Every rejection's feedback in one place (Insights).

Every application with feedback is listed, whatever has happened since, so nothing you wrote drops
out of sight. Its rejection is the latest move to Rejected that still stands (not undone), by when
it happened (`in_time_order`): the date, and the stage it came from. Without one, an application
created at Rejected with nothing filled in before counts its creation. One whose move to Rejected was
undone has no rejection to date, so it's listed only when no period is asked for. A period goes by
the rejection's date, in [since, until).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from jat.db.models import Application, Company, Contact, Event, Role

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
    ids = [app.id for app, *_ in rows]
    events: dict[str, list[Event]] = defaultdict(list)
    if ids:
        for ev in session.scalars(
            select(Event).where(Event.application_id.in_(ids), Event.kind == STAGE_CHANGE).order_by(Event.seq)
        ):
            events[ev.application_id].append(ev)
    out: list[Rejection] = []
    for app, role, company, person in rows:
        moves = [ev for ev in in_time_order(_effective_moves(events[app.id])) if ev.to_stage == REJECTED]
        # With no move to Rejected, it may have been created there with nothing filled in before (a
        # workflow whose first stage is Rejected, or a row migration 0013 left alone): that's its
        # rejection, and creation can't be undone.
        created = next((ev for ev in events[app.id] if ev.from_stage is None and ev.to_stage == REJECTED), None)
        last = moves[-1] if moves else created
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
