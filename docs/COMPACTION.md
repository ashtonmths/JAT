# Compacting the build session

The long-running Claude Code session that builds this repo compacts its context now and then.
This file says what the summary must keep, what it can drop, where to find what it dropped,
and how to carry on afterwards, so the work continues as if nothing happened.

**How to use it:** run `/compact` followed by everything under [The prompt](#the-prompt).
After compaction, the session follows [Resuming](#resuming-after-compaction), and
[Re-expanding](#re-expanding-what-the-summary-dropped) when it needs a detail back.

Sections 3, 4, 4a and 5 are a snapshot (2026-11-05, after PR #237, main at `5ed8f46`, v1.18.10), and 4a is the live plan;
refresh them before each compaction in a small docs PR. This repo is public: nothing here may contain Kai's job-search
data (no real companies, people, salaries or notes).

---

## The prompt

Summarise this session so work continues without asking Kai anything a sensible default
answers. Keep everything in sections 1–8 below, quoting Kai verbatim where quoted. Keep ids,
paths, ports, branch names, PR numbers, commit hashes and commands exact. Keep the last few
user messages word for word, with what was done about each, and anything promised but not yet
done. Drop what section 9 says. End with section 10: the resume steps and one line saying the
next action.

### 1. Standing instructions from Kai

`CLAUDE.md` in the repo is the source of truth and wins on any conflict. Carry these:

- **Keep going.** "keep going. im going afk. you have enough to work on for ages, you'll hit a
  rate limit before you finish. just wait it out." On a rate limit, wait about 30 minutes and
  retry. New work comes from Kai's feedback and section 4a.
- **Commits.** "commit small and frequently and often". Conventional Commits, one logical unit
  each, push after committing. End every commit message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the harness's current trailer;
  older commits say "(1M context)") and every PR body with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **PRs.** One worktree and PR per task, branch `worktree-<name>`. Claude merges its own PRs
  with `gh pr merge N --merge --delete-branch` after the review-fix cycle (CLAUDE.md *Git*), fixing
  every `must_fix`, the reasonable `should_fix` and the cheap nits, and reviewing again until no
  `must_fix` is left. Every PR goes through it, docs-only ones too; a large docs change gets a
  fact-check reviewer. Kai: "merge once ready and update local main".
- **Approval to merge and release (since 2026-10-31).** Kai: "if you have followed and completed the
  iterative review-fix cycle then it can auto merge and make a release as appropriate, but it needs
  my explicit permission each time to make a major release". So don't ask per PR, except for a major,
  or when Kai has said to hold that PR. The auto-mode permission check may still block `gh pr merge`
  and tag/`gh release create`: never work around a refusal; ask, and give the `!` command as a fallback.
- **What to start.** Kai scopes the work: "stop after merge and release, dont start the next one";
  "then stop once thats done, dont start the next". A dev preview (section 6) before merging only when
  Kai asks for one on that work: "i want to check the dev version before merging".
- **Up next and Backlog (since 2026-11-02, in `CLAUDE.md`).** Not started is two roadmap statuses:
  `next` (Up next: work Kai has asked for, queued) and `planned` (Backlog: ideas and things to plan with
  Kai first). Only `next` work is started; work from Kai's feedback goes on as `next` (or `building` when
  its own PR adds it). With nothing up next, "Report and wait" (Kai's pick): tell Kai what's in the
  backlog and wait for Kai to pick. And (2026-11-02, about `notes-documents-improve`, `timeline-improve`,
  `people-you-meet`): "those things youre waiting on me for, leave them on the roadmap. we wont be doing
  thme this session".
- **Small PRs, split before building.** "they are big PRs, way over the 1k line target. This time I
  will allow it" (#196/#197). Since then a feature is split into ~500-line roadmap tasks before any
  code (API first, then screens, then insights): calls rescheduling and rejection feedback were five
  PRs each. Dependency updates: "it might be best to do only a couple of version updates per PR in case
  something breaks"; "be sure to run e2e tests for this as these updates have a high risk of breaking
  some behaviour".
- **Don't max out Kai's PC.** "you are maxing out my PC": since `test-resource-limits` (#217, v1.18.1) `pnpm test` and
  `pnpm e2e` cap their workers, run at low priority and take one lock across worktrees (`/tmp/jat-test-run.lock`;
  CLAUDE.md and CONTRIBUTING *Checks*). `<tmp>/deps/pm_checks.sh` still also wraps a whole run in the older
  `flock /tmp/jat-heavy-tests.lock nice -n 19 ionice -c 3`; the two locks don't wait on each other.
- **Plan before building when asked.** "lets plan it firtst and dont start building until i say
  so" (Docker); "dont build yet, just commit the plan"; "noooo noo no no, dont buikld antyhing
  eyt … undo all of that. i want to know what each PR would be". When Kai asks for a plan,
  write it (an RFC in `docs/rfc/`, roadmap tasks) and stop; build only on "lets get
  building" / "do the first item".
- **Branches.** "also delete branches on remote that are no longer needed". After each merge
  only `main` should remain, locally and on GitHub.
- **PM dashboard.** "keep the PM dashboard up to date, or even backfill items if they were not
  added". Every task gets a `docs/ROADMAP.yaml` entry in phase P7 (P8 for i18n; id = branch name minus
  `worktree-`, `prd: docs/prd/tracker.md`, `depends` on real task ids) in the PR that builds
  it, `status: building`, set to `done` just before merging. `uv run pytest -q tests/pm`
  checks the file still parses.
- **Docs and images.** "ensure docs are up to date, readme, images, etc". Every PR that adds or
  changes a feature, command, setting or data-folder behaviour updates `docs/guide/`, the
  README row (and its text and alt text), `llms.txt` and `CHANGELOG.md` in the same PR,
  checked against the code. When a change is visible in a README screenshot (or a `demo.gif`
  frame), retake it. The website (`website/`) copies the screenshots, so it follows.
- **Show before applying.** "i want to see the new gif(s) before you apply them"; "i want to be
  able to have it running asap so i can follow the progretss/chagnes in a browser with
  hotreloading". GIFs stay a standing ask: show them before applying. For other visual things
  (the website, colour schemes), preview when Kai asks: a local server, or files to look at.
- **Visibility.** After each merge: fast-forward main, rebuild the frontend on main, and say in
  a line what's now live. If the backend changed (a migration, a new or changed API), Kai must
  Ctrl+C and rerun `uv run jat serve` in their terminal; a frontend-only change needs a page
  refresh.
- **Version and status.** "it is ready, im using it. i just havent bumped a version number to
  the first major release". Kai then asked for 1.0.0 (released 2026-10-25) and for semver on
  every PR: "most are patch unless its new feature then it would be minor. it should be very
  explicit asking me for permission to merge a major bump". The rules are in `CLAUDE.md`
  (*Versions and releases*): bump in each PR, release each version, ask before any major.
  Released: v1.0.0 up to v1.18.10 (section 4a). Kai: "yes add release for each change"
  (each i18n PR is its own patch release; the switcher was minor). Only internal planning
  files (`CLAUDE.md`, `docs/ROADMAP.yaml`, `docs/COMPACTION.md`, `docs/IDEAS.md`, `var/`) and the PM dashboard skip
  the bump.
- **Privacy.** Kai's data never enters this repo. Tests, fixtures, seed data and screenshots use
  fictional names (Contoso, Fabrikam, Litware, Northwind Talent, Northwind Pay, Blue Yonder
  Recruitment, Alex Morgan, Riley Chen, Sam Patel, Jordan Lee…) and example.com. Never act on
  Kai's real data folder beyond reading status (`/api/v1/backup`, `git log`/`status`, a GET to
  check a migration or endpoint is live, e.g. `/api/openapi.json`); never POST, PATCH or
  DELETE against Kai's tracker. Kai's screenshots show real names: never copy them
  into the repo, commits or PRs.
- **Scope cuts.** No job searching or scraping, no quick-add from URLs, no `.ics` export.
  The MCP cut is reversed: Kai asked for "mcp or smt so local agents can query the status and
  perhaps make changes" (#101; planned in detail in `docs/rfc/mcp.md`, roadmap `mcp-plan` and the
  `mcp-*` build tasks, 2026-11-03). Dropped on request: Search Console and
  Google Analytics ("lets forget search console and GA"), a test CI workflow ("skip the CI
  tests workflow"), a coined phrase ("forget it"), and a Chinese README for now ("leave it for
  now", it comes with `multi-language`).
- **Outward-facing changes** (repo settings, Pages, description, topics, publishing) need Kai's
  yes first. Given so far: the description and topics ("Yes make the chnages"); Pages, the
  repo's Website field and the README link ("merge it, setup github pages, update the repo url
  to point to the pages"). **Not given yet:** the description and topics proposed in #96 (see
  section 5). Kai uploads the social preview by hand (Settings → General → Social preview).
  Kai made a branch ruleset `main` (2026-11-02): block deletion and force pushes only; merges work as before.
- **English dates are day, month, year.** Kai: "english dates should be 31st October 2026 (day
  month year), american is month day year". Every date goes through the dayjs patterns in
  `utils/format.ts` ("31 Oct 2026", "30 Oct 2026, 19:25"), never the browser's locale.
- **Documents** go in the repo, not artifacts. Deleting anything of Kai's needs confirmation.
- **No agent-team skill in this repo.** Plain `general-purpose` subagents for reviews and
  fact-checks.

### 2. Project facts

- **Repos.** Code: `/home/kai/Documents/Projects/job-application-tracker`
  (`waddington/job-application-tracker`, public, created 2026-09-30). Data:
  `/home/kai/Documents/Projects/job-application-tracker-data` (private; Kai pushes it).
  Worktrees: `.claude/worktrees/<name>`.
- **GitHub listing.** Description "Open-source, self-hosted job application tracker for
  software engineers. Kanban board, recruiter CRM, interview rounds, follow-up reminders,
  offers compared side by side, Sankey funnel and insights. Local-first: your data stays in
  plain files on your machine. A free Huntr / Teal alternative with no scraping." 20 topics
  (job-application-tracker, job-tracker, job-search, job-hunting, job-hunt, jobhunt,
  job-search-tracker, job-search-tool, application-tracker, job-applications, job-tracking,
  job-seekers, job-seeker, interview-tracker, offer-comparison, job-offers, recruiter-crm,
  recruiters, self-hosted, local-first). Website field:
  https://waddington.github.io/job-application-tracker/. Social preview:
  `docs/social-preview.png`, indigo, layout B since #96: "No AI. No cloud. / No account. No
  tracking." (that order since `tagline-reorder`) beside the whole-picture Sankey (Kai: the
  board is what every competitor shows).
  Rebuilt by `python3 scripts/social_preview/make_card.py [--layout a|b]` from `card.html`
  (layout A is a checklist). 9 stars as of 2026-11-02.
- **Website** (`website/`, Astro 7, one landing page, PR #64): published by
  `.github/workflows/website.yml` to GitHub Pages (Source: GitHub Actions) on pushes to main
  touching `website/**`, `docs/screenshots/**`, `docs/social-preview.png`,
  `frontend/public/**` or `llms.txt`. `scripts/sync.mjs` copies the screenshots, social card,
  favicon and `llms.txt` in (git-ignored). Palette **paper** (warm off-white, ink, burnt
  orange); `forest`, `ember`, `indigo` exist, and a switcher plus `?palette=` work in
  `pnpm --dir website dev` only. Docs links go to the guide on GitHub (no docs section). Since
  #96 the copy speaks to job seekers who aren't developers (no `git clone` in the hero, a "What
  you'll need" setup, FAQ on being technical, Huntr/Teal, AI, Windows, phone, import), with SEO
  title "Free Job Application Tracker: private, no sign-up, open source". The footer says
  "Hosted on GitHub Pages; this site adds no cookies, analytics or trackers".
  `waddington.github.io/robots.txt` 404s, so the site's own robots.txt has no effect. `pnpm --dir website dev` (localhost:4321, Astro 7
  runs it as a background daemon: `npx astro dev stop` / `status`), `build`, `preview`,
  `format`; `build` runs `astro check`.
