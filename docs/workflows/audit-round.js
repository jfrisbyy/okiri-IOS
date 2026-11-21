export const meta = {
  name: 'audit-round',
  description: 'One beta-readiness audit round: seven parallel auditors, three-refuter verification per finding, area-owned fixes in conflict-free waves, compile re-review of changed files',
  whenToUse: 'Run once per audit round with args {round: N}. Reads docs/audit-findings.md so it never re-reports a prior finding.',
  phases: [
    { title: 'Audit', detail: 'seven auditors, one per area, read-only' },
    { title: 'Verify', detail: 'three refuters per finding (correctness, intent, impact); a refuter that fails to run is unverified, never a refutation' },
    { title: 'Fix', detail: 'one agent per area, grouped into waves that touch disjoint files' },
    { title: 'Recheck', detail: 'harness, lints, validator and a compile read of every changed file the harness cannot see' },
  ],
}

// Rebuilt in November 2026 to the contract of the version lost with the session scratch
// directory: same areas, same three refuter lenses, same return shape. Two changes:
//   1. A finding with fewer than two live verdicts is UNVERIFIED. The original only treated
//      the all-dead case that way, so two dead refuters and one live "refuted" read as a
//      refutation.
//   2. Fix agents run in waves whose areas touch disjoint files. They used to run all at
//      once, and two that died mid-edit on a rate limit left the branch red.

const ROUND = (args && args.round) || 0
const LEDGER = (args && args.priorFindingsPath) || 'docs/audit-findings.md'
const REPO = '/home/user/okiri-IOS'

const CONTEXT = `
Repo ${REPO}, branch claude/okiri-ios-handoff-f2gnkx. The app is ios/FluentFrenchIOS/: SwiftUI,
iOS 18, Swift 5 language mode, default MainActor isolation on the app target, approachable
concurrency, MemberImportVisibility. expo/ is a legacy React Native reference: read it if it
clarifies intent, NEVER modify it.

Read docs/workplan.md before anything else. It holds the binding rules (no invented French;
every constant in Services/Tuning.swift; the engine stays view-free; concept ids are immutable;
cite the finding id in a comment for any defect-driven rule), the evidence-integrity rules,
the owner's decisions and content schema v2.

Tools:
- Linux harness: ios/tools/linuxbuild/run.sh -- 550 tests in 22 suites today. A clean run is
  0 errors AND 0 warnings. Safe to run concurrently. It CANNOT compile SwiftUI views or
  components, Theme/, the AVFoundation services (VoiceRecorder, DialoguePlayer, ElevenLabsTTS,
  FrenchSpeech) or AuthManager; ios/tools/linuxbuild/engine-files.txt lists what it compiles.
- Parse a file the harness cannot compile:
  docker run --rm -v ${REPO}/ios:/src -w /src mirror.gcr.io/library/swift:6.2-noble swiftc -parse -swift-version 5 <paths relative to ios/>
- Import lints: python3 ios/tools/import_lint.py && python3 ios/tools/foundation_lint.py
- Content validator: python3 ios/tools/validate_foundation_content.py ios/FluentFrenchIOS/Resources/FoundationContent.json --full

Known state, which is NOT a finding: the taxonomy has 181 concepts (A1-C1) and authored content
covers 49 of them; the D6 concept-map surfaces, the band-gating reach rule, the D6.8 link from
captured words to concepts and every package in docs/roadmap.md are unbuilt by design. Do not
report an unbuilt roadmap feature or the mere absence of content. DO report anything that
breaks, crashes, corrupts evidence or tells the learner something false because of that state.

Prior rounds: ${LEDGER} lists every finding already confirmed and fixed, and every one
refuted, in earlier rounds. Never re-report any of them. The single exception is a prior fix
that is demonstrably incomplete or has regressed: report it as new, cite the prior id, and
show the evidence.

Severity:
- high: the app fails to build; learner data is lost or overwritten; the learning model is
  corrupted (wrong evidence, unreachable mastery, an unteachable gap ranked first); a feature
  is dead; or the app tells the learner something false about their progress or about who
  wrote what they are reading.
- medium: a real harm to learning, or a clear UX failure on a common path.
- low: polish, a rare path, or a cost no learner would perceive.
`

