# Now: state and live plan

Snapshot 2026-11-08, after #273 (main at `29e9ec8`, v1.19.5). Refresh this file before each compaction. Before
trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and `docs/ROADMAP.yaml`.

## State

- Released up to **v1.19.5**. No open PRs; only `main` locally and on GitHub, unless this snapshot is older than the last
  merge.
- **All 17 Simplified Chinese string files are in** (still a draft: shown only on a dev server, `?lang=zh-CN`).
- Kai's tracker on 8770 still needs a restart for #254's *Rejected* badge on roles (Ctrl+C, `uv run jat serve`). Since
  then everything is frontend, tooling or docs.
- Tests on main: pytest 1,309, browser 713 (#271's full run).
- Dependabot: #32 and #33, both minimatch in dev tools only; the fix (minimatch 11) waits for eslint and redocly. Leave
  them open unless Kai dismisses them.
- Background jobs of this session: the PM dashboard on 8767 and the zh-CN demo API on 8891
  (`uv run jat --data-dir /home/kai/.claude/jobs/cf5328f4/tmp/zh/demo serve --dev --port 8891`). A session restart
  stops both; restart the dashboard at once, the demo API only when a zh-CN task needs it.

## Done since the last snapshot (2026-11-07 / 08)

- #264 Backlog task `generalise-agent-tooling` (make the Claude Code-only tooling work with other agents; plan first).
- #265 the helper scripts in `tools/dev/`; #266 these notes and the after-compaction hook.
- Chinese string files, by builder agents with the lead running the workflows: #268 `today`, #267 `people`, #269
  `errors`, #273 `insights`. No release (draft).
- Bugs Kai picked: #270 `fix-add-another-role-carries-over` (v1.19.4); #271 `fix-offer-kind-pin-flaky` (v1.19.5: the
  pin now holds GET /roles until the form opens, capped at 5 s, and only then marks itself expected-to-fail).
- #272 `bugs-stale-key-pattern`: Kai asked whether other boxes are tied to a time instead of their record. Seven bugs share
  that cause: three new (`fix-stale-edit-other-dialogs` medium, `fix-today-reschedule-lost-when-due` low,
  `fix-midnight-drops-open-edits` low) and four linked (`fix-rename-drops-unsaved-about`, `fix-applied-date-wipe`,
  `fix-stale-edit-after-save`, `fix-note-reopen-stale`). One shared fix is planned, `fix-stale-key-pattern` (P7). Kai
  said not to fix them yet.

## Kai's latest asks (2026-11-07 / 08)

1. "the compaction doc is very long…" and "do it, but make sure that the files to be read after resuming do actually
   get read…" → #266. The user-level hook needs Kai: the auto-mode check refused editing `~/.claude/settings.json`; the
   JSON to add is in `docs/COMPACTION.md`'s first section (SessionStart, matcher `compact`,
   `tools/dev/after_compact.sh --user`). Not confirmed added.
2. "actually dont paralleisd im close to usage limit" (2026-11-07), then on 2026-11-08 "do today and people in parallel
   with agents, not yourself": translations and fixes go to builder agents.
3. "choose 3 easy bugs to fix…" → listed; "do 1, do 3 but ensure there is a maximum time limit for the test so it cant
   wait forever, on bug 2 … investigate this pattern of bug and report back and add to roadmap, dont fix yet" → #270,
   #271, #272.
4. "of the new chinese work, are there other tasks to pick up that are not translations" → listed (below); then
   "actually just do the last translation" → #273. The three tooling gaps were offered, not taken up.
5. "update teh compaction doc" → this refresh.

## Next

Nothing Kai asked for is unfinished. Report and wait. When Kai picks, the likely next items are:

- **`i18n-zh-cn-layout`** (`next`): CJK fonts, clipped labels, and capitals styling that turns Offer into OFFER on stage
  badges and section headings (Today's 待答复的 Offer). Can start now.
- **`i18n-zh-cn-switch-on`** (`next`, minor): into `LANGUAGES`, drop the dev-only gate, load on demand, README "Use it
  in your language"; decide about plain `zh`/`zh-Hans` browsers. All 17 files are in, so it's unblocked.
- Then `-demo-data` (Kai to confirm), `-screenshots` (show Kai first), `-readme`, `-website` (Kai to confirm), `-listing`
  (Kai approves the exact text).
- **Tooling gaps offered, not on the roadmap:** `apply_review.py` and the consistency pass mishandle keys carrying the
  namespace prefix (`errors.x`, `insights:x`; seen on `errors` and `insights`, fixed by hand); `screenshots.py` can't
  click (tabs) or make a save fail (error toasts), so builders wrote throwaway helpers; `pages.json` points at an agency
  by literal id (people) because agencies can't be looked up by name. Add them only if Kai says.

**How a translation or fix ran this round** (keep doing it this way unless Kai says otherwise):
- A builder agent per item (`isolation: "worktree"`, no `name`), briefed by `/home/kai/.claude/jobs/cf5328f4/tmp/deps/zh-builder-brief.md`
  (translations) or `tools/dev/briefs/bug-fix.md` (bugs). Builders have **no Workflow tool**: they stop at each workflow
  step with an args file; the lead runs the workflow (`scriptPath` in the builder's worktree), saves `.result` from the
  task output file into the builder's `var/i18n/zh-CN/<ns>/` (translate.json, review.json, rereview-1.json) and resumes
  the builder with SendMessage.
- One Sonnet reviewer per bug PR (diff saved to a file, Read-only); the lead adds the bump (`tools/dev/bump.py`), runs
  `tools/dev/checks.sh` (full for app or test changes), merges with `tools/dev/merge.sh`, then
  `tools/dev/ship.sh <version|-> <pr> <agent worktree folder> <branch>` from the main checkout. Agent worktrees stay
  locked: `git worktree remove -f -f` them and delete their branches if `ship.sh` couldn't.
- Merge order: whatever's checks are already running goes first; the next branch merges main and reruns its checks.

**Simplified Chinese decisions** (Kai): `zh-CN`; Traditional browsers stay English; "More coming soon"; AI translation,
corrections by issue or PR; a draft until switch-on; no release while a draft; Opus translates and judges, Sonnet and Opus
review; no screenshots in PRs. Cost this round: today about 4M, people 4.3M, errors and insights each about 3.5M (the
review workflows are the biggest share).

## Waiting on Kai (don't start)

- **The MCP server:** the `mcp-*` tasks wait on the 11 decisions in `docs/rfc/mcp.md` §14.
- **Windows** (`docs/rfc/windows.md`): `windows-starts` first; issue #230's author picks a task. Don't post for Kai.
- **Backlog to plan with Kai:** `generalise-agent-tooling`, `fix-stale-key-pattern`, `code-cleanup`,
  `delivery-speed-improvements`, `recruiter-open-application-mark`, `i18n-search`, the P11 test gaps,
  `tests-reorganise`, Docker, `packaged-install`, `desktop-app`, `hosted-version`, `demo-site`.
- **Left alone** (Kai, 2026-11-02): `notes-documents-improve`, `timeline-improve`, `people-you-meet`.
- **Offered, no answer:** the GitHub description and topics from #96; a short brand name; tile rows on other pages;
  dropping *Screen* from the default workflow; linking the recruiter in the Applications list; rebuilding `demo.gif`.
- **Open bugs:** 67 in phase B, 1 high (`fix-applied-date-wipe`, also in the stale-key family). None is fixed without
  Kai's go. Quick ones left from the last pick: `fix-backup-same-site` (a behaviour change to the backup route, look
  first), `fix-archive-lock-not-ignored` (trivial, rare). Two lack rating fields: `fix-escape-closes-quick-view`,
  `fix-phone-header-overlap` (likely a duplicate of `fix-phone-header-overflow`).

## Noticed, not promised

- README screenshots show the old language icon; `insights-stats.png`, `demo.gif`, `recruiters.png`, `person.png` and
  `roles.png` show older UI.
- Long text clips on Today's Waiting rows, the call form's How and the offer form's kind (for other languages).
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- The application page's People card ignores a recruiter set through the route.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
- Suspected, unconfirmed (from #272): the Interviews page at midnight; to-dos beside a round or call have no `key`; the CV
  adopt dialog's ticked applications are seeded once.
