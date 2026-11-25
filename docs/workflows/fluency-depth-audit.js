export const meta = {
  name: 'fluency-depth-audit',
  description: 'Can a learner reach fluency in this app? Trace the taxonomy-to-lesson chain, audit taxonomy sufficiency for C1, check surface wiring, verify adversarially',
  phases: [
    { title: 'Investigate', detail: 'sixteen lenses: reachability, taxonomy sufficiency, surface wiring' },
    { title: 'Verify', detail: 'three refuters per finding, majority survives' },
    { title: 'Critique', detail: 'what did every lens miss' },
    { title: 'Synthesize', detail: 'the honest answer to: do we have the depth for fluency' },
  ],
}

// Recovered from the build session (September 2026), where this was run as an inline
// Claude Code Workflow script. Facts stated in its CTX are as of then. Paths were updated
// from the lost session scratch directory to their homes in this repository.

const REPO = '/home/user/okiri-IOS'
const CTX = `
Repo ${REPO}. The product is ios/FluentFrenchIOS/ ONLY. expo/ is a legacy React Native
version kept for reference — read it to clarify intent, NEVER propose changes to it.

State as of right now (verified, do not re-derive):
- ios/FluentFrenchIOS/Models/ConceptTaxonomy.swift holds 181 concepts spanning A1-C1
  (35/39/41/36/30 by band; grammar 95, vocabulary 40, phrasing 19, pronunciation 15,
  register 12). It was just extended from 49 concepts (A1-B1) in commit b67753f.
- ios/FluentFrenchIOS/Resources/FoundationContent.json holds authored content (schema v2:
  teaching card + 3 probes + 10-12 items) for only 49 of those 181 concepts:
  A1 31/35, A2 10/39, B1 8/41, B2 0/36, C1 0/30. So 132 concepts have NO content.
- The Linux test harness is at
  /home/user/okiri-IOS/ios/tools/linuxbuild/run.sh
  (compiles engine+store+tests in docker; 476 tests currently pass). Run it if you need to
  test a hypothesis. It does NOT compile SwiftUI views or networking.
- The full feature spec for the concept map is at
  /home/user/okiri-IOS/docs/spec-concept-map.md
  Read it — sections 3 (band gating), 5 (work breakdown) and 7 (sequencing correction) matter.
  Packages D6.3 (certified level), D6.4 (band gating), D6.5 (content), D6.7 (map UI) are
  ALL UNBUILT. Only D6.1 (taxonomy) and D6.2 (graph tests) have landed.

You are READ-ONLY. Do not edit any file. Report findings as data.
A finding must name a concrete file:line and a concrete consequence for a real learner.
Do not report speculative or stylistic issues. Do not report the mere fact that content is
unauthored — that is known. Report what BREAKS or MISLEADS because of it, or what is missing
from the taxonomy itself.
`

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'one sentence, concrete' },
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
          kind: { type: 'string', enum: ['reachability', 'taxonomy-gap', 'wiring', 'false-claim', 'correctness'] },
          consequence: { type: 'string', description: 'what a real learner experiences' },
          evidence: { type: 'string', description: 'the code or data that proves it' },
        },
        required: ['title', 'file', 'severity', 'kind', 'consequence', 'evidence'],
      },
    },
  },
  required: ['findings'],
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
  { key: 'ceiling', prompt: `Determine THE CEILING: what CEFR level can a learner actually reach in this app today, and exactly what stops them going further? Trace the full chain for a concept that has NO authored content (pick a real B2 one, e.g. a phrasing concept): does it get a Concept row? can it ever have a GapItem? does ConceptSelector ever rank it? can LessonAssembler build a question for it? What does the learner see? Then determine what the LAST concept a learner can be taught is, and whether progression stalls, silently loops, or ends cleanly. Read ConceptSelector.swift, LessonAssembler.swift, LessonPipeline.swift, AppStore.swift, FoundationContentLoader. This is the single most important lens: answer the ceiling question definitively with evidence.` },
  { key: 'unteachable', prompt: `A concept with no content can still enter state .learning or become a "gap" via other paths (Speak, Converse, Read capture, placement seeding, blind-spot probes). Find every path by which one of the 132 unauthored concepts can enter the learner's model, and what happens next — does it rank in the daily plan, appear in the Gap Map, block a gate, or count toward a total, while being permanently unteachable? Grep for conceptId assignment across Services/ and State/.` },
  { key: 'placement', prompt: `Audit placement and the reading gate against the 181-concept map. AssessmentService.contentBank, the adaptive staircase, AssessmentResult.masteredConceptIds, applyPlacement, baseConceptIds, and Readiness.swift. The spec section 7.1 claims placement breaks once probes exist for the whole map (staircase rides to band 4, never fully probes a base concept, masteredConceptIds empty, reading never unlocks). VERIFY OR REFUTE that claim against the actual code, and determine whether anything is broken TODAY (not just after D6.5).` },
  { key: 'gating', prompt: `There is no band gating yet (D6.4 unbuilt). With 181 concepts in the taxonomy, find every place that iterates the whole taxonomy and would now behave differently than when it was 49: frontier selection, daily plan, Gap Map totals, progress percentages, "concepts remaining" counts, unlock announcements, analytics. Which of these are wrong or misleading TODAY? Check ConceptSelector.isFrontier, AppStore daily plan, GapsView, ProfileView, HomeView.` },
  { key: 'counts', prompt: `Hunt for any number, percentage, progress bar, or claim shown to the learner whose denominator just changed from 49 to 181, or that now reads falsely. foundationTotal, foundationMastered, any x/y display, any "% complete", any level label. Read State/AppStore.swift computed properties and every View that renders a total or a fraction. A progress bar that silently fell from 60% to 16% overnight is a finding; so is one that ignores the new concepts and overstates.` },
  { key: 'lessons', prompt: `Can the lesson loop teach anything at B2/C1 today, through ANY surface? Check every lesson entry point and every content source: FoundationContent, the user's own captured gaps, AI-generated items, deck review, capstones, retention. If a learner captures a B2 word while reading, can the app build a lesson from it even with no authored B2 concept content? Trace CaptureBuilder and the gap-to-question path. Be precise about what works and what does not.` },
  { key: 'tax-grammar', prompt: `You are a French grammar specialist. Audit the 181-concept taxonomy for GRAMMAR completeness against what an educated C1 speaker controls. Read ConceptTaxonomy.swift in full. What grammar is MISSING or mis-levelled? Consider: full tense/mood system, subjunctive coverage, aspect, participles and agreement, pronoun systems and ordering, relatives, hypotheticals, reported speech, passive and alternatives, negation, comparatives, determiners, prepositions governed by verbs, infinitive vs subjunctive complementation, causatives, impersonals, inversion. Report genuine gaps as taxonomy-gap findings with the band they belong in.` },
  { key: 'tax-lexis', prompt: `You are a French lexicology specialist. Audit the taxonomy's VOCABULARY (40 concepts) and PHRASING (19) coverage for a learner going to C1. Is 40 vocabulary concepts enough to carry a learner to fluency, and are they the right ones? What lexical domains, word-formation patterns (derivation, prefixes, nominalisation), collocation types, or register-specific lexis are missing? Is the vocabulary/grammar balance right for French specifically? Report gaps with bands.` },
  { key: 'tax-phon', prompt: `You are a French phonetics specialist. Audit the 15 PRONUNCIATION concepts. What does an English-speaking learner need that is missing? Consider liaison (obligatory/forbidden/optional), enchainement, elision, nasal vowels, the e muet/schwa, vowel length and quality contrasts, the R, final consonants, rhythm and stress groups, intonation contours, spoken reductions, homophone discrimination, and the specific interference errors English speakers make. Also: does the app have any way to TEACH or ASSESS pronunciation concepts at all? Check whether pronunciation concepts can even become testable items.` },
  { key: 'tax-prag', prompt: `You are a specialist in French pragmatics and sociolinguistics. Audit the 12 REGISTER concepts plus relevant phrasing for C1 adequacy. Consider tu/vous negotiation, soutenu/courant/familier, politeness formulae and indirectness, hedging, disagreement, formal written conventions (letters, email), argot/verlan, regional variation, humour and irony, discourse markers, turn-taking. What is missing for someone who must function professionally in French? Report gaps with bands.` },
  { key: 'tax-cefr', prompt: `Audit the taxonomy against the actual CEFR descriptors. For each band A1-C1, do the concepts assigned to it genuinely correspond to that band's can-do statements, or are things mis-levelled? Specifically check: is anything at A1 that is really A2+, is anything at B1 that is really B2, and does the C1 set actually describe C1 competence or is it B2+ material relabelled? Also: the app claims to take someone to fluency — is C1 the right ceiling, or does the absence of C2 matter for that claim? Report mis-levellings as taxonomy-gap findings.` },
  { key: 'tax-prereq', prompt: `Audit the PREREQUISITE GRAPH for pedagogical soundness, not just structural validity (structure is already tested: acyclic, resolves, no upward edges). Are the prerequisites actually right? Find concepts whose prerequisites are too thin (a B2 concept hanging off one A1 concept, so it becomes reachable far too early), too heavy (unreachable in practice), or pedagogically wrong (missing a genuinely required precursor). Since frontier selection uses this graph, a thin prerequisite means the app will offer C1 material to a beginner. Quantify: what is the shortest path from zero to a C1 concept?` },
  { key: 'map-surface', prompt: `The concept map UI (D6.7) is unbuilt. Determine precisely what a learner can and cannot see today about the 181 concepts: which existing views render taxonomy concepts (GapsView, ProfileView, HomeView, any skills or progress screen), and what they now show given 132 have no content and no gaps. Is there any screen that now lists 181 things, or shows empty rows, or a category that reads "all clear" because it has no content rather than because it is mastered? Read every View that touches concepts.` },
  { key: 'honesty', prompt: `Hunt for FALSE CLAIMS the app makes to the learner given the current state — this is the highest-value lens. Any onboarding copy, marketing string, level label, certificate, completion message, "you have mastered", "fluent", CEFR badge, or progress claim that is now untrue or will mislead. Also check: does the app anywhere imply it can teach to fluency/C1/advanced when content stops at B1? Grep for user-facing strings across Views/ and Models/. Read first-run and paywall/premium copy if any exists.` },
  { key: 'content-quality', prompt: `Assess whether the 49 authored concepts have enough DEPTH per concept to actually build competence, versus just touching it. Read FoundationContent.json for several concepts (an easy A1 one and the hardest B1 ones). Per concept there is 1 teaching card, 3 probes, 10-12 items. Is 10-12 items enough to master a grammar concept like imparfait-vs-pc or the subjunctive? Compare against what the spaced-repetition engine needs to reach the mastery threshold (read Concept.swift mastery, Tuning thresholds, and how many observations are needed). Compute: how many items does a learner actually need per concept for the Bayesian estimator to certify mastery, and does the content supply it?` },
  { key: 'expo-gap', prompt: `Compare against the legacy expo/ implementation (READ ONLY — never propose changes there). Did the Expo version have any concept/skill taxonomy, level map, progress-toward-fluency surface, or content breadth that iOS now lacks or has diverged from? Is there authored French content in expo/ covering concepts iOS does not have — content that could be ported rather than authored from scratch? Quantify what exists there. This could materially reduce the D6.5 authoring job, so be concrete about file paths and volumes.` },
]

