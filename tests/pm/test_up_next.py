"""Not started is split in two: the backlog (planned) and work queued to be built (next)."""

import re
import unittest
from datetime import datetime

from tools.pm import charts, derive, render, task_page
from tools.pm.live import Snapshot, TaskEvidence
from tools.pm.roadmap import BranchRoadmap, Live, PullRequest, apply_live, from_data

NOW = datetime(2026, 11, 2, 12, 0).astimezone()


def roadmap(**live):
    data = {
        "project": "demo",
        "phases": [
            {
                "id": "P0",
                "name": "Started",
                "tasks": [
                    {"id": "first", "name": "First", "status": "done"},
                    {"id": "idea", "name": "An idea"},
                    {"id": "plan-with-kai", "name": "Plan with Kai", "status": "planned"},
                ],
            },
            {
                "id": "P1",
                "name": "Asked for",
                "tasks": [
                    {"id": "queued", "name": "Queued work", "status": "next", "depends": ["first"]},
                    {"id": "queued-later", "name": "Queued after", "status": "next", "depends": ["queued"]},
                    {"id": "queued-built", "name": "Being built", "status": "next"},
                ],
            },
            {
                "id": "B",
                "name": "Bugs",
                "tasks": [
                    {"id": "a-bug", "name": "A bug", "type": "bug", "severity": "low"},
                    {"id": "bug-next", "name": "A bug up next", "type": "bug", "severity": "high", "status": "next"},
                ],
            },
        ],
    }
    return apply_live(from_data(data), Live(**live))


DRAFT = PullRequest(4, "Building it", "OPEN", "worktree-queued-built", "https://example.com/4", is_draft=True)


def column(html: str, label: str) -> str:
    """One board column's HTML, from its heading to the next column."""
    start = html.index(f">{label}</span>")
    end = html.find('<div class="col">', start)
    return html[start : end if end > 0 else None]


class ParseTests(unittest.TestCase):
    def test_next_parses_and_planned_stays_the_backlog(self):
        rm = roadmap()
        self.assertEqual(rm.errors, [])
        self.assertEqual(rm.task("queued").status, "next")
        self.assertEqual(rm.task("idea").status, "planned")
        self.assertEqual(rm.task("plan-with-kai").status, "planned")

    def test_a_bug_is_a_bug_unless_its_set_to_next(self):
        rm = roadmap()
        self.assertEqual(rm.task("a-bug").status, "bug")
        self.assertEqual((rm.task("bug-next").status, rm.task("bug-next").type), ("next", "bug"))
        self.assertIn("bug-next", [t.id for t in rm.open_bugs()])

    def test_live_status_overrides_next(self):
        self.assertEqual(roadmap(prs=[DRAFT]).task("queued-built").status, "building")
        ready = PullRequest(4, "t", "OPEN", "worktree-queued", "u")
        self.assertEqual(roadmap(prs=[ready]).task("queued").status, "review")
        merged = PullRequest(4, "t", "MERGED", "worktree-queued", "u")
        self.assertEqual(roadmap(prs=[merged]).task("queued").status, "done")
        self.assertEqual(roadmap(branches_ahead={"worktree-queued": 2}).task("queued").status, "building")

    def test_queued_and_next_up(self):
        rm = roadmap(prs=[DRAFT])
        self.assertEqual([t.id for t in rm.queued()], ["queued", "bug-next", "queued-later"])
        self.assertEqual([t.id for t in rm.next_up()], ["queued", "bug-next"])
        self.assertEqual(rm.waiting(rm.task("queued-later")), ["queued"])

    def test_summary_counts_both(self):
        counts = roadmap(prs=[DRAFT]).summary()["counts"]
        self.assertEqual((counts["planned"], counts["next"], counts["building"]), (2, 3, 1))


