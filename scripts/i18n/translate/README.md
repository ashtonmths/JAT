# Translating a string file with agents

How Simplified Chinese is being translated (`docs/rfc/zh-cn.md`), as scripts and Claude Code workflows that work for
any language. A person translating by hand follows `docs/guide/adding-a-language.md` instead; these tools automate the
same steps and add a review by several models.

One string file (`frontend/src/locales/en/<ns>.ts`) at a time, one pull request each. Work files go in
`var/i18n/<lang>/<ns>/`, which git ignores: they're rebuilt from the code each run, so nothing goes stale.

## What you need

- The language's glossary and style rules, `docs/i18n/<lang>.md` (Chinese: `docs/i18n/zh-CN.md`).
- The language set up in the app as a draft (`DRAFT_LANGUAGES`, its folder and `index.ts`, the dev-only
  line in `i18n/index.ts`): the guide's "Translating in parts".
- The demo data on a dev server, since only a dev server shows a draft language:

  ```bash
  uv run python scripts/seed_demo.py /tmp/jat-i18n-demo
  uv run jat --data-dir /tmp/jat-i18n-demo serve --dev --port 8891
  JAT_API_URL=http://127.0.0.1:8891 pnpm --dir frontend exec vite --port 5182 --strictPort
  ```

## The steps

From the repo root, with `<lang>` such as `zh-CN` and `<ns>` such as `stages`:

1. **Prepare:** `uv run python scripts/i18n/translate/prepare.py <lang> <ns>` copies the marked file into
   `locales/<lang>/`, lists it in that folder's `index.ts`, and splits the keys into **areas**: the file's top-level
   groups, merged up to 30 keys, so each agent has one part of the screen.
2. **English screenshots:** `uv run --with playwright python scripts/i18n/translate/screenshots.py http://127.0.0.1:5182 <lang> <ns> en`
   shoots the pages listed for that file in `pages.json`. Add pages there for a new file; `{application:Contoso}` and
   the like are looked up by name in the demo data.
3. **Translate:** run the `i18n-translate` workflow with `{lang, language, ns, wt, areas}` (`wt` is the checkout's
   absolute path, `areas` the contents of `areas.json`). One translator per area reads its keys, every place the code
   uses them and the screenshots, following the glossary; then one agent checks the whole file for consistency. Save
   the result as `var/i18n/<lang>/<ns>/translate.json`.
4. **Assemble:** `uv run python scripts/i18n/translate/assemble.py <lang> <ns>` writes `locales/<lang>/<ns>.json`. It
   refuses if a key is missing or extra, a `[TRANSLATE]` marker is left, or a placeholder or tag differs from the
   English (the catalog test doesn't check tags). Add the consistency pass's new terms to the glossary by hand.
5. **Translated screenshots:** step 2 again with `<lang>` in place of `en`.
6. **Review:** the `i18n-review` workflow with `{lang, language, ns, wt, areas, shots}` (`shots`: the page names).
   For each area, Sonnet and Opus review the text separately; for each screenshot, they look at it in place; then an
   Opus judge per area settles their findings and records where the two disagreed. Save the result as
   `review.json` there.
7. **Apply:** `uv run python scripts/i18n/translate/apply_review.py <lang> <ns>` writes `fixes.json`, `changed.json`
   and `table.md` (for the pull request), then `assemble.py <lang> <ns> var/i18n/<lang>/<ns>/fixes.json`.
8. **Re-review:** the `i18n-rereview` workflow with `{lang, language, ns, wt}` checks only the changed strings. Repeat
   7 and 8 until no `must_fix` is left.
9. The usual checks and review for the pull request (CLAUDE.md *Git*). Its body lists the agents and tokens used and
   `table.md`.

The pilot (`applications`, #239) used about 3.1 million tokens for 190 strings, about 70% of it on the review.
