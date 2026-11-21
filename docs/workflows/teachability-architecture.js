export const meta = {
  name: 'teachability-architecture',
  description: 'Design 100% concept teachability and the bidirectional link between learner-captured gaps and the concept map',
  phases: [
    { title: 'Ground', detail: 'six investigators establish the real current mechanics' },
    { title: 'Design', detail: 'four independent architectures for gap-to-concept linkage' },
    { title: 'Judge', detail: 'score each design on three lenses' },
    { title: 'Size', detail: 'what authoring 132 concepts actually costs' },
    { title: 'Synthesize', detail: 'one plan, in dependency order' },
  ],
}

// Recovered from the build session (September 2026), where this was run as an inline
// Claude Code Workflow script. Facts stated in its CTX are as of then. Paths were updated
// from the lost session scratch directory to their homes in this repository.

const REPO = '/home/user/okiri-IOS'
const CTX = `
Repo ${REPO}. Product is ios/FluentFrenchIOS/ ONLY. expo/ is legacy reference — read it if it
clarifies intent, NEVER propose changes to it.

BINDING PROJECT RULES (from the workplan, non-negotiable):
- Do NOT invent French. Mechanically unambiguous content fixes only; otherwise flag for human
  review. Never fabricate pedagogy. (Classification of an existing word into a concept is NOT
  inventing French and is allowed. Authoring new French sentences goes through the specialist
  pipeline: specialist author -> simulated beginner student -> specialist re-review -> final.)
- Every constant lives in Services/Tuning.swift, named, one-line comment, no magic numbers.
- The engine stays view-free. No new logic in SwiftUI views.

VERIFIED CURRENT STATE (do not re-derive, but you may verify):
- ConceptTaxonomy.swift: 181 concepts, A1-C1 (35/39/41/36/30), prerequisite DAG, verified acyclic.
- FoundationContent.json: schema v2 content for only 49 of the 181. Per concept: 1 teaching card
  (rule >=60 chars, >=2 examples with notes, >=1 contrast pair, commonMistake), 3 MC probes,
  10-12 items (fr/en/note/ex/exEn/blank/alts/testable). 598 items total.
- Structs are in Services/FoundationContentLoader.swift (FoundationSkillContent,
  FoundationTeachingContent, FoundationProbeContent, FoundationItemContent).
- CaptureDraft.conceptId (Models/Gloss.swift:155) defaults to nil. 9 CaptureDraft construction
  sites; 6 pass NO conceptId: ContentScreens.swift:869 and :872 (reading), WatchPlayerView.swift
  :1048 and :1050 (watch), SharedComponents.swift:414 and :417 (shared/listen/speak). Only
  IdiomsView, AccentView, TensesView and ConverseView set one.
- AppStore capture path around line 2700 does 'let linked = concept(draft.conceptId)'.
- Mastery is Beta evidence (alpha/beta) per concept with recency decay, plus undecayed
  observationCount; FSRS schedules review per gap. See Models/Concept.swift.
- Linux harness (engine+store+tests, no SwiftUI/networking), 476 tests passing:
  /home/user/okiri-IOS/ios/tools/linuxbuild/run.sh
- Concept map spec: /home/user/okiri-IOS/docs/spec-concept-map.md

THE OWNER'S REQUIREMENT, stated this turn:
1. 100% of the 181 concepts must be genuinely teachable in the app.
2. Authored content must map to how users actually learn.
3. Users must be able to learn through the gaps THEY identify by interacting with the app
   (reading, watching, listening, speaking) — those gaps must connect to the concept map.

You are READ-ONLY. Do not edit files.
`

const GROUND = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          matters: { type: 'string', description: 'why this constrains the design' },
        },
        required: ['claim', 'file', 'matters'],
      },
    },
  },
  required: ['summary', 'facts'],
}

const DESIGN = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    thesis: { type: 'string', description: 'the approach in two sentences' },
    classification: { type: 'string', description: 'how a captured word/phrase is assigned to one of 181 concepts, precisely' },
    evidence: { type: 'string', description: 'how a captured item affects concept mastery, and how it must NOT corrupt the estimator' },
    selection: { type: 'string', description: 'how accumulated captures influence what the app teaches next' },
    partialTeachability: { type: 'string', description: 'what happens for a concept with captures but no authored content' },
    files: { type: 'array', items: { type: 'string' }, description: 'files created or changed' },
    risks: { type: 'array', items: { type: 'string' } },
    effort: { type: 'string', enum: ['S', 'M', 'L', 'XL'] },
  },
  required: ['name', 'thesis', 'classification', 'evidence', 'selection', 'partialTeachability', 'files', 'risks', 'effort'],
}