const F = 'ios/FluentFrenchIOS/'
const T = 'ios/FluentFrenchIOSTests/'
const AREAS = [
  { key: 'lesson', scope: 'the lesson loop: scheduling, question building, grading, remedials, hearts, the match round, capstones, AI-written questions, and the lesson screens',
    own: [F+'Services/LessonSession.swift', F+'Services/LessonScheduler.swift', F+'Services/AnswerGrader.swift', F+'Services/LessonQuestionParser.swift', F+'Services/LessonService.swift', F+'Services/LessonAssembler.swift', F+'Services/LessonPipeline.swift', F+'Models/LessonQuestion.swift', F+'Views/Lesson/', F+'Components/GapCardView.swift',
          T+'LessonSessionTests.swift', T+'LessonSchedulerTests.swift', T+'AnswerGraderTests.swift', T+'LessonQuestionParserTests.swift', T+'LessonAssemblerTests.swift'] },
  { key: 'firstrun', scope: 'first run and the everyday screens: welcome, placement, preferences, Home, the daily plan, the deck, gaps, profile, retention, readiness gates and Kiri',
    own: [F+'Views/WelcomeView.swift', F+'Views/AssessmentView.swift', F+'Views/PreferencesView.swift', F+'Views/HomeView.swift', F+'Views/DeckView.swift', F+'Views/GapsView.swift', F+'Views/ProfileView.swift', F+'Views/RetentionView.swift', F+'Views/KiriView.swift', F+'Views/RootView.swift', F+'Views/DiagnosticsView.swift', F+'ContentView.swift', F+'FluentFrenchIOSApp.swift',
          F+'Services/HomeCopy.swift', F+'Services/DailyPlanEngine.swift', F+'Services/AssessmentService.swift', F+'Services/ActivityCredit.swift', F+'Models/Readiness.swift', F+'Models/UserPreferences.swift',
          T+'HomeGateTests.swift', T+'PlacementFlowTests.swift', T+'DailyPlanEngineTests.swift'] },
  { key: 'read', scope: 'reading and capture: the reader, live news, saving a word or phrase, tagging it to a concept, translation, tenses, idioms, accents and resources',
    own: [F+'Views/ReadView.swift', F+'Views/ContentScreens.swift', F+'Views/TensesView.swift', F+'Views/IdiomsView.swift', F+'Views/AccentView.swift', F+'Views/TranslatorView.swift',
          F+'Services/NewsService.swift', F+'Services/HeuristicTagger.swift', F+'Services/ConceptTagger.swift', F+'Services/CaptureBuilder.swift', F+'Services/SentenceExtractor.swift', F+'Services/ReadingLevelEstimator.swift', F+'Services/ArticleText.swift', F+'Services/KeyVocabulary.swift', F+'Services/TranslationService.swift', F+'Services/TranslationCache.swift', F+'Services/ConjugationCard.swift',
          F+'Models/ReadingContent.swift', F+'Models/ResourcesData.swift', F+'Models/Gloss.swift', T+'ReadCaptureTests.swift', T+'ArticleTextTests.swift'] },
  { key: 'talkmedia', scope: 'speaking, conversation, listening and watching: Speak, Converse, scenarios, Listen, Watch, transcripts, recording, playback and text-to-speech',
    own: [F+'Views/SpeakView.swift', F+'Views/ConverseView.swift', F+'Views/ScenariosView.swift', F+'Views/ListenView.swift', F+'Views/WatchView.swift', F+'Views/WatchPlayerView.swift', F+'Views/YouTubeEmbedView.swift',
          F+'Services/MediaSupport.swift', F+'Services/TalkSupport.swift', F+'Services/ConverseService.swift', F+'Services/ConverseRecap.swift', F+'Services/SpeakFeedbackService.swift', F+'Services/ScenariosService.swift', F+'Services/SpeechToText.swift', F+'Services/TranscriptService.swift', F+'Services/YouTubeService.swift', F+'Services/PlaybackState.swift', F+'Services/VoiceRecorder.swift', F+'Services/DialoguePlayer.swift', F+'Services/ElevenLabsTTS.swift', F+'Services/FrenchSpeech.swift',
          F+'Models/SpeakFeedback.swift', F+'Models/SpeakingPrompts.swift', F+'Models/ListeningData.swift', F+'Models/WatchCatalog.swift', F+'Models/ScenarioGuide.swift', F+'Models/ConverseScenario.swift', T+'MediaSurfaceTests.swift', T+'TalkSurfaceTests.swift'] },
  { key: 'store', scope: 'persistence, cloud backup and sign-in: the record on disk, loading and recovery, the sync reconciler, sign-out, and the backend schema',
    own: [F+'State/AppStore.swift', F+'Services/CloudSync.swift', F+'Services/SnapshotReconciler.swift', F+'Services/DeferredRestore.swift', F+'Services/AuthManager.swift', F+'Services/SupabaseManager.swift', F+'Services/EngineMetrics.swift', F+'Config.swift', F+'Models/SampleData.swift', 'backend/',
          T+'StoreTests.swift', T+'SnapshotReconcilerTests.swift'] },
  { key: 'engine', scope: 'the learning engine: concept selection and ranking, the taxonomy and prerequisites, Bayesian mastery, FSRS, check-ins and the retention governor, probes, placement seeding, Foundation content loading and seeding, and the headless calibration simulations',
    own: [F+'Services/ConceptSelector.swift', F+'Services/FoundationContentLoader.swift', F+'Services/FoundationSeeder.swift', F+'Services/SelectionLog.swift', F+'Models/Concept.swift', F+'Models/ConceptTaxonomy.swift', F+'Models/FSRS.swift', F+'Models/Selection.swift', F+'Models/FoundationCurriculum.swift', F+'Models/Models.swift', F+'Services/Tuning.swift',
          T+'ConceptSelectorTests.swift', T+'Pass3EngineTests.swift', T+'FSRSTests.swift', T+'HeadlessDriver.swift', T+'HeadlessDriverTests.swift', T+'EngineFixtures.swift', T+'ConceptTaxonomyTests.swift', T+'EvidenceWeightFloorTests.swift', T+'FluentFrenchIOSTests.swift'] },
  { key: 'compile', scope: 'compile correctness of every file the Linux harness cannot compile -- all of Views/, Components/, Theme/, ContentView.swift, FluentFrenchIOSApp.swift, and the AVFoundation and AuthenticationServices services. Read each in full and check that every type, member, initializer, Tuning constant and store API it references exists with that exact signature, and that imports satisfy MemberImportVisibility. Report only things that would fail the Xcode build or produce a new warning',
    own: [F+'Views/', F+'Components/', F+'Theme/', F+'ContentView.swift', F+'FluentFrenchIOSApp.swift'] },
]

