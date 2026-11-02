"""How your CVs and cover letters do: an A/B test across the versions you've sent.

*Applied* is the `applied` stage, or in a workflow without one, the first active stage after
the starting one. Each application you sent (it got to Applied, or was closed after it, or has
a document recorded against it) counts for every document version recorded as sent with it,
and once for each document. Applications with no CV recorded (or no cover letter) make a row
of their own, so you can compare with and without. One closed before it got to Applied (you
decided not to, or the role went) wasn't sent.

For each version, document and that row:
- **sent**: applications;
- **heard back**: any sign of life after applying: a move past Applied, a call, email or
  message logged (logged contact has no direction, so a chaser you sent counts too), a move to
  a closed stage that isn't yours (a rejection is a reply; Withdrawn, Declined and the
  `reopen_from` stages, Ghosted by default, aren't), or an interview round or offer;
- **interviewed**: got past the CV: reached a stage beyond Applied that isn't closed (a screen
  counts), or has an interview round that wasn't cancelled;
- **offers**: an offer recorded, or reached the `offer` stage or a success stage;
- **open** / **ghosted** / **closed**: where they are now;
- **reply days**: median days from applying (when it got to Applied; for one recorded at
  Applied from the start, its backdatable first stage) to the first sign of life.

Undone moves don't count, and nothing dated in the future does either. Rates are out of
`sent`; `interview_low` and `interview_high` are a 95% Wilson interval, so small numbers show
how unsure they are.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from statistics import median

from sqlalchemy import select
from sqlalchemy.orm import Session

from jat.db.models import Application, ApplicationDocument, Document, DocumentVersion, Event, Interview, Offer

from .applications import STAGE_CHANGE, _effective_moves, in_time_order, is_implied
from .insights import applied_rank, stage_rank
from .scorecard import CONTACT_KINDS, _added_at, call_moved
from .workflow import Workflow

KINDS = ("cv", "cover_letter", "other")
NOT_A_REPLY = frozenset({"withdrawn", "declined"})  # closing moves you make (besides reopen_from)


@dataclass
class Tally:
    sent: int = 0
    heard_back: int = 0
    interviewed: int = 0
    offers: int = 0
    open: int = 0
    ghosted: int = 0
    closed: int = 0
    reply_days: list[float] = field(default_factory=list)

    @property
    def median_reply_days(self) -> float | None:
        return round(median(self.reply_days), 1) if self.reply_days else None


@dataclass
class Version:
    id: str
    label: str
    created_at: datetime
    tally: Tally = field(default_factory=Tally)


@dataclass
class Doc:
    id: str
    name: str
    kind: str
    tally: Tally = field(default_factory=Tally)
    versions: list[Version] = field(default_factory=list)


@dataclass
class Kind:
    kind: str
    documents: list[Doc] = field(default_factory=list)
    none: Tally = field(default_factory=Tally)  # applications sent without one recorded


@dataclass
class Result:
    applications: int = 0
    kinds: list[Kind] = field(default_factory=list)


def wilson(successes: int, n: int, z: float = 1.96) -> tuple[float, float] | None:
    """A 95% confidence interval for a rate, sound even for small numbers."""
    if n == 0:
        return None
    p = successes / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return max(0.0, centre - half), min(1.0, centre + half)


@dataclass
class _Outcome:
    heard_back: bool
    interviewed: bool
    offer: bool
    now: str  # open | ghosted | closed
    reply_days: float | None


def applied_at(
    history: list[Event], kinds: dict[str, str], rank: dict[str, int], applied: int, now: datetime
) -> datetime | None:
    """When it got to Applied (or past it), or was closed after it; None if it never did."""
    first = next((ev for ev in history if ev.kind == STAGE_CHANGE and ev.from_stage is None), None)
    if (
        first is not None
        and first.to_stage
        and kinds.get(first.to_stage) != "closed"
        and rank.get(first.to_stage, -1) >= applied
    ):
        return first.occurred_at
    for ev in in_time_order(_effective_moves(history)):
        if ev.occurred_at > now or not ev.to_stage:
            continue
        if kinds.get(ev.to_stage) != "closed" and rank.get(ev.to_stage, -1) >= applied:
            return ev.occurred_at
        if kinds.get(ev.to_stage) == "closed" and rank.get(ev.from_stage or "", -1) >= applied:
            return ev.occurred_at
    return None


def _outcome(
    app: Application,
    history: list[Event],
    workflow: Workflow,
    *,
    sent_at: datetime,
    applied: int,
    rank: dict[str, int],
    interviewed: bool,
    offered: bool,
    now: datetime,
) -> _Outcome:
    kinds = {s.id: s.kind for s in workflow.stages}
    yours = NOT_A_REPLY | set(workflow.reopen_from)
    moves = [ev for ev in _effective_moves(history) if ev.occurred_at <= now]
    real_moves = [ev for ev in moves if not is_implied(ev)]  # the app's fill-ins aren't signs
    signs = [
        ev.occurred_at
        for ev in real_moves
        if ev.to_stage
        and (
            # Moving it to Applied (or before) is yours; past it, or a rejection, is theirs.
            (kinds.get(ev.to_stage) != "closed" and rank.get(ev.to_stage, -1) > applied)
            or (kinds.get(ev.to_stage) == "closed" and ev.to_stage not in yours)
        )
    ]
    signs += [ev.occurred_at for ev in history if ev.kind in CONTACT_KINDS and ev.occurred_at <= now]
    signs = [t for t in signs if t >= sent_at]
    reached = {ev.to_stage for ev in moves if ev.to_stage}
    first = next((ev.to_stage for ev in history if ev.kind == STAGE_CHANGE and ev.from_stage is None), None)
    if first:
        reached.add(first)
    past_cv = any(kinds.get(s) != "closed" and rank.get(s, -1) > applied for s in reached)
    offer = offered or any(s == "offer" or kinds.get(s) == "success" for s in reached)
    kind = kinds.get(app.stage, "active")
    return _Outcome(
        # A round or an offer means they replied, even if nothing else was logged.
        heard_back=bool(signs) or interviewed or past_cv or offer,
        interviewed=interviewed or past_cv,
        offer=offer,
        now="ghosted" if app.stage in workflow.reopen_from else ("closed" if kind == "closed" else "open"),
        reply_days=(min(signs) - sent_at).total_seconds() / 86_400 if signs else None,
    )


def _count(t: Tally, o: _Outcome) -> None:
    t.sent += 1
    t.heard_back += o.heard_back
    t.interviewed += o.interviewed
    t.offers += o.offer
    setattr(t, o.now, getattr(t, o.now) + 1)
    if o.reply_days is not None:
        t.reply_days.append(o.reply_days)


def performance(
    session: Session,
    workflow: Workflow,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
    route: str | None = None,
) -> Result:
    """Every document's versions, compared on the applications added in [since, until) (and by route)."""
    stmt = select(Application)
    if since is not None:
        stmt = stmt.where(Application.created_at >= since)
    if until is not None:
        stmt = stmt.where(Application.created_at < until)
    if route:
        stmt = stmt.where(Application.route == route)
    apps = {a.id: a for a in session.scalars(stmt)}
    ids = list(apps)

    history: dict[str, list[Event]] = defaultdict(list)
    sent: dict[str, set[str]] = defaultdict(set)  # application -> version ids
    interviewed: set[str] = set()
    offered: set[str] = set()
    if ids:
        for ev in session.scalars(
            select(Event)
            .where(Event.application_id.in_(ids), Event.kind.in_((STAGE_CHANGE, *CONTACT_KINDS)))
            .order_by(Event.seq)
        ):
            if not call_moved(ev):
                history[ev.application_id].append(ev)
        for app_id, version_id in session.execute(
            select(ApplicationDocument.application_id, ApplicationDocument.document_version_id).where(
                ApplicationDocument.application_id.in_(ids)
            )
        ):
            sent[app_id].add(version_id)
        interviewed = set(
            session.scalars(
                select(Interview.application_id).where(
                    Interview.application_id.in_(ids), Interview.status != "cancelled"
                )
            )
        )
        offered = set(session.scalars(select(Offer.application_id).where(Offer.application_id.in_(ids))))

    docs: dict[str, Doc] = {}
    versions: dict[str, tuple[Doc, Version]] = {}
    for d in session.scalars(select(Document).order_by(Document.name)):
        docs[d.id] = Doc(id=d.id, name=d.name, kind=d.kind)
    for v in session.scalars(select(DocumentVersion).order_by(DocumentVersion.created_at, DocumentVersion.id)):
        if (doc := docs.get(v.document_id)) is not None:
            version = Version(id=v.id, label=v.label, created_at=v.created_at)
            doc.versions.append(version)
            versions[v.id] = (doc, version)

    kinds = {k: Kind(kind=k) for k in KINDS}
    rank = stage_rank(workflow)
    applied = applied_rank(workflow, rank)
    stage_kinds = {st.id: st.kind for st in workflow.stages}
    now = datetime.now(UTC)
    result = Result()
    for app_id, app in apps.items():
        events = history[app_id]
        sent_at = applied_at(events, stage_kinds, rank, applied, now)
        if sent_at is None:
            if not sent[app_id]:
                continue  # not sent (still Interested, or closed before applying)
            sent_at = _added_at(app.created_at, events)  # a CV recorded: it went out
        o = _outcome(
            app,
            events,
            workflow,
            sent_at=sent_at,
            applied=applied,
            rank=rank,
            interviewed=app_id in interviewed,
            offered=app_id in offered,
            now=now,
        )
        result.applications += 1
        had: dict[str, set[str]] = defaultdict(set)  # kind -> document ids
        for version_id in sent[app_id]:
            if version_id not in versions:
                continue
            doc, version = versions[version_id]
            _count(version.tally, o)
            had[doc.kind].add(doc.id)
        for doc_ids in had.values():
            for doc_id in doc_ids:
                _count(docs[doc_id].tally, o)
        for kind in ("cv", "cover_letter"):
            if kind not in had:
                _count(kinds[kind].none, o)

    for doc in docs.values():
        kinds.get(doc.kind, kinds["other"]).documents.append(doc)
    for k in kinds.values():
        k.documents.sort(key=lambda d: (-d.tally.sent, d.name.lower()))
    result.kinds = [k for k in kinds.values() if k.documents or k.kind == "cv"]
    return result
