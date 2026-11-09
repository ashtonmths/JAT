# Now: state and live plan

Snapshot 2026-11-09, after #287 (main at `566f635`, v1.19.12). Refresh this file before each compaction. Before
trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and `docs/ROADMAP.yaml`.

## State

- Released up to **v1.19.12**. Our own PRs: none open; only `main` locally and on GitHub.
- **Open PRs from a contributor** (issue #230's author, Windows work; Kai reviews them, see *Contributors' PRs* in
  working-with-kai.md): #283 `windows-starts`, #284 `utf8-everywhere`, #285 `windows-time-zones`. Not merged.
- **All 17 Simplified Chinese string files are in** (still a draft: shown only on a dev server, `?lang=zh-CN`).
- Kai's tracker on 8770 still needs a restart for #254's *Rejected* badge on roles (Ctrl+C, `uv run jat serve`). Since
  then everything is frontend, tooling or docs (v1.19.6's change is only what `jat init` writes).
- Tests on main: pytest 1,311, browser 717 (#286's full run).
- Dependabot: #32 and #33, both minimatch in dev tools only; the fix (minimatch 11) waits for eslint and redocly. Leave
  them open unless Kai dismisses them.
- Background jobs of this session: the PM dashboard on 8767 and the zh-CN demo API on 8891
  (`uv run jat --data-dir /home/kai/.claude/jobs/cf5328f4/tmp/zh/demo serve --dev --port 8891`). A session restart
  stops both; restart the dashboard at once, the demo API only when a zh-CN task needs it. If that folder is gone (a new
  session gets a new job folder), seed one with `uv run python scripts/seed_demo.py <dir>`.
- The user-level after-compaction hook is still **not** in `~/.claude/settings.json` (checked 2026-11-09; the JSON
  is under *Waiting on Kai*).

## Done since the last snapshot (2026-11-08 / 09)

- Six bugs Kai picked as easy and low-risk, by builder agents in parallel (after "my usage limit refreshed, do it in
  paralel with agents"), merged one at a time: #278 `fix-archive-lock-not-ignored` (v1.19.6), #276
  `fix-deleted-application-documents-stale` (v1.19.7), #275 `fix-menu-recruiters-section` (v1.19.8), #277
  `fix-version-label-repeats` (v1.19.9), #279 `fix-refused-delete-stale-page` (v1.19.10, refreshes only after a coded
  refusal: `isRefusal` in `api/client.ts`), #281 `fix-offer-loading-says-none` (v1.19.11).
- #280 `bugs-loading-state-pattern`: Kai asked whether other places show "nothing here" while loading. Four more bugs
  (`fix-roles-card-loading-says-none`, `fix-calls-card-loading-says-none`, `fix-today-done-loading-says-none`,
  `fix-today-recent-loading-says-none`) and a planned shared fix, `fix-loading-state-pattern` (a `QueryState` with
  animated skeletons; needs Kai's go on skeletons vs loaders and the new "couldn't load" text).
- #282 `review-process-check`: Kai worried reviews weren't finding things. Planted bugs were all caught; small fixes are
  mostly right first time. Three planned tasks: `review-brief-blind`, `review-break-attempt`, `review-seeded-canary`.
- #286 `today-coming-up-pill` (v1.19.12): today's rounds and calls in Coming up show the to-dos' orange *Today* pill at
  the left of the Reschedule line (placement settled on a demo with Kai); a call's buttons now fade like a round's.
- #287 `pm-code-lines-split`: the dashboard's Code tile shows source · tests · other (they add up to the total).
- Contributor PR reviews for Kai (nothing posted): #285 (tzdata right; asks: drop the `fcntl` MagicMock from
  `tests/conftest.py`, and a test that switches off the system time-zone files) and #283 (works in simulation, Linux
  unchanged; asks: Windows checks in one place, two test fixes, a Prettier fix; nine smaller items kept as Kai's
  follow-ups after merging). Kai has the drafted comments.

## Kai's latest asks (2026-11-08 / 09)

1. "choose 6 low-risk, small, quick, easy bugs" → "do those 6, but before doing 3 check if this is a pattern…" → the six
   bug PRs and #280.
2. "im concerned that code reviews are not finding things to fix…" → the check; "add all 3 suggestions to the roadmap"
   → #282.
3. Issue #230: a reply drafted for Kai; how FOSS projects handle contributors; which of #283–#285 first (#285, #283,
   #284); "use /agent-team to do a code review" of #285 and #283 (plus `/code-review:code-review` on #283), comments
   drafted as one top-level comment, encouraging, only blockers, and only claiming what Kai did.
4. "a small area … for today in coming up" → ideas → the pill → #286. "lines of code … total, tests, source" → #287.
5. "update compact doc" → this refresh.

## Next

Nothing Kai asked for is unfinished. Report and wait. Likely next, when Kai says:

- **Contributor PRs:** once the contributor pushes changes, re-run the full checks on their new commit (and the Windows
  simulation for #283), then Kai's bump/CHANGELOG/roadmap and merge on Kai's go. Order: #285, #283 (minor: 1.20.0),
  #284 (conflicts with #283 in `snapshot/git.py` and `datadir.py`). Kai tests #283 on Windows himself.
- **`i18n-zh-cn-layout`** and **`i18n-zh-cn-switch-on`** (both `next`), then `-demo-data`, `-screenshots` (show Kai
  first), `-readme`, `-website`, `-listing`.
- **Planned, waiting for Kai's go:** `fix-loading-state-pattern`, `fix-stale-key-pattern`, the three review-process
  tasks.
- **Tooling gaps offered, not on the roadmap:** namespace-prefixed keys in `apply_review.py`/`assemble.py`;
  `screenshots.py` can't click; `pages.json` uses a literal agency id. Add them only if Kai says.

**How bug fixes ran this round** (keep doing it this way unless Kai says otherwise):
- A builder agent per bug (`isolation: "worktree"`, no `name`), briefed with `tools/dev/briefs/bug-fix.md` plus any
  decision already made. Builders open draft PRs; the lead reviews, bumps, merges and releases one at a time.
- One Sonnet reviewer per PR, given the diff as a file; the lead fixes its should_fix items, proves each test fails
  without the fix (temporarily restoring main's file), adds the bump (`tools/dev/bump.py`), runs `tools/dev/checks.sh`,
  merges (`tools/dev/merge.sh`) and ships (`tools/dev/ship.sh <version> <pr> <worktree> <branch>` from the main
  checkout), then `git worktree remove -f -f` the agent's worktree and delete its branch. Every merge moves main, so
  the next PR merges main and reruns its checks; stop a run that's about to be stale rather than finishing it.
- Translations: the builder brief at `/home/kai/.claude/jobs/cf5328f4/tmp/deps/zh-builder-brief.md` (outside the repo;
  if gone, rewrite it from `scripts/i18n/translate/README.md`); builders have no Workflow tool, the lead runs the
  workflows for them.

**Simplified Chinese decisions** (Kai): `zh-CN`; Traditional browsers stay English; "More coming soon"; AI translation,
corrections by issue or PR; a draft until switch-on; no release while a draft; Opus translates and judges, Sonnet and Opus
review; no screenshots in PRs.

## Waiting on Kai (don't start)

- **The user-level hook:** add to `~/.claude/settings.json` next to `"env"` (the auto-mode check refuses this edit):
  ```json
  "hooks": { "SessionStart": [ { "matcher": "compact", "hooks": [ { "type": "command",
    "command": "/home/kai/Documents/Projects/job-application-tracker/tools/dev/after_compact.sh --user", "timeout": 30 } ] } ] },
  ```
- **Contributor PRs #283–#285:** Kai posts the drafted comments and tests #283 on Windows.
- **Repo gaps offered for contributors, no answer:** `CONTRIBUTING.md` and the PR template tell contributors to update
  `CHANGELOG.md`, but Kai asked them to leave it; and PRs get no automatic checks (a GitHub Actions job, perhaps with a
  `windows-latest` Python run).
- **The MCP server:** the `mcp-*` tasks wait on the 11 decisions in `docs/rfc/mcp.md` §14.
- **Backlog to plan with Kai:** `generalise-agent-tooling`, `code-cleanup`, `delivery-speed-improvements`,
  `recruiter-open-application-mark`, `i18n-search`, the P11 test gaps, `tests-reorganise`, Docker, `packaged-install`,
  `desktop-app`, `hosted-version`, `demo-site`.
- **Left alone** (Kai, 2026-11-02): `notes-documents-improve`, `timeline-improve`, `people-you-meet`.
- **Offered, no answer:** the GitHub description and topics from #96; a short brand name; tile rows on other pages;
  dropping *Screen* from the default workflow; linking the recruiter in the Applications list; rebuilding `demo.gif`;
  day headings or a countdown for Today's Coming up.
- **Open bugs:** 64 in phase B, 1 high (`fix-applied-date-wipe`, in the stale-key family). None is fixed without Kai's
  go. Two lack rating fields: `fix-escape-closes-quick-view`, `fix-phone-header-overlap` (likely a duplicate of
  `fix-phone-header-overflow`).

## Noticed, not promised

- README screenshots show the old language icon; `insights-stats.png`, `demo.gif`, `recruiters.png`, `person.png` and
  `roles.png` show older UI.
- Long text clips on Today's Waiting rows, the call form's How and the offer form's kind (for other languages).
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- The application page's People card ignores a recruiter set through the route.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
- Suspected, unconfirmed (from #272): the Interviews page at midnight; to-dos beside a round or call have no `key`; the CV
  adopt dialog's ticked applications are seeded once.