const FINDINGS = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'what you read, what you traced, and your overall judgement of the area' },
    checkedFine: { type: 'array', items: { type: 'string' }, description: 'specific things you verified are correct' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'AREA-ROUND-N, e.g. lesson-10-1' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          category: { type: 'string', enum: ['learning', 'ux', 'functionality', 'compile', 'honesty', 'data'] },
          title: { type: 'string', description: 'one sentence describing what the learner experiences or what breaks' },
          file: { type: 'string', description: 'path relative to the repo root' },
          line: { type: 'integer' },
          evidence: { type: 'string', description: 'the code, data or experiment that proves it' },
          consequence: { type: 'string' },
          fix: { type: 'string', description: 'the smallest correct fix' },
        },
        required: ['id', 'severity', 'category', 'title', 'file', 'line', 'evidence', 'consequence', 'fix'],
      },
    },
  },
  required: ['summary', 'checkedFine', 'findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
    severityAdjust: { type: 'string', enum: ['keep', 'lower', 'raise'] },
  },
  required: ['refuted', 'reason', 'severityAdjust'],
}

const FIXREPORT = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    items: { type: 'array', items: { type: 'string' } },
    done: { type: 'array', items: { type: 'string' } },
    partial: { type: 'array', items: { type: 'string' } },
    harness: { type: 'boolean', description: 'true only if the last harness run had 0 errors and 0 warnings' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string', description: 'per finding: what changed and why it is right, the tests added, and anything outside your area you had to touch' },
  },
  required: ['area', 'items', 'done', 'partial', 'harness', 'filesChanged', 'notes'],
}

const RECHECK = {
  type: 'object',
  properties: {
    clean: { type: 'boolean' },
    harnessSummary: { type: 'string', description: 'the final "Test run with N tests" line, plus the warning count' },
    lintsClean: { type: 'boolean' },
    parseClean: { type: 'boolean' },
    validatorClean: { type: 'boolean' },
    problems: { type: 'array', items: { type: 'string' } },
    fixed: { type: 'array', items: { type: 'string' } },
  },
  required: ['clean', 'harnessSummary', 'lintsClean', 'parseClean', 'validatorClean', 'problems', 'fixed'],
}

const LENS = {
  correctness: 'Go to the code. Does it behave exactly as the finding claims, at the cited file and line, on the real shipped content? Reproduce it with the harness or a small experiment where you can.',
  intent: 'Is this a deliberate, documented decision -- in docs/workplan.md, in a code comment citing a finding id, or among the refuted entries of the ledger? Is it already fixed in the current tree? Is it an unbuilt roadmap feature, or the known content gap?',
  impact: 'Would a real beta learner actually hit this, and is the severity right? If the finding is real but its severity is overstated, return refuted=false with severityAdjust=lower.',
}

