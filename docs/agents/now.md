# Now: state and live plan

Snapshot 2026-11-11, after #308 (main at `e119d89`, v1.23.3). Refresh this file before each compaction. Before
trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and `docs/ROADMAP.yaml`.

## State

- Released up to **v1.23.3**. No open PRs, ours or the contributor's. Branches: `main`, plus `worktree-pr-screenshots`
  on GitHub (shelved work, kept on purpose: see `pr-screenshots` on the roadmap).
- **Windows** (`docs/rfc/windows.md`): six of nine plan items done (`windows-rfc`, `windows-time-zones`,
  `windows-starts`, `static-file-types`, `utf8-everywhere`, `data-gitattributes`). The tracker starts and runs on
  Windows, snapshots off there; README, website and guide still say it isn't supported, as the plan says until
  `windows-support`. Left: see *Next*.
- **The contributor's five Windows PRs are all carried and merged** (#285 → #298, #283 → #300, #301 → #305,
  #284 → #306, #302 → #308). The process is in [contributor-prs.md](contributor-prs.md). GitHub shows all but #285
  as merged (#285: `Closes`, see the guide).
- **The Windows VM** (`ssh winvm`, gotchas.md *Windows VM*) is shut down; reset it to its clean snapshot before using it.
- **Merging and releasing:** Kai's standing yes after the review-fix cycle (working-with-kai.md). `.claude/settings.json`
  allows `tools/dev/merge.sh` and `ship.sh` (#295); run them relative (`tools/dev/merge.sh N`) and they go through.
- Kai's tracker on 8770 needs a restart (Ctrl+C, `uv run jat serve`) to serve 1.23.x: #300 changed `/health` and the
  CLI, #306 and #308 the data folder handling. The frontend in the main checkout is rebuilt.
- Tests on main: pytest 1,383, browser 723 (#308's full run). On Windows: 1,351 pass, 11 skip, 18 fail, all listed in
  `windows-tests-green`.
- Dependabot alerts #32 and #33, both minimatch in dev tools only; the fix (minimatch 11) waits for eslint and redocly. Leave
  them open unless Kai dismisses them.
- Background jobs of this session: the PM dashboard on 8767. A session restart stops it; restart it at once. Demos only
  when a task needs one (`uv run python scripts/seed_demo.py <new dir>`, then `uv run jat --data-dir <dir> serve --port 88xx`).
- The user-level after-compaction hook is still **not** in `~/.claude/settings.json` (the JSON is under *Waiting on
  Kai*).

## Done since the last snapshot (2026-11-10 / 11)

- #298 (v1.22.1): `tzdata` on every platform (carried #285), plus a 500 on `?tz=Europe` fixed (Python 3.12 raises
  `IsADirectoryError` with `tzdata`).
- #300 (v1.23.0): the tracker starts on Windows (carried #283): `src/jat/platform.py` (`is_windows()`, `snapshots_allowed()`,
  the lock), snapshots off on Windows, `JAT_WINDOWS_SNAPSHOTS=1` to test them, `/health` gains `snapshots_enabled` and
  `windows`, the error code `backup_snapshots_off_windows`. Snapshot-feature tests skip on Windows (`unix_only`).
- #305 (v1.23.1): the app's own files served with fixed types (carried #301), so the page isn't blank on a Windows
  whose registry says `text/plain` for `.js`.
- #306 (v1.23.2): text read and written as UTF-8 in `src/jat` (carried #284), with a check (`tests/test_encoding.py`)
  that also reruns its tests under an ASCII default on Linux.
- #308 (v1.23.3): a `.gitattributes` in the data folder (carried #302): uploads byte for byte, export, notes and config
  LF; written by `jat init`, on app start and before each snapshot.
- Docs: #299 and #307 (`docs/agents/contributor-prs.md`, the guide for outside contributors' PRs), #304 (the Windows VM in
  the notes), #303 (`google-doc-content` on the backlog). This refresh.

## Kai's latest asks (2026-11-10 / 11)