const SCORE = {
  type: 'object',
  properties: {
    score: { type: 'integer', description: '1-10' },
    strongest: { type: 'string' },
    fatalFlaw: { type: 'string', description: 'the thing that would actually break, or "none"' },
  },
  required: ['score', 'strongest', 'fatalFlaw'],
}

phase('Ground')
const groundLenses = [
  { k: 'capture', p: `Trace the COMPLETE capture path end to end for every one of the 9 CaptureDraft sites: what data each site has available at the moment of capture (the word, its sentence, the gloss/LLM result, part of speech, register, source level, the article or media it came from). The design needs to know what raw signal exists to classify from. Be exhaustive and concrete about what each site knows.` },
  { k: 'gloss', p: `Read Models/Gloss.swift and every service that produces a Gloss (the LLM call, its prompt, its response schema, what fields it returns, whether it is cached, whether it runs offline). Question to answer: could the existing gloss call also return a conceptId from a fixed list of 181 slugs, at no extra request? What exactly would have to change? Quote the current prompt and schema.` },
  { k: 'evidence', p: `Read Models/Concept.swift and everywhere alpha/beta/observationCount are updated. Establish precisely how evidence currently flows from answering a question to concept mastery, which roles count (probe, review, checkIn, remedial...), what weights apply, and what guards exist. The design must make captured items count WITHOUT letting a learner inflate mastery by saving and drilling easy words. Identify every place that guard would have to live.` },
  { k: 'selection', p: `Read Services/ConceptSelector.swift fully. Establish how a concept enters the frontier, how gaps are chosen, and precisely where a signal like "the learner has captured 3 words for this concept" could influence ranking without breaking the existing scoring (urgency/leverage/frontier/confusion/repeatDamp). Name the exact function and the exact insertion point.` },
  { k: 'partial', p: `What ALREADY happens today for a concept that has gaps but no authored content? Trace it: does LessonAssembler build questions from a GapItem alone, with no FoundationContent? Can a lesson run on purely captured gaps? What breaks — the teaching card display, the probe path, the capstone, the summary? This determines whether partial teachability is a new feature or an existing behaviour that needs surfacing.` },
  { k: 'authoring', p: `Read tools/validate_foundation_content.py and the content pipeline notes in the workplan at /home/user/okiri-IOS/docs/workplan.md. Establish exactly what authoring ONE concept to schema v2 requires, every validator rule it must satisfy, and every cross-concept constraint (e.g. no duplicate fr across skills). Then estimate the true cost of authoring the remaining 132 concepts: item count, validator constraints that get harder as the corpus grows, and where the specialist pipeline is likely to fail at B2/C1.` },
]

const ground = await parallel(groundLenses.map((l) => () =>
  agent(`${CTX}\n\n## Investigate: ${l.k}\n\n${l.p}`, { label: `ground:${l.k}`, phase: 'Ground', schema: GROUND, effort: 'high' })))

const groundText = JSON.stringify(ground.filter(Boolean))
log(`grounded on ${ground.filter(Boolean).length}/6 lenses`)

phase('Design')
const ANGLES = [
  { k: 'deterministic-first', p: `Design so that classification is DETERMINISTIC wherever possible — morphology, part of speech, article/gender pattern, verb tense form, register tag, the concept's own authored items as a lookup table — and the LLM is only a labelled fallback. Optimise for: works offline, testable in the Linux harness, never wrong in a way the learner notices.` },
  { k: 'llm-first', p: `Design so that the existing gloss call returns the conceptId directly, treating classification as a language-understanding problem rather than a morphological one. Optimise for: coverage of the long tail (idioms, collocations, register, phrasing concepts that morphology cannot see), and be rigorous about what happens offline, on a wrong label, and how a wrong label is corrected.` },
  { k: 'multi-label', p: `Design on the premise that a single captured word legitimately exercises SEVERAL concepts at once (a sentence with a subjunctive after a conjunction touches subjunctive-after-conjunctions, the conjunction itself, and the verb's own concept). Design the data model, the evidence weighting across multiple concepts, and the UI consequence. Be rigorous about not multiplying evidence.` },
  { k: 'learner-in-loop', p: `Design so the learner participates in classification — the app proposes a concept for a capture and the learner can confirm or change it, and that act is itself pedagogically valuable ("this word is an example of the partitive"). Optimise for trust and for the teaching value of the act, while keeping friction near zero for people who do not want to curate.` },
]