phase('Investigate')
log(`${LENSES.length} lenses across reachability, taxonomy sufficiency and surface wiring`)

const perLens = await pipeline(
  LENSES,
  (lens) => agent(`${CTX}\n\n## Your lens: ${lens.key}\n\n${lens.prompt}`, {
    label: `look:${lens.key}`, phase: 'Investigate', schema: FINDINGS, effort: 'high',
  }),
  (res, lens) => {
    const found = (res && res.findings) ? res.findings : []
    if (!found.length) return []
    return parallel(found.map((f) => () =>
      parallel(['does-it-reproduce', 'is-it-already-handled', 'is-the-consequence-real'].map((angle) => () =>
        agent(`${CTX}\n\n## Refute this finding\n\nLens: ${lens.key}\nTitle: ${f.title}\nFile: ${f.file}:${f.line || '?'}\nClaimed consequence: ${f.consequence}\nClaimed evidence: ${f.evidence}\n\nYour angle: ${angle}.\n\nGo to the code and try to REFUTE this. Refute it if: the code does not say what is claimed, the case is already handled elsewhere, the consequence cannot actually occur for a real learner, the file:line is wrong, or it merely restates "content is unauthored" (which is known and not a finding). Default refuted=true when genuinely uncertain. Be adversarial and specific.`,
          { label: `refute:${lens.key}:${angle}`, phase: 'Verify', schema: VERDICT, effort: 'high' })))
        .then((votes) => {
          const live = votes.filter(Boolean)
          const kills = live.filter((v) => v.refuted).length
          return { ...f, lens: lens.key, survived: live.length > 0 && kills < 2,
                   refutations: live.filter((v) => v.refuted).map((v) => v.reason) }
        })))
  },
)