const refutePrompt = (f, lens) => `${CONTEXT}

You are an adversarial verifier. Try to REFUTE this audit finding.
Your lens: ${lens}. ${LENS[lens]}

FINDING:
${JSON.stringify(f, null, 2)}

Default to refuted=true if you cannot confirm the finding from the code. Return refuted=false only if
you verified that the defect is real as described. Do not edit any file.`

const STEP = { low: 0, medium: 1, high: 2 }
const NAME = ['low', 'medium', 'high']

// ---- Audit, then verify each area's findings as soon as that area reports (no barrier)
phase('Audit')
log(`Round ${ROUND}: ${AREAS.length} auditors; prior findings read from ${LEDGER}`)

const perArea = await pipeline(
  AREAS,
  (a) => agent(`${CONTEXT}

You are the round-${ROUND} auditor for the "${a.key}" area: ${a.scope}.

Your area's files (directories mean every file in them):
${a.own.map((p) => '- ' + p).join('\n')}

Read every file in your area in full. Trace real flows against the real shipped content
(ios/FluentFrenchIOS/Resources/FoundationContent.json) rather than sampling. Use the harness or small
experiments wherever they settle a question. Number your findings ${a.key}-${ROUND}-1, ${a.key}-${ROUND}-2,
and so on, most severe first. Report every real finding; if you have more than 10, report the 10
most severe and say in the summary how many you left out. Quality matters more than count: each
finding needs a file and line, the evidence, the consequence for a real learner, and the smallest
correct fix. Also list in checkedFine the specific things you verified are correct.

You are READ-ONLY. Do not edit any file.`,
    { label: `audit:${a.key}`, phase: 'Audit', schema: FINDINGS, effort: 'high' }),
  (res, a) => {
    if (!res) return { area: a.key, audit: null, verified: [] }
    const findings = res.findings || []
    if (!findings.length) return { area: a.key, audit: res, verified: [] }
    return parallel(findings.map((f) => () =>
      parallel(['correctness', 'intent', 'impact'].map((lens) => () =>
        agent(refutePrompt(f, lens), { label: `verify:${f.id}:${lens}`, phase: 'Verify', schema: VERDICT, effort: 'medium' })))
        .then((vs) => {
          const live = vs.filter(Boolean)
          // Fewer than two live verdicts is not enough to decide either way.
          const unverified = live.length < 2
          const standing = live.filter((v) => !v.refuted)
          const survives = !unverified && standing.length >= 2
          let severity = f.severity
          if (survives) {
            const lower = standing.filter((v) => v.severityAdjust === 'lower').length
            const raise = standing.filter((v) => v.severityAdjust === 'raise').length
            if (lower >= 2) severity = NAME[Math.max(0, STEP[severity] - 1)]
            else if (raise >= 2) severity = NAME[Math.min(2, STEP[severity] + 1)]
          }
          return { ...f, area: a.key, severity, reportedSeverity: f.severity, survives, unverified,
                   verdicts: live.map((v) => ({ refuted: v.refuted, adjust: v.severityAdjust, reason: v.reason })) }
        })))
      .then((verified) => ({ area: a.key, audit: res, verified }))
  },
)

const areas = perArea.filter(Boolean)
const all = areas.flatMap((x) => x.verified || [])
const confirmed = all.filter((f) => f.survives)
const unverified = all.filter((f) => f.unverified)
const refuted = all.filter((f) => !f.survives && !f.unverified)
const deadAuditors = AREAS.map((a) => a.key).filter((k) => !areas.find((x) => x.area === k && x.audit))
log(`${all.length} raw: ${confirmed.length} confirmed, ${refuted.length} refuted, ${unverified.length} unverified` +
    (deadAuditors.length ? `; auditors that did not report: ${deadAuditors.join(', ')}` : ''))

// ---- Fix in waves: an area joins a wave only if no area already in it touches a file
// it touches. Tuning.swift is shared by design (additive constants in per-package MARK
// blocks), so it is not a conflict key; AppStore.swift and everything else is.
phase('Fix')
const byArea = {}
for (const f of confirmed) (byArea[f.area] = byArea[f.area] || []).push(f)
const fixAreas = Object.keys(byArea)
const keysFor = (k) => new Set(byArea[k].map((f) => f.file).filter((p) => !/Tuning\.swift$/.test(p)))
const waves = []
for (const k of fixAreas) {
  const mine = keysFor(k)
  let placed = false
  for (const w of waves) {
    if (w.every((o) => [...keysFor(o)].every((p) => !mine.has(p)))) { w.push(k); placed = true; break }
  }
  if (!placed) waves.push([k])
}
log(`fix waves: ${waves.map((w) => '[' + w.join(', ') + ']').join(' -> ') || 'none'}`)