- **Docs.** `docs/guide/` (README, install, your-data, using-the-app, customising, commands,
  troubleshooting), `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/` (bug, feature, links),
  `.github/pull_request_template.md`, `docs/prd/tracker.md`, `docs/rfc/stack.md`,
  `docs/ROADMAP.yaml`, `CHANGELOG.md`, `docs/IDEAS.md`, `docs/screenshots/` (17 PNGs incl.
  `conversations.png` and `cv-insights.png`, plus `demo.gif`), `docs/social-preview.png`, this file.
- **Demo GIF.** `python3 scripts/demo_gif/make_demo_gif.py [--out x.gif] [--hold 150]` renders
  `scripts/demo_gif/scene.html` frames with headless Chrome and builds the GIF with
  ImageMagick (1.5 s per scene, 45 frames, ~2.7 MB). Show Kai a preview before replacing it.
- **API docs page** `/api/docs` serves Swagger UI from the app (`_api_docs` in `app.py`; the
  build copies `swagger-ui-dist` into `dist/api-docs/`, and Vite serves them in dev), not a CDN
  (#96), so nothing is fetched from the web.
- **Stack.** Python 3.12, uv, FastAPI, SQLAlchemy 2.1, Alembic (migrations 0001–0017) and
  SQLite in `src/jat`. Frontend `frontend/`: Vite 8, React 19, TypeScript 5.9, Mantine 9,
  TanStack Router/Query, dnd-kit, d3-sankey, react-markdown, openapi-fetch.
- **Data folder.** `--data-dir` or `JAT_DATA_DIR` (env var or `.env` in the current
  directory; `~` expanded). Kai has a `.env` in the main checkout. `tracker.sqlite3` is
  git-ignored and rebuilt from `export/*.jsonl` by `jat restore`. Snapshots commit 60 s after
  the last write; pushing is `jat push` only. Notes are Markdown files under `notes/` with
  their links in the front matter; `note_index` is rebuilt from the files (`_sync`).
- **Running apps.**
  - **The tracker:** `uv run jat serve` in the main checkout → http://127.0.0.1:8770
    (`/api/docs`), on Kai's data folder via `.env`. It migrates on start and serves
    `frontend/dist`. **Kai runs it in their own terminal** (as of 2026-10-25: `pgrep -af "jat
    serve"` shows it). On 2026-10-14 Kai said "start it up" and this session ran it as a
    background job, but that stopped when the session restarted, and Kai started their own.
    Never stop Kai's. After a merge that changes the backend, tell Kai to Ctrl+C and rerun it;
    a frontend-only change needs only `pnpm build` on main and a page refresh. Check it with
    `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8770/api/v1/health`; if it's down,
    say so and offer to start it as a background job from the main checkout.
  - PM dashboard: `python3 -m tools.pm` → http://127.0.0.1:8767 (pages in section 4a). Kai asked for it on 2026-10-25 and it runs as a
    background job of this session from the main checkout; restart it if it's gone.
- **Commands.**
  - Backend: `uv run pytest -q`, `uv run ruff check src tests scripts`, `uv run ruff format -q src tests`.
  - Frontend: prefix pnpm with `PATH=/home/kai/.nvm/versions/node/v22.23.3/bin:/home/kai/.local/bin:/usr/local/bin:/usr/bin:/bin`
    (`/home/kai/.local/bin` is where `uv` lives: without it e2e fails 580 tests with `spawnSync uv ENOENT`);
    `pnpm --dir frontend install --frozen-lockfile --silent` (new worktrees), then
    `typecheck | lint | test | build | format | gen:api`. Run `format` before committing.
  - After API changes: `uv run python -m jat.openapi` then `pnpm --dir frontend gen:api`
    (`tests/test_openapi.py` fails on drift, including docstring changes).
  - Demo: `uv run python scripts/seed_demo.py <new empty dir>` then
    `uv run jat --data-dir <dir> serve --port 88xx` as a background job (8886 was the last
    port). Since #99 the seed fills every section of Today (waiting, overdue in red, a
    recruiter slower than usual, a favourite, a follow-up due, a call to mark, an unbooked
    round). Rebuild `frontend/dist` in the worktree first so it serves the branch. TaskStop it
    after merging, and tell Kai the URL if they want to look.
  - Screenshots: Playwright with the system Chrome, from a throwaway env:
    `uv run --with playwright python <script>` with `p.chromium.launch(channel="chrome")`.
    Use it to click (tabs), scroll and crop to element boxes. Plain
    `google-chrome --headless=new --screenshot` works for a page top, not after anchors.
  - Link check: `python3 /home/kai/.claude/jobs/cf5328f4/tmp/check_links.py` (rewrite it if the
    tmp dir is gone: it resolves the guide's relative links and GitHub-style anchors).
  - Waiting on a PR's checks: a background Bash `until` loop on
    `gh pr view N --json mergeStateStatus` (not CLEAN-only: UNSTABLE while the website build
    runs), never a foreground `sleep`.
- **Scratch files** in `/home/kai/.claude/jobs/cf5328f4/tmp` (and `tmp/site/` for the website).
  Agents started with `isolation: "worktree"` can't write there: they use their worktree's git-ignored
  `var/`, or a uniquely named `/tmp/jat-<task>-…` folder they remove afterwards.

### 3. Product map (what exists, so you can find things)

- **Menu** (`frontend/src/nav.ts`, `NAV_GROUPS`): *Today* `/` (one item, so its group heading
  is hidden; `/next-actions` redirects to `/` in `router.tsx`). *Your applications*: Roles `/roles`, Applications `/applications`
  (list/board, `?view=board`), Interviews, Offers. *People and companies*: Recruiters,
  Companies. *Files and notes*: Documents, Notes. *Review*: Insights, Timeline. Detail pages:
  `/applications/$id`, `/roles/$id`, `/companies/$id`, `/agencies/$id`, `/people/$id`,
  `/search?q=`.
- **Header** (`components/Layout.tsx`; buttons in `components/HeaderButtons.tsx`): wordmark →
  `/`; **New application**; search (`/`); **?** How it works; the **language switch**
  (`LanguageSwitch`, #114, #182: an outlined button with a globe, the language's name and an arrow, the
  globe alone on a phone; English ticked, *Coming soon!* greyed out, *Pseudo-language (dev)* in dev only,
  *Don't see your language?* linking to the guide; saved in localStorage `jat.language`; `<html lang>`
  follows); theme toggle.
  Every date picker rings today (#82) and shows "D MMM YYYY" (`theme.ts` `valueFormat`);
  calendars follow the language (`DatesProvider` in `App.tsx`, weeks from Monday).
- **Translations (i18n; the cutover is done, English only so far; `docs/rfc/i18n.md`).** i18next + react-i18next.
  - **Draft languages** (#237): `DRAFT_LANGUAGES` in `i18n/language.ts` (code → own name), shown only on a dev server
    (`?lang=<code>`, or "<name> (draft)" in the switch), never saved; may miss whole namespaces (English shows), but each
    file must be complete; its `index.ts` must load exactly its files. Moves to `LANGUAGES` when every namespace is in.
  - `frontend/src/i18n/`: `index.ts` (`createI18n`, the app's `i18n`, strict mode throws
    `MissingValueError`/`MissingKeyError` in dev and tests), `language.ts` (`LANGUAGES`,
    `LANGUAGE_NAMES`, `pickLanguage`, `saveLanguage`, `isLanguage`, `PSEUDO` = `en-XA`,
    `?lang=pseudo` in dev), `pseudo.ts`, `catalog.ts` (key and placeholder checks, unused-key
    scanner), `types.check.tsx` (type tests).
  - English text: `frontend/src/locales/en/*.ts`, one namespace per area (`as const`, typed via
    `i18next.d.ts`; `TextKey` = "ns:key"). Other languages will be JSON in `locales/<code>/`; a missing
    key, namespace or plural form, or a `[TRANSLATE]` marker left in, fails `catalog.test.ts`.
    `scripts/i18n/new_language.mjs` writes a new language's starting files with every line marked;
    `docs/guide/adding-a-language.md` is the how-to.
  - All the app's text is converted. The lint rules in `frontend/eslint.config.js`
    (`i18next/no-literal-string` plus a `no-restricted-syntax` on text properties) cover every source file
    but tests, with what they miss listed in CONTRIBUTING.
  - What the API sends: errors have `code` and `params` beside `detail`; 422s translate from Pydantic's
    `type` and `ctx` (`api/validationText.ts`); saved events have `data.msg` and a typed `msg`
    (`components/eventText.ts`); Timeline entries have `kind` and raw fields (`components/timelineTitle.ts`).
    Default stages translate through `utils/stageName.ts`; renamed or added ones show as written.
  - `utils/format.ts`: `formatDay(value, pattern, lang)` and helpers; every date through the
    dayjs `PATTERNS`. `utils/time.ts` `formatDate`/`formatDateTime`/`ago` go through it.
  - `scripts/i18n/text_snapshot.py` + `text_diff.py`: before/after text check (section 6).
- **Today** (`pages/TodayPage.tsx`, `TodayPage.module.css`, `api/next_actions.py`; #99
  replaced `HomePage.tsx` and `NextActionsPage.tsx`): one line of numbers (active, interviews
  in two weeks, offers to answer) over a thin pipeline; then three groups (`Bucket`, h3, a
  count badge labelled "N in <group>"), two columns from `lg` (Your move left):
  - **Your move**: replies to read, offers to answer, how did it go?, to-dos due today or
    undated (`TodosSection`, with Add and Done recently), follow up, roles to decide.
  - **Coming up**: calls, interviews and to-dos dated later, by time, then rounds not booked.
  - **Waiting on them**: waiting to hear back (people rows: Chased / Ghosted / Not interested;
    *Usually replies within N working days*, *longer than usual*), gone quiet.
  Sections are small grey labels (`SectionLabel`, h4, `role="group"` with the title; the hint
  shows on hover/focus and is read by screen readers). Rows share `Row` (who on the left,
  stage and status on one line on the right, buttons underneath); each row is a soft tile that
  darkens under the pointer, with `.actions` at opacity 0.55 until hover/focus-within (always
  full on `hover: none`). To-dos and roles keep full-strength buttons. Recent activity and How
  it works fold away at the bottom. Getting started / *No applications yet* as before; it waits
  for applications only when nothing else shows. *How did it go?* (#87/#88,
  `components/OutcomeNotes.tsx`): a round's **Done** asks for the debrief and questions asked,
  **Didn't happen** (round or call) for what happened; nothing saves until you confirm.
- **Application page and quick view** (`pages/ApplicationPage.tsx`,
  `components/ApplicationDrawer.tsx`): summary, then **At a glance**
  (`components/AtAGlance.tsx`, rules in `utils/attention.ts`, #65). Then details, interviews,
  documents sent, offer, notes, links, files (+ *From the role*), log activity, timeline;
  to-dos, role and people on the right. *Route* (`RouteLine`, #89) links the recruiter, agency
  and company. Every application starts at the workflow's first stage (#83): one created later
  gets an *implied* creation event a second before plus an implied move (`data.implied`,
  `is_implied`, `in_time_order`); not undoable, not a stay, update, reply or weekly move;
  migration 0013 backfilled it (first stage read from the data folder's `config.toml`).
- **Roles** (`api/roles.py`, `components/Roles.tsx`, `pages/RolesPage.tsx`,
  `pages/RolePage.tsx`): pitched or spotted roles, **Apply** / **Interested** / **Pass** /
  Reconsider; a page per role with its files (shown on the application). Status (#77):
  `to_decide` (no application, not passed), `interested`, `closed` (#79, with `closed_as` =
  the latest application's stage name, e.g. *Withdrawn*), `applied`, `passed`; a view on the
  Roles page for each. All from `role_progress` in `domain/insights.py` (also `applied_rank`,
  `before_applied`, `stage_paths`): *applied* if any application's stage path got to Applied
  or later (or it was recorded straight at a closed stage with an applied date); else
  *closed* if every one is closed; else *interested*. Stage history is only loaded for roles
  that might not be applied. Role lines link to the latest application, and wrap their
  buttons under the role in narrow cards.
  *Interested* opens `ApplyModal` with `interested` (starting stage, no applied date; hidden
  when the workflow starts at Applied); the dialog's date follows before/after Applied until
  edited (`utils/applied.ts`). `move()` fills in `applied_on` when it reaches Applied or later.
  Changing a role's person (#92, `_role_recruiter_changed` in `api/routers.py` via the CRUD
  `after_update` hook) gives its open, unarchived, non-referral applications that had the old
  person (or nobody) the new one only where they fit (same agency; someone at the role's
  company for direct); others keep theirs with a note; route and agency never change. Notes
  use `note_change` (`manual` event, `data.bookkeeping`, not activity; `_activity_time` skips
  them). Recruiter changes on an application are noted too. The role form shows a hint.
- **People** (`pages/RecruitersPage.tsx` tiles with All / Agencies / Companies / Independent /
  *Favourites · n* / *Ghosted · n*, favourites first; `pages/PersonPage.tsx`): calls, roles mentioned, applications, interviews,
  to-dos, notes, links, files; **Timeline**, **Edit**, **Merge…**, **Delete**.
  - Merge and one person per email / LinkedIn (`components/MergePerson.tsx`,
    `domain/people.py`, #68).
  - **Ghosts** (#72): `components/GhostMark.tsx` (`GhostMark`, `useGhosted`, `PersonName`) puts
    a ghost before a ghosted person's name across the app (tiles, page icon, application
    list/board/quick view/People card, company/agency/role pages, calls, Today,
    Timeline entries and person lanes, search, Insights). Role lines say "(ghosted)". **Not a
    ghost** / **Remove Not interested** on the page, or the × on the tile chip, with Undo
    (`components/PersonChase.tsx`, `useAct`).
  - **Favourites** (#80): `contacts.favourite` (migration 0012, not null, default false);
    `FavouriteToggle` (☆, `aria-pressed`, label "Favourite: <name>") on tiles and the person
    page; a gold star (`FavouriteMark`) via `PersonName` / `PersonMarks` (both marks, used
    wherever the ghost shows); role lines add " ★". The edit form never sends `favourite`
    (only create does); merge keeps it if either had it.
  - **Reply times** (#73): `replies` table (migration 0011, backfilled from application
    events), `domain/replies.py` (`working_days` = weekdays after the wait day up to the reply,
    `is_reply_move`, `record`, `take_back_move`, `stats`); `ContactOut.replies` +
    `usual_reply_days` (median, rounded up); `components/ReplyHabit.tsx`, `utils/replies.ts`.
- **Documents** (`pages/DocumentsPage.tsx`, `api/documents.py`): CVs and cover letters with
  versions. **CV files you've attached** card (`components/CvFiles.tsx`, #74/#75):
  `GET /cv-files` finds PDF/Word files on applications, roles and people named like a CV or in
  two or more places (a role and its own application count as one), grouped by `sha256`, each
  with `sources` and the `applications` it counts for (role/person files only claim
  applications with no CV yet); `POST /cv-files/adopt` copies it into a version (or reuses the
  matching one) and records it on the ticked `application_ids` (sent on `applied_on`, else the
  earliest attachment linked to that application). *Not a CV* (localStorage `jat.notACv`,
  "Show … you said aren't CVs").
- **Board** (`components/Board.tsx`, `utils/board.ts`): *Show closed stages*, and **A column
  per interview round** (#91, localStorage `jat.board.byRound`): an active stage whose id/name
  says "interview" splits into *No round yet*, then Round 1… up to the furthest (empty gaps
  only up to Round 6); a card's round is `current_round` (next booked, else last done). Only
  *No round yet* takes drops (`isRoundColumn`, keys `<stage>#round-<n>`, `stageOfColumn`).
  A card's recruiter name links to their page, or the agency's when only the agency shows (`ViaLink`, #229); the link
  stops click, pointerdown and keydown so it doesn't open the quick view or start a drag. The list view's name isn't linked.
- **Test runs** (#217): `pnpm test` / `pnpm e2e` go through `frontend/scripts/test-run.mjs` (one at a time across
  worktrees on `/tmp/jat-test-run.lock`, low priority) with workers from `frontend/testWorkers.ts`.
- **The MCP server** is planned, not built: `docs/rfc/mcp.md` (#228), the `mcp-*` tasks.
- **Interviews page** (`pages/InterviewsPage.tsx`, #90): a pencil per row (the round's form)
  and **Reschedule** for booked rounds. `interviews.rescheduled_count` / `rescheduled_from` (migration 0014,
  backfilled count); a *Rescheduled* badge.
- **Rescheduling** (#191–#197, v1.3.0–v1.8.0): `components/Reschedule.tsx` asks **Who needed the
  change?** (required: me, them, mutual, neither) and an optional reason; on the application page, quick
  view, Today and Interviews. Each move saves `data.reschedule = {from, to, by, reason}` on its event;
  the API exposes a validated `reschedule` (`from_at`, `to_at`, `by`, `reason`) and the timelines show
  "Moved from … to …" as one whole sentence per state. Insights' Applications tab has a Rescheduling
  block (`domain/reschedule_stats.py`, `GET /insights/rescheduling`); rounds show days moved.
  **A new time isn't agreed yet** (migration 0015: `needs_new_time_since`, `needs_new_time_by`,
  `rebook_todo_id`): the round keeps its old time, a to-do to book it is made in the same POST (it starts
  open), *Set new time* books it as one move and ticks the to-do; Undo/*Keep the old time* deletes the
  to-do only if unchanged. Today has a *Needs a new time* section in Your move.
- **Calls rescheduling** (#201, #205–#208, v1.9.0–v1.13.0) mirrors rounds: migration 0016 adds the
  same columns to `meetings` plus a `meeting_moves` table (a call often has no application timeline);
  `PATCH /meetings/{id}` takes `reschedule_by`/`reschedule_reason`; `POST`/`DELETE
  /meetings/{id}/needs-new-time`; the rebook to-do goes on the application, else the person;
  `components/CallReschedule.tsx` on the person page and Today; Insights' Recruiter conversations has a
  *Calls moved* block, and a waiting call isn't held or booked ahead.
- **Recruiter on cards** (#202): `RecruiterLine` adds the application's recruiter (grey, underlined when
  linked, with marks) to Today's round and offer rows, Interviews, Offers, the person page, and direct
  applications on the board, list and company page. Rounds and offers carry `recruiter_id/name`.
- **Version in the sidebar** (#200, `components/AppVersion.tsx`): the page's build version (Vite
  `__APP_VERSION__`) linked to its release; a note if the server is older ("Restart the tracker") or
  the page is ("Refresh this page").
- **Rejection feedback** (#209, #211–#214, v1.14.0–v1.18.0): migration 0017 adds
  `applications.rejection_feedback` (one per application, plain text kept as written, max 10,000).
  Moving to the stage id `rejected` (board drop, Move to… on the application page and quick view) asks
  "any feedback?" first (Cancel cancels the move); edit it later under *Rejection feedback*
  (`PUT /applications/{id}/rejection-feedback`). Insights has a **Rejections** tab
  (`GET /insights/rejections`, `domain/rejections.py`): every application with feedback, plus a card of
  which round rejections came after, by kind and number (`GET /insights/rejections/rounds`). Both
  Sankeys have a **Show interview rounds** switch (`?rounds=true`, localStorage `jat.insights.rounds`).
- **Insights** (`pages/InsightsPage.tsx`): tabs *The whole picture* (default, #84:
  `GET /insights/whole-flow`, `whole_flow`/`source_of` in `domain/insights.py`: sources
  *Through a recruiter* / *Referred* / *You found it*, roles with no application to
  *Decided not to apply* or *Deciding whether to apply*), *Applications* (Sankey, stage table,
  routes, scorecard), *Recruiter conversations* (`components/Conversations.tsx`,
  `domain/conversations.py`, #66) and *CVs and cover letters* (#71:
  `domain/document_performance.py`, `GET /insights/documents`,
  `components/DocumentPerformance.tsx`, Fisher's exact test in `utils/abtest.ts`; a note
  linking to Documents when CV files aren't versions yet). *Weekly activity* under all.
  All Sankeys (`components/SankeyChart.tsx`, #84–#86): a spur from each active stage to where
  things wait (`holding` nodes: *Waiting to hear back*, *Still interviewing*…, built in
  `_flow_out`/`_with_holding` in `api/insights.py`), placed just after their stage; outcomes on
  the right; *Decided not to apply* (`PASSED_NAME`) beside Applied; `untangle` searches column
  orders for the fewest weighted crossings (`tangle`), once per flow at a nominal size, capped
  at 300 layouts; labels wrap (`wrap`) and get a halo; height grows with busy columns; narrow
  screens scroll sideways.
- **Timeline** (`pages/TimelinePage.tsx`, `api/timeline.py`, #67/#70): list by day or lanes
  (per role by default, or person, company, agency). View, period and *About* live in the URL
  (`useTimelineSearch`; the router JSON-parses `?period=30` into a number); person, company and
  agency pages have a **Timeline** button (`components/TimelineButton.tsx`) opening
  `/timeline?about=contact:<id>&period=all`. Notes on a role count for its company, pitcher and
  agency; roles you added yourself are `added` bookkeeping.
- **API** (`/api/v1`): CRUD for companies, agencies, contacts (+ `/merge`), roles,
  applications (+ `/quick`, `/move`, `/undo`, `/activities`, `/contacts`), interviews, offers,
  notes, links, attachments, documents (+ `cv-files`, `cv-files/adopt`), todos; summaries;
  `role-summaries`, `next-actions`, `timeline`, `meetings`,
  `insights/{whole-flow,flow,stats,activity,scorecard,conversations,documents,rescheduling,rejections,rejections/rounds}`,
  `search`, `workflow`, `backup` (+ `/archive`, `/snapshot`, `/push`); `interviews/{id}/needs-new-time`,
  `meetings/{id}/needs-new-time`, `applications/{id}/rejection-feedback`.

### 4. Current state (snapshot 2026-11-05, after #237)

- **main at `5ed8f46`** (merge of #237), plus this doc's PR until it merges. No other open PRs; one worktree (the main
  checkout); only `main` locally and on GitHub. Version **1.18.10**, released as v1.18.10.
- **Merged since the last snapshot (#231), all through the review-fix cycle, one PR at a time:**
  - #231 the previous refresh of this doc.
  - #232 roadmap: `windows-support` split into nine planned tasks (section 4a), with Kai's answers.
  - #233 `windows-rfc` (no release): `docs/rfc/windows.md`, the path to Windows support, fact-checked twice; the tasks
    and the PRD (FR24) link to it. Written to link from issue #230.
  - #234 (no release): `packaged-install` and `desktop-app` taken out of the Windows plan (Kai: "we dont need
    packaged-install and desktop-app as part of this windows work").
  - #235 (no release): the testing switch `JAT_WINDOWS_SNAPSHOTS=1` added to the plan (Kai: "testing switch, good idea.
    add it to the plan").
  - #236 `language-research` (no release): `docs/rfc/i18n.md` 13a, the human languages offered by up to 20 most-starred
    repos in each of the repo's 20 GitHub topics (299 repos, 20 agents): Simplified Chinese first (72 repos, 16 topics),
    then Spanish, French, German, Russian, Japanese. Data in `<tmp>/lang/` (`results.json`, `aggregate.py`).
  - #237 `i18n-draft-languages` (v1.18.10): draft languages. `DRAFT_LANGUAGES` in `frontend/src/i18n/language.ts`
    (code → own name, empty for now): only a dev server shows one (`?lang=<code>` or the switch, "<name> (draft)"), never
    saved or picked from the browser. The catalog test lets a draft miss whole namespaces (English shows) but each file
    must be complete; a shipped language needs all; every `locales/<code>/` folder must be shipped or a draft and its
    `index.ts` must load exactly its files (`namespaceProblems` in `catalog.ts`). `new_language.mjs <code> <dir>` writes
    `<dir>/<code>/`, making it if needed (it refuses one already there). Guide: "Translating in parts". RFC: Kai's
    AI-translation decision and the Chinese decisions.
- **Tests on main** (the lead's full run on #237's final commit): pytest 1,284, browser 711; unit 1,142
  passed one commit earlier, and the last fixes added one test.
- **Kai's tracker** answered on 8770. Everything since v1.18.0 is frontend, tooling or docs; the sidebar keeps asking for
  a restart until Kai restarts (each release bumps the server's version).
- **Kai's messages since #231, in order** (word for word where quoted):
  - Issue #230: "evaluate what he said, and the effort required to do it, and the risks of him doing it hmself and
    contributing it / also, at some ppint i want to dockerize, would that solve it / also first explain to me why this
    wont work on windows atm / also check his fork and see his approach" → answered after three agents (audit, fork
    review, Docker). The fork is `ashtonmths/JAT` (12 ahead: 7 Windows commits, plus an unrequested "colleges" route
    with migration 0018, a margin change, a version bump; Kai: "i wont incorporate them").
  - "feel free to fan out" (agents used); four questions (isolate and disable on Windows; what tzdata is; the colleges
    commits; fork vs Docker) → answered.
  - "the various issues you mentioned, perhaps its worth splitting those things out as their own PRs also" → #232; then
    "1. that sounds like a plan, add it to the roadmap to get basic windows support. on windows we can simply globaly
    disable the parts that would be an issue after isolating them and minimising the problematic surface, that as a
    first step 2. this is reasonable to include and then use same dependency on all platforms 3. nice 4. i can test on
    windows" → folded into #232.
  - "so what does the path to windows support look like now?", "how much of this does the other persons fork cover?"
    (about a quarter), "so their dependency change instead of fcntl, our plan would still do that" (yes, msvcrt in step
    2; it's stdlib) → answered.
  - "okay so is our roadmap up to date with our path to windows support? perhaps create a separate md file about this
    that we can later link to, explaining our path / afterwards, dont do it until i say so, we will draft a reply." →
    #233; "is git snapshot correct? really its just making a commit isnt it?" → answered (export + commit, never
    pushes) and written into the RFC; "we dont need packaged-install and desktop-app as part of this windows work" → #234.
  - The #230 reply: Kai's six points; "1. testing switch, good idea. add it to the plan 2. I will post / keep PRs
    targetting 500 lines, max 1k / dont mention rebase vs merge / dont mention the 3rd ntoe" → #235 and the final
    Markdown given; "give me the message as markdown so i can copy and paste" → given. **Kai posted it on #230 (2026-11-05,
    19:01 UTC).** Only Kai can merge (sole collaborator; the `main` ruleset blocks deletion and force pushes only).
  - "i want to add a second language! scour every tag … find the languages in the top-20 starred repos for each tag" and
    "fan out massively" → a 20-agent workflow, ranked list; "put these findings in the roadmap" → #236.
  - "then lets say i want to add a language, i assume thats 1 pr because of the checks?" → yes as built; the
    draft-language change splits it. "i will have AI do the translations, people can open an issue/pr if the think
    something should change / dont do anything yet, give me a PR plan for adding simplified chinese" → the 11-PR plan
    (section 4a). "what is the draft-language change? you didnt explain it to me, file changes got in the way" →
    explained. "i like the draft-language plan, implenebt tgat change but dont create the new language yet" → #237.
    Kai's decisions: "1. i dont know, recommended 2. recommended 3. keep but change to more coming soon 5. leave it".
  - "after that update the compaction doc" → this PR.

### 4a. Current work, 2026-11-05 (read this first; it overrides 4 and 5 where they differ)

Keep this whole section word for word in the summary: it is the live plan.

**Versions and main.** Released up to v1.18.10 (#237); main at `5ed8f46`. Everything Kai asked for is merged and
released (section 4). Before trusting anything here, re-read `docs/ROADMAP.yaml` and run `gh pr list`.

**Nothing is up next: report and wait.** No roadmap task is `next` or `building`. By `CLAUDE.md` ("Report and wait", Kai,
2026-11-02), with nothing up next I tell Kai what's in the backlog and wait for Kai to pick; nothing from the backlog starts
without Kai's go-ahead. Waiting on Kai in particular:
- **Simplified Chinese** (Kai: "dont create the new language yet"). The PR plan Kai was given, none on the roadmap yet (add
  them as tasks when Kai says go; each its own PR, all patch but the switch-on, which is minor):
  1. ~~Draft languages~~ (done, #237).
  2. A glossary, `docs/i18n/zh-CN.md`: the fixed Chinese for key terms (application, role, recruiter, agency, round,
     stage, offer, ghosted, Today, Your move…), tone, and how dates, numbers and money read. Every translation PR follows it.
  3–8. Six translation PRs of ~500 lines, by namespace: `insights`+`stages`+`files`; `errors`+`common`+`todos`;
     `people`+`applications`; `today`+`roles`+`calls`; `interviews`+`offers`+`timeline`+`events`; `notes`+`documents`
     (the first adds `zh-CN` to `DRAFT_LANGUAGES` as "简体中文", its `index.ts` and the loader line in `i18n/index.ts`).
     Each checked by the catalog test and `?lang=zh-CN` screenshots of its pages.
  9. Chinese layout: system CJK fonts (PingFang SC, Microsoft YaHei, Noto Sans CJK SC) and clipped labels, at desktop
     and 375 px.
  10. Switch it on (minor): `LANGUAGES`/`LANGUAGE_NAMES`, `dayjs/locale/zh-cn`, a `PATTERNS` row (`YYYY年M月D日`…),
      `NUMBER_LOCALE`, "Coming soon!" → "More coming soon", a browser test that switches and finds no English, guide,
      README row, `llms.txt`, changelog.
  11. `README.zh-CN.md`, linked from the README. The website in Chinese is separate and later, if Kai wants it.
  Kai's decisions (RFC i18n 13a): code `zh-CN`; Traditional Chinese browsers stay on English; "More coming soon"; search
  left as is (`i18n-search` not first); AI translation, corrections by issue or PR (no native-speaker review).
- **Windows** (`docs/rfc/windows.md`, all planned): `windows-starts` (basic support: the Windows-unsafe parts behind one
  is-Windows check, off there; `JAT_WINDOWS_SNAPSHOTS=1` turns snapshots on for testing on a test data folder), then
  `utf8-everywhere`, `windows-time-zones` (tzdata on every platform, Kai's yes), `static-file-types`,
  `data-gitattributes`, `locked-file-retry`, `windows-testing` (Kai tests on Windows), then `windows-support` (docs);
  later `windows-snapshots` (msvcrt lock, then the switch goes). Issue #230: Kai posted the reply (2026-11-05),
  welcoming contributions; next is the author saying which task they'll pick up. Don't post or reply for Kai. Their PRs:
  ~500 lines, max 1k; one task each; Kai tests on Windows before each merges.
- **The MCP server:** the ten `mcp-*` build tasks wait on Kai's answers to the 11 decisions in `docs/rfc/mcp.md` §14 (the
  main one: approving the official `mcp` SDK as an optional dependency) and a go-ahead. Nothing is built.
- **Offered and not taken up:** linking the recruiter in the Applications *list* too; a roadmap item only if Kai says.
- **Backlog added recently:** `delivery-speed-improvements`, `recruiter-open-application-mark` (its icon and what
  counts are Kai's to decide).
- From 2026-11-02, still left alone ("leave them on the roadmap. we wont be doing thme this session"):
  `notes-documents-improve`, `timeline-improve`, `people-you-meet`.
- `security-alerts`: minimatch #32 stays open until eslint and redocly take minimatch 11, or Kai dismisses it.
- Older backlog: `i18n-search`, P11 "Test gaps" (less `test-gaps-demo-data`, done), `tests-reorganise`, Docker and the
  rest of section 5.

**Kai's latest word on how to work** (also section 1):
- **One PR at a time** (2026-11-03): "handle PRs sequentially, review-fix cycle then merge, then handle the next PR.
  theres no point running reviews for PRs that will need ot be reviewed again ocne another PR merges". When several PRs
  are already built and reviewed: merge main into the next, compare its own diff before and after (`git diff
  origin/main...HEAD --stat`, then `git diff origin/main --stat`); only a changed diff needs a fresh review. Don't start
  reviews ahead of their turn.
- **Don't combine fixes into one PR** to save check time: "no dont ocmbine them". Small PRs, one per bug or task.
- **Fan out when Kai asks:** "there are 5 bugs" meant one agent per bug; "fan out massively" meant a Workflow of 20
  agents. Their test runs queue on the test lock, so more agents doesn't mean faster tests.
- "if you followed the iterative review-fix cycle then i give you permission to merge and release"; a major still needs
  Kai's explicit yes each time.
- Split a feature into ~500-line tasks before building (max 1k); a docs-only plan may be bigger when Kai says so.
- When Kai asks for a plan, give the PR plan and build nothing ("dont do anything yet, give me a PR plan"); explain a
  change in plain words before the file details ("you didnt explain it to me, file changes got in the way").
- When Kai asks for a roadmap item, add it as `planned` (Backlog) unless Kai says to build it; a request to build makes
  it `next` (or `building` in its own PR). Set `next` as soon as Kai queues work.
- Outward text (an issue reply) is drafted for Kai and given as Markdown to paste; Kai posts it.
- Images go to Kai before they're applied.
- Mid-turn "sitrep" questions get a short honest answer straight away, then carry on.
- When Kai asks a question, check the code or the running thing and answer plainly before proposing work.

**Open bugs (phase B; 65, none to fix without a go-ahead).** High 1 (`fix-applied-date-wipe`), medium 18, low 46. Fixed
on 2026-11-03: `fix-new-company-keeps-draft`, `fix-new-agency-keeps-draft`, `fix-menu-prefix-active`,
`fix-deleted-person-404`, `fix-cv-files-stale`. Added: `fix-offer-kind-pin-flaky` (low, trivial; its `test.fail` waits a
fixed 1.5 s instead of holding the request, so it passed by luck once in #221's full check). Still missing their rating
fields: `fix-escape-closes-quick-view`, `fix-phone-header-overlap` (likely a duplicate of `fix-phone-header-overflow`).
A bug Kai OKs is set to `next`. Next-easiest by the ratings, if Kai asks for more quick ones: `fix-rename-drops-unsaved-about`,
`fix-archive-lock-not-ignored`, `fix-backup-same-site` (low, trivial), `fix-add-another-role-carries-over` (medium,
trivial), then the
trivial display-only ones (`fix-company-page-blank-route`, `fix-search-stale-after-rename`, `fix-hidden-link-kept`…).
- Medium, easy or trivial: `fix-add-another-role-carries-over`, `fix-call-delete-no-confirm`, `fix-didnt-happen-notes-hidden`,
  `fix-link-rename-tick-error`, `fix-link-rename-cancel-saves`, `fix-timeline-load-error-silent`,
  `fix-agency-delete-blocks-application-save`, `fix-emptied-agency-kept`, `fix-stale-edit-after-save`, `fix-hidden-link-blocks-save`,
  `fix-person-move-blocks-application`, `fix-note-reopen-stale`.
- Medium, moderate: `fix-deletes-no-confirm`, `fix-duplicate-role`, `fix-typed-agency-lost`, `fix-double-save-locked`,
  `fix-duplicate-company-name`, `fix-duplicate-agency-name`.
- Seven earlier low bugs can also lose data or block editing: `fix-merge-dialog-after-back`, `fix-person-saved-before-new-company`,
  `fix-offer-no-kind-loses-rate`, `fix-round-end-before-start`, `fix-website-rules-differ`, `fix-detail-spaces-refused`,
  `fix-event-data-not-dict`.

**Settled:** two people can share a name. Kai: "yes there can be 2 people with the same name". Keep that test pinned; it
isn't a bug.

**The running tracker** on 8770 answers. It may still need Kai's restart (Ctrl+C, `uv run jat serve`) for v1.18.0's server
change (the Sankey rounds filter; the switch and the sidebar version note say so). Everything since is frontend, tooling or
docs, so a page refresh shows it, but the sidebar note keeps asking for a restart until Kai restarts, since each release
bumps the server's version. Leave it alone.

**How work ran this session:**
- **A feature in parts** (as before): one builder agent (`isolation: "worktree"`) builds part 1, opens a draft and stops;
  a fresh reviewer per PR; findings go back to the builder by `SendMessage`, or I fix small ones; then I merge main, bump with
  `<tmp>/deps/finish_deps.py <task> "<changelog>" "<title>" [minor]`, run `pm_checks.sh`, `merge.sh`, and `ship.sh` with a
  dummy worktree name so the builder's worktree survives, and resume the builder for the next part.
- **A batch of small bugs** (2026-11-03): one builder per bug (`isolation: "worktree"`, no `name`), briefed by
  `<tmp>/deps/bug-brief.md` (fix only that bug, smallest change, unpin its `test.fail` or add a test proven to fail
  without the fix, run only `pnpm test` and its own spec through pnpm, no bump, draft PR). Then, one PR at a time: review
  (an unnamed reviewer), fixes, merge main, compare the diff, `finish_deps.py`, `pm_checks.sh`, `merge.sh`, `ship.sh
  <version> <pr> <agent worktree folder> <branch>`. An agent's worktree is named `agent-<id>` with the branch renamed to
  `worktree-<bug id>`; it stays locked, so `git worktree remove -f -f` it after the merge.
- **Small things I build myself** (the tagline, the board link): worktree, roadmap task `building`, draft PR, build,
  one unnamed reviewer, fix, bump, full checks, merge, release.
- **A plan** (the MCP RFC): three planning agents with different angles, merged by me into one RFC, then a fact-check
  reviewer told to check every claim against the code. It found 15 must_fix in a 650-line plan, so always fact-check a
  plan before merging it.
- Give each server its own port and reviewers their own, or one's test data shows up in another's snapshot.
- Reviewers' `Bash` can be refused when my session sits in a worktree: save the diff (`gh pr diff N > <tmp>/prN.diff`)
  and tell them to Read it.

**The loop for an i18n change:**
- Read the area and the last entry in `docs/rfc/i18n.md`. If it won't fit in about 500 changed lines (1,000 at most,
  CLAUDE.md *Git*), split its roadmap task first, in its own PR (#158). Worktree `worktree-<id>`; set the task `building`,
  push, and open a draft PR straight away.
- **English stays exactly the same.** If a move would fix a recorded bug, keep the bug and leave the fix to its task: Kai
  said "none yet". `fix-offer-plurals` keeps "1 months", with `_one` forms repeating the plural; its `test.fail` would have
  gone green otherwise (#157).
- **Check what the API sends as English.** Round names, call names, search titles and Sankey names all were. Build the words
  in the frontend from raw parts, adding those to the response if it lacks them (rounds had them), and keep the English
  field. Fall back to it for an older server (`hitTitle`, `nodeName` do; #156's role page drops its text instead, so don't
  copy that). Say in the report if Kai must restart.
- **Whole sentences, one per state:** no word dropped into a placeholder, no count glued on. A count always gets `_one` and
  `_other` keys, even when English repeats itself, or the catalog test can't protect it. Keys in a map
  outside a component are whole (`"ns:key"`), or
  the unused-key scanner misses them.
- Move strings to `frontend/src/locales/en/<namespace>.ts`; the lint rule covers every source file but tests.
  Your words go into `<Trans>` as components, never `values`. A regex with `//` gets its own line, for the unused-key
  scanner. Pass `TFunction<"namespace">`, not `ReturnType<typeof useTranslation>["t"]` (too deep for TypeScript).
- Add the area's views to `scripts/i18n/text_snapshot.py`. `bash <tmp>/deps/i18n_snapshot.sh` from the worktree compares
  main's build with the branch's: it must say 0 view parts differ, and no view "couldn't open".
- A `*Text.test.tsx` pins what the snapshot can't reach, by exact text: plurals, hover titles, errors, confirmations, and
  states the demo lacks (`test-gaps-demo-data`, P11, lists them). Reviewers check each claim of
  coverage, so say "most of" unless it's all. Run the review before the slow checks, and the checks on the final commit.
- Don't pipe `pnpm format` into `tail -0` (it stops Prettier part way); send it to `/dev/null`. A snapshot run across the top
  of an hour differs on the call form's default time, and across midnight on "Today": run it again. `SNAP_PORT=<port>` gives it its own port.
- An API change must keep working when the rebuilt frontend meets a tracker not yet restarted: Kai's serves `frontend/dist` from
  main. A new body field got 422 from the old server, so #176 sends the old body and puts the marker in the query string.
- A changed response field can be a major: #181 first changed a 422's `type`, then kept it and added to `ctx` instead. Stay additive.
- `pr-<task>.md` in `<tmp>/deps/` is the PR body; `python3 <tmp>/deps/finish_i18n.py <task> "<what>" "<title>"` bumps, writes
  the changelog, marks the roadmap done, sets the draft PR's title and body, and marks it ready.
- Review, fix, review again until no `must_fix` is left, run everything (the list is in CLAUDE.md *Git*), `merge.sh <pr>`, then `ship.sh <version> <pr> <worktree name> [<branch>]` from the main checkout. Add the
  RFC's Built entry in the PR. Don't stop after the merge without checking the release exists.

**The loop's scripts,** in `<tmp>` = `/home/kai/.claude/jobs/cf5328f4/tmp`: `deps/e2e.sh <spec>` (format, typecheck, lint,
one spec), `deps/merge_main.sh` (merge main; a roadmap conflict keeps both sides, then `deps/roadmap_dedupe.py` leaves one
line per id, the longer, so check a task's status afterwards: "building" and "planned" both outlast "done"; always run
`git diff origin/main -- docs/ROADMAP.yaml` after it), `deps/merge.sh`, `deps/ship.sh <version>
<pr> <worktree folder> [<branch>]` (pass a dummy worktree folder such as `keep-agent-worktree` to keep a builder's worktree
for its next part), `deps/finish.py` (tests-only PRs), `deps/finish_deps.py <task> "<changelog entry>" "<title>" [minor]`
(the bump for any PR: patch, or minor with `minor`; marks the task done, also when it already is; writes the changelog line
as given), `<tmp>/deps/pm_checks.sh` (every check in CLAUDE.md *Git* on the current commit, printing PASS or FAIL for each and the
commit it ran on; it re-runs itself under the shared lock, `nice` and `ionice`, with 3 workers; about 10 minutes now, so run it
in the background and restart it after any new commit), `<tmp>/pm_shot.py <base url> <prefix> <path>[@light][@375][@full]`
(screenshots, run with `uv run --with playwright python`; not the older `deps/pm_shot.py`). If they're gone, rewrite them from this description. `e2e.sh`'s
output is cut short, so read the whole of it before trusting a pass. `finish_i18n.py` writes a generic changelog line: replace it
with what the PR really does. A finished builder's worktree stays locked; once merged and clean, `git worktree remove -f -f`
(Kai: "cleanup the no-longer-needed worktrees").

**Dependabot: done** (#186–#188, #190; v1.2.44–v1.2.47). Only minimatch #32 is open: the fix is minimatch 11, but eslint's
packages need ^10 and `@redocly/openapi-core` pins 5.1.9, and forcing 11 breaks redocly (`m is not a function`). Dev tools
only. GitHub's alert list lags a merge by a few minutes; check `gh api …/dependabot/alerts?state=open` again before
reporting. Check what pulls a package in with `pnpm why` / `uv tree --invert --package <name>`.

**PM dashboard.** http://127.0.0.1:8767 runs from the main checkout as a background job of this session (`python3 -m
tools.pm`). It reads the main checkout's roadmap, so **pull main after every merge, roadmap-only ones too**, or Kai's
dashboard is stale (Kai noticed once). It doesn't reload code, so restart it after a change to `tools/pm`:
`TaskStop` on its job, then start it again as a background job. It's silent by design, so the harness's "still running" check-ins
need no action. To preview a branch, serve it on a spare port from the worktree:
`python3 -m tools.pm --port 8768 --root <main checkout>`.
- **Pages:** Overview `/`, Board `/board`, Roadmap `/roadmap`, Activity `/activity`, Agents `/agents`, a task
  `/task/<id>`. `Collector` serves the last snapshot and refreshes in the background; a failed source keeps its last data
  with a red light, and one that never answered shows "unknown", never a false 0. Folds are kept in localStorage.
- **Modules:** `live.py` (git and `gh`), `derive.py` (Overview and Roadmap numbers), `charts.py`, `activity.py`,
  `agents.py`, `task_page.py`, `render.py`, `style.py`, `roadmap.py` (status from evidence), `server.py`. Standard library only, and nothing loads from the web.
- **Decided, and told to Kai:** no plan line on the burn-up, because the roadmap has no planned dates (a labelled forecast
  instead); a swimlane bar is a PR, not an agent, because this project keeps no workflow journals.
- **Drafts and branches:** a draft PR's task is Building, a ready one's Review. A task a `worktree-*` branch added to its own
  roadmap shows marked "on its branch", read once per branch commit (`git show`; only what the branch added since it left main).
  Main's definition wins for a task on both. Left out: `worktree-agent-*` and branches whose PR merged or closed. The dashboard
  doesn't fetch: an open PR whose latest commit isn't here gets a warning under Problems. A bad roadmap on a branch keeps its last
  tasks and shows under Problems. Branch tasks count in the totals, burn-up and forecast, so the size steps up at "today" (its
  history is main's), and a stale branch with no PR counts until it's deleted. With GitHub never having answered, commits on a
  branch show status `unknown`, not Building, and branch tasks are held back and out of the totals, which Problems says.
- **Known gaps, left:** a merged task added only on its branch vanishes until the main checkout is pulled (its branch is no
  longer ahead of `origin/main`, and the local roadmap file doesn't have it yet); "Tests added" counts a test
  moved between files; chart text is small on tablet widths; empty Board columns still show on phones (from the #129 review).

**Other things said lately:**
- Kai asked for links twice while I was working, and text sent mid-turn didn't always reach them: when asked for
  links or status, give them in a clean final message.
- `uv.lock`, `openapi.json` and five version files change in every bump; finish.py handles them.
- Reviewers kept finding real bugs in code that passed its tests, usually false statements when a source fails, so ask
  them to check what a page claims, not just the code. Look at real pages too: a screenshot, not a test, found the broken
  logo in #150.
- Formatting rewraps lines, so an Edit written from memory can miss: read the lines first, and check an edit applied
  before committing (a missed one pushed a failing test). Don't push before the tests pass.
- `pkill -f` matches its own command line if the pattern appears literally there, and kills that shell: use `TaskStop`, or anchor the pattern.

**Browser test facts:**
- `pnpm --dir frontend e2e` builds and runs everything; `pnpm exec playwright test e2e/<file>` runs one (a bare word
  matches the path, and "today" matched the worktree's name).
- `fixtures.ts`: a server per test file on seeded demo data in a temp folder, checked by health's `data_dir` and
  `git_repo`, with `JAT_*` and `GIT_*` removed from its environment. Any console error, uncaught exception or failed
  request fails the test unless `problems.allow(/…/)`.
- Tests in a file share data: use unique names, make what you need through the API, and don't rely on counts. A failed
  test restarts the worker and reseeds.
- A `test.fail` must not rest on timing: freeze staleness with `page.clock.setFixedTime`, hold overlapping requests in `page.route` and release them together, wait for retries with the loader gone. And it must go green for any shape of fix: check the outcome, not the wording.
- Check `toBeHidden` only after something else has loaded, or it passes during loading. After "nothing happened",
  watch for non-GET requests. A mocked request can't prove the server's state, so check the UI there.
- Mantine: `getByLabel` needs `exact: true` or `.first()` (a hidden twin); SegmentedControl: click its label text;
  switches: `check({force:true})`, or `click({force:true})` when the state only flips after a save; dropdown options via
  `getByRole("option")`; choosing a Select's current value clears it; Escape closes a dialog unless a dropdown is open
  (then it takes two); the role dialog opens with Company's list covering the form, so click away first.
- Board: `test.use` a 3800 px viewport (autoscroll moves targets); wait for dnd-kit's live region ("X is over Y") before
  releasing. `window.confirm` needs `page.once("dialog", …)`, or it's dismissed by default.
- Demo data names: Alex Morgan, Sam Patel, Jordan Lee (no Riley Chen); stages Interested, Applied, Screen, Interviewing,
  Final, Offer, Accepted, then closed Rejected, Withdrawn, Ghosted; Backend CV (v2, v3 (impact first)), Short cover letter.
- A TypeScript error stops the build, so every test then fails for one reason. Prettier reformats specs, which is one more
  reason to edit them directly. Run `git` with no `-C`, and don't `cd ..` before it: the harness refuses both.
- `gh pr merge` can fail right after a push (still rechecking) or with a 504: merge.sh retries. The "'main' is already
  used" line is harmless. Never run finish.py during a merge conflict: it once committed markers (it refuses now).

### 5. Work in flight and candidates

- **In flight:** none (after this doc's PR merges). **Up next:** nothing. **Backlog:** Kai picks (section 4a); the MCP
  build waits on the RFC's §14 decisions.
- **Left of the i18n work, P8** (when Kai says; see 4a): `i18n-search` and `multi-language`
  (Simplified Chinese as `zh-CN`, AI-translated, in the 11 PRs of section 4a; also percent and number formats,
  brackets and separators).
- **Noticed, for later:** long text clips on Today's Waiting rows, the call form's How and the offer form's kind (for
  `multi-language`); README screenshots showing the header still have the old language icon (no open task: the `readme-refresh-*` tasks are done, so retaking them needs a new one).
- **Planned elsewhere, not started** (build only when Kai asks): `tests-reorganise` (P7: a test
  file per component next to it with React Testing Library, shared render helpers in
  `src/test/`, `@testing-library/user-event`, backend tests by module, a Testing section in
  CONTRIBUTING); `docker-image` (plan in `docs/rfc/docker.md`), `docker-image-publish`,
  the `windows-*` tasks (#232; `windows-starts` first), `packaged-install`, `desktop-app`, `hosted-version`, `demo-site`, and the
  MCP server's `mcp-*` tasks (`docs/rfc/mcp.md`, waiting on Kai's decisions in its §14).
- **Offered, waiting on Kai:**
  - The GitHub description and topics proposed in #96 (put its four claims in the
    `tagline-reorder` order if Kai adopts it; description "Self-hosted job
    application tracker for software engineers. No account, no cloud, no AI, no tracking.
    Kanban board, recruiter CRM, interview rounds, follow-ups, offer comparison and Sankey
    insights; your data in readable files on your machine, with optional git backups. A free,
    open-source Huntr / Teal alternative."; topics: drop `jobhunt`, `job-seekers`, `recruiters`,
    add `huntr-alternative`, `kanban`, `privacy`).
  - A short brand name (ideas: Pursuit, Offerboard, Shortlist, Followup, Dossier, Waypoint,
    Jobfolio). Keep the repo name either way.
  - Tile rows on other pages; dropping *Screen* from the default workflow; post drafts (Kai
    posts); rebuilding `demo.gif` (preview first).
- **Noticed, not promised:**
  - i18n: labels computed outside components re-render on the pages #177 checked (20, not dialogs or
    menus); `test-gaps-language-switch` covers the rest. Calendar names can't be pseudo-accented (they're dayjs locale data).
    `firstDayOfWeek` is fixed at Monday (TODO in `App.tsx`).
  - Ghost and star still missing in the Timeline *About* select and to-do "about" text.
  - Reply times: weekdays only, no bank holidays.
  - On phones: the header search overlaps the page title (`fix-phone-header-overflow`, and `fix-phone-header-overlap` from 2026-11-02 likely describes the same thing); the header
    only just fits at 375 px, so anything wider there pushes the theme toggle off.
  - The application page's People card ignores a recruiter set through the route.
  - Today: a to-do on a role shows on its role line and in Coming up; to-dos months ahead still
    count in Coming up.
  - Recruiter conversations' tiles and table still say *Passed*.
  - Board round columns only split stages named "interview".
  - `insights-stats.png`, `demo.gif`, `recruiters.png`, `person.png`, `roles.png` show older UI.

### 6. The delivery loop

1. `git fetch -q && git worktree add -q .claude/worktrees/<name> -b worktree-<name> origin/main`,
   then EnterWorktree with `path`. Add the roadmap task (P7, `building`), commit, push with
   `-u`, and open it with `gh pr create --draft`. In a new worktree, `pnpm --dir frontend install`
   before frontend commands. Stay near 500 changed lines (CLAUDE.md *Git*); split the task if not.
2. Backend: model + migration (check `tests/test_db.py`), API, tests; new tables/columns in
   `tests/factories.py` `populate()`; regenerate OpenAPI and types. Commit and push.
3. Frontend: hooks (invalidate every query key that shows the data), components, pages,
   tests. Commit and push.
4. Docs: guide, README row and text, `llms.txt`, changelog with the PR number (the draft's,
   `gh pr view --json number`) under a new `## X.Y.Z (date)` section, screenshots if visible UI
   changed. Bump the version (CLAUDE.md *Versions and releases*: five files, `uv lock`,
   `jat.openapi`, `gen:api`). Link check.
5. Live check: seed demo data, build the branch's frontend, serve on a spare port, drive it
   with Playwright, Read the screenshots (also at 375 px when rows gain buttons).
6. Fill in the draft PR's body (what Kai asked, quoted; what changed; checks) and run
   `gh pr ready`. Start a background `general-purpose` reviewer: `gh pr diff N` once, Read files in the worktree, report
   must_fix/should_fix/nit with file:line. For anything touching Kai's real data, tell it to
   focus on data safety. Tell Kai what's happening meanwhile.
7. Apply fixes (more tests where it found gaps) and review again until no `must_fix` is left. Set the
   roadmap task `done`, re-run every check on that commit, push. Poll `mergeStateStatus` for CLEAN, then merge,
   unless it's a major: stop and ask Kai first (CLAUDE.md *Versions and releases*).
8. ExitWorktree keep; on main: `git pull -q --ff-only`, `git worktree remove --force …`,
   `git branch -D …`, `git fetch -q --prune`; rebuild the frontend; TaskStop demo servers;
   check the tracker answers; report what's live and whether Kai must restart.
9. Release: `git tag -a vX.Y.Z <merge sha> -m vX.Y.Z`, `git push origin vX.Y.Z`,
   `gh release create vX.Y.Z --title vX.Y.Z --notes-file <that changelog section>
   --verify-tag` (notes extracted with a script into the tmp dir; make relative links
   absolute). Follows the review-fix cycle without asking; a major needs Kai's explicit yes each time.

**An i18n area's cutover** (since #113; CONTRIBUTING "Text in the UI"):
1. Worktree `worktree-i18n-<area>`; set its P8 task `building`, push, open a draft PR.
2. Baseline: build main's frontend in the worktree (it starts identical), seed demo data
   (`scripts/seed_demo.py <tmp>/demo-x`), `uv run jat --data-dir … serve --port 88xx`, then
   `uv run --with playwright python scripts/i18n/text_snapshot.py http://127.0.0.1:88xx before.json`.
   Take it twice and diff for stability.
3. Write the English in `locales/en/<ns>.ts` (new namespace → `locales/en/index.ts`), cut the
   components over (`useTranslation("<ns>")`, `t()`, `<Trans>` for markup, `i18n.t("ns:key")`
   outside components; another namespace too → `useTranslation(["ns", "common"])`); text the
   app *saves* stays English, and a new event also saves `data.msg`. The lint rule covers every source file but tests.
4. Typecheck, lint, tests; rebuild, restart the server, snapshot again, `text_diff.py` must say
   `0 view parts differ` (or only intended changes). Pin what the snapshot can't reach in a
   test (`components/TodayText.test.tsx` is the model). Prove a test catches a slip by breaking
   one English string.
5. Dev preview, when Kai asks for one: `JAT_API_URL=http://127.0.0.1:88xx pnpm exec vite --port 5174
   --strictPort` from `frontend/` (background); http://127.0.0.1:5174 and `?lang=pseudo`.
   Screenshot pseudo to check nothing in the area is still plain English.
6. Docs: CONTRIBUTING (what's moved), RFC Status + Learned, CHANGELOG `## 1.x.y`; bump. `gh pr ready`,
   reviewer (tell it to check exact text equivalence for every string), fixes, review again, merge.

Several features can be in flight at once (one worktree each): ExitWorktree keep, then
EnterWorktree the other. Merge main into a branch before its PR when main moved; the usual
conflict is the last lines of `docs/ROADMAP.yaml` (keep both, in merge order).

### 7. Decisions already made (don't re-litigate)

- **Workflow:** any-to-any moves by default; `transitions = "configured"` enforces `next`.
- **Staleness:** not stale if snoozed, a follow-up is planned later, a round is booked ahead,
  you're waiting to hear back, or there's a reply to read.
- **Reply states:** `awaiting_reply_since` and `reply_to_read_since` never coexist; a stage
  move clears both. People also have `chased_on`, `closed_as` (`ghosted` |
  `not_interested`) + `closed_on`.
- **At a glance** follows Today's rules for one application; to-dos show even on closed
  or archived applications; key dates count only what has happened (`last_activity_at` in the
  future falls back to the latest past event).
- **Recruiter conversations:** a pitched role is a role with a person; calls held = marked
  Happened (whatever the time); booked = scheduled and ahead; a scheduled call already past
  isn't counted. Best outcome per role: offer > in progress > closed > ghosted. Time to decide
  counts from an application's first stage event. Weekly calls = held.
- **Timeline:** lanes by role by default; `role` kind for pitches and passes; `added`
  bookkeeping off by default; Application lanes dropped.
- **People:** one agency or company each. One person per email and LinkedIn profile (only
  details new to a person are checked, so old duplicates stay editable). Merge: the kept
  person's fields win; title from the other if none; agency or company if neither; waiting /
  to-read / closed if none; later chased date. Notes are relinked in the file, keeping their
  edit time; the index catches up on the next sync.
- **Roles:** status derived (*applied* > *passed* > *to decide*); role files show on the
  application; same title at the same company reuses the role.
- **Deleting:** a company or role with applications can't be deleted; deleting a person
  deletes their calls and unlinks the rest (so for duplicates, merge).
- **Offers:** the newest per application counts; worth a year = salary + bonus + equity +
  employer pension, or day rate × 220.
- **Interested roles:** a role is *Interested* while every application is in an open stage
  before Applied; Insights' recruiter conversations count those as *still deciding*, and
  Today's *roles to decide* only lists roles with no application.
- **Closed roles:** closed before any application got to Applied → *Closed* (badge = how it
  ended), counted as *passed* in Insights (not in time to decide); applied and then
  withdrawn stays *Applied*; logged straight at a closed stage with an applied date counts as
  applied.
- **Favourites:** one star (not a rating); separate from ghosted (both can show); favourites
  first on the Recruiters page.
- **Every application starts at the first stage:** implied events (`data.implied`) fill it in;
  they aren't undoable and don't count as a stay, update, reply or move; the Timeline shows the
  pair as one *Added at …* entry; the application timeline shows both.
- **Sankeys:** holding spurs for every active stage (DECIDING only when the first stage is
  before Applied); holding nodes just after their stage; outcomes (closed/success) on the right
  edge because they can follow any stage; *Decided not to apply* beside Applied; column order
  searched for fewest crossings. "Passed" is never used as a Sankey label.
- **The whole picture:** sources by precedence referral > recruiter (person on the role, or an
  application with a recruiter/agency) > found; a role applied to twice counts twice.
- **Board rounds:** only stages named "interview"; rounds are sequential and come from
  interviews, so only *No round yet* takes drops.
- **Reschedules:** counted only when a booked round's time moves (not adding/clearing a time,
  not with a status change in the same save); the end moves with the start; the reason lives on
  the timeline only.
- **A role's person changing:** never changes an application's route or agency; only open,
  unarchived, non-referral applications that had the old person or nobody, and only where the
  new person fits; removing the person changes nothing; notes are bookkeeping.
- **Notes dialogs:** nothing saves until confirmed; can't close while saving.
- **Workflow:** *Screen* stays in the default unless Kai says otherwise; Kai's own stages live
  in their data folder's `config.toml` (we give snippets, never edit it).
- **Ghosts:** only `closed_as == "ghosted"` gets a ghost (not *Not interested*); taking it off
  is a plain action any time (not "undo" wording), with an Undo toast.
- **Reply times:** recorded when waiting ends with *They've replied* / *Heard back*, or a move
  on while waiting that isn't yours (Withdrawn, Declined, success stages, `reopen_from`);
  undoing that move takes it back; chasing and Ghosted aren't replies; no guessing at PATCH
  "undos" (it deleted real replies). Local days. Merging people keeps replies; deleting an
  application keeps them (`SET NULL`).
- **CV A/B:** CVs are told apart by the version recorded per application, not by reading
  files. *Sent* = got to Applied (or the first active stage after the start without an
  `applied` stage), closed after it, or a document recorded; reply time from the day it got
  to Applied. Screen or interview is the headline measure; Wilson 95% ranges; Fisher's exact
  test with "too few" under 5 each; a CV can't be compared with its own versions.
- **CV files:** grouped by content (`sha256`); the version gets its own copy; originals never
  touched; role/person files only claim applications without a CV; you tick the applications.
- **Website:** one landing page, paper palette, docs on GitHub, no analytics; it speaks to
  non-developers, the README to developers.
- **Positioning:** "No AI. No cloud. No account. No tracking." (Kai reordered it on
  2026-11-03 to lead with no AI; use that order wherever the four are listed) (no "no external dependencies",
  which isn't true; "plain files" only with the SQLite caveat; git backups are *optional*).
  The app never calls out to the web (a linked image in a note loads from where it's linked).
  No new coined phrase. Keep the repo name `job-application-tracker`.
- **Today:** one home page in place of the Overview and Next actions; three groups (Your move /
  Coming up / Waiting on them), gone quiet under Waiting on them; the look is "Tiles + faint
  buttons" (Kai: "Lines is least fav"; "I like the new one, ship that"); no per-row ⋯ menu and
  no folding long lists (not picked).
- **Docker vs non-technical users:** Docker is for self-hosters; the lay-person path is the
  one-command install, Windows support, then a double-click desktop app.
- **Promotion:** Claude drafts posts; Kai posts them. Posts say it's built with Claude Code.
- **Search:** every word must match, accent- and case-insensitive.

- **i18n:** the frontend does all translating; the backend sends codes and ids next to its
  English (§4 of the RFC). One namespace per area; keys say what text is for; English as
  `.ts` `as const` (typed keys and placeholder names), other languages JSON. Every converted
  file is linted (every source file but tests). Your data (companies, notes, stage names you've renamed or
  added) is never translated; a default stage you haven't changed is (Kai: option 2).
  Saved summaries stay English, new events also save `data.msg`; no backfill of old events. Each i18n PR is a
  patch with its own release (the switch was minor). Cut over directly with the before/after
  text snapshot. Typed id-to-key maps hold bare keys.
  A language is added by `docs/guide/adding-a-language.md`, `LANGUAGES` last; a `[TRANSLATE]` marker fails the
  test, not the app, so a half-done language still runs in dev (Kai asked for markers over plain copies).
- **Language switch:** option D of six (Kai): an outlined button, globe, name, arrow; globe alone on a phone. English plus
  a greyed *Coming soon!*; pseudo in dev only, never saved; languages by their own names (`LANGUAGE_NAMES`), not translated.
- **Docker:** shelved; the plan is `docs/rfc/docker.md` (minor bump, bind-mounted data folder,
  user id and git identity passed in, Podman-compatible, Compose, published image later).
- **Reschedules, who and why:** "Who needed the change?" (Me / Them / Both of us / Neither of us; values `me | them |
  mutual | neither`), not "Blame". Required in the dialog, optional in the API (the Edit form's moves are *Not recorded*).
  Each move keeps its own who and why on its event; old moves keep their text. Insights counts raw numbers, with companies and
  recruiters only from 3 moved rounds, and never claims reschedules lengthen time in stage.
- **A new time isn't agreed yet:** a mark beside the status, not a new status; the old time is kept; the to-do is made in the
  same request and starts open (Kai: the checkbox is "Add a to-do to book the new time", never "ticked" meaning done); booking
  counts as the one move with the marked who; Undo deletes the to-do only if unchanged since it was made, else ticks it off;
  refused on a closed or archived application (and, for calls, a closed person).
- **Calls mirror rounds** for rescheduling and needing a new time; the to-do goes on the application, else the person; a
  waiting call isn't held or booked ahead in Insights.
- **Rejection feedback:** a stage is rejected by its id `rejected` (Kai's workflow has it); one feedback per application,
  editable any time, kept as written; undo and reopening keep it. The Rejections list shows every application with feedback,
  whatever happened since: date and from-stage from the latest standing move to Rejected by `in_time_order`, "undone" if
  none stands, and the current stage if it moved on. Its period goes by rejection date.
- **"Reached" a round** (for which round a rejection came after, and the Sankey rounds): not cancelled, not waiting for a new
  time, and its start (or a take-home's deadline) at or before the cutoff, or marked done by then (from its latest `done`
  timeline entry, else when it was added). The Sankeys split only the first active stage with "interview" in its id.
- **Up next / Backlog and "Report and wait"** (section 1, `CLAUDE.md`).
- **Windows** (`docs/rfc/windows.md`): basic support first, the Windows-unsafe parts (fcntl lock, git snapshots,
  `jat init`'s commit) isolated behind one is-Windows check and off there; Download a backup is the backup;
  `JAT_WINDOWS_SNAPSHOTS=1` (env or `.env`, off by default) for testing; `tzdata` on every platform; Kai tests on
  Windows (no CI job unless Kai asks); msvcrt lock in step 2. Not part of it: `packaged-install`, `desktop-app`.
  Docker doesn't replace it (it's for self-hosters).
- **Translations:** AI-translated, corrections by issue or PR, no native-speaker review; a big language goes in as a
  draft a few namespaces per PR. Chinese: `zh-CN`; Traditional browsers stay English; "More coming soon"; search as is.

### 8. Gotchas already learned

- **Harness refusals.** Bash it can't prove stays in the entered worktree is refused:
  heredocs and inline Python (especially when the text contains "git"), `for` loops with
  variables as programs, `cd` before git, `&&` chains mixing git with other tools. Fix: split the
  commands, and edit files with Edit. A script in the tmp dir is only for mechanical bulk changes.
  A refused command changed nothing.
- **Never `open(p, "w").write(f(open(p).read()))`**: the write mode truncates the file before
  the read. Read into a variable first. If it happens, `git checkout -- <file>` (tracked files
  only; a new untracked file must be fixed by hand).
- **The main checkout is read-only for edits** in this session (git pull, worktree remove and
  `pnpm build` there are fine). Ask Kai to run anything else with `!`.
- **Subagents can't run Bash in your worktree:** tell them to use `gh pr diff` and Read.
- **`gh pr edit` fails silently** (classic Projects deprecation): set a title or body with
  `gh api -X PATCH repos/waddington/job-application-tracker/pulls/N -f title=… -F body=@file`.
- **`gh pr merge` from the main checkout** prints "'main' is already used by worktree"; the
  merge still happened (check `gh pr view N --json state`).
- **Polling.** Right after a push, poll `mergeStateStatus` for CLEAN before merging.
- **SQLite and notes:** call `_sync(request)` (notes index) before the request's session reads
  anything; otherwise a write later in the request can fail with "database is locked".
- **zsh:** `grep --include=*.tsx` fails ("no matches found"); grep paths directly.
- **React lint:** no `Date.now()` or `dayjs()` in render (`useToday()`, `useNow()` in
  `utils/useToday.ts`). Mantine options render hidden; SegmentedControl items are radios;
  Chips are checkboxes.
- **Test fixtures:** `frontend/src/test/mockApi.ts` (`row`, `item` with `role_id`, `meeting`,
  `roleSummary`, `todo`). Prove a test catches a bug by breaking the code and watching it fail.
- **Headless screenshots** of a page with reveal animations need reduced motion
  (`--force-prefers-reduced-motion` or Playwright `reduced_motion="reduce"`); `scroll-behavior:
  smooth` swallows scripted scrolling (inject `html{scroll-behavior:auto}`).
- **Astro 7 `dev`** detaches into a daemon: `npx astro dev stop` before restarting; a content
  change it misses needs a restart.
- **The truncation trap again (#74):** a script's last line `open(C, "w").write(open(C).read())`
  emptied a file. Never reopen a file for writing on the same line it's read; restore with
  `git checkout -- <file>` and re-apply only that file's edits.
- **`git checkout -- <file>` after a test-the-test break** also drops your uncommitted edits to
  that file: copy the file aside (`cp f tmp/f.bak`) and copy it back instead.
- **`export PATH=…node…`** in a Bash call hides `uv` for the rest of that call: run
  `uv run python -m jat.openapi` in its own call before `pnpm gen:api`.
- **TanStack Router:** routes built from `NAV` aren't typed for `navigate({ to: "/timeline" })`;
  navigate to `"."`. Mantine Select inputs have two elements per label (use
  `getAllByLabelText(...)[0]` or `findByDisplayValue`); jsdom lacks `scrollIntoView` (stubbed
  in `src/test/setup.ts`); notifications persist across tests (scope `Undo` clicks to the
  toast).
- **CI:** a website build check runs when docs/screenshots change; `mergeStateStatus` is
  UNSTABLE until it passes.

- **React synthetic events:** never read `e.currentTarget.value` inside a state updater
  (`setX((v) => …e.currentTarget…)`): React clears it before the updater runs, which crashed
  the notes dialog on Enter (#88). jsdom tests don't catch it; read the value first.
- **EnterWorktree** refuses when the worktree is already the cwd (e.g. after `cd` into it in
  the same Bash call); you're still isolated, carry on.
- **Demo servers** don't reload backend code: after a backend change, TaskStop and restart
  `jat serve` before screenshotting (a stale server showed the old node order in #84).
- **d3-sankey:** a custom `nodeSort` is applied once and kept through relaxation; `undefined`
  lets d3 reorder by position. `nodeAlign` decides columns. Search for orderings outside the
  render path (memo on the flow), not on every resize.
- **CSS modules: no `light-dark()`.** The build rewrites it to variables the app never sets, so
  the colour silently vanishes. Use a custom property, overridden under
  `:where([data-mantine-color-scheme="dark"])` (`theme.module.css`, `TodayPage.module.css`).
- **Mantine 9 `Grid`** takes `gap`, not `gutter`.
- **Astro drops the space** between text and an element on the next line; add `{" "}`.
- **React Query retries a failed request 3 times (~7 s).** A page that waits on a query nobody
  mocked waits that long in tests (they time out); mock it, or don't block on it.
- **pnpm 10** ignores `pnpm.ignoredBuiltDependencies` in `package.json`, and already blocks build
  scripts (e.g. `@scarf/scarf` from `swagger-ui-dist`) by default.
- **`ruff check src tests` misses `scripts/`**: include `scripts` (a long line in
  `make_card.py` sat on main from #96 to #99).
- **The auto-mode permission check** can block merges and releases, as it did on #147's first try
  (no review, no approval). A blocked command ran nothing: ask Kai, never work around it.
- **Migrations that read config:** `migrate()` passes `cfg.attributes["data_dir"]`; a
  `config.toml` that doesn't load must stop the migration, never fall back silently (#83).
- **Data-touching features** (rewriting applications from another edit) get a reviewer told
  to focus on data safety; #92's first version flipped routes and was reworked before merge.

- **i18n gotchas** (more in the RFC's "Learned so far"):
  - `t()` from `useTranslation("x")` refuses keys prefixed with any namespace, its own
    included; use bare keys, or `useTranslation(["x", "common"])` for another namespace.
  - `<Trans>` tags named after HTML void elements (`<link>`, `<br>`) render empty.
  - The pseudo-language is `en-XA` (an unknown tag takes the machine's plural rules).
  - A component rendered alone in a test needs `src/i18n` loaded (the test setup does it).
  - The lint plugin compiles word filters without the `u` flag: no `\p{L}`; it anchors them.
    Prove the rule still bites by putting a hard-coded label back.
  - Intl's en-GB writes "Sept"; dayjs writes "Sep": all dates go through dayjs patterns.
  - A Mantine `Tooltip` inside `Menu.Target` steals the menu's ARIA: put the Tooltip outside.
  - jsdom can't type into a Mantine searchable Select (`fireEvent.change` doesn't stick):
    check those in a real browser (Playwright) until `user-event` arrives.
  - Mantine menu items and options render hidden: query with `hidden: true`.
  - `mouseenter` doesn't bubble: hover a Tooltip's own target element in tests.
- **Bash refusals in a worktree** also hit `cd ..` before git and `python3 - <<EOF` scripts that
  mention git: split the commands, and put long text in a file.

- **Learned 2026-11-02:**
  - **Roadmap merges revert statuses.** `merge_main.sh`'s dedupe keeps the longer line, so a `done` task can come back as
    `planned` or `building`. It happened on almost every merge this session. Always check `git diff origin/main --
    docs/ROADMAP.yaml` after merging main, and fix the line by hand.
  - **Stacked PRs:** deleting a PR's base branch (merging the PR below it with `--delete-branch`) closes it, and GitHub won't
    change a closed PR's base. Open a replacement from the same branch (#195 replaced #193). Prefer one base, main.
  - **Isolated agents** (`isolation: "worktree"`) can't write to the job tmp dir: give them the worktree's `var/` or a
    unique `/tmp/jat-…` folder. Their worktrees stay locked after they finish: `git worktree remove -f -f` once merged and clean.
  - **The PATH needs `/home/kai/.local/bin`** for `uv`; without it e2e's fixtures fail 580 tests with `spawnSync uv ENOENT`.
    A piped e2e run can report exit 0 on failure: read the pass and fail counts.
  - **Mantine buttons are disabled while loading**, so "Save is disabled" isn't proof a save finished; wait on the saved
    value (`expect.poll` on the API) instead (fixed in `companies.spec.ts` in #192).
  - **A test that works a time out twice** (`_iso(10)` twice) can tick over a second between: work each time out once.
  - **The shared test lock deadlocked once:** `pm_checks.sh` clears `JAT_*` variables, which wiped its own `JAT_HEAVY_LOCKED`
    marker, so it re-took the lock it held and every agent waited 11 minutes. The marker is now `HEAVY_TESTS_LOCKED`.
    Check `lsof /tmp/jat-heavy-tests.lock` when runs seem stuck.
  - **Killing a process by PID is refused** by the permission check ("Interfere With Workloads"); stop your own background
    task with TaskStop.
  - **The PM dashboard parses branch roadmaps:** a new status on an unmerged branch shows under Problems on the old
    dashboard until the PR merges and the dashboard restarts.
  - **A forked Claude can't use EnterWorktree** from the main checkout; it works in the worktree by absolute paths.
- **Learned 2026-11-03:**
  - **Never give a one-off reviewer or builder a `name`.** A named agent starts as a long-lived teammate in its own pane,
    and it doesn't report back by itself: five reviewers sat idle for about an hour with their findings until asked
    (SendMessage), then needed TaskStop. Leave `name` off so the agent reports when it's done.
  - **Kai: handle PRs one at a time** ("handle PRs sequentially, review-fix cycle then merge, then handle the next PR").
    Don't review PRs ahead of their turn. After merging main into the next one, compare its own diff (`git diff
    origin/main --stat` before and after); only a changed diff needs a fresh review. Kai declined combining fixes into one PR.
  - **`!` commands run in this session's current folder,** which may be a worktree: a `playwright test --ui` that Kai ran
    with `!` cleared a worktree's `test-results` mid-check and failed three tests on missing trace files. Tell Kai to run
    such things in their own terminal, in the main checkout. UI mode needs a display, which `!` doesn't have.
  - **The test lock** (`frontend/scripts/test-run.mjs`, `/tmp/jat-test-run.lock`, from `test-resource-limits`) runs
    `pnpm test` and `pnpm e2e` one at a time across worktrees: parallel builders queue for it, so more builders doesn't
    mean faster tests. It's separate from `pm_checks.sh`'s older `flock` (section 1).
  - **A flaky `test.fail` blocks merges:** `fix-offer-kind-pin-flaky` passed by luck once. Rerun only the browser suite on
    the same commit (`<tmp>/deps/e2e_only.sh`) when everything else passed and the failure isn't the PR's.
  - **`pm_checks.sh` keeps only the last 25 lines** of a failing check: read the failures' `error-context.md` under
    `frontend/test-results/` for the rest.
- **Learned 2026-11-05:**
  - **Fact-check public docs before linking them.** The Windows RFC's first fact-check found a "Backup page" that
    doesn't exist (it's the sidebar's "Download a backup" link) and a fork "linked from the issue" that wasn't.
  - **Agents disagree; check the code.** The audit said `git push` holds the snapshot lock; it doesn't
    (`push()` runs outside `_process_lock`). A reviewer looked for the fork under the wrong name (it's `ashtonmths/JAT`).
  - **A Workflow's result** is in its task output file as JSON (`.result`); big `args` lists pass fine.
  - **A worktree-isolated session can't `cd` to the main checkout** for git: read files there by path, or exit the
    worktree first.
  - **`pnpm exec vitest run <files>`** skips the test lock: only for a quick look at one or two files; full runs go
    through `pnpm test` / `pm_checks.sh`.
  - **New commits make running checks stale:** stop `pm_checks.sh` (TaskStop) and start it again on the final commit.

### 8a. How Kai works

- Uses the tracker for a real job search and reports gaps as they hit them, often several in
  one message or mid-turn: split them into PRs, fold small ones into the one in progress.
- Sometimes wants to see things running before they land (a local URL): do that when asked.
- Asks short questions ("how do i run thius?"): answer plainly with the exact command.
- Values findability, honesty about state, docs and images that match the code, a tidy repo,
  and the project being discoverable on GitHub.
- Thinks out loud in questions first ("how will…", "what did you mean…"): answer plainly, and
  record the answers in the RFC when Kai says "commit the plan".
- When previewing, spots gaps (calendar, date order, role lines):
  fold the fix into the open PR if it's small and in scope, else say which planned PR owns it.
- Refines visual things in quick rounds (the Sankeys took #84–#86) when asked to look at them:
  show a demo URL with each round, and fold follow-ups into the open PR.

### 9. Drop

Tool output, diffs and file contents already on disk; per-command narration; reviewer reports
already handled; screenshots already looked at; topic-research tables; superseded plans and
palettes; the earlier versions of this doc.

### 10. End the summary with

The resume steps below, then one line with the next action: Kai's latest instruction if it's unfinished; otherwise
"Next action: nothing is up next; report and wait for Kai (section 4a)."

---

## Resuming after compaction

1. **Re-read, don't trust memory:** `CLAUDE.md`, this file, `gh pr list`, `git worktree list`,
   `git branch -a`, `git log --oneline -5` on main and any worktree branch.
2. **Check the PM dashboard:** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8767/board`; if it's down, start
   `python3 -m tools.pm` from the main checkout as a background job.
   **Check the tracker:** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8770/api/v1/health`.
   Kai runs it in their terminal (section 2): if it answers, leave it alone. If it's down, say
   so and offer to start it (`uv run jat serve` in the main checkout, as a background job), or
   Kai reruns it themselves.
3. **Open PRs first:** finish a draft's work, run the review-fix cycle, then merge and release
   (a major needs Kai's yes first).
4. **Unfinished worktrees:** commit and push, then finish that task.
5. **Then Kai's latest request,** which section 4a spells out. If there isn't one, report the state in two lines and
   wait.
6. **Before the next compaction,** refresh sections 3, 4, 4a and 5 in a small docs PR.

## Re-expanding what the summary dropped

The summary keeps decisions and pointers, not detail. When a detail is needed, get it back
from the record rather than guessing:

- **The full conversation:** the transcript path the summary gives
  (`/home/kai/.claude/projects/-home-kai/<session>.jsonl`). Search it with `grep` for a quote,
  a PR number or a file name; don't read it whole.
- **What a PR did and why:** `gh pr view N` (the body quotes Kai and lists what changed and
  the checks), `gh pr diff N`, and the merge commit's messages (`git log --oneline main`).
- **What a feature does:** `docs/guide/using-the-app.md` and the module docstrings
  (`src/jat/domain/*.py`, `src/jat/api/*.py`); `CHANGELOG.md` maps features to PRs.
- **What's planned or done:** `docs/ROADMAP.yaml` and `docs/IDEAS.md`.
- **How a screenshot was made:** the scripts in the tmp dir (`shots9.py`, `copy9.py`,
  `tmp/site/cap.py`, `insights_shots.py`, `tl_readme.py`, `merge_live.py`); rewrite them from
  the Commands above if the tmp dir is gone.

## Keeping things that must survive

Context is temporary; the repo isn't. Anything that should outlive a compaction goes on disk
in the same PR that makes it true:

- Kai's standing instructions and decisions: sections 1 and 7 here (and `CLAUDE.md` when they
  are rules for the repo).
- What's built: the guide, the README, `llms.txt`, `CHANGELOG.md`, the roadmap.
- Why: the PR body (quote Kai) and commit messages.
- Gotchas worth not relearning: section 8 here.
