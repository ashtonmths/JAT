# Simplified Chinese (zh-CN): the plan

Status: in progress. The pilot (`i18n-zh-cn-applications`, the applications strings) is being built; every other
task waits for Kai's go after it merges (Kai, 2026-11-05: "after that file is translated and gets merged, dont continue
after that until isay").

Simplified Chinese is the first language after English: the language research (`docs/rfc/i18n.md` §13a) ranked it first.
The roadmap tasks are `i18n-zh-cn-*` in phase P8 of `docs/ROADMAP.yaml`.

## Decisions (Kai, 2026-11-05)

- **Code `zh-CN`**, named "简体中文" in the language switch. Browsers set to Traditional Chinese stay on English.
- **AI translation.** No native-speaker review; people can correct it by issue or PR ("i will have AI do the translations,
  people can open an issue/pr if the think something should change").
- **A draft until every file is in** (#237): `zh-CN` sits in `DRAFT_LANGUAGES`, so only a dev server offers it
  (`?lang=zh-CN`), and files not translated yet show in English.
- **No release while it's a draft** ("yes no release while it is draft"): the translation and layout PRs bump no version.
  Switching it on is a minor release.
- **One PR per string file**, translated in context and reviewed per area of the screen by several models (below).
- **Reviewers:** Sonnet and Opus, each separately ("perhaps we can drop haiku"); Opus translates and settles
  disagreements.
- **No screenshots in the PRs** ("no screenshots in the PR"). They're taken to translate and review, and stay outside the
  repo.
- **No saved context pack.** A saved list of where each key is used would go stale as the code changes, so each run looks
  up the context fresh from the code it's translating.
- "Coming soon!" in the language menu becomes "More coming soon". Search is left as it is (`i18n-search` comes later).
- **Promotion:** the main README shows Chinese near the top (a language line under the title), the GitHub description
  carries Chinese so it shows in search results, and the README makes it clear the app itself is translated, not just the
  README, without putting it in the hero.

## How each translation PR runs

One Workflow per string file, `locales/en/<file>.ts` → `locales/zh-CN/<file>.json`:

1. **Areas.** Split the file's keys into areas a reader would recognise on screen ("board columns", "the application card
   on the board", "New application"), usually by the file's top-level groups.
2. **Context, fresh.** For each area: the English with its comments, every place in the code that uses each key (with
   the code around it), and English screenshots of where it shows, taken on demo data from the branch.
3. **Translate**, one Opus agent per area, following the glossary (`docs/i18n/zh-CN.md`) and the files already merged.
   New key terms go into the glossary.
4. **Consistency pass:** one agent reads the whole file for terms and tone that differ between areas.
5. **Checks:** the catalog test (every key, placeholders and tags intact, no `[TRANSLATE]` left); then the same pages are
   screenshotted in `?lang=zh-CN`, at desktop width and 375 px.
6. **Text review, per area:** Sonnet and Opus each review the area separately, with the same context and screenshots, and
   report `must_fix`, `should_fix` or `nit` per string with a suggestion.
7. **Review in place, per screenshot:** Sonnet and Opus each look for clipped or badly wrapped text, and words that read
   wrong where they sit.
8. **Judge, per area (Opus):** findings both models agree on stand; where they differ, the judge decides and says why. The
   PR body lists every disagreement and how it was settled.
9. Apply the fixes, then re-review only the strings that changed, until no `must_fix` is left.
10. A code reviewer checks the non-text changes; the full checks run; then merge (no release while a draft).

The PR body also reports the agents used and the tokens spent, so the cost of each file is visible.

## The PRs, in order

| # | Task | What |
|---|------|------|
| 1 | `i18n-zh-cn-applications` | Pilot: `applications` (190 strings). Registers the draft and starts the glossary. Kai checks the process and token use before anything else starts. |
| 2–17 | `i18n-zh-cn-<file>` | One per remaining file: common, stages, today, roles, people, interviews, calls, offers, todos, notes, documents, files, timeline, events, insights, errors (11 to 263 strings each). |
| 18 | `i18n-zh-cn-layout` | System CJK fonts (PingFang SC, Microsoft YaHei, Noto Sans CJK SC) and clipped labels, checked on every page at desktop width and 375 px. |
| 19 | `i18n-zh-cn-switch-on` | Minor release. `LANGUAGES` and `LANGUAGE_NAMES`, `dayjs/locale/zh-cn`, a `PATTERNS` row (`YYYY年M月D日`…), `NUMBER_LOCALE`, "More coming soon", a browser test that finds no English left. README: a "Use it in your language" feature row and a Languages section with the open language menu; guide, `llms.txt`, changelog. |
| 20 | `i18n-zh-cn-demo-data` | `seed_demo.py --lang zh-CN`: made-up Chinese companies, people and notes, so Chinese screenshots look like real use (to confirm with Kai). |
| 21 | `i18n-zh-cn-screenshots` | The README screenshots and `demo.gif` in Chinese under `docs/screenshots/zh-CN/`; shown to Kai before they go in. |
| 22 | `i18n-zh-cn-readme` | `README.zh-CN.md` with the Chinese images, reviewed the same way; the main README gets `English · 简体中文` under its title. |
| 23 | `i18n-zh-cn-website` | The website says the app comes in several languages (Features, FAQ) (to confirm with Kai). |
| 24 | `i18n-zh-cn-listing` | Not a PR: the GitHub description with Chinese in it (e.g. "… in English and 简体中文 · 开源求职申请追踪器"), and perhaps the topics `chinese` and `multilingual` in place of two others. Kai approves the exact text first. |