class BoardTests(unittest.TestCase):
    def test_columns_in_order_with_counts(self):
        html = render.board(roadmap(prs=[DRAFT]), Snapshot(live=Live()))
        heads = re.findall(r'<h2 class="small muted"><span class="pill (\w+)">([^<]+)</span> <span>(\d+)</span>', html)
        self.assertEqual(
            [(label, int(n)) for _, label, n in heads],
            [
                ("Bugs", 1),
                ("Backlog", 2),
                ("Up next", 3),
                ("Building", 1),
                ("In review", 0),
                ("Merged", 1),
                ("Blocked", 0),
            ],
        )

    def test_each_task_is_in_its_column(self):
        html = render.board(roadmap(prs=[DRAFT]), Snapshot(live=Live()))
        self.assertIn("An idea", column(html, "Backlog"))
        self.assertNotIn("Queued work", column(html, "Backlog"))
        upnext = column(html, "Up next")
        self.assertIn("Queued work", upnext)
        self.assertIn("BUG · high", upnext)
        self.assertIn("waits on queued", upnext)
        self.assertIn("Being built", column(html, "Building"))


class OverviewTests(unittest.TestCase):
    def html(self, rm=None):
        return render.overview(rm or roadmap(prs=[DRAFT]), Snapshot(live=Live()), NOW)

    def test_up_next_lists_the_queue_not_the_backlog(self):
        html = self.html()
        panel = html[html.index("<h2>Up next · 3</h2>") :]
        panel = panel[: panel.index("</ul>")]
        self.assertIn("Queued work", panel)
        self.assertIn("A bug up next", panel)
        self.assertLess(panel.index("A bug up next"), panel.index("Queued after"))  # ready ones first
        self.assertIn("Queued after", panel)
        self.assertIn("waits on queued", panel)
        self.assertNotIn("An idea", panel)
        self.assertNotIn("Being built", panel)  # building now

    def test_counts_and_legend(self):
        html = self.html()
        self.assertIn("1 of 6 tasks done · 2 up next", html)  # work tasks only, as in the 6: not the bug
        self.assertIn('<i class="planned"></i>Backlog', html)
        self.assertIn('<i class="next"></i>Up next', html)
        self.assertIn('<i class="next" style="width:66.67%">', html)  # P1: two of three up next

    def test_the_pipeline_has_no_not_started_stages(self):
        heads = re.findall(r'<th class="stage">([^<]+)</th>', self.html())
        self.assertEqual(heads, ["Building", "In review", "Merged"])

    def test_up_next_on_a_backlog_task_is_a_problem(self):
        data = {
            "phases": [
                {
                    "id": "P",
                    "tasks": [
                        {"id": "idea"},
                        {"id": "asked", "status": "next", "depends": ["idea"]},
                        {"id": "fine", "status": "next", "depends": ["asked"]},
                    ],
                }
            ]
        }
        rm = apply_live(from_data(data), Live())
        self.assertEqual(rm.errors, [])
        self.assertEqual(rm.queue_problems(), ["asked is up next but depends on idea, which is in the backlog"])
        self.assertIn("asked is up next but depends on idea", render.problems(rm, Snapshot(live=Live())))
        building = apply_live(from_data(data), Live(branches_ahead={"worktree-idea": 1}))
        self.assertEqual(building.queue_problems(), [])  # live status counts: it's being built

    def test_up_next_on_an_unfixed_bug_is_a_problem_and_in_the_json(self):
        data = {
            "phases": [
                {"id": "P", "tasks": [{"id": "asked", "status": "next", "depends": ["fix-it"]}]},
                {"id": "B", "tasks": [{"id": "fix-it", "type": "bug", "severity": "low"}]},
            ]
        }
        rm = apply_live(from_data(data), Live())
        problem = "asked is up next but depends on fix-it, a bug not being fixed"
        self.assertEqual(rm.queue_problems(), [problem])
        self.assertIn(problem, render.as_json(rm, Snapshot(live=Live()))["warnings"])
        fixing = apply_live(from_data(data), Live(branches_ahead={"worktree-fix-it": 1}))
        self.assertEqual(fixing.queue_problems(), [])

    def test_the_panel_shows_eight_without_details_and_links_to_the_rest(self):
        tasks = [{"id": f"t{i}", "name": f"Task {i}", "status": "next", "detail": f"Long words {i}"} for i in range(10)]
        html = self.html(apply_live(from_data({"phases": [{"id": "P", "tasks": tasks}]}), Live()))
        panel = html[html.index("<h2>Up next · 10</h2>") :]
        panel = panel[: panel.index("</ul>")]
        self.assertIn("Task 7", panel)
        self.assertNotIn("Task 8", panel)
        self.assertNotIn("Long words", panel)
        self.assertIn('<a href="/board">+2 more on the Board</a>', panel)

    def test_nothing_queued_says_how_much_is_in_the_backlog(self):
        rm = from_data({"phases": [{"id": "P", "tasks": [{"id": "a"}, {"id": "b"}]}]})
        html = self.html(apply_live(rm, Live()))
        self.assertIn("Up next · 0", html)
        self.assertIn("Nothing queued. 2 in the", html)

    def test_the_current_phase_is_the_one_with_work_up_next(self):
        rm = roadmap()
        self.assertEqual(derive.current_phase(rm).id, "P1")
        self.assertEqual(derive.current_phase(roadmap(branches_ahead={"worktree-idea": 1})).id, "P0")

    def test_up_next_isnt_done_in_the_burn_up(self):
        b = derive.burnup(roadmap(), Snapshot(live=Live()), NOW)
        self.assertEqual((b.done, b.total), (1, 6))

    def test_json_next_up_is_the_ready_queue(self):
        ready = render.as_json(roadmap(), Snapshot(live=Live()))["next_up"]
        self.assertEqual(ready, ["queued", "queued-built", "bug-next"])


