"""How applications flow through the stages (PRD FR19), from the event history.

Each application's path is its first stage and then every stage move that wasn't undone, in
the order they happened. A Sankey diagram can't draw loops, so paths are folded forwards in
workflow order (active stages, then success and closed ones): a move back to an earlier stage
counts as staying at the furthest stage reached. A closed stage that was reopened (Ghosted, and
then they came back) is left out, so the application is drawn along where it really went. The
history itself is untouched; this is only how the picture is drawn.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from jat.db.models import Application, Event, Interview, Role
from jat.db.types import utcnow

from .applications import STAGE_CHANGE, _effective_moves, in_time_order, is_implied
from .rejections import _marked_done, _reached
from .workflow import Workflow


@dataclass
class Flow:
    applications: int = 0
    reached: Counter[str] = field(default_factory=Counter)  # stage -> applications that got there
    links: Counter[tuple[str, str]] = field(default_factory=Counter)  # (from, to) -> applications
    current: Counter[str] = field(default_factory=Counter)  # where they are now (folded)


def closed_stages(workflow: Workflow) -> frozenset[str]:
    return frozenset(s.id for s in workflow.stages if s.kind == "closed")


def stage_rank(workflow: Workflow) -> dict[str, int]:
    """Active stages in workflow order first, then success, then closed: a left-to-right order."""
    order = [s for s in workflow.stages if s.is_active]
    order += [s for s in workflow.stages if s.kind == "success"]
    order += [s for s in workflow.stages if s.kind == "closed"]
    return {s.id: i for i, s in enumerate(order)}


def applied_rank(workflow: Workflow, rank: dict[str, int]) -> int:
    """Where *Applied* is: the `applied` stage, or the first active stage after the start."""
    if "applied" in rank:
        return rank["applied"]
    active = [st.id for st in workflow.stages if st.is_active]
    after = active[active.index(workflow.initial) + 1 :] if workflow.initial in active else active
    return rank[after[0]] if after else rank.get(workflow.initial, 0)


def before_applied(workflow: Workflow, stage: str) -> bool:
    """An open stage before Applied (Interested, say): you're interested but haven't applied."""
    rank = stage_rank(workflow)
    kinds = {st.id: st.kind for st in workflow.stages}
    return kinds.get(stage) == "active" and rank.get(stage, len(rank)) < applied_rank(workflow, rank)


def role_progress(workflow: Workflow, apps: list[tuple[str, list[str], bool]]) -> str:
    """How far a role's applications got, from each one's (current stage, stage path, whether it
    has an applied date):

    - `applied`: one got to Applied or further at some point (or was recorded straight at a
      closed stage with an applied date: a past application you logged as Rejected);
    - `interested`: none has, and one is still in an open stage before Applied;
    - `closed`: none has, and every one is closed (withdrawn while only interested, say).

    An application with no stage history counts as its current stage.
    """
    rank = stage_rank(workflow)
    applied = applied_rank(workflow, rank)
    kinds = {st.id: st.kind for st in workflow.stages}

    def got_there(stage: str) -> bool:
        return kinds.get(stage) != "closed" and rank.get(stage, applied) >= applied

    for stage, path, has_applied_on in apps:
        path = path or [stage]
        if any(got_there(st) for st in path) or (kinds.get(path[0]) == "closed" and has_applied_on):
            return "applied"
    if all(kinds.get(stage) == "closed" for stage, _, _ in apps):
        return "closed"
    if all(kinds.get(stage) == "closed" or before_applied(workflow, stage) for stage, _, _ in apps):
        return "interested"
    return "applied"  # a stage the workflow no longer has: assume the furthest


def stage_paths(session: Session, app_ids: list[str]) -> dict[str, list[str]]:
    """Each application's stage path (first stage, then moves not undone), for role_progress.

    A first stage the app filled in is left out: the path starts where you started it.
    """
    events: dict[str, list[Event]] = {i: [] for i in app_ids}
    if app_ids:
        for ev in session.scalars(
            select(Event).where(Event.application_id.in_(app_ids), Event.kind == STAGE_CHANGE).order_by(Event.seq)
        ):
            events[ev.application_id].append(ev)
    return {i: stage_path(evs, implied=False) for i, evs in events.items()}


def stage_path(events: list[Event], *, implied: bool = True) -> list[str]:
    """First stage, then the stages moved to (undone moves left out), in time order.

    `implied=False` leaves out a first stage the app filled in (see `create_application`).
    """
    stage_events = [ev for ev in events if ev.kind == STAGE_CHANGE]
    first = next((ev for ev in stage_events if ev.from_stage is None), None)
    if first is None or first.to_stage is None:
        return []
    moves = in_time_order(_effective_moves(events))
    path = [first.to_stage, *(ev.to_stage for ev in moves if ev.to_stage)]
    return path[1:] if not implied and is_implied(first) and len(path) > 1 else path


def fold_forward(path: list[str], rank: dict[str, int], closed: frozenset[str] = frozenset()) -> list[str]:
    """Keep only moves to a later stage, so the flow has no loops (unknown stages go last).

    `closed` stages count only where the path ends: one that was reopened is skipped.
    """
    last = len(rank)
    folded: list[str] = []
    for i, stage in enumerate(path):
        if stage in closed and i < len(path) - 1:
            continue
        if not folded or rank.get(stage, last) > rank.get(folded[-1], last):
            folded.append(stage)
    return folded


ROUND = "#round-"  # a round node's id: "<stage id>#round-<n>", as the board names its round columns


def interviewing_stage(workflow: Workflow, path: list[str]) -> str | None:
    """The stage rounds are drawn after: the first active stage in the path whose id says "interview"
    (names are yours, and may be in any language). The board splits every such stage; a flow has one
    place for the rounds, so only the first is split here."""
    active = {s.id for s in workflow.stages if s.is_active}
    return next((s for s in path if s in active and "interview" in s.lower()), None)


class Rounds:
    """Each application's rounds and when they were marked done, to expand Interviewing into them."""

    def __init__(self, session: Session, app_ids: list[str]) -> None:
        self.by_app: dict[str, list[Interview]] = {i: [] for i in app_ids}
        if app_ids:
            for r in session.scalars(select(Interview).where(Interview.application_id.in_(app_ids))):
                self.by_app[r.application_id].append(r)
        self.done = _marked_done(session, app_ids)

    def expand(self, workflow: Workflow, app_id: str, path: list[str], events: list[Event]) -> list[str]:
        """The path with each numbered round reached while at the interviewing stage after it:
        Interviewing → Round 1 → Round 2 → what came next. "Reached" is as in which round rejections
        came after (rejections._reached), by the move on to the next stage in the path, else now."""
        stage = interviewing_stage(workflow, path)
        if stage is None or not self.by_app.get(app_id):
            return path
        at = path.index(stage)
        after = path[at + 1] if at + 1 < len(path) else None
        moves = [ev for ev in in_time_order(_effective_moves(events)) if after and ev.to_stage == after]
        cutoff = moves[-1].occurred_at if moves else utcnow()
        numbers = sorted(
            {r.round for r in self.by_app[app_id] if r.round and _reached(r, self.done[r.id], cutoff) is not None}
        )
        return [*path[: at + 1], *(f"{stage}{ROUND}{n}" for n in numbers), *path[at + 1 :]]


