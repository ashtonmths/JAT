# Now: state and live plan

Snapshot 2026-11-10, after #296 (main at `b994f0d`, v1.22.0). Refresh this file before each compaction. Before
trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and `docs/ROADMAP.yaml`.

## State

- Released up to **v1.22.0**. Our own PRs: none open. Branches: `main`, plus `worktree-pr-screenshots` on GitHub
  (shelved work, kept on purpose: see `pr-screenshots` on the roadmap).
- **Simplified Chinese is switched on** (v1.21.0): in the language menu, and given to browsers asking for `zh`, `zh-CN`,
  `zh-Hans` or `zh-SG`. Chinese demo data: `scripts/seed_demo.py --lang zh-CN` (v1.21.1).
- **Open PRs from a contributor** (issue #230's author, Windows work; Kai reviews them, see *Contributors' PRs* in
  working-with-kai.md): #283 `windows-starts`, #284 `utf8-everywhere`, #285 `windows-time-zones`. Not merged.
- **Merging and releasing:** Kai's standing yes after the review-fix cycle (working-with-kai.md). `.claude/settings.json`
  allows `tools/dev/merge.sh` and `ship.sh` (#295); run them relative (`tools/dev/merge.sh N`) and they go through.
- Kai's tracker on 8770 needs a restart (Ctrl+C, `uv run jat serve`) if it hasn't had one since v1.20.0: #289 changed
  the API (round pills' *Waiting to hear back*). Everything since is frontend, scripts or docs.
- Tests on main: pytest 1,328, browser 723 (#296's full run).
- Dependabot: #32 and #33, both minimatch in dev tools only; the fix (minimatch 11) waits for eslint and redocly. Leave
  them open unless Kai dismisses them.
- Background jobs of this session: the PM dashboard on 8767 and the zh-CN demo API on 8891 (on the session's job
  folder `tmp/zh/demo`). A session restart stops both; restart the dashboard at once, a demo only when a task needs one
  (`uv run python scripts/seed_demo.py <new dir>`, then `uv run jat --data-dir <dir> serve --port 88xx`).
- The user-level after-compaction hook is still **not** in `~/.claude/settings.json` (the JSON is under *Waiting on
  Kai*).

## Done since the last snapshot (2026-11-09 / 10)

- #289 `round-pill-status` (v1.20.0, a builder): a round's in-between state (*Not booked yet*, *Waiting to hear back*,
  *Needs a new time*) is its own pink badge beside the violet round pill on the board, list and quick view; At a glance
  says when a done round is waiting to hear back. The API's current round gains `waiting_to_hear_back` (timed from the
  round's *done* event; archived applications never wait). Pink: all 14 Mantine colours are used somewhere, pink only by
  the Timeline's call lane.
- #290 `i18n-zh-cn-layout`: Chinese fonts last in the theme's list, date pickers in each language's pattern (and typed
  dates read with dayjs's `customParseFormat`), `word-break: keep-all` on short labels, no forced capitals in Chinese
  (`:lang(zh)` in `frontend/src/text.module.css`, the one language-specific rule), date boxes one per line on phones.
- #294 `i18n-zh-cn-switch-on` (v1.21.0): Chinese shipped; *More coming soon*; the tab title follows the language;
  `e2e/chinese.spec.ts` checks every page in Chinese has none of the English catalog left; README *Languages* section
  with `docs/screenshots/language-menu.png`.
- #293 `i18n-zh-cn-demo-data` (v1.21.1, a builder): `scripts/demo_content.py` holds the demo's words (EN and ZH_CN);
  English unchanged (a full dump matched); Chinese phones `+86 000 0000 000N`.
- #296 `recruiters-active-filter` (v1.22.0): Recruiters' *In progress · N* tab (an open application with them as
  recruiter, Interested included, or a pitched role with no application yet) and each card's counts. A role you've
  started on counts once, as its application.
- Roadmap only: #292 (`docs-no-machine-paths`, `pr-screenshots` shelved), #295 (settings, `review-merge-script`).
- Closed unmerged: #291, the before-and-after screenshot tool (shelved by Kai; its work is on `worktree-pr-screenshots`).

## Kai's latest asks (2026-11-09 / 10)

1. "check roadmap, what tasks are there to do with compaction/tooling/making stuff agent agnostic" → listed; "plan item 1"
   → a plan for `generalise-agent-tooling` in chat (inventory, other tools' equivalents, three PRs: AGENTS.md, compaction
   and hooks, a translation runner). Then "lets choose something else". Not started; the plan isn't in the repo yet.
2. "whats next for the chinese language" → "yep do 1" (#290, with "dont automerge", before/after screenshots in the PR)
   → "do the switch on and demo data" (#294, #293).
3. The round pills (#289): wording, "a different colour", "not rescheduled, different, its a enw thing", "its own pill
   outsied of the pill about the round", "ship it".
4. "new roadmap feature idea … pencil that into it" → `interview-process-plan` (planned).
5. "when making a UI change the PR should have before/after screenshot(s)" → #291, then "shelve this", "close the PR
   without merging" → `pr-screenshots` (planned). "cleanup/anonymise the docs to stop mentioning full computer paths" →
   `docs-no-machine-paths` (planned).
6. "yes you can merge and release going forward as long as you follow review-fix iterative cycle" → recorded; "use th gh
   api, add a new item to the roadmap to review that script" → #295.
7. "another filter to show recruiters that i have applications associated with … and show the count in the card too"
   → #296. "that bug, is that surfaced anywhre else or the same pattern?" → the double count isn't anywhere else; a
   related lag is `fix-move-stage-kind-lags` (this PR).
8. "update compact doc" → this refresh.

## Next

Nothing Kai asked for is unfinished. Report and wait. Likely next, when Kai says:

- **Chinese:** `i18n-zh-cn-screenshots` (show Kai first), `-readme`, `-website`, `-listing` (Kai approves the text).
- **Contributor PRs:** once the contributor pushes changes, re-run the full checks on their new commit (and the Windows
  simulation for #283), then the bump, CHANGELOG, roadmap and merge on Kai's go. Order: #285, #283, #284.
- **Planned, waiting for Kai's go:** `generalise-agent-tooling` (plan in chat above), `docs-no-machine-paths`,
  `review-merge-script`, `pr-screenshots`, `interview-process-plan`, `fix-loading-state-pattern`, `fix-stale-key-pattern`,
  the three review-process tasks.

**How work ran this round** (keep doing it this way unless Kai says otherwise):
- Builders (`isolation: "worktree"`, no `name`) for independent tasks, briefed in full; the lead reviews, merges main
  in, bumps, runs the checks and merges, one PR at a time. Review only once a PR's dependency has merged.
- The review-fix cycle: a Sonnet reviewer given the diff as a file ("try to break it"); fix must_fix and the cheap
  should_fix items; prove a new test fails without the fix; a re-review of just the fix commit (SendMessage to the same
  reviewer); then `tools/dev/checks.sh` on the final commit; `tools/dev/merge.sh N`; from the main checkout
  `tools/dev/ship.sh <version|-> <pr> <worktree> [<branch>]`. Kai's UI changes get a demo first when he asks.
- After merging main into a branch, check `git diff origin/main -- docs/ROADMAP.yaml`: merges revert done tasks.

**Simplified Chinese decisions** (Kai): `docs/rfc/zh-cn.md`. Layout: English stays as it is; language-specific CSS as
little as possible; a fix that changes English needs Kai's yes.

## Waiting on Kai (don't start)

- **The user-level hook:** add to `~/.claude/settings.json` next to `"env"` (the auto-mode check refuses this edit):
  ```json
  "hooks": { "SessionStart": [ { "matcher": "compact", "hooks": [ { "type": "command",
    "command": "/home/kai/Documents/Projects/job-application-tracker/tools/dev/after_compact.sh --user", "timeout": 30 } ] } ] },
  ```
- **Contributor PRs #283–#285:** Kai posts the drafted comments and tests #283 on Windows.
- **Repo gaps offered for contributors, no answer:** `CONTRIBUTING.md` and the PR template tell contributors to update
  `CHANGELOG.md`, but Kai asked them to leave it; and PRs get no automatic checks.
- **The MCP server:** the `mcp-*` tasks wait on the 11 decisions in `docs/rfc/mcp.md` §14.
- **Backlog to plan with Kai:** as under *Next*, plus `code-cleanup`, `delivery-speed-improvements`,
  `recruiter-open-application-mark`, `i18n-search`, the P11 test gaps, `tests-reorganise`, Docker, `packaged-install`,
  `desktop-app`, `hosted-version`, `demo-site`.
- **Left alone** (Kai, 2026-11-02): `notes-documents-improve`, `timeline-improve`, `people-you-meet`.
- **Offered, no answer:** done-and-waiting rounds in Today's *Waiting on them*; a Chinese word for Offer (录用通知)
  instead of the Latin one; the GitHub description and topics from #96; a short brand name; rebuilding `demo.gif`.
- **Open bugs:** 68 in phase B, 1 high (`fix-applied-date-wipe`, in the stale-key family). None is fixed without Kai's
  go. New this round: `fix-phone-stage-badges-cut`, `fix-today-waiting-actions-clipped`, `fix-phone-tables-cut`,
  `fix-move-stage-kind-lags`.

## Noticed, not promised

- README screenshots show older UI (`insights-stats.png`, `demo.gif`, `recruiters.png`, `person.png`, `roles.png`), and
  Recruiters now has the In progress tab and card counts.
- Money in CNY shows as "540,000 CNY": `formatMoney` has symbols only for GBP, USD and EUR.
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