class RoadmapPageTests(unittest.TestCase):
    def test_status_table_has_both_columns(self):
        html = charts.status_table(roadmap())
        heads = re.findall(r'<th class="num">([^<]+)</th>', html)
        self.assertLess(heads.index("Up next"), heads.index("Backlog"))
        row = re.search(r"P1</code> Asked for</td>(.*?)</tr>", html).group(1)
        cells = re.findall(r'<td class="num">([^<]+)</td>', row)
        self.assertEqual(cells[heads.index("Up next")], "3")

    def test_pills_say_backlog_and_up_next(self):
        html = render.roadmap_page(roadmap(), Snapshot(live=Live()), NOW)
        self.assertIn('<span class="pill planned">backlog</span>', html)
        self.assertIn('<span class="pill next">up next</span>', html)


class TaskPageTests(unittest.TestCase):
    def page(self, task_id):
        rm = roadmap()
        return task_page.task_page(rm.task(task_id), rm, TaskEvidence())

    def test_a_queued_task_is_at_up_next_and_says_what_it_waits_on(self):
        html = self.page("queued-later")
        self.assertIn('<span class="dot next at">', html)
        self.assertIn("says up next", html)
        self.assertIn("Waiting on queued.", html)

    def test_a_backlog_task_is_at_backlog(self):
        html = self.page("idea")
        self.assertIn('<span class="dot planned at">', html)
        self.assertIn("says backlog", html)

    def track(self, task):
        return re.findall(r'<span class="small(?: muted)?">([^<]+)</span></div>', task_page.stage_track(task))

    def test_the_first_stage_is_named_by_its_own_status_and_not_started_once_past(self):
        rm = roadmap(prs=[DRAFT])
        self.assertEqual(self.track(rm.task("idea")), ["Backlog", "Building", "In review", "Merged"])
        self.assertEqual(self.track(rm.task("queued")), ["Up next", "Building", "In review", "Merged"])
        self.assertEqual(self.track(rm.task("queued-built")), ["Not started", "Building", "In review", "Merged"])
        self.assertIn('<span class="dot past">', task_page.stage_track(rm.task("queued-built")))
        self.assertEqual(task_page.stage_track(rm.task("a-bug")), "")

    def test_a_task_only_on_a_branch_says_up_next_in_words(self):
        main = from_data({"phases": [{"id": "P", "tasks": [{"id": "own"}]}]})
        extra = from_data({"phases": [{"id": "P", "tasks": [{"id": "sib", "status": "next"}]}]}).phases
        live = Live(branch_roadmaps={"worktree-own": BranchRoadmap("worktree-own", "s", extra)})
        task = apply_live(main, live).task("sib")
        self.assertEqual(task.status_source, "roadmap on worktree-own says up next")
        self.assertIn("That file says up next.", task_page.stage_why(task))