const fixes = []
for (const wave of waves) {
  const results = await parallel(wave.map((k) => () => {
    const a = AREAS.find((x) => x.key === k)
    const items = byArea[k]
    return agent(`${CONTEXT}

You are the round-${ROUND} fix agent for the "${k}" area. These findings survived three adversarial
refuters. Fix every one.

${JSON.stringify(items.map((f) => ({ id: f.id, severity: f.severity, title: f.title, file: f.file, line: f.line,
  evidence: f.evidence, consequence: f.consequence, proposedFix: f.fix,
  verifierNotes: f.verdicts.filter((v) => !v.refuted).map((v) => v.reason) })), null, 2)}

Your area's files: ${a.own.join(', ')}

Rules:
- Read the code before changing it, and make the smallest change that is correct.
- Put every new constant in Services/Tuning.swift, named and with a one-line comment, inside your area's MARK block.
- Cite the finding id in a comment wherever the code now encodes a rule because of the finding.
- Add or update tests that would have FAILED before your fix. Never weaken an existing assertion to get green. If a test
  encoded the defect, rewrite it to the correct behaviour and say so in your notes.
- Edit only your area's files, its tests and Tuning.swift. If a fix genuinely needs a file outside your area, make the
  smallest change, re-read the file immediately before editing it, and report it.
- Other areas' fix agents may be working at the same time. If the harness fails in a file outside your area, wait a
  minute and run it again before you conclude anything.
- Do not invent French. If a fix needs new French content, leave it partial and say exactly what content is needed.

Verify before you report: the harness must show 0 errors and 0 warnings; run swiftc -parse on every file you changed
that the harness cannot compile; run both import lints; run the content validator if you touched content.
Do NOT commit. Leave your changes in the working tree.`,
      { label: `fix:${k}`, phase: 'Fix', schema: FIXREPORT, effort: 'high' })
      .then((r) => r || { area: k, items: items.map((f) => f.id), done: [], partial: items.map((f) => f.id),
                          harness: false, filesChanged: [], notes: 'FIX AGENT DID NOT REPORT -- findings left unfixed' })
  }))
  fixes.push(...results)
}

// ---- Recheck everything the fixes touched
phase('Recheck')
const recheck = confirmed.length ? await agent(`${CONTEXT}

You are the round-${ROUND} recheck. The fix agents have finished; their reports follow.
${JSON.stringify(fixes.map((x) => ({ area: x.area, done: x.done, partial: x.partial, filesChanged: x.filesChanged })), null, 2)}

1. Run \`git -C ${REPO} status --short\` to get the real list of changed files.
2. Run the full harness. It must show 0 errors and 0 warnings.
3. For every changed Swift file that is NOT listed in ios/tools/linuxbuild/engine-files.txt (views, components,
   Theme, the app entry and the AVFoundation and AuthenticationServices services): run swiftc -parse on it, then
   read it and confirm that every type, member, initializer, Tuning constant and store API it references exists
   with exactly that signature. The harness cannot check these files, and they are where compile errors have
   shipped before.
4. Run both import lints and the content validator.
5. Fix any compile problem you find with the smallest change, then rerun the check that failed.
Do NOT commit.`, { label: 'recheck', phase: 'Recheck', schema: RECHECK, effort: 'high' }) : null

return {
  round: ROUND,
  rawCount: all.length,
  confirmed: confirmed.map((f) => ({ id: f.id, severity: f.severity, reportedSeverity: f.reportedSeverity, category: f.category, title: f.title, file: f.file, line: f.line })),
  unverified: unverified.map((f) => ({ id: f.id, severity: f.severity, title: f.title, file: f.file, line: f.line })),
  refuted: refuted.map((f) => ({ id: f.id, title: f.title, reasons: f.verdicts.filter((v) => v.refuted).map((v) => v.reason.slice(0, 300)) })),
  deadAuditors,
  waves,
  fixes,
  recheck,
  auditSummaries: areas.map((x) => ({ area: x.area, summary: x.audit ? x.audit.summary : null, checkedFine: x.audit ? x.audit.checkedFine : [] })),
}