const designs = await pipeline(
  ANGLES,
  (a) => agent(`${CTX}\n\n## Grounding established by the investigation phase\n${groundText}\n\n## Your design angle: ${a.k}\n\n${a.p}\n\nDesign the full architecture satisfying all three owner requirements. Be concrete: name files, functions, data-model changes, Tuning constants, and the harness tests that would prove it. Address how a concept with NO authored content behaves, and how this interacts with band gating (D6.4) and the certified-level idea in the spec.`,
    { label: `design:${a.k}`, phase: 'Design', schema: DESIGN, effort: 'high' }),
  (d, a) => {
    if (!d) return null
    return parallel(['pedagogy', 'engineering', 'estimator-integrity'].map((lens) => () =>
      agent(`${CTX}\n\n## Score this design on the ${lens} lens\n\n${JSON.stringify(d)}\n\nlens=pedagogy: does this genuinely help someone learn French, or is it bookkeeping? Would a learner feel the app understood them?\nlens=engineering: is it buildable in this codebase as it stands, testable in the Linux harness, and free of new failure modes? Check its file/function claims against the real code.\nlens=estimator-integrity: could this corrupt the Bayesian mastery model or the FSRS schedule — inflate mastery, double-count evidence, let a learner game it, or feed evidence from material never taught? Be ruthless here; this is the highest risk.\n\nScore 1-10 and name the fatal flaw if there is one.`,
        { label: `judge:${a.k}:${lens}`, phase: 'Judge', schema: SCORE, effort: 'high' })))
      .then((scores) => ({ design: d, angle: a.k, scores: scores.filter(Boolean),
                           total: scores.filter(Boolean).reduce((s, x) => s + x.score, 0) }))
  },
)

const scored = designs.filter(Boolean).sort((x, y) => y.total - x.total)
log(`designs scored: ${scored.map((s) => `${s.angle}=${s.total}`).join(', ')}`)

phase('Size')
const sizing = await parallel([
  () => agent(`${CTX}\n\n## Grounding\n${groundText}\n\nSize the authoring job for the remaining 132 concepts precisely. Per band: how many concepts, how many items (10-12 each), probes, teaching cards. What is the total new item count? Which validator constraints get materially harder as the corpus grows from 598 to ~2000 items (the no-duplicate-fr-across-skills rule especially — quantify the collision risk). Where will the specialist pipeline most likely produce weak or wrong French, and what review gate catches it? Give a concrete, ordered authoring plan by band with a per-band definition of done.`,
    { label: 'size:authoring', phase: 'Size', effort: 'high' }),
  () => agent(`${CTX}\n\n## Grounding\n${groundText}\n\nIs schema v2 ADEQUATE for B2/C1 concepts, or does the shape itself need to change? A B2 phrasing concept like 'hedging-and-nuance' or a C1 concept like 'irony-and-understatement' may not decompose into 10-12 fr/en word-level items with a single-token blank the way 'definite-articles' does. Examine several real B2/C1 concept names from ConceptTaxonomy.swift and ask what an item for each would actually look like. If the schema needs extending (e.g. sentence-level items, discourse-level items, multi-blank, judgement items), say exactly how, and whether that is backward compatible with the 49 authored concepts and with AnswerGrader/LessonAssembler. This is a load-bearing question — be concrete and give worked examples.`,
    { label: 'size:schema', phase: 'Size', effort: 'max' }),
])

phase('Synthesize')
const plan = await agent(
  `${CTX}\n\n## Everything established\n\nGrounding:\n${groundText}\n\nDesigns, best first:\n${JSON.stringify(scored)}\n\nSizing:\n${JSON.stringify(sizing.filter(Boolean))}\n\n## Write the plan\n\nSynthesize ONE architecture from the winning design, grafting the best ideas from the runners-up where they do not conflict. Answer the owner's three requirements directly. Structure:\n\n1. WHAT A TEACHING CARD SHOULD BE — is the current 4-field shape right for all 181 concepts, or must it change for B2/C1? Give a worked example of a B2 phrasing concept card.\n2. HOW CAPTURED GAPS JOIN THE MAP — the classification mechanism, chosen and justified against the alternatives, including exactly what happens offline and when it is wrong.\n3. HOW CAPTURED WORK COUNTS — the evidence rules, and the specific guards that stop a learner inflating mastery by drilling easy self-saved words. Be precise; this is the highest-risk part.\n4. HOW THE APP TEACHES WHAT YOUR READING REVEALED — the selection change, with the exact insertion point in ConceptSelector.\n5. PARTIAL TEACHABILITY — the honest intermediate state for a concept with captures but no authored content, and what the map says about it.\n6. THE PATH TO 100% TEACHABLE — ordered, with the authoring plan by band and what must be built before authoring starts.\n7. WHAT I WOULD PUSH BACK ON — anything in the owner's requirement that is a bad idea as literally stated, said plainly with a better alternative.\n\nBe concrete and quantitative. Name files, functions, constants and tests. Do not pad.`,
  { label: 'synthesis', phase: 'Synthesize', effort: 'max' },
)

return { winner: scored[0] ? scored[0].angle : null, scores: scored.map((s) => ({ angle: s.angle, total: s.total })), plan, sizing: sizing.filter(Boolean) }