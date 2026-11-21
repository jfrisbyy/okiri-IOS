export const meta = {
  name: 'taxonomy-sufficiency',
  description: 'Is the 181-concept A1-C1 taxonomy genuinely sufficient to carry a learner to fluency, and can expo content be ported to cut the authoring job',
  phases: [
    { title: 'Audit', detail: 'seven specialist lenses over the taxonomy' },
    { title: 'Verify', detail: 'three refuters per proposal; deaths counted as unverified, never as refutations' },
    { title: 'Decide', detail: 'one amendment list in dependency order' },
  ],
}

// Recovered from the build session (September 2026), where this was run as an inline
// Claude Code Workflow script. Facts stated in its CTX are as of then. Paths were updated
// from the lost session scratch directory to their homes in this repository.

const REPO = '/home/user/okiri-IOS'
const CTX = `
Repo ${REPO}. Product is ios/FluentFrenchIOS/ ONLY. expo/ is a legacy React Native version kept
as reference — read it freely, NEVER propose changes to it.

VERIFIED STATE (do not re-derive):
- ios/FluentFrenchIOS/Models/ConceptTaxonomy.swift holds 181 concepts spanning A1-C1, extended
  from 49 in commit b67753f. Distribution by band: A1 35, A2 39, B1 41, B2 36, C1 30.
  By category: grammar 95, vocabulary 40, phrasing 19, pronunciation 15, register 12.
  GapCategory has exactly five cases: vocabulary, grammar, pronunciation, phrasing, register.
  CEFRLevel has A1 A2 B1 B2 C1 C2; nothing is assigned C2 and that is deliberate.
- The prerequisite graph is already PROVEN acyclic, fully resolving, with no prerequisite above
  its dependent's band, all ids unique, every band >= 20, every category populated
  (ConceptTaxonomyTests.swift). Do NOT re-report structural validity — it is tested.
- Content (FoundationContent.json, schema v2) covers only 49 of the 181 concepts:
  A1 31/35, A2 10/39, B1 8/41, B2 0/36, C1 0/30. Authoring the other 132 is the next job
  and will produce roughly 1450 new items. That is WHY this audit runs now: a missing or
  mis-levelled concept found today is free; found after authoring, it is expensive.
- Existing concept ids are IMMUTABLE. Persisted learner state, ConceptTaxonomy.baseConceptIds
  and FoundationContent skill ids all reference the slugs. Propose ADDITIONS and, where
  genuinely wrong, re-levellings — but flag a re-levelling as a data-migration risk, and
  NEVER propose a rename or removal.

You are READ-ONLY. Do not edit any file.
A proposal must be specific: the concept to add (proposed slug, name, category, band,
prerequisites), or the concept to re-level with its current and correct band. Justify from
French as it actually works and from what an English-speaking learner actually fails at —
not from a generic syllabus. Do not propose splitting a concept merely to raise the count.
`

const PROPOSALS = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'your overall judgement on sufficiency in this domain' },
    sufficient: { type: 'boolean', description: 'is the current taxonomy adequate in your domain for a C1 learner' },
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['add', 'relevel'] },
          slug: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string', enum: ['vocabulary', 'grammar', 'pronunciation', 'phrasing', 'register'] },
          band: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1'] },
          currentBand: { type: 'string', description: 'for relevel only; else empty' },
          prerequisites: { type: 'array', items: { type: 'string' } },
          why: { type: 'string', description: 'why a learner fails without this, specific to French vs English' },
          severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
        },
        required: ['kind', 'slug', 'name', 'category', 'band', 'why', 'severity'],
      },
    },
  },
  required: ['summary', 'sufficient', 'proposals'],
}

const VERDICT = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['refuted', 'reason'],
}

const LENSES = [
  { k: 'grammar', p: `You are a French grammar specialist. Read ConceptTaxonomy.swift IN FULL, list what grammar is actually covered, then find what is missing or mis-levelled for a learner who must reach C1. Check the full tense/mood system, the subjunctive progression, aspect and tense choice, participle agreement in all its cases, the pronoun systems and their ordering, relatives and interrogatives, hypotheticals, reported speech, passive and its French-preferred alternatives, causatives, impersonals, inversion, negation beyond pas, determiners, and verb-governed prepositions (the de/à complementation that no English speaker guesses). Be rigorous: the taxonomy already has 95 grammar concepts, so only propose what is genuinely absent.` },
  { k: 'lexis', p: `You are a French lexicology specialist. The taxonomy has 40 vocabulary concepts for a journey to C1. Judge whether that is enough and whether they are the right ones. Consider word-formation and derivation (prefixes, suffixes, nominalisation — the machinery that turns 1 known word into 10), false friends, polysemy, the high-frequency verbs whose range English splits differently, academic and professional lexis, and whether "vocabulary as concepts" is even the right model above B1 or whether the work shifts to phrasing. Say plainly if the vocabulary/grammar balance (40 vs 95) is wrong for French.` },
  { k: 'phonetics', p: `You are a French phonetics specialist. Audit the 15 pronunciation concepts. Consider liaison in all three classes, enchainement, elision, nasal vowels, the e muet/schwa and its deletion rules, vowel quality contrasts English lacks, the R, final consonants, rhythm and stress groups, intonation contours, spoken reductions, and the specific L1 interference errors English speakers make. ALSO answer a question that decides whether these concepts are worth authoring at all: can this app actually TEACH or ASSESS pronunciation? Read how a pronunciation concept becomes a testable item (FoundationContentLoader, LessonScheduler, AnswerGrader, and whether Speak/AccentView feed concept evidence). If pronunciation concepts cannot be assessed, say so — that is a more important finding than any missing concept.` },
  { k: 'pragmatics', p: `You are a specialist in French pragmatics and sociolinguistics. Audit the 12 register concepts plus the relevant phrasing ones for C1 adequacy. Consider tu/vous negotiation and its repair, the soutenu/courant/familier range, politeness and indirectness, hedging, disagreement and face-saving, formal written conventions (email, letter, administrative French), argot and verlan, regional and Francophone variation beyond metropolitan French, humour and irony, discourse markers, and turn-taking. What is missing for someone who must function professionally and socially in French?` },
  { k: 'cefr', p: `Audit the taxonomy against the actual CEFR descriptors band by band. For each of A1-C1, do the assigned concepts genuinely match that band's can-do statements? Find concepts sitting a band too low or too high — especially anything at A1 that is really A2+, and whether the C1 set describes real C1 competence or is B2+ material relabelled. Then answer directly: the product claims to take someone to fluency. Is C1 the right ceiling, and does the deliberate absence of C2 undermine that claim or not? Report mis-levellings as 'relevel' proposals with the current and correct band.` },
  { k: 'prereq', p: `Audit the prerequisite graph for PEDAGOGICAL soundness. Structural validity is already tested — do not re-report it. The question is whether the edges are right. Find concepts whose prerequisites are too thin, so the concept becomes reachable far earlier than a learner could cope with; too heavy, so it is unreachable in practice; or missing a genuinely required precursor. This matters concretely: frontier selection walks this graph, so a thin prerequisite chain means the app will offer C1 material to a near-beginner. Compute and report the SHORTEST path from zero mastered concepts to any C1 concept, and name the specific edges that make it that short. Report fixes as 'relevel' proposals or describe the prerequisite edges to add in the why field.` },
  { k: 'expo-port', p: `Read the legacy expo/ implementation (READ ONLY). Question: does it contain authored French content — vocabulary sets, grammar explanations, exercises, lesson data, dialogues — covering concepts the iOS FoundationContent.json does not? Quantify precisely: file paths, item counts, what schema it is in, and how mechanically it could be transformed into schema v2 (teaching card + 3 probes + 10-12 items with a verbatim blank). This could materially shrink the 1450-item authoring job, so be concrete and honest — if the content is thin, absent, or too different in shape to port, say that plainly rather than overselling it. Report findings in the summary field; use proposals only if expo reveals a genuinely missing CONCEPT.` },
]

phase('Audit')
log(`${LENSES.length} specialist lenses over a 181-concept taxonomy`)

