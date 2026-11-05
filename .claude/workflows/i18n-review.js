export const meta = {
  name: 'i18n-review',
  description: 'Review one translated string file: per area and per screenshot by Sonnet and Opus separately, then an Opus judge per area (scripts/i18n/translate/README.md)',
  whenToUse: 'After assemble.py and the translated screenshots. args: {lang, language, ns, wt, areas, shots}',
  phases: [{ title: 'Review' }, { title: 'Judge' }],
}
// args: lang, language, ns, wt, areas (areas.json), shots (the page names from pages.json).
const { lang, language, ns, wt, areas, shots } = args
const W = `${wt}/var/i18n/${lang}/${ns}`
const MODELS = ['sonnet', 'opus']
const COMMON = `You are reviewing a ${language} (${lang}) translation of the UI of an open-source, self-hosted job application tracker for software engineers. Reader: a software engineer tracking their own job search, in their own language. Do NOT edit any file; only report.
Glossary and style rules every translator followed: ${wt}/docs/i18n/${lang}.md (Read it first; judge against it, and say if the glossary itself is wrong).
English source with comments: ${wt}/frontend/src/locales/en/${ns}.ts. Translation: ${wt}/frontend/src/locales/${lang}/${ns}.json. Other translated files: ${wt}/frontend/src/locales/${lang}/*.json.
The language may be a draft with only some files translated, so other text on screen may still be English. Don't report it. Company, people, role, stage and tag names are the user's data and are never translated.
Severity: must_fix = wrong meaning, misleading, broken placeholder/tag, ungrammatical, or contradicts the glossary; should_fix = clearly unnatural or inconsistent but understandable; nit = minor polish. Don't invent problems: say nothing about good strings.`
const FIND = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string', description: `dotted key in the ${ns} namespace` },
      severity: { type: 'string', enum: ['must_fix', 'should_fix', 'nit'] },
      problem: { type: 'string' },
      suggestion: { type: 'string', description: 'the full replacement string, placeholders intact' },
    }, required: ['key', 'severity', 'problem', 'suggestion'] } },
    overall: { type: 'string' },
  },
  required: ['findings', 'overall'],
}

phase('Review')
const textJobs = areas.flatMap(a => MODELS.map(m => () => agent(`${COMMON}

Review area ${a.id}: ${a.desc}.
1. English and translation pairs: ${W}/areas/${a.id}.pairs.json.
2. For each key, find where the code uses it (grep under ${wt}/frontend/src excluding locales) and read the code around it: what element it is, what fills each placeholder (and in what language), what sits next to it.
3. Where it shows, English then translated: ${a.shots.map(s => `${W}/shots-en/${s}.png and ${W}/shots-${lang}/${s}.png`).join('; ')}.
Check each string: faithful meaning in context, natural UI language, glossary terms, placeholders/tags intact and well placed, punctuation and spacing per the style rules, consistency with the other translated files.`,
  { label: `text:${a.id}:${m}`, phase: 'Review', model: m, schema: FIND })))
const shotJobs = shots.flatMap(s => MODELS.map(m => () => agent(`${COMMON}

Review this screen in place: Read ${W}/shots-${lang}/${s}.png (translated) and ${W}/shots-en/${s}.png (English). Look only at text from the "${ns}" file (search the translated file for text you see to find its key). Check: clipped, truncated or overlapping text; awkward line breaks; labels that read wrongly next to what's beside them; anything unfinished. Report only with a key and a full replacement string. If a problem is layout only (no wording would fix it), use severity nit, start problem with "LAYOUT:", and give the current string as the suggestion. If nothing from "${ns}" is visible, return no findings and say so.`,
  { label: `screen:${s}:${m}`, phase: 'Review', model: m, schema: FIND })))

const reviews = await parallel([...textJobs, ...shotJobs])
const textRes = reviews.slice(0, textJobs.length)
const shotRes = reviews.slice(textJobs.length)
if (reviews.some(r => !r)) log(`${reviews.filter(r => !r).length} reviewers returned nothing`)
const prefixOf = {}
areas.forEach(a => a.prefixes.forEach(p => { prefixOf[p] = a.id }))
const areaOf = key => prefixOf[key.replace(`${ns}:`, '').replace(`${ns}.`, '').split('.')[0]] || areas[0].id

phase('Judge')
const JUDGE = {
  type: 'object',
  properties: {
    decisions: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' },
      verdict: { type: 'string', enum: ['change', 'keep'] },
      final: { type: 'string', description: 'the final string (the current one if keep)' },
      severity: { type: 'string', enum: ['must_fix', 'should_fix', 'nit'] },
      agreed: { type: 'boolean', description: 'true if both models raised the same problem' },
      disagreement: { type: 'string' },
      why: { type: 'string' },
    }, required: ['key', 'verdict', 'final', 'agreed', 'why'] } },
    glossary_changes: { type: 'array', items: { type: 'string' } },
  },
  required: ['decisions'],
}
const judged = await parallel(areas.map((a, ai) => () => {
  const byModel = MODELS.map((m, mi) => ({ model: m, text: textRes[ai * MODELS.length + mi] }))
  const screen = shotRes.flatMap((r, i) => (r?.findings || []).filter(f => areaOf(f.key) === a.id).map(f => ({ ...f, model: MODELS[i % MODELS.length], screen: shots[Math.floor(i / MODELS.length)] })))
  if (!byModel.some(b => b.text?.findings?.length) && !screen.length) return Promise.resolve({ area: a.id, decisions: [], glossary_changes: [] })
  return agent(`${COMMON}

You are the judge for area ${a.id} (${a.desc}). Pairs: ${W}/areas/${a.id}.pairs.json. Screenshots: ${W}/shots-${lang}/.
Sonnet and Opus reviewed the text separately, and reviewers looked at screenshots. For every key any of them flagged, decide change (final string) or keep. Both models agreeing: accept unless clearly wrong. Disagreeing: check the code and context yourself, decide, and record both views in "disagreement". Placeholders and tags stay intact. LAYOUT-only items: keep unless shorter wording fixes it without losing meaning. A key outside this area: still decide it.
Text reviews: ${JSON.stringify(byModel.map(b => ({ model: b.model, findings: b.text?.findings || [], overall: b.text?.overall })))}
Screen reviews: ${JSON.stringify(screen)}`, { label: `judge:${a.id}`, phase: 'Judge', schema: JUDGE }).then(r => ({ area: a.id, ...(r || {}) }))
}))

return {
  text: textRes.map((r, i) => ({ area: areas[Math.floor(i / MODELS.length)].id, model: MODELS[i % MODELS.length], ...(r || {}) })),
  screens: shotRes.map((r, i) => ({ screen: shots[Math.floor(i / MODELS.length)], model: MODELS[i % MODELS.length], ...(r || {}) })),
  judged,
}
