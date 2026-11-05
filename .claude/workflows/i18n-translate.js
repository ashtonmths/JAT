export const meta = {
  name: 'i18n-translate',
  description: 'Translate one string file in context: one translator per screen area, then a consistency pass (scripts/i18n/translate/README.md)',
  whenToUse: 'After scripts/i18n/translate/prepare.py and the English screenshots. args: {lang, language, ns, wt, areas}',
  phases: [{ title: 'Translate' }, { title: 'Consistency' }],
}
// args: lang ("zh-CN"), language ("Simplified Chinese (mainland China)"), ns ("stages"),
// wt (the checkout's absolute path), areas (the contents of var/i18n/<lang>/<ns>/areas.json).
const { lang, language, ns, wt, areas } = args
const W = `${wt}/var/i18n/${lang}/${ns}`
const COMMON = `You are translating the UI of an open-source, self-hosted job application tracker for software engineers into ${language} (${lang}). Reader: a software engineer tracking their own job search, in their own language. Repo checkout: ${wt} (read-only for you: do NOT edit any file).
Follow the glossary and style rules in ${wt}/docs/i18n/${lang}.md exactly (Read it first). Files already translated, for consistency: ${wt}/frontend/src/locales/${lang}/*.json (the ${ns} one is still all [TRANSLATE] markers: ignore it).
Keep every {{placeholder}} and tag (<b>…</b>, <x/>) exactly; move them where the grammar wants. Plural keys (_one, _other, …) are already the forms this language uses: translate each. Company, people, role, stage and tag names on screen are the user's data: never translate data, only the keys you are given.`

const TR = {
  type: 'object',
  properties: {
    translations: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, text: { type: 'string' }, note: { type: 'string' } }, required: ['key', 'text'] } },
    new_terms: { type: 'array', items: { type: 'object', properties: { en: { type: 'string' }, text: { type: 'string' }, why: { type: 'string' } }, required: ['en', 'text'] } },
    unused_keys: { type: 'array', items: { type: 'string' } },
  },
  required: ['translations'],
}

phase('Translate')
const results = await parallel(areas.map(a => () => agent(`${COMMON}

Your area: ${a.desc} (${a.count} keys of the "${ns}" namespace).
1. Keys and English: ${W}/areas/${a.id}.json (dotted key -> English).
2. The English source with comments explaining each string: ${wt}/frontend/src/locales/en/${ns}.ts.
3. For EVERY key, find where the code uses it: grep under ${wt}/frontend/src excluding locales (t("key"), t("${ns}:key"), <Trans i18nKey>, keys built from a prefix or held in a map, so also grep the last segment). Read the code around each use: what element it is (button, heading, tooltip, aria-label, toast), what fills each placeholder, what sits next to it. List keys you can't find in unused_keys and translate them from their comment.
4. See where it shows (English, demo data): ${a.shots.length ? 'Read ' + a.shots.map(s => `${W}/shots-en/${s}.png`).join(', ') : 'no screenshots for this file; rely on the code'}.
5. Translate every key; a short note only where a choice needs explaining. Propose a new glossary term only for a recurring concept the glossary lacks.
Return all ${a.count} keys exactly as given, the translation in "text".`, { label: `translate:${a.id}`, phase: 'Translate', model: 'opus', schema: TR })))

const ok = results.map((r, i) => ({ area: areas[i].id, ...(r || {}) }))
const dropped = ok.filter(r => !r.translations).map(r => r.area)
if (dropped.length) log(`no result for: ${dropped.join(', ')}`)

phase('Consistency')
const CONS = {
  type: 'object',
  properties: {
    changes: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, why: { type: 'string' } }, required: ['key', 'to', 'why'] } },
    glossary_additions: { type: 'array', items: { type: 'object', properties: { en: { type: 'string' }, text: { type: 'string' }, notes: { type: 'string' } }, required: ['en', 'text'] } },
    summary: { type: 'string' },
  },
  required: ['changes', 'summary'],
}
const consistency = await agent(`${COMMON}

Below is the whole "${ns}" namespace translated area by area, with proposed new terms. Check it as one file and against the files already translated: the same concept uses the same term (and matches the glossary), same tone, button style, punctuation and spacing; placeholders and tags intact versus the English (${wt}/frontend/src/locales/en/${ns}.ts). Only change what's inconsistent or wrong. Decide which proposed terms join the glossary (only ones not already in it).

Translations: ${JSON.stringify(ok.flatMap(r => (r.translations || []).map(t => ({ area: r.area, ...t }))))}
Proposed terms: ${JSON.stringify(ok.map(r => ({ area: r.area, terms: r.new_terms || [], unused: r.unused_keys || [] })))}`, { label: 'consistency', phase: 'Consistency', model: 'opus', schema: CONS })

return { results: ok, consistency }
