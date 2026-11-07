# Now: state and live plan

Snapshot 2026-11-07, after #266 (docs-compaction-slim). Refresh this file before each compaction. Before trusting it,
check `gh pr list`, `git worktree list`, `git log --oneline -5` and `docs/ROADMAP.yaml`.

## State

- Released up to **v1.19.3** (#259). Internal PRs since, with no release: #264 (Backlog task `generalise-agent-tooling`),
  #265 (helper scripts in `tools/dev/`), #266 (this file and its siblings; COMPACTION.md cut to the paste-in prompt; the
  after-compaction hook).
- No open PRs; only `main` locally and on GitHub, unless this snapshot is older than the last merge.
- Kai's tracker on 8770 still needs a restart for #254's *Rejected* badge on roles (Ctrl+C, `uv run jat serve`).
- Tests on main: pytest about 1,310, browser 713 (#259's full run). A one-off browser-test 500 on `GET /offers` (#258)
  passed on rerun; if it recurs, keep the server log and record a bug.
- Dependabot: #32 and #33 are both minimatch in dev tools only. The fix (minimatch 11) waits for eslint and redocly to
  accept it; leave both open unless Kai dismisses them.

## Kai's latest asks (2026-11-07)

1. "the compaction doc is very long, does it need to be that long…" → this split (#266).
2. "do it, but make sure that the files to be read after resuming do actually get read after resuming… perhaps also
   reference and guide to read other relevant files after resuming" → the SessionStart hook and docs/agents/README.md.
3. "what are the helper scripts? yes move them to the repo" → #265.
4. "also add a roadmap item to generlise the claude code specific cotnent to work with other agents/harnesses e.g. the
   translations workflows" → #264, Backlog.
5. "actually dont paralleisd im close to usage limit dont want to go over": one PR at a time, single reviewers (Sonnet
   for small PRs), no fan-out, until Kai says otherwise.

## Next

**Resume the Simplified Chinese strings with `today` (152 strings), as its own PR**, then report and wait for Kai's go
on the next file. Kai scopes one file at a time ("do roles"), although the `i18n-zh-cn-*` tasks sit in Up next.
First start the demo API on 8891 (it stops when the session restarts), from the main checkout, as a background job:
`uv run jat --data-dir /home/kai/.claude/jobs/cf5328f4/tmp/zh/demo serve --dev --port 8891`. If that folder is gone,
seed a new one with `uv run python scripts/seed_demo.py <dir>`.

**Simplified Chinese** (`docs/rfc/zh-cn.md`, tasks `i18n-zh-cn-*`, P8):
- Done, 13 of 17 files: applications, stages, files, todos, calls, documents, notes, events, offers, common, timeline,
  interviews, roles.
- Left, smallest first: today 152, people 213, errors 269, insights 327. No pages yet in
  `scripts/i18n/translate/pages.json` for any of them.
- Then: `-layout` (CJK fonts, clipped labels, stage badges in capitals), `-switch-on` (minor: into `LANGUAGES`, drop
  the dev-only gate, README "Use it in your language"; load on demand; decide about plain `zh`/`zh-Hans`), `-demo-data`,
  `-screenshots` (show Kai first), `-readme`, `-website`, `-listing` (Kai approves the exact text).
- Pending glossary row: "track" is 追踪 (跟进 is following up), applied in #261; add it in the next zh-CN PR.
- **How a file runs** (details in `scripts/i18n/translate/README.md`):
  1. Worktree `worktree-i18n-zh-cn-<ns>`, task `building`, draft PR. Add the file's pages to `pages.json`
     (`{person:Alex Morgan}` placeholders only resolve as a whole path).
  2. `prepare.py zh-CN <ns>`; a dev server for the branch (`JAT_API_URL=http://127.0.0.1:8891 pnpm exec vite --port
     51xx --strictPort` from its `frontend/`); `screenshots.py … en`.
  3. Workflow `i18n-translate` (`scriptPath` the worktree's `.claude/workflows/i18n-translate.js`, args
     `{lang, language, ns, wt, areas}`, `areas` the parsed `areas.json`); save the result as
     `var/i18n/zh-CN/<ns>/translate.json`, dropping consistency changes whose key isn't in `flat.json`.
  4. `assemble.py`; add the consistency pass's `glossary_additions` to `docs/i18n/zh-CN.md` by hand; catalog test; commit.
  5. `screenshots.py … zh-CN`; workflow `i18n-review`, saved as `review.json`; `apply_review.py` (apply the judge's
     glossary notes it prints); `assemble.py zh-CN <ns> review-fixes.json`; workflow `i18n-rereview` (cross-file changes
     into `changed.json` first) until no must_fix. A reviewer's note about code is checked and, if real, recorded as a bug.
  6. Task `done`, merge main (`tools/dev/merge_main.sh`, then check the roadmap diff), `tools/dev/checks.sh --no-e2e`
     from the worktree root.
  7. PR body: what was done in our own words, what changed, the judge's table from `review-table.md`, the agents and
     tokens table, checks, "Browser tests skipped" and why. `gh pr ready`, `tools/dev/merge.sh`, then
     `tools/dev/ship.sh - <pr> <worktree>` from the main checkout (no release while Chinese is a draft).
- **Kai's decisions:** `zh-CN`; Traditional Chinese browsers stay English; "More coming soon"; AI translation,
  corrections by issue or PR; a draft until every file is in; **no release while a draft**; one PR per string file,
  smallest first; Opus translates and judges, **Sonnet and Opus review** (no Haiku); **no screenshots in PRs**; no saved
  context pack.
- **Cost:** about 14–16k tokens per string (roles 1.97M for its strings); the screenshots set most of a review's cost.
  Kai is near the usage limit: say so before starting a file, and offer to wait.

## Waiting on Kai (don't start)

- **MCP server:** the ten `mcp-*` tasks wait on the 11 decisions in `docs/rfc/mcp.md` §14 (mainly the `mcp` SDK as an
  optional dependency).
- **Windows** (`docs/rfc/windows.md`): `windows-starts` first; issue #230's author picks a task; Kai tests on Windows.
  Don't post or reply for Kai.
- **Backlog to plan with Kai:** `generalise-agent-tooling`, `code-cleanup`, `delivery-speed-improvements`,
  `recruiter-open-application-mark`, `i18n-search`, the P11 test gaps, `tests-reorganise`, Docker, `packaged-install`,
  `desktop-app`, `hosted-version`, `demo-site`.
- **Left alone this session** (Kai, 2026-11-02): `notes-documents-improve`, `timeline-improve`, `people-you-meet`.
- **Offered, no answer:** the GitHub description and topics from #96; a short brand name; tile rows on other pages;
  dropping *Screen* from the default workflow; linking the recruiter in the Applications list; rebuilding `demo.gif`
  (preview first).
- **Open bugs:** 65 in phase B (high 1: `fix-applied-date-wipe`; medium 18; low 46). None is fixed without Kai's go. If
  Kai asks for quick ones: `fix-rename-drops-unsaved-about`, `fix-archive-lock-not-ignored`, `fix-backup-same-site`,
  `fix-add-another-role-carries-over`. Two lack rating fields: `fix-escape-closes-quick-view`, `fix-phone-header-overlap`
  (likely a duplicate of `fix-phone-header-overflow`).

## Noticed, not promised

- README screenshots show the old language icon in the header; `insights-stats.png`, `demo.gif`, `recruiters.png`,
  `person.png` and `roles.png` show older UI.
- Long text clips on Today's Waiting rows, the call form's How and the offer form's kind (for other languages).
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- The application page's People card ignores a recruiter set through the route.
- `tools/pm/yamlish.py` isn't `ruff format`-clean (not in the checks).