1. "which of the open PRs is the first to merge" → #285, #283, #284; then reviews of each with `/agent-team` and
   `/code-review`, findings in chat only ("we will ask PRs to fix main issues, but for small thigsn we will roadmap as
   flllowups and fix myself").
2. Carrying: "is there a way to do it as our own branch but maintain them as contributing?" → "yes I prefer B"; the PR
   body opens with a friendly note tagging the author in Kai's voice; "lets not add the "CLoses ..." line … to see what
   the orginal PR shows as" → `Carries #N` leaves theirs merged.
3. "we need throgh security review of external PRs before agents run the code themselves".
4. The Windows VM: "can i do the windows testing inside a VM … can you control that VM" → Kai set it up (`ssh winvm`);
   "perhaps add somethign to this repo to refeerence that, not by absolute path" → #304; "you should be able to control
   the tests from here, and then you can iterate review-fix cycle".
5. "if you decuide we need to leave a comment on authors PR then you must report back to me and wait for my approval - in
   fact i will post the comment myself"; "only ever report in chat in the claude code instance. ever externally".
6. "how they adhere to the plan we created. we want them to stay on-track"; "your judgement call about what the author
   should fix, what we fix with the carry, and what we add to the backlog"; "perhaps put what i just said into a guidance
   doc" → #307.
7. "do 301" (and "i didnt say anything about 284, 301, 302. dont merge those yet" before that), "do 284, merge main into
   it, pushing to his PR", "do 302".
8. "if google doc links are inserted, perhaps follow them" plus "an explicit way to say "import google doc"" →
   `google-doc-content` (planned, #303).
9. "give me a final full report … of our windows support progress" → given in chat (2026-11-11); "tell me more about the
   pr301 types bug" → explained (minor scope creep: only `.ico` and `.map` upload types changed).
10. "update the compaction doc" → this refresh.

## Next

Nothing Kai asked for is unfinished. Report and wait. Likely next, when Kai says:

- **Windows, in the plan's order:** `fix-python-315-install` (a bug: needs Kai's go), `locked-file-retry`,
  `windows-testing` (the checklist in the guide), `windows-tests-green` (the 18 failures), then `windows-support`; later
  `windows-snapshots`. Follow-ups: `scripts-utf8`, `encoding-check-edges`, `windows-tz-tests`, `health-typed-response`.
- **Chinese:** `i18n-zh-cn-screenshots` (show Kai first), `-readme`, `-website`, `-listing` (Kai approves the text).
- **Planned, waiting for Kai's go:** `generalise-agent-tooling` (a plan was given in chat on 2026-11-10, not in the repo),
  `google-doc-content`, `docs-no-machine-paths`, `review-merge-script`, `pr-screenshots`, `interview-process-plan`,
  `fix-loading-state-pattern`, `fix-stale-key-pattern`, the three review-process tasks.

**How work ran this round** (keep doing it this way unless Kai says otherwise):
- Contributor PRs: [contributor-prs.md](contributor-prs.md), step by step. Each was carried; nothing went back to the author.
- The review-fix cycle: a Sonnet reviewer given the diff as a file; fix must_fix and the cheap should_fix items; prove a
  new test fails without the fix; a re-review of just the fix commit (SendMessage to the same reviewer); then
  `tools/dev/checks.sh` on the final commit (merge main in first if it moved, and run them again); `tools/dev/merge.sh N`;
  from the main checkout `tools/dev/ship.sh <version|-> <pr> <worktree> [<branch>]`.
- Windows changes: reproduce on main in the VM, show the fix, run the whole suite there and compare with
  `windows-tests-green`.

## Waiting on Kai (don't start)

- **The user-level hook:** add to `~/.claude/settings.json` next to `"env"` (the auto-mode check refuses this edit):
  ```json
  "hooks": { "SessionStart": [ { "matcher": "compact", "hooks": [ { "type": "command",
    "command": "/home/kai/Documents/Projects/job-application-tracker/tools/dev/after_compact.sh --user", "timeout": 30 } ] } ] },
  ```
- **The VM's README** (Kai's `windows-vm` project): `virsh shutdown` didn't stop Windows; `ssh winvm 'Stop-Computer -Force'`
  did. Kai may want that in its README.
- **Repo gaps offered for contributors, no answer:** `CONTRIBUTING.md` and the PR template tell contributors to update
  `CHANGELOG.md`, but Kai asked them to leave it; and PRs get no automatic checks.
- **The MCP server:** the `mcp-*` tasks wait on the 11 decisions in `docs/rfc/mcp.md` §14.
- **Backlog to plan with Kai:** as under *Next*, plus `code-cleanup`, `delivery-speed-improvements`,
  `recruiter-open-application-mark`, `i18n-search`, the P11 test gaps, `tests-reorganise`, Docker, `packaged-install`,
  `desktop-app`, `hosted-version`, `demo-site`.
- **Left alone** (Kai, 2026-11-02): `notes-documents-improve`, `timeline-improve`, `people-you-meet`.
- **Offered, no answer:** done-and-waiting rounds in Today's *Waiting on them*; a Chinese word for Offer (录用通知)
  instead of the Latin one; the GitHub description and topics from #96; a short brand name; rebuilding `demo.gif`.
- **Open bugs:** 69 in phase B, 1 high (`fix-applied-date-wipe`, in the stale-key family). None is fixed without Kai's
  go. New this round: `fix-python-315-install` (medium).

## Noticed, not promised

- README screenshots show older UI (`insights-stats.png`, `demo.gif`, `recruiters.png`, `person.png`, `roles.png`), and
  Recruiters now has the In progress tab and card counts.
- Money in CNY shows as "540,000 CNY": `formatMoney` has symbols only for GBP, USD and EUR.
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
- A failed startup write of `.gitattributes` is silent (no log); snapshots report it where they run.