const all = perLens.filter(Boolean).flat().filter(Boolean)
const confirmed = all.filter((f) => f.survived)
const refuted = all.filter((f) => !f.survived)
log(`${all.length} raw findings; ${confirmed.length} survived adversarial verification, ${refuted.length} refuted`)

phase('Critique')
const critiqueOf = (slice) => JSON.stringify(slice.map((f) => ({ lens: f.lens, sev: f.severity, kind: f.kind, title: f.title, file: f.file })))
const critics = await parallel([
  () => agent(`${CTX}\n\n## Completeness critic\n\nSixteen lenses ran and produced these confirmed findings:\n${critiqueOf(confirmed)}\n\nWhat did they ALL miss? Name concrete, checkable things: a code path nobody traced, a surface nobody opened, a false claim nobody grepped for, a pedagogical domain nobody audited. Then GO CHECK the most important two or three yourself and report them as findings.`,
    { label: 'critic:completeness', phase: 'Critique', schema: FINDINGS, effort: 'high' }),
  () => agent(`${CTX}\n\n## Ceiling critic\n\nConfirmed findings:\n${critiqueOf(confirmed)}\n\nYour single job: independently determine the honest answer to "what is the highest CEFR level a learner can actually reach in this app today, end to end, and what is the ordered list of things that must be built or authored for them to reach C1?" Verify against the code yourself; do not trust the other lenses. Report as findings any place where the app's real ceiling differs from what the product implies.`,
    { label: 'critic:ceiling', phase: 'Critique', schema: FINDINGS, effort: 'high' }),
])

