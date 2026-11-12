# Now: state and live plan

Snapshot 2026-11-12, after #317 (main at `808868a`, v1.24.0). Refresh this file before each compaction. Before
trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and `docs/ROADMAP.yaml`.

## State

- Released up to **v1.24.0**. Open PRs: #327 (the PM dashboard fix below, if not merged yet) and this refresh.
  Branches: `main`, plus `worktree-pr-screenshots` on GitHub (shelved work, kept on purpose: see `pr-screenshots`).
- **Interviews calendar** (#325 helpers, #317 view, 1.24.0): Calendar · List, Month · Year dot views, a summary, a side
  panel of the chosen day's rounds. Plan in `docs/rfc/interviews-calendar.md`. Kai picked the design from concepts on a
  dev server (working-with-kai.md *Designs*); #326 (the concepts) is closed.
- **Chinese** is complete: the app (every key, checked by `frontend/src/i18n/catalog.test.ts`), `README.zh-CN.md` (#319),
  its screenshots and GIF in `docs/screenshots/zh-CN/` (#318; `make_demo_gif.py --lang zh-CN`), the website (#323),
  the GitHub description and topics (applied 2026-11-11 with Kai's yes). Keeping it in step is a rule in CLAUDE.md
  *Languages* and CONTRIBUTING (#324), with `tests/test_readme_parity.py`.
- **The stale-key family is fixed** (`fix-stale-key-pattern` done: #313 `useDraft` for page forms, #315 `settleSave` for
  dialog saves, #310 Today keeps edits at midnight). The keying rule is in gotchas.md *Frontend*.
- **Windows:** five of the plan's nine items done; installs now pick Python 3.12 to 3.14 (`.python-version`, #312), so
  the VM needs plain `uv sync`. On Windows 17 known failures (`windows-tests-green`). The VM is shut down.
- **Merging and releasing:** Kai's standing yes after the review-fix cycle (working-with-kai.md).
- **Kai's tracker** on 8770 needs a restart (Ctrl+C, `uv run jat serve`) for v1.23.12 (search snippets, Python). The
  frontend in the main checkout is rebuilt to 1.24.0.
- Tests on main: pytest 1,394, browser 741 (#317's full run).
- Background jobs of this session: the PM dashboard on 8767 (restart it after #327 merges). No demo or dev servers.
- The user-level after-compaction hook is still **not** in `~/.claude/settings.json` (the JSON is under *Waiting on Kai*).

## Done since the last snapshot (2026-11-11 / 12)

| Version | PR | What |
|---|---|---|
| 1.23.4 | #312 | uv picks Python 3.12 to 3.14 (`fix-python-315-install`), checked on the Windows VM |
| 1.23.5 | #313 | `useDraft`: the applied date isn't wiped; About keeps unsaved text after a rename |
| 1.23.6 | #310 | Today keeps edits at midnight and a Reschedule dialog past a round's start |
| 1.23.7 | #314 | An agency or company typed but not chosen is kept (also fixed `fix-person-saved-before-new-company`) |
| 1.23.8 | #311 | A link rename's X cancels and its tick saves once |
| 1.23.9 | #315 | Reopening Edit right after saving shows what was saved (8 dialogs, notes' conflict check) |
| 1.23.10 | #322 | The Chinese demo labels contact details in Chinese |
| 1.23.11 | #321 | A role's pay in its own currency; editing a role keeps its currency |
| 1.23.12 | #320 | Search snippets without Markdown marks (Markdown fields only, a window around the match) |
| 1.23.13 | #325 | Calendar date and summary helpers |
| 1.23.14 | #318 | Chinese screenshots and demo GIF |
| 1.23.15 | #319 | README in Simplified Chinese |
| 1.23.16 | #323 | The website says English and 简体中文 |
| 1.24.0 | #317 | The Interviews calendar |

Internal: #316 (`interviews-calendar` on the roadmap), #324 (language parity rules and checks), #327 (shelved tasks stay
in the Backlog), this refresh.

## Kai's asks this round (2026-11-11 / 12)

1. "choose 5 bugs to work on next" → five chosen; "do those 5, use the stale-key pattern fix" → #310–#315; "release and
   merge after dong the review-fix cycle. if new bugs are discovered report them here and add them to the backlog".
2. "proably only 1 PR can be checked on the VM at a time … multiple instances would bog the computer" → working-with-kai.md.
3. Interviews calendar: "toggle to a calendar view … weekly/monthly summary … look goooood" (#316 roadmap) → "work on
   this after this tranche of bugs" → demo → "fix the today button, then split and ship it" → "create a reskinned
   version … that has dots … the dev server should have a toggle for 3-5 different designs" → "dot months, clusters …
   give me a few sub variations … i really like the side panel" → "Months A and Months B and clusters A and clusters B" →
   "lets do months A AND months B … a toggle to switch" → "interviews looks good, ship it" → v1.24.0.
4. Chinese: "whats next for chinese language" → "do the screenshots task. dont add them to the current readme" → "then
   also do the readme task" → "readme and screenshots look good" → "fix those bugs too and update other places where
   relecant" (#320–#322) → "those 2 open choiuces put them on the roadmap; yes do website and listing, i will review these
   before merge/action; yes update claude/contruting/etc about keeping language files and readmes up to date" → all done.
5. "dont pick up anything new (except recording things in backlog) until these are merged" → done; nothing new started.
6. "this item in roadmap can be back in backlog col" (`pr-screenshots`) → #327.
7. "pause, i need to put computer to sleep … lmk when its safe" → paused cleanly; "continue" → finished.
8. "once thats finihsed update the compaction doc" → this refresh.

## Next

Nothing Kai asked for is unfinished (once #327 and this refresh merge). Report and wait. Likely next, when Kai says:

- **Bugs:** 60 open (none high, 12 medium, 48 low). New this round, all in the backlog: `fix-reschedule-closed-drops-who`
  (low), `fix-role-form-forces-gbp` (low now: the currency field and labels, needs Kai's wording),
  `fix-snippet-long-mark-closer`, `fix-calendar-companies-by-name` (both low). Earlier mediums include
  `fix-duplicate-role`, `fix-emptied-agency-kept`, `fix-double-save-locked`.
- **Chinese, Kai to decide:** `i18n-zh-cn-offer-word` (Offer or 录用通知), `i18n-zh-cn-brand-name`.
- **Windows:** `locked-file-retry`, `windows-testing`, `windows-tests-green` (17), `windows-support`; later `windows-snapshots`.
- **Planned, waiting for Kai's go:** `generalise-agent-tooling`, `google-doc-content`, `docs-no-machine-paths`,
  `review-merge-script`, `pr-screenshots`, `interview-process-plan`, `fix-loading-state-pattern`, the review-process tasks.

**How work ran this round** (keep doing it this way unless Kai says otherwise):
- Builders in parallel, each in its own worktree with `tools/dev/briefs/bug-fix.md` plus a shared brief; one Sonnet reviewer
  per PR (two, Opus and Sonnet, for a big feature), fixes sent back to the same builder, re-review of the fix commits,
  then the full checks one PR at a time and merge in order (versions follow merge order).
- Chinese text: a translator agent, then Sonnet and Opus reviewing each section separately, an Opus judge applying
  the agreed fixes. UI designs: concepts on a dev server for Kai to pick (working-with-kai.md *Designs*).
- After `merge_main.sh`, check the roadmap's statuses (gotchas.md): it reverted done tasks on three PRs this round.

## Waiting on Kai (don't start)

- **The user-level hook:** add to `~/.claude/settings.json` next to `"env"` (the auto-mode check refuses this edit):
  ```json
  "hooks": { "SessionStart": [ { "matcher": "compact", "hooks": [ { "type": "command",
    "command": "/home/kai/Documents/Projects/job-application-tracker/tools/dev/after_compact.sh --user", "timeout": 30 } ] } ] },
  ```
- **Restart the tracker** for v1.23.12 (Python changed).
- **The VM's README** (Kai's `windows-vm` project): `virsh shutdown` didn't stop Windows; `ssh winvm 'Stop-Computer -Force'` did.
- **Repo gaps offered for contributors, no answer:** CONTRIBUTING and the PR template ask contributors to update
  `CHANGELOG.md`, but Kai asked them to leave it; and PRs get no automatic checks.
- **The MCP server:** the `mcp-*` tasks wait on the 11 decisions in `docs/rfc/mcp.md` §14.
- **Backlog to plan with Kai:** as under *Next*, plus `code-cleanup`, `delivery-speed-improvements`,
  `recruiter-open-application-mark`, `i18n-search`, the P11 test gaps, `tests-reorganise`, Docker, `packaged-install`,
  `desktop-app`, `hosted-version`, `demo-site`.
- **Left alone** (Kai, 2026-11-02): `notes-documents-improve`, `timeline-improve`, `people-you-meet`.
- **Offered, no answer:** done-and-waiting rounds in Today's *Waiting on them*; rebuilding the English `demo.gif` and the
  older English screenshots (`board`, `role`, `next-actions` predate the current UI).

## Noticed, not promised

- The website at 800 px scrolls sideways: the hero, marquee and background stick out (seen on #323; check main first).
- A CNY role's pay reads "2800 CNY/天" and "500k CNY–700k CNY": `formatMoney` has symbols only for GBP, USD and EUR.
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
- A failed startup write of `.gitattributes` is silent (no log); snapshots report it where they run.