const perLens = await pipeline(
  LENSES,
  (l) => agent(`${CTX}\n\n## Your lens: ${l.k}\n\n${l.p}`, {
    label: `audit:${l.k}`, phase: 'Audit', schema: PROPOSALS, effort: 'high',
  }),
  (res, l) => {
    if (!res) return []
    const props = res.proposals || []
    if (!props.length) return []
    return parallel(props.map((pr) => () =>
      parallel(['already-covered', 'wrong-band', 'not-worth-a-concept'].map((angle) => () =>
        agent(`${CTX}\n\n## Refute this taxonomy proposal\n\nLens: ${l.k}\n${JSON.stringify(pr)}\n\nYour angle: ${angle}.\n- already-covered: is this ALREADY in the taxonomy under a different name, or subsumed by an existing concept? Read ConceptTaxonomy.swift and check every plausible existing slug before answering.\n- wrong-band: even if the concept is real, is the proposed CEFR band wrong, or the prerequisites wrong?\n- not-worth-a-concept: is this too fine-grained to be its own concept, better taught as part of another, or not actually something English speakers fail at?\n\nDefault to refuted=true if you cannot confirm the proposal is both real and absent. Be adversarial and specific; cite the existing slug if it is already covered.`,
          { label: `refute:${l.k}:${pr.slug}:${angle}`, phase: 'Verify', schema: VERDICT, effort: 'high' })))
        .then((votes) => {
          const live = votes.filter(Boolean)
          // A refuter that DIED is not a refutation. Track that separately so a
          // quota or API failure can never silently delete a real proposal.
          const unverified = live.length === 0
          const survived = !unverified && live.filter((v) => v.refuted).length < 2
          return { ...pr, lens: l.k, survived, unverified,
                   objections: live.filter((v) => v.refuted).map((v) => v.reason) }
        })))
  },
)

const all = perLens.filter(Boolean).flat().filter(Boolean)
const confirmed = all.filter((x) => x.survived)
const unverified = all.filter((x) => x.unverified)
const rejected = all.filter((x) => !x.survived && !x.unverified)
log(`${all.length} proposals: ${confirmed.length} survived, ${rejected.length} refuted, ${unverified.length} UNVERIFIED (verifier failure, not a refutation)`)

const summaries = perLens.filter(Boolean).map((_, i) => i)

phase('Decide')
const decision = await agent(
  `${CTX}\n\n## Proposals that survived three adversarial refuters\n${JSON.stringify(confirmed)}\n\n## Refuted (do NOT reinstate; listed so you can see what was considered)\n${JSON.stringify(rejected.map((r) => ({ slug: r.slug, why: r.why, objections: r.objections })))}\n\n## Unverified — verifiers failed, so these are NEITHER confirmed NOR refuted\n${JSON.stringify(unverified.map((r) => ({ slug: r.slug, lens: r.lens, why: r.why })))}\n\n## Produce the decision\n\nWrite the taxonomy amendment plan. Structure:\n\n1. **VERDICT** — is the 181-concept taxonomy sufficient to carry a learner to genuine fluency? Answer yes or no in the first sentence, then justify. If concepts must be added, give the resulting count.\n2. **AMENDMENTS** — a single deduplicated, ordered list of concepts to ADD: slug, name, category, band, prerequisites, one-line description in the learner-facing register the file already uses. Merge near-duplicate proposals from different lenses into one entry. Group by band.\n3. **RE-LEVELLINGS** — concepts to move, with current and correct band, and an explicit note on the data-migration risk (persisted learner state references these ids and their bands feed band gating).\n4. **PREREQUISITE REPAIRS** — specific edges to add, and the shortest-path-to-C1 finding.\n5. **CAN PRONUNCIATION BE TAUGHT?** — the phonetics lens was asked whether this app can assess pronunciation concepts at all. Answer it directly; if it cannot, say what that means for authoring those 15 concepts.\n6. **EXPO PORT** — can any of the 1450-item authoring job be met from legacy content? Concrete numbers or a plain no.\n7. **STILL UNVERIFIED** — list the unverified proposals plainly as open questions. Do not silently drop them and do not present them as confirmed.\n\nBe concrete and quantitative. Do not pad. If the honest answer to (1) is that the taxonomy is already sufficient, say so and keep the amendment list short.`,
  { label: 'decision', phase: 'Decide', effort: 'max' },
)

return { confirmedCount: confirmed.length, rejectedCount: rejected.length, unverifiedCount: unverified.length, confirmed, unverified, decision }