const extra = critics.filter(Boolean).flatMap((c) => c.findings || [])
log(`critics added ${extra.length} findings`)

phase('Synthesize')
const answer = await agent(
  `${CTX}\n\n## Synthesize the answer\n\nThe user asked, plainly: "do we have the depth we need to get to fluency, and is that mapped in the app and the lessons and new content?"\n\nAdversarially-confirmed findings:\n${JSON.stringify(confirmed)}\n\nCritic findings (unverified):\n${JSON.stringify(extra)}\n\nRefuted (do NOT present these as real):\n${JSON.stringify(refuted.map((f) => ({ title: f.title, why: f.refutations })))}\n\nWrite the honest answer. Structure it as:\n1. THE CEILING — one paragraph: what level can a learner actually reach today, end to end, stated plainly. If the answer is "not fluency", say so directly.\n2. THE THREE LAYERS — answer separately for (a) the map/taxonomy, (b) the lessons/engine, (c) the content. For each: is the depth there, yes or no, with the number that proves it.\n3. WHAT IS BROKEN NOW — findings that hurt a learner TODAY, ranked. Distinguish sharply from things that only break later.\n4. TAXONOMY GAPS — is 181 concepts genuinely enough for C1? What is missing, by band. Be specific; this is expert judgement the owner is paying for.\n5. THE ORDERED PATH TO FLUENCY — what must be built and authored, in dependency order, with the one thing that must come first and why.\n\nBe concrete and quantitative. Do not pad. Do not repeat the known fact that 132 concepts lack content except where it causes a specific failure. If the honest answer to the user's question is "no", lead with that.`,
  { label: 'synthesis', phase: 'Synthesize', effort: 'max' },
)

return { confirmedCount: confirmed.length, refutedCount: refuted.length, criticCount: extra.length, confirmed, extra, answer }