//
//  LessonViewModel.swift
//  FluentFrenchIOS
//
//  The lesson's main-actor glue: owns the `LessonSession` (the view-free state
//  machine in Services/LessonSession.swift), the per-question UI state, the AI
//  prefetch and the foreground timer, and forwards every piece of evidence the
//  session hands back to the store. The stage views render it and call its
//  intents; they never decide what an answer is worth.
//

import SwiftUI
import UIKit

@MainActor
@Observable
final class LessonViewModel {
    enum Stage { case intro, teaching, generating, practice, complete }

    private(set) var lesson: AssembledLesson
    private(set) var isCapstone: Bool
    private(set) var stage: Stage = .intro
    private(set) var session: LessonSession

    // MARK: Per-question UI state (reset when a question loads)

    var selectedOption: String? = nil
    var textAnswer = ""
    private(set) var arranged: [String] = []
    /// The match round's right column, shuffled ONCE when the round loads (C4).
    private(set) var matchRights: [GapItem] = []
    private(set) var matchSelectedLeft: String? = nil
    private(set) var matchWrongRight: String? = nil
    /// A meaning was tapped before any French word: the left column flashes so the
    /// order is visible instead of the tap simply doing nothing.
    private(set) var matchNeedsLeft = false
    private(set) var revealed = false
    private(set) var feedback: LessonFeedback? = nil
    /// B11: "Nice — you've got <concept>, moving on."
    private(set) var releaseNote: String? = nil
    private(set) var masteryFlash: String? = nil
    private(set) var comboPop = false

    // MARK: Completion

    private(set) var summary: LessonSummary? = nil
    private(set) var unlockedConcepts: [String] = []
    private(set) var isNewBest = false
    /// The pipeline's headline when "Practice these now" had nothing to offer (C23).
    private(set) var followUpNotice: String? = nil
    /// AI teaching summaries — only for skill cards without a content `teaching` block (C17 fallback).
    private(set) var conceptExplanations: [String: String] = [:]

    @ObservationIgnored private var prefetch: Task<[LessonQuestion]?, Never>? = nil
    @ObservationIgnored private var prefetchKey: (level: CEFRLevel, optionCount: Int)? = nil
    @ObservationIgnored private var generation: Task<Void, Never>? = nil
    @ObservationIgnored private var explaining: Task<Void, Never>? = nil
    @ObservationIgnored private var wrongFlash: Task<Void, Never>? = nil
    @ObservationIgnored private var needsLeftFlash: Task<Void, Never>? = nil
    @ObservationIgnored private var masteryTask: Task<Void, Never>? = nil
    @ObservationIgnored private var popTask: Task<Void, Never>? = nil
    @ObservationIgnored private var timer = LessonTimer()

    init(gaps: [GapItem], assembled: AssembledLesson?, isCapstone: Bool) {
        let lesson = LessonSession.lesson(for: gaps, assembled: assembled, isCapstone: isCapstone)
        self.lesson = lesson
        self.isCapstone = isCapstone
        self.session = LessonSession(lesson: lesson, isCapstone: isCapstone)
    }

    // MARK: Reading

    var gaps: [GapItem] { lesson.gaps }
    var current: LessonQuestion? { session.current }
    var hearts: Int? { session.hearts }
    var answeredCount: Int { session.answered }
    var revealsLeft: Int { session.revealsLeft }
    var reasons: [String: String] { lesson.reasons }
    var conceptBlocks: [ConceptBlock] { lesson.conceptBlocks }
    var isOutOfHearts: Bool { session.end == .outOfHearts }
    var bestKind: LessonBestKind { isCapstone ? .capstone : (lesson.isScoped ? .scoped : .smart) }
    /// A quit from practice (or while generating) asks first (C13); earlier stages just close.
    var needsQuitConfirmation: Bool { stage == .practice || stage == .generating }

    /// Word cards for the teaching stage: ONLY never-reviewed items, capped by
    /// `Tuning.teachingWordCards`.
    ///
    /// A word card shows the meaning, the example sentence and its translation — it
    /// is the answer to every question the lesson can ask about that item. Showing it
    /// for an item that is about to be TESTED (a check-in on a mastered concept, an
    /// interleaved review) turns the test into a memory test of the last screen: the
    /// check-in banks a pass the learner has not earned, and the review answer becomes
    /// FSRS interval growth. New items are the only ones a card can honestly teach.
    var teachingGaps: [GapItem] {
        Array(gaps.filter { !$0.isProbe && $0.isNew }.prefix(Tuning.teachingWordCards))
    }

    /// "Show me" is offered for the current question (C12).
    var canReveal: Bool { session.canReveal && !revealed }

    var canSubmit: Bool {
        guard let q = current, !revealed, !session.isOver else { return false }
        switch q.kind {
        case .multipleChoice, .trueFalse: return selectedOption != nil
        case .fillBlank, .translation: return !textAnswer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .arrange: return arranged.count == q.correctOrder.count
        case .match: return false
        }
    }

    /// What the bottom button says right now.
    var primaryButtonTitle: String {
        guard let q = current else { return "Continue" }
        if revealed {
            if isOutOfHearts { return "See recap" }
            return session.isLast ? "Finish" : "Continue"
        }
        return q.kind == .match ? "Match all to continue" : "Check"
    }

    // MARK: Motion (G3)

    /// The animation to use for a stage change or a flash, honouring Reduce
    /// Motion. A view model has no SwiftUI environment, so the setting is read
    /// from UIKit; `Theme.motion` turns every spring into a short cross-fade
    /// when the learner has asked for less movement.
    private func motion(_ animation: Animation) -> Animation? {
        Theme.motion(animation, reduceMotion: UIAccessibility.isReduceMotionEnabled)
    }

    // MARK: Stage intents

    /// "Start" on the intro: capstones go straight to practice, everything else teaches
    /// first — unless there is nothing honest to teach (no skill card and no new word),
    /// which would leave an empty carousel between the intro and the questions.
    func begin(store: AppStore) {
        guard !gaps.isEmpty else { return }
        if isCapstone || (conceptBlocks.isEmpty && teachingGaps.isEmpty) {
            startPractice(store: store)
        } else {
            withAnimation(motion(.spring(response: 0.4, dampingFraction: 0.85))) { stage = .teaching }
            startPrefetch(store: store)
        }
    }

    /// Start (or join) the AI question fetch while the skill cards are on screen (C9).
    func startPrefetch(store: AppStore) {
        guard prefetch == nil, !isCapstone else { return }
        let level = store.learnerLevel
        let count = store.optionCount
        prefetchKey = (level, count)
        prefetch = LessonService.prefetch(lesson: lesson, level: level, optionCount: count)
    }

    /// "Start practice": use cached AI questions at once, otherwise wait (cancellably)
    /// for the prefetch, otherwise the built-in schedule.
    func startPractice(store: AppStore) {
        guard stage != .practice, stage != .complete else { return }
        let level = store.learnerLevel
        let count = store.optionCount
        if isCapstone || !LessonService.hasKey {
            launch(ai: [], store: store)
            return
        }
        if let cached = LessonService.cachedQuestions(for: lesson, level: level, optionCount: count) {
            launch(ai: cached, store: store)
            return
        }
        if prefetch == nil { startPrefetch(store: store) }
        guard let prefetch else {
            launch(ai: [], store: store)
            return
        }
        withAnimation(motion(.spring(response: 0.4, dampingFraction: 0.85))) { stage = .generating }
        generation = Task { [weak self] in
            let ai = await prefetch.value ?? []
            guard !Task.isCancelled, let self else { return }
            self.launch(ai: ai, store: store)
        }
    }

    /// "Start with the built-in questions" on the generating stage (C9).
    func skipGeneration(store: AppStore) {
        generation?.cancel()
        generation = nil
        cancelPrefetch()
        launch(ai: [], store: store)
    }

    private func launch(ai: [LessonQuestion], store: AppStore) {
        generation = nil
        let schedule = LessonScheduler().schedule(for: lesson, abilityOptionCount: store.optionCount, ai: ai)
        session.start(with: schedule)
        guard !schedule.isEmpty else {
            // Nothing could be asked (e.g. probes without options): an honest empty completion, no bookkeeping.
            summary = session.summary
            withAnimation(motion(.spring(response: 0.45, dampingFraction: 0.85))) { stage = .complete }
            return
        }
        timer.start(at: Date())
        loadQuestion()
        withAnimation(motion(.spring(response: 0.4, dampingFraction: 0.85))) { stage = .practice }
    }

    private func loadQuestion() {
        selectedOption = nil
        textAnswer = ""
        arranged = []
        matchSelectedLeft = nil
        matchWrongRight = nil
        needsLeftFlash?.cancel()
        matchNeedsLeft = false
        revealed = false
        feedback = nil
        releaseNote = nil
        if let q = session.current, q.kind == .match {
            matchRights = q.matchGaps.shuffled()
        } else {
            matchRights = []
        }
    }

    // MARK: Answer intents

    func select(_ option: String) {
        guard !revealed else { return }
        Haptics.tap()
        selectedOption = option
    }

    func appendToken(_ word: String) {
        guard !revealed, let q = current, q.kind == .arrange else { return }
        let capacity = q.tokens.filter { $0 == word }.count
        guard arranged.filter({ $0 == word }).count < capacity else { return }
        Haptics.tap()
        arranged.append(word)
    }

    func removeArranged(at index: Int) {
        guard !revealed, arranged.indices.contains(index) else { return }
        Haptics.tap()
        arranged.remove(at: index)
    }

    /// Whether every copy of `word` in the bank is already placed.
    func isTokenUsed(_ word: String) -> Bool {
        guard let q = current else { return false }
        return arranged.filter { $0 == word }.count >= q.tokens.filter { $0 == word }.count
    }

    func check(store: AppStore) {
        guard let q = current, canSubmit else { return }
        let answer: LessonAnswer
        switch q.kind {
        case .multipleChoice, .trueFalse: answer = .option(selectedOption ?? "")
        case .fillBlank, .translation: answer = .typed(textAnswer)
        case .arrange: answer = .arranged(arranged)
        case .match: return
        }
        guard let outcome = session.submit(answer) else { return }
        apply(outcome, store: store)
    }

    /// "Show me" (C12): the answer is shown and a miss is recorded — never an error-log entry.
    func reveal(store: AppStore) {
        guard let outcome = session.reveal() else { return }
        apply(outcome, store: store)
    }

    func selectMatchLeft(_ gapId: String) {
        guard !revealed, !session.matchedIds.contains(gapId) else { return }
        Haptics.tap()
        // The "pick a French word first" flash has been answered: end it now, or
        // its remaining 900 ms would highlight every left button and hide which
        // word was just picked (lesson-3-6).
        needsLeftFlash?.cancel()
        if matchNeedsLeft {
            withAnimation(motion(.default)) { matchNeedsLeft = false }
        }
        matchSelectedLeft = gapId
    }

    /// True while the round still needs a French word picked: the right column is
    /// dimmed until then, and a tap on it flashes the left column (lesson-3-6).
    var matchAwaitsLeft: Bool {
        guard let q = current, q.kind == .match, !revealed else { return false }
        return matchSelectedLeft == nil
    }

    func selectMatchRight(_ gapId: String, store: AppStore) {
        guard !revealed else { return }
        guard let left = matchSelectedLeft else {
            // A meaning tapped with no word picked is not an answer, but it must not
            // be a dead tap either: say so instead of ignoring it.
            flashNeedsLeft()
            return
        }
        guard let outcome = session.matchPair(left: left, right: gapId) else {
            // A pair already tried this round: flash it again, but record nothing.
            if left != gapId, !session.matchedIds.contains(gapId) { flashWrongRight(gapId) }
            return
        }
        if outcome.correct {
            matchSelectedLeft = nil
        } else {
            flashWrongRight(gapId)
        }
        apply(outcome, store: store)
    }

    func isMatched(_ gapId: String) -> Bool { session.matchedIds.contains(gapId) }

    /// After the feedback: the next question, or the completion / recap screen.
    func advance(store: AppStore) {
        guard revealed else { return }
        if isOutOfHearts {
            finish(store: store)
            return
        }
        if session.advance() {
            withAnimation(motion(.spring(response: 0.4, dampingFraction: 0.85))) { loadQuestion() }
        } else {
            finish(store: store)
        }
    }

    // MARK: Evidence

    private func apply(_ outcome: LessonAnswerOutcome, store: AppStore) {
        for evidence in outcome.evidence { record(evidence, store: store) }
        if outcome.xp > 0 { store.awardXP(outcome.xp) }
        if outcome.correct {
            Haptics.success()
            if outcome.roundComplete { pop() }
        } else {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
        if outcome.roundComplete || outcome.endedByHearts {
            feedback = outcome.feedback
                ?? (outcome.endedByHearts
                    ? LessonFeedback(tone: .incorrect, title: "Out of hearts", detail: "Let's look at what slipped.")
                    : nil)
            withAnimation(motion(.spring(response: 0.35, dampingFraction: 0.8))) { revealed = true }
        }
        if let word = outcome.masteredWord { showMastery(word) }
        if let conceptId = outcome.releasedConceptId {
            let name = store.concept(conceptId)?.name ?? "this skill"
            releaseNote = "Nice — you've got \(name), moving on."
        }
    }

    /// Every answer goes through `recordAnswer` (B6 / C11); a grade decided by the
    /// session (the accent slip's `.hard`) goes through `recordGradedAnswer`.
    private func record(_ evidence: LessonEvidence, store: AppStore) {
        if let grade = evidence.grade {
            store.recordGradedAnswer(gapId: evidence.gapId, grade: grade, format: evidence.format,
                                     conceptWeight: evidence.conceptWeight, isCheckIn: evidence.isCheckIn)
        } else {
            store.recordAnswer(gapId: evidence.gapId, correct: evidence.correct, format: evidence.format,
                               firstTry: evidence.firstTry, conceptWeight: evidence.conceptWeight,
                               isCheckIn: evidence.isCheckIn)
        }
        if let wrong = evidence.loggedAnswer {
            store.recordError(gap: evidence.gap, userAnswer: wrong, correctAnswer: evidence.correctAnswer)
        }
        // A miss that named another item on the table is a mix-up: link the pair so
        // the selector can rank it and the assembler can show the two together.
        if let partner = evidence.confusedWithGapId {
            store.recordConfusion(gapId: evidence.gapId, partnerGapId: partner)
        }
    }

    // MARK: Lesson end

    /// Completion bookkeeping (C13 / C14 / C25): minutes, `completeLesson`, the best
    /// for this lesson kind. A lesson cut short by hearts records its evidence and
    /// minutes but is booked as abandoned (C5): no day count, no finishing XP.
    func finish(store: AppStore) {
        guard stage != .complete else { return }
        let now = Date()
        timer.pause(at: now)
        cancelPending()
        let result = session.summary
        if result.answered > 0 {
            store.recordLessonMinutes(timer.creditedMinutes(at: now), now: now)
            unlockedConcepts = store.completeLesson(targetConceptId: session.targetConceptId, isCapstone: isCapstone,
                                                    abandoned: !result.isCompleted, answered: result.answered, now: now)
            if result.end == .finished {
                isNewBest = store.recordLessonBest(kind: bestKind, accuracy: result.accuracy,
                                                   streak: result.bestCombo, now: now)
            }
        }
        summary = result
        withAnimation(motion(.spring(response: 0.45, dampingFraction: 0.85))) { stage = .complete }
    }

    /// The learner confirmed a quit (C13): abandoned bookkeeping when anything was answered.
    func confirmQuit(store: AppStore) {
        let now = Date()
        timer.pause(at: now)
        cancelPending()
        session.quit()
        let answered = session.answered
        if answered > 0 {
            store.recordLessonMinutes(timer.creditedMinutes(at: now), now: now)
            _ = store.completeLesson(targetConceptId: session.targetConceptId, isCapstone: isCapstone,
                                     abandoned: true, answered: answered, now: now)
        }
    }

    /// Drop every in-flight task (the cover is going away or the lesson is over).
    func cancelPending() {
        generation?.cancel()
        generation = nil
        explaining?.cancel()
        explaining = nil
        cancelPrefetch()
    }

    private func cancelPrefetch() {
        if let key = prefetchKey {
            LessonService.cancelPrefetch(lesson: lesson, level: key.level, optionCount: key.optionCount)
        }
        prefetch = nil
        prefetchKey = nil
    }

    /// Lesson time counts only while the app is active (C14 / D9).
    func scenePhaseChanged(_ phase: ScenePhase) {
        let now = Date()
        if phase == .active {
            timer.resume(at: now)
        } else {
            timer.pause(at: now)
        }
    }

    // MARK: Follow-up (C26)

    /// "Practice these now": a scoped lesson over the missed items replaces this one
    /// in place; an empty outcome shows the pipeline's own headline.
    func practiceMissed(store: AppStore) {
        guard let summary, !summary.missed.isEmpty else { return }
        switch LessonPipeline(store: store).outcome(for: .gapIds(summary.missedGapIds, name: "Missed items")) {
        case .lesson(let next):
            restart(with: next)
        case .empty(let headline):
            followUpNotice = headline
        }
    }

    private func restart(with next: AssembledLesson) {
        cancelPending()
        lesson = next
        isCapstone = false
        session = LessonSession(lesson: next, isCapstone: false)
        summary = nil
        unlockedConcepts = []
        isNewBest = false
        followUpNotice = nil
        conceptExplanations = [:]
        masteryFlash = nil
        timer = LessonTimer()
        loadQuestion()
        withAnimation(motion(.spring(response: 0.4, dampingFraction: 0.85))) { stage = .intro }
    }

    // MARK: Teaching fallback (C17)

    /// AI summaries only for skill cards the content did not write a `teaching` block
    /// for, and only when the stored description is thin. Best-effort, cancellable.
    func loadConceptExplanations() {
        guard explaining == nil, LessonService.hasKey else { return }
        let thin = conceptBlocks.filter {
            $0.teaching == nil && $0.explanation.count < Tuning.thinExplanationLength && conceptExplanations[$0.id] == nil
        }
        guard !thin.isEmpty else { return }
        explaining = Task { [weak self] in
            for block in thin {
                guard !Task.isCancelled else { return }
                if let text = await LessonService.explainConcept(name: block.concept.name,
                                                                 category: block.concept.category.label,
                                                                 level: block.concept.cefrLevel) {
                    self?.conceptExplanations[block.id] = text
                }
            }
        }
    }

    // MARK: Transient flashes

    private func flashNeedsLeft() {
        Haptics.tap()
        withAnimation(motion(.default)) { matchNeedsLeft = true }
        needsLeftFlash?.cancel()
        needsLeftFlash = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(900))
            guard !Task.isCancelled, let self else { return }
            withAnimation(self.motion(.default)) { self.matchNeedsLeft = false }
        }
    }

    private func flashWrongRight(_ gapId: String) {
        withAnimation(motion(.default)) { matchWrongRight = gapId }
        wrongFlash?.cancel()
        wrongFlash = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled, let self else { return }
            withAnimation(self.motion(.default)) { self.matchWrongRight = nil }
        }
    }

    private func showMastery(_ word: String) {
        withAnimation(motion(.spring(response: 0.4, dampingFraction: 0.6))) { masteryFlash = word }
        masteryTask?.cancel()
        masteryTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Tuning.lessonFlashSeconds))
            guard !Task.isCancelled, let self else { return }
            withAnimation(self.motion(.default)) { self.masteryFlash = nil }
        }
    }

    private func pop() {
        comboPop = true
        popTask?.cancel()
        popTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(320))
            guard !Task.isCancelled, let self else { return }
            self.comboPop = false
        }
    }
}
