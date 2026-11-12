# Now: state and live plan

Snapshot 2026-11-12, after #346 (main at `2598d1a`, v1.24.13). Refresh this file before each compaction. Before
trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and `docs/ROADMAP.yaml`.

## State

- Released up to **v1.24.13**. Open PRs: only this refresh until it merges. Branches on GitHub: `main` and
  `worktree-pr-screenshots` (shelved, kept on purpose). Local: `main` and `pr324` (old, left alone).
- **The website is redesigned and live** (https://waddington.github.io/job-application-tracker/): concept 1i, built in
  #336–#346 behind a hidden `/preview/` (now a redirect to `/`). Plan and every round of Kai's notes:
  `docs/rfc/website-redesign.md`. Code: `website/src/components/site/`, `website/src/layouts/Base.astro`,
  `website/src/styles/site.css`; the hero's app demo is `site/AppDemo.astro` (screenshots on a fixed 1440×900 stage,
  scaled with one CSS variable; the HTML pieces sit at the screenshot's own pixels). Concepts PR #334 is closed.
- **Website-only PRs skip the app's checks**: `tools/dev/checks.sh --website` (#341, rule in CLAUDE.md), about a minute.
  Its guard refuses if anything the app is built from changed; version files may change only their own version line
  (`tools/dev/version_only.py`).
- **Loading states**: part 1 shipped (v1.24.4: `QueryState`, skeletons and "Couldn't load this." + Retry in four
  cards). Parts 2–4 are on the roadmap as `next` (`loading-state-failed-loads`, `-silent-cards`, `-page-skeletons`).
- Kai's tracker on 8770 needs a restart (Ctrl+C, `uv run jat serve`) for v1.24.1 (Python changed). The main
  checkout's frontend is rebuilt to 1.24.13.
- Background jobs of this session: the PM dashboard on 8767. No dev, demo or concept servers.
- The user-level after-compaction hook is still **not** in `~/.claude/settings.json` (JSON under *Waiting on Kai*).

## Done since the last snapshot (2026-11-12)

| Version | PR | What |
|---|---|---|
| 1.24.1 | #329 | Applications save again after their recruiter moves agency or their agency/recruiter is deleted |
| 1.24.2 | #330 | Deleting a call asks first ("Delete this call and its notes? Roles added from it stay.") |
| 1.24.3 | #331 | Emptying the Agency or Company box takes it off (only while the box has focus) |
| 1.24.4 | #333 | Loading-state part 1: `QueryState`, skeletons and Retry in Roles, Calls, Done recently, Recent activity |
| 1.24.5 | #338 | One shared head for the website's pages (`SiteHead.astro`; bump.py reads `softwareVersion` there) |
| 1.24.6 | #336 | The redesigned page's shell at /preview/ |
| 1.24.7 | #339 | The hero: drifting cards and the 3D browser |
| 1.24.8 | #340 | The app in use inside the hero window |
| 1.24.9 | #343 | The middle sections (statement, glass board, Today, Insights, centre line) |
| 1.24.10 | #342 | The sticky story |
| 1.24.11 | #344 | Languages, quick start and FAQ (copy now in `data.ts`) |
| 1.24.12 | #345 | No layout shift in the hero on phones |
| 1.24.13 | #346 | The redesign becomes the homepage |

Internal: #332 (`pytest-parallel`, loading-state parts 2–3 planned), #335 (`hosted-mcp` planned), #337 (redesign plan),
#341 (`checks.sh --website`), this refresh (`loading-state-page-skeletons`).

## Kai's asks this round (2026-11-12)

1. "choose 5 bugs to pickup" → "tell me what the proposed fix is and whether the same pattern has other bugs" → "do
   1-4 sequentially, dont do 5 yet" → #329–#331 (bug 5, `fix-double-save-locked`, untouched). Wording for #330:
   "that wording is fne". New bug found: `fix-app-person-remove-no-confirm` (backlog).
2. "choose 1 item from the backlog" → "give me 5 options" → asked about `e2e-shared-server` (measured: 2–5%, barely any
   load saved) → "add the parallel test runner to the roadmap" (`pytest-parallel`) → loading-state pattern: "skeletons,
   retry wording is fine, keep page spinners" → "plan out each item … put them in up-next" → later "i prefer skeletons
   to loading spinner" / "yes skeletons instead of page spinners" (part 4 added in this refresh).
3. Website redesign: "redesign the static page website … liquid glass … 5 concepts … DO NOT MERGE" → rounds (see the
   RFC) → "1i, ship it" → "keep going with the redesign getting it shipped" → "go, ship it" (#346).
4. "i only want you to work on the website redesign for now, dont start anything else" — the redesign is done; nothing
   else has been started since. Treat it as: report, then wait for Kai to pick the next thing.
5. "whats taking so long" → `checks.sh --website` and a second builder in parallel ("yep do 1 and 2").
6. "new feature idea for roadmap, hosted version with public MCP … hwo would auth work here?" → `hosted-mcp` (#335).
7. "cleanup old branches when you're done with them too" → done after each merge (working-with-kai.md).
8. "kill both old dev servers" → one leftover process; stopped.
9. "update compact doc" → this refresh.

## Next

Nothing Kai asked for is unfinished. Report and wait; Kai picks. Likely candidates:

- **App redesign** (phase P12, ten `next` tasks heading Up next; Kai, 2026-11-12, after the star count shipped as
  v1.24.14, #348): the app in the website's look, starting with concepts on a dev server. Content stays, the look
  changes. Part 4 (components) waits for the loading-state parts. The shelved before-and-after screenshot tool
  (`pr-screenshots`, branch gone from GitHub, commit `a283908` via PR #291) would serve its PRs.
- **Loading states, parts 2–4** (`next`): Timeline and Weekly activity's failed loads; the cards blank while loading;
  whole pages as skeletons.
- **Bugs:** 54 open (9 medium, 45 low). Mediums include `fix-double-save-locked` (bug 5 of the last five: needs a
  decision on taking the write lock early), `fix-deletes-no-confirm`, `fix-app-person-remove-no-confirm`,
  `fix-duplicate-role`, `fix-duplicate-company-name`, `fix-duplicate-agency-name`, `fix-hidden-link-blocks-save`,
  `fix-didnt-happen-notes-hidden`, `fix-timeline-load-error-silent` (= loading-state part 2).
- **Planned:** `pytest-parallel`, `calendar-page`, `hosted-mcp`, `interview-process-plan`, `recruiter-open-application-mark`
  and the rest of the backlog.

**How work ran this round** (keep doing it this way unless Kai says otherwise):
- One builder agent per part, in its own worktree; a second builder in parallel for an independent part when Kai wants
  speed; PRs merge one at a time in order. Opus reviewers for anything visual or structural (they build in /tmp and
  drive headless Chrome), Sonnet for small or docs PRs; re-review every fix commit.
- Website work: design concepts on a dev server with a switcher, rounds of sub-variations, then build behind a hidden
  route in small PRs, then a switch PR with a before/after table that Kai approves before merging.
- After each merge: `ship.sh` (pass `keep-agent-worktree` when the builder's worktree is still in use), then delete the
  branch and worktree.

## Waiting on Kai (don't start)

- **The user-level hook:** add to `~/.claude/settings.json` next to `"env"` (the auto-mode check refuses this edit):
  ```json
  "hooks": { "SessionStart": [ { "matcher": "compact", "hooks": [ { "type": "command",
    "command": "/home/kai/Documents/Projects/job-application-tracker/tools/dev/after_compact.sh --user", "timeout": 30 } ] } ] },
  ```
- **Restart the tracker** for v1.24.1 (Python changed).
- **The Dependabot alert** (#33, moderate) on GitHub: not looked at.
- **Decisions:** `fix-double-save-locked` (how write requests take the database lock); `i18n-zh-cn-offer-word`,
  `i18n-zh-cn-brand-name`; the MCP decisions in `docs/rfc/mcp.md` §14; `hosted-mcp`'s open questions (in its entry).
- **The VM's README** (Kai's `windows-vm` project): `virsh shutdown` didn't stop Windows; `ssh winvm 'Stop-Computer -Force'` did.
- **Repo gaps offered for contributors, no answer:** CONTRIBUTING asks contributors to update `CHANGELOG.md` though Kai
  asked them to leave it; PRs get no automatic checks.
- **Left alone** (Kai, 2026-11-02): `notes-documents-improve`, `timeline-improve`, `people-you-meet`.

## Noticed, not promised

- `docs-contributor-prs` is still `building` on the roadmap with no branch: check whether it's done.
- The redesign's hero demo shows the app at 1.24.7; re-capture its screenshots when the app's look changes
  (CONTRIBUTING *The website* has the recipe).
- A CNY role's pay reads "2800 CNY/天" and "500k CNY–700k CNY": `formatMoney` has symbols only for GBP, USD and EUR.
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
- A failed startup write of `.gitattributes` is silent (no log); snapshots report it where they run.
