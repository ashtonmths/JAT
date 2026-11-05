export const meta = {
  name: 'i18n-rereview',
  description: 'Re-review the strings a review changed, with Sonnet and Opus; an Opus judge if either flags more than a nit (scripts/i18n/translate/README.md)',
  whenToUse: 'After apply_review.py and assemble.py with the fixes. args: {lang, language, ns, wt}',
  phases: [{ title: 'Re-review' }, { title: 'Judge' }],
}
const { lang, language, ns, wt } = args
const W = `${wt}/var/i18n/${lang}/${ns}`
const P = `You are re-reviewing strings of a ${language} (${lang}) translation of a job application tracker's UI, changed after a first review. Do NOT edit files. Glossary and style rules: ${wt}/docs/i18n/${lang}.md. English with comments: ${wt}/frontend/src/locales/en/${ns}.ts; translation: ${wt}/frontend/src/locales/${lang}/${ns}.json. The changed strings, with the English and why each changed: ${W}/changed.json. Check each in its code context (grep its key under ${wt}/frontend/src) and, where visible, in ${W}/shots-${lang}/*.png. Other text on screen may still be English (a draft). Severity: must_fix = wrong meaning, broken placeholder, ungrammatical, contradicts glossary; should_fix = clearly unnatural; nit = polish. Report only real problems.`
const FIND = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, severity: { type: 'string', enum: ['must_fix', 'should_fix', 'nit'] }, problem: { type: 'string' }, suggestion: { type: 'string' } }, required: ['key', 'severity', 'problem', 'suggestion'] } }, overall: { type: 'string' } }, required: ['findings', 'overall'] }

phase('Re-review')
const reviews = await parallel(['sonnet', 'opus'].map(m => () => agent(P, { label: `rereview:${m}`, phase: 'Re-review', model: m, schema: FIND }).then(r => ({ model: m, ...(r || {}) }))))
const flagged = reviews.flatMap(r => (r.findings || []).filter(f => f.severity !== 'nit'))
let judge = null
if (flagged.length) {
  phase('Judge')
  judge = await agent(`${P}\n\nYou are the judge. For each flagged key decide change (final string) or keep, noting where the models disagreed. Reviews: ${JSON.stringify(reviews)}`, { label: 'judge', phase: 'Judge', schema: { type: 'object', properties: { decisions: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, verdict: { type: 'string', enum: ['change', 'keep'] }, final: { type: 'string' }, severity: { type: 'string' }, why: { type: 'string' } }, required: ['key', 'verdict', 'final', 'why'] } } }, required: ['decisions'] } })
}
return { reviews, judge }