def round_of(node: str) -> tuple[str, int] | None:
    """A round node's stage and number."""
    stage, sep, n = node.partition(ROUND)
    return (stage, int(n)) if sep and n.isdigit() else None


def flow(
    session: Session,
    workflow: Workflow,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
    route: str | None = None,
    rounds: bool = False,
) -> Flow:
    """Applications added in [since, until) (and by `route`), counted along their folded paths;
    with `rounds`, the interviewing stage expanded into the rounds each reached."""
    stmt = select(Application.id)
    if since is not None:
        stmt = stmt.where(Application.created_at >= since)
    if until is not None:
        stmt = stmt.where(Application.created_at < until)
    if route:
        stmt = stmt.where(Application.route == route)
    ids = list(session.scalars(stmt))
    events: dict[str, list[Event]] = {i: [] for i in ids}
    if ids:
        for ev in session.scalars(
            select(Event).where(Event.application_id.in_(ids), Event.kind == STAGE_CHANGE).order_by(Event.seq)
        ):
            events[ev.application_id].append(ev)

    rank = stage_rank(workflow)
    closed = closed_stages(workflow)
    expand = Rounds(session, ids) if rounds else None
    result = Flow()
    for app_id in ids:
        path = fold_forward(stage_path(events[app_id]), rank, closed)
        if not path:
            continue
        if expand:
            path = expand.expand(workflow, app_id, path, events[app_id])
        result.applications += 1
        result.current[path[-1]] += 1
        for stage in path:
            result.reached[stage] += 1
        for a, b in zip(path, path[1:], strict=False):
            result.links[(a, b)] += 1
    return result


# Where a role or application came from, for the whole picture.
SOURCES = ("recruiter", "referral", "found")
PASSED, DECIDING = "passed", "deciding"


def source_of(app: Application | None, role: Role) -> str:
    """`referral` if the application came by referral; `recruiter` if someone pitched the role or
    the application went through a recruiter or agency; otherwise `found` (you found it)."""
    if app is not None and app.route == "referral":
        return "referral"
    if role.contact_id or (app is not None and (app.route == "agency" or app.recruiter_id or app.agency_id)):
        return "recruiter"
    return "found"


def whole_flow(
    session: Session,
    workflow: Workflow,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
    rounds: bool = False,
) -> Flow:
    """Everything in one flow: each application added in [since, until) from where it came from
    through its stages, and each role added then with no application, to passed or still deciding.

    Node ids: `source:<SOURCES>`, `passed`, `deciding` and stage ids. `applications` counts both.
    """

    def within(col):
        conds = []
        if since is not None:
            conds.append(col >= since)
        if until is not None:
            conds.append(col < until)
        return conds

    roles = {r.id: r for r in session.scalars(select(Role))}
    apps = list(session.scalars(select(Application).where(*within(Application.created_at))))
    with_apps = set(session.scalars(select(Application.role_id).distinct()))
    events: dict[str, list[Event]] = {a.id: [] for a in apps}
    if apps:
        for ev in session.scalars(
            select(Event).where(Event.application_id.in_(list(events)), Event.kind == STAGE_CHANGE).order_by(Event.seq)
        ):
            events[ev.application_id].append(ev)

    rank = stage_rank(workflow)
    closed = closed_stages(workflow)
    result = Flow()

    def add(path: list[str]) -> None:
        result.applications += 1
        result.current[path[-1]] += 1
        for node in path:
            result.reached[node] += 1
        for a, b in zip(path, path[1:], strict=False):
            result.links[(a, b)] += 1

    expand = Rounds(session, [a.id for a in apps]) if rounds else None
    for app in apps:
        path = fold_forward(stage_path(events[app.id]), rank, closed)
        if path and expand:
            path = expand.expand(workflow, app.id, path, events[app.id])
        if path and app.role_id in roles:
            add([f"source:{source_of(app, roles[app.role_id])}", *path])
    since_ok = select(Role.id).where(*within(Role.created_at))
    for role_id in session.scalars(since_ok):
        role = roles[role_id]
        if role_id not in with_apps:
            add([f"source:{source_of(None, role)}", PASSED if role.decision == "passed" else DECIDING])
    return result
