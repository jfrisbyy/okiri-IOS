//
//  LessonSession.swift
//  FluentFrenchIOS
//
//  The lesson's state machine, view-free (Package C part 2). `LessonView` renders
//  a `LessonSession` and forwards the evidence it hands back to the store; the
//  view never decides what a miss costs, when a remedial is queued, when a
//  concept is released, or how a capstone differs. Everything here is pure so the
//  harness can drive whole lessons.
//
//  Rules (all knobs from `Tuning` through `LessonSessionConfig`):
//    • Hearts are real (C5): an ordinary lesson starts with `hearts`; a miss costs
//      one; at zero the lesson ends (`end == .outOfHearts`). Capstones run without.
//    • A "Show me" reveal (C12) is a miss recorded with `firstTry: false`, never
//      logged as an error, and — an admitted "I don't know" — costs no heart.
//    • A missed blind-spot probe is a diagnosis: evidence, no heart, not "missed".
//    • A miss queues one stepped-down remedial from the scheduler (C6), capped per
//      gap, `remedialSpacing` questions later, never behind the trailing probes.
//    • A match round is ONE question: a wrong pair is a miss for the tapped left
//      gap (evidence + error) recorded once per left row, costs one heart once per
//      round, and the round scores as correct only when no pair was wrong (C4 / B6).
//      Re-tapping a pair already tried in the round does nothing.
//    • In-session release (B11): once the target concept's streak of first-try
//      correct answers reaches the selection's `conceptReleaseStreak`, its remaining
//      questions are dropped and backfilled by the scheduler.
//    • Capstone (C16): one question per gap, no remedials, no reveals, no mastery
//      flashes, first attempt is the tally (`held` / `slipped`), capstone weight.
//

import Foundation

// MARK: - Config

nonisolated struct LessonSessionConfig {
    /// Hearts an ordinary lesson starts with; a miss costs one (C5).
    var hearts: Int = Tuning.lessonHearts
    /// Whether a capstone runs on hearts at all (it does not: a milestone quiz is never cut short).
    var capstoneHasHearts: Bool = Tuning.capstoneHasHearts
    /// "Show me" reveals allowed per lesson (C12).
    var reveals: Int = Tuning.hintsPerLesson
    /// A reveal is an admitted "I don't know": a recorded miss that costs no heart.
    var revealCostsHeart: Bool = Tuning.revealCostsHeart
    /// A missed probe is a diagnosis, not a slip.
    var probeMissCostsHeart: Bool = Tuning.probeMissCostsHeart
    /// Questions between a miss and its stepped-down remedial (C6).
    var remedialSpacing: Int = Tuning.remedialSpacing
    /// Correct answers a gap needs in one lesson to flash "mastered" (a session badge only).
    var masteryTarget: Int = Tuning.masteryTarget
    /// Concept weight every capstone answer carries.
    var capstoneWeight: Double = Tuning.capstoneWeight
    /// Builds remedials and applies the in-session release.
    var scheduler: LessonScheduler = LessonScheduler()

    static let tuning = LessonSessionConfig()
}

// MARK: - Answers, evidence, feedback

/// What the learner submitted for the current question.
nonisolated enum LessonAnswer: Equatable {
    case option(String)
    case typed(String)
    case arranged([String])
}

nonisolated enum LessonEndReason: Equatable {
    case finished, outOfHearts, quit
}

/// One piece of evidence for the store, shaped exactly as `recordAnswer` wants it.
nonisolated struct LessonEvidence {
    let gap: GapItem
    let correct: Bool
    let format: AnswerFormat
    let firstTry: Bool
    let isCheckIn: Bool
    let conceptWeight: Double
    /// A grade decided here (an accent slip is a `.hard` success — C3); nil lets the
    /// store derive it from the format via `recordAnswer`.
    let grade: ReviewGrade?
    /// The learner's own wrong answer to log with `recordError`; nil for correct
    /// answers and for reveals (C12).
    let loggedAnswer: String?
    let correctAnswer: String
    /// The OTHER lesson gap the learner actually picked when the miss was a mix-up:
    /// the meaning tapped in a match round, or a wrong multiple-choice option that is
    /// another item in this lesson. `AppStore.recordConfusion` turns it into a
    /// confusion link, which is what the selector ranks on and what puts the pair
    /// side by side in a later lesson. Nil when the miss names no partner.
    var confusedWithGapId: String? = nil

    var gapId: String { gap.id }
}

nonisolated enum LessonFeedbackTone: Equatable {
    case correct, close, incorrect, revealed
}

/// What the learner reads after answering (C10).
nonisolated struct LessonFeedback: Equatable {
    var tone: LessonFeedbackTone
    var title: String
    var detail: String?
    /// Other accepted typed forms ("Also accepted: …").
    var alternatives: [String] = []
    /// French worth hearing once the answer is on screen; nil when there is none.
    var speech: String?

    var isCorrect: Bool { tone == .correct || tone == .close }
}

nonisolated struct LessonMissedItem: Identifiable, Equatable {
    var id: String { gap.id }
    let gap: GapItem
    /// What the recap prints under the French word — the item's MEANING, plus the
    /// completed sentence for a sentence format. Not the question's own answer:
    /// see `LessonSession.recapAnswer(for:)`.
    let answer: String
    let kind: QuestionKind
}

/// What one submission changed. The view records `evidence`, awards `xp`, and
/// renders the rest.
nonisolated struct LessonAnswerOutcome {
    /// The answer (or, for a completed match round, the round) was correct.
    var correct: Bool
    var firstTry: Bool
    /// False only for a match pair that did not finish the round.
    var roundComplete: Bool = true
    var evidence: [LessonEvidence] = []
    var xp: Int = 0
    var heartLost: Bool = false
    var endedByHearts: Bool = false
    /// B11: the target concept released by this answer (the view shows a small note).
    var releasedConceptId: String? = nil
    /// The word that just reached the session mastery target (never in a capstone).
    var masteredWord: String? = nil
    var remedialQueued: Bool = false
    var feedback: LessonFeedback? = nil
}

nonisolated struct LessonSummary: Equatable {
    var end: LessonEndReason
    /// Every question answered — probes, remedials and reveals included (what `completeLesson` gets).
    var answered: Int
    /// First-attempt, non-probe questions (the honest accuracy base).
    var scored: Int
    var scoredCorrect: Int
    var accuracy: Double
    var accuracyPercent: Int
    var xp: Int
    var bestCombo: Int
    var masteredCount: Int
    var missed: [LessonMissedItem]
    /// Capstone tally: first attempt correct / wrong, one entry per gap.
    var held: [GapItem]
    var slipped: [GapItem]
    var releasedConceptIds: [String]

    var missedGapIds: [String] { missed.map { $0.gap.id } }

    /// Whether the store books this as a completed lesson (day count + finishing
    /// XP): only a lesson played to the end, unless `Tuning.outOfHeartsCountsAsComplete`
    /// lets a hearts-out recap count too. Quits and hearts-out are otherwise
    /// `abandoned` — evidence and minutes are still recorded.
    var isCompleted: Bool {
        switch end {
        case .finished: return true
        case .outOfHearts: return Tuning.outOfHeartsCountsAsComplete
        case .quit: return false
        }
    }
}

// MARK: - Session

nonisolated struct LessonSession {
    let config: LessonSessionConfig
    let lesson: AssembledLesson
    let isCapstone: Bool
    /// Selected role per gap id, from `lesson.selection.items` (B6: `.checkIn` → `isCheckIn`).
    let roles: [String: SelectedItemRole]
    /// The selection's release streak (B11).
    let releaseStreak: Int
    let targetConceptId: String?

    private(set) var schedule: [LessonQuestion] = []
    private(set) var position = 0
    /// Nil when the lesson runs without hearts (capstone).
    private(set) var hearts: Int?
    private(set) var xp = 0
    private(set) var combo = 0
    private(set) var bestCombo = 0
    private(set) var answered = 0
    private(set) var scored = 0
    private(set) var scoredCorrect = 0
    private(set) var revealsUsed = 0
    private(set) var end: LessonEndReason?
    private(set) var missed: [LessonMissedItem] = []
    private(set) var masteredGapIds: Set<String> = []
    private(set) var held: [GapItem] = []
    private(set) var slipped: [GapItem] = []
    private(set) var releasedConceptIds: [String] = []
    /// Left gap ids matched so far in the current match round.
    private(set) var matchedIds: Set<String> = []
    /// The current question has been answered (or revealed) and awaits `advance()`.
    private(set) var currentAnswered = false

    private var missCountByGap: [String: Int] = [:]
    private var correctByGap: [String: Int] = [:]
    private var remedialsByGap: [String: Int] = [:]
    private var releaseTracker = ConceptReleaseTracker()
    private var wrongLefts: Set<String> = []
    /// "<left>|<right>" pairs already tried in the current match round: tapping the
    /// same wrong pair again is not new evidence.
    private var triedPairs: Set<String> = []
    private var roundHadWrong = false

    init(lesson: AssembledLesson, isCapstone: Bool, config: LessonSessionConfig = .tuning) {
        self.config = config
        self.lesson = lesson
        self.isCapstone = isCapstone
        self.roles = LessonScheduler.roles(in: lesson)
        self.releaseStreak = lesson.selection.conceptReleaseStreak
        self.targetConceptId = lesson.targetConcept?.id ?? lesson.selection.targetConceptId
        self.hearts = (isCapstone && !config.capstoneHasHearts) ? nil : config.hearts
    }

    /// The lesson to run for a bare gap list (entry points always pass an assembled
    /// lesson; this keeps the initializer honest when they do not).
    static func lesson(for gaps: [GapItem], assembled: AssembledLesson?, isCapstone: Bool) -> AssembledLesson {
        if let assembled { return assembled }
        let mode: SelectionMode = isCapstone ? .capstone : .scoped(candidateGapIds: gaps.map { $0.id })
        let items = gaps.map { SelectedItem(gapId: $0.id, conceptId: $0.conceptId, role: .review, reason: "") }
        let headline = isCapstone ? "Capstone" : "Practice"
        let output = SelectionOutput(request: SelectionRequest(mode: mode, scopeName: isCapstone ? nil : headline),
                                     targetConceptId: nil, items: items, headline: headline,
                                     rankedConcepts: [], learnerLevel: .A1)
        return AssembledLesson(selection: output, targetConcept: nil, gaps: gaps, reasons: [:],
                               headline: headline, probeGapId: nil)
    }

    // MARK: Reading

    var isStarted: Bool { !schedule.isEmpty }
    var current: LessonQuestion? { schedule.indices.contains(position) ? schedule[position] : nil }
    var isLast: Bool { position + 1 >= schedule.count }
    var hasHearts: Bool { hearts != nil }
    var revealsLeft: Int { max(0, config.reveals - revealsUsed) }
    var conceptWeight: Double { isCapstone ? config.capstoneWeight : 1 }
    var isOver: Bool { end != nil }

    /// Progress through the schedule (the bar): answered questions over the total.
    var progress: Double {
        guard !schedule.isEmpty else { return 0 }
        if end == .finished { return 1 }
        return min(1, Double(position + (currentAnswered ? 1 : 0)) / Double(schedule.count))
    }

    /// The gaps that can still reach the session mastery target: the LIVE schedule
    /// holds at least `masteryTarget` unaided questions for them. A check-in is
    /// asked once, and a released concept's remaining questions are dropped, so
    /// neither can ever be "mastered this session" — counting them would put a
    /// denominator on the practice bar that a flawless lesson cannot reach.
    var masterableGapIds: Set<String> {
        var counts: [String: Int] = [:]
        for q in schedule where !q.isInterstitial && !q.isProbe && !q.isRemedial {
            counts[q.gap.id, default: 0] += 1
        }
        return Set(counts.filter { $0.value >= config.masteryTarget }.keys)
    }

    /// The denominator the practice bar shows next to `masteredGapIds.count`.
    var masterableCount: Int { max(masterableGapIds.count, masteredGapIds.count) }

    /// "Show me" is available for the current question (C12): never in a capstone,
    /// never for a match round, and only while reveals remain.
    var canReveal: Bool {
        guard let q = current else { return false }
        return canReveal(q)
    }

    func canReveal(_ q: LessonQuestion) -> Bool {
        !isCapstone && !q.isInterstitial && revealsLeft > 0 && end == nil && !currentAnswered
    }

    /// A first try: not a remedial, and the gap has not been missed in this session.
    func firstTry(for q: LessonQuestion) -> Bool {
        !q.isRemedial && (missCountByGap[q.gap.id] ?? 0) == 0
    }

    /// Selected role for a gap (B6): the selection's role first, the question's as fallback.
    func role(for gap: GapItem, in q: LessonQuestion) -> SelectedItemRole {
        roles[gap.id] ?? q.role
    }

    /// Whether the lesson may show this item's MEANING before it asks about it —
    /// the word card on the teaching stage and the meaning line on the intro
    /// preview both use this.
    ///
    /// Two exclusions, both about not banking a pass the learner has not earned:
    ///   • an item that has been reviewed before is here to be TESTED (an
    ///     interleaved review), and its answer is what FSRS is about to grade;
    ///   • a CHECK-IN, whatever its evidence. `ConceptSelector.checkInVehicle`
    ///     falls back to a never-reviewed gap when a mastered concept has no
    ///     reviewed one, which is exactly the case for a provisional placement
    ///     seed — teaching it would "verify" the seed on evidence just handed over.
    /// A probe is never taught: it is a blind-spot diagnosis.
    func mayTeach(_ gap: GapItem) -> Bool {
        guard !gap.isProbe, gap.isNew else { return false }
        return (roles[gap.id] ?? .review) != .checkIn
    }

    /// The lesson's items the learner may be shown the meaning of, in lesson order.
    var teachableGaps: [GapItem] { lesson.gaps.filter(mayTeach) }

    var summary: LessonSummary {
        let accuracy = scored > 0 ? Double(scoredCorrect) / Double(scored) : 0
        return LessonSummary(end: end ?? .quit, answered: answered, scored: scored, scoredCorrect: scoredCorrect,
                             accuracy: accuracy, accuracyPercent: Int((accuracy * 100).rounded()),
                             xp: xp, bestCombo: bestCombo, masteredCount: masteredGapIds.count,
                             missed: missed, held: held, slipped: slipped, releasedConceptIds: releasedConceptIds)
    }

    // MARK: Transitions

    /// Load the schedule and start at its first question.
    mutating func start(with schedule: [LessonQuestion]) {
        self.schedule = schedule
        position = 0
        end = nil
        resetRound()
    }

    /// Grade and record the current (non-match) question. Nil when nothing can be
    /// answered: the lesson is over, the question was already answered, or it is a match round.
    mutating func submit(_ answer: LessonAnswer) -> LessonAnswerOutcome? {
        guard end == nil, !currentAnswered, let q = current, q.kind != .match else { return nil }
        let graded = Self.grade(answer, for: q)
        return resolve(q, correct: graded.correct, verdict: graded.verdict, given: graded.given, revealed: false)
    }

    /// "Show me": the answer is shown, the miss is recorded with `firstTry: false`,
    /// nothing is logged as an error (C12).
    mutating func reveal() -> LessonAnswerOutcome? {
        guard let q = current, canReveal(q) else { return nil }
        revealsUsed += 1
        return resolve(q, correct: false, verdict: nil, given: "", revealed: true)
    }

    /// One pair in the current match round: `left` and `right` are gap ids (rows are
    /// keyed by gap id, so duplicate translations can never collide — C4). Nil when
    /// there is no match round, the ids are not in it, the left row is already
    /// matched, or this exact pair was already tried in this round.
    ///
    /// A left row costs at most one miss per round however many wrong meanings are
    /// tapped for it: guessing down the right column must not stack lapses on one word.
    mutating func matchPair(left leftId: String, right rightId: String) -> LessonAnswerOutcome? {
        guard end == nil, !currentAnswered, let q = current, q.kind == .match,
              let leftGap = q.matchGaps.first(where: { $0.id == leftId }),
              let rightGap = q.matchGaps.first(where: { $0.id == rightId }),
              !matchedIds.contains(leftId),
              triedPairs.insert("\(leftId)|\(rightId)").inserted else { return nil }
        let matched = leftId == rightId
        let firstTry = !wrongLefts.contains(leftId) && (missCountByGap[leftId] ?? 0) == 0
        // The first wrong meaning tapped for a left row is the evidence; the ones
        // after it are the same miss, and are recorded once.
        let counts = matched || wrongLefts.insert(leftId).inserted
        var outcome = LessonAnswerOutcome(correct: matched, firstTry: firstTry, roundComplete: false)
        if counts {
            // A wrong pair names both halves of the mix-up: the gap asked and the gap
            // whose meaning was tapped. That pair is the confusion signal.
            outcome.evidence = [evidence(for: leftGap, role: role(for: leftGap, in: q), correct: matched,
                                         format: .match, firstTry: firstTry, grade: nil,
                                         loggedAnswer: matched ? nil : rightGap.englishTranslation,
                                         correctAnswer: leftGap.englishTranslation,
                                         confusedWith: matched ? nil : rightGap.id)]
        }
        if matched {
            matchedIds.insert(leftId)
            if matchedIds.count == q.matchGaps.count {
                // The round is one question: correct only when no pair went wrong.
                let roundCorrect = !roundHadWrong
                outcome.roundComplete = true
                outcome.correct = roundCorrect
                currentAnswered = true
                answered += 1
                scored += 1
                if roundCorrect {
                    scoredCorrect += 1
                    outcome.xp = registerCorrect()
                }
                outcome.feedback = Self.matchFeedback(for: q, wrongLefts: wrongLefts, combo: combo)
            }
        } else {
            if counts {
                missCountByGap[leftId, default: 0] += 1
                noteMissed(leftGap, answer: leftGap.englishTranslation, kind: .match)
            }
            if !roundHadWrong {
                roundHadWrong = true
                combo = 0
                outcome.heartLost = loseHeart()
                outcome.endedByHearts = end == .outOfHearts
            }
            if counts, end == nil {
                // Remediate the missed gap, not the round's first pair.
                var missedQuestion = LessonQuestion(gap: leftGap, kind: .match, prompt: q.prompt,
                                                    correctAnswer: leftGap.englishTranslation)
                missedQuestion.role = role(for: leftGap, in: q)
                outcome.remedialQueued = queueRemedial(for: missedQuestion)
            }
        }
        return outcome
    }

    /// Move to the next question. False when the schedule is exhausted (the lesson
    /// is then `.finished`) or the lesson already ended.
    mutating func advance() -> Bool {
        guard end == nil else { return false }
        if position + 1 < schedule.count {
            resetRound()
            position += 1
            return true
        }
        end = .finished
        return false
    }

    mutating func quit() {
        if end == nil { end = .quit }
    }

    // MARK: Grading

    static func grade(_ answer: LessonAnswer, for q: LessonQuestion) -> (correct: Bool, verdict: AnswerVerdict?, given: String) {
        switch answer {
        case .option(let option):
            // Tag-preserving: options that differ only in "(masculine singular)" /
            // "(feminine singular)" are different answers, and only one is correct.
            let correct = AnswerGrader.optionMatches(option, q.correctAnswer)
            return (correct, nil, option)
        case .typed(let text):
            let verdict = AnswerGrader.grade(typed: text, against: q.gap, expected: q.correctAnswer, kind: q.kind)
            return (verdict.countsAsCorrect, verdict, text)
        case .arranged(let tokens):
            return (tokens == q.correctOrder, nil, tokens.joined(separator: " "))
        }
    }

    // MARK: Private

    private mutating func resolve(_ q: LessonQuestion, correct: Bool, verdict: AnswerVerdict?,
                                  given: String, revealed: Bool) -> LessonAnswerOutcome {
        let firstTry = revealed ? false : firstTry(for: q)
        currentAnswered = true
        answered += 1
        if !q.isProbe && !q.isRemedial {
            scored += 1
            if correct { scoredCorrect += 1 }
        }
        var outcome = LessonAnswerOutcome(correct: correct, firstTry: firstTry)
        var grade: ReviewGrade? = nil
        if let verdict, case .closeAccents = verdict { grade = .hard }
        // A probe miss is a diagnosis of material never taught, not a mistake to
        // log: it is already out of `scored`, out of `missed` and free of hearts.
        let logsError = !correct && !revealed && !q.isProbe
        // Picking another lesson item's option is a mix-up, not a blank: name the
        // partner so the store can link the pair (the selector ranks on it and the
        // assembler puts the two side by side).
        let confusedWith = (logsError && q.kind == .multipleChoice)
            ? confusedGapId(for: given, excluding: q.gap.id) : nil
        outcome.evidence = [evidence(for: q.gap, role: role(for: q.gap, in: q), correct: correct,
                                     format: q.answerFormat, firstTry: firstTry, grade: grade,
                                     loggedAnswer: logsError ? given : nil,
                                     correctAnswer: q.correctAnswer,
                                     confusedWith: confusedWith)]
        if isCapstone {
            if correct { held.append(q.gap) } else { slipped.append(q.gap) }
        }
        if correct {
            outcome.xp = registerCorrect()
            // Only unaided answers count toward "Mastered!": the first remedial shows
            // the answer before the pick (C6), so it cannot be evidence of mastery.
            if !isCapstone && !q.isProbe && !q.isRemedial {
                let n = (correctByGap[q.gap.id] ?? 0) + 1
                correctByGap[q.gap.id] = n
                if n >= config.masteryTarget && masteredGapIds.insert(q.gap.id).inserted {
                    outcome.masteredWord = q.gap.frenchWord
                }
            }
        } else {
            combo = 0
            missCountByGap[q.gap.id, default: 0] += 1
            if !q.isProbe { noteMissed(q.gap, answer: Self.recapAnswer(for: q), kind: q.kind) }
            let costsHeart = revealed ? config.revealCostsHeart : (q.isProbe ? config.probeMissCostsHeart : true)
            if costsHeart {
                outcome.heartLost = loseHeart()
                outcome.endedByHearts = end == .outOfHearts
            }
            if end == nil { outcome.remedialQueued = queueRemedial(for: q) }
        }
        if !isCapstone, end == nil, !q.isProbe,
           let released = releaseTracker.record(conceptId: q.conceptId, firstTryCorrect: correct && firstTry,
                                                releaseStreak: releaseStreak),
           released == targetConceptId {
            let before = pendingTargetCount(released)
            schedule = config.scheduler.releaseTargetConcept(conceptId: released, from: schedule, after: position)
            if pendingTargetCount(released) < before {
                releasedConceptIds.append(released)
                outcome.releasedConceptId = released
            }
        }
        outcome.feedback = Self.feedback(for: q, correct: correct, verdict: verdict, revealed: revealed, combo: combo)
        return outcome
    }

    /// Combo, best combo and XP for one correct answer; returns the XP earned.
    private mutating func registerCorrect() -> Int {
        combo += 1
        bestCombo = max(bestCombo, combo)
        let gained = LessonScoring.xp(forCombo: combo)
        xp += gained
        return gained
    }

    private mutating func loseHeart() -> Bool {
        guard let h = hearts, h > 0 else { return false }
        hearts = h - 1
        if h - 1 == 0 { end = .outOfHearts }
        return true
    }

    private mutating func noteMissed(_ gap: GapItem, answer: String, kind: QuestionKind) {
        guard !missed.contains(where: { $0.gap.id == gap.id }) else { return }
        missed.append(LessonMissedItem(gap: gap, answer: answer, kind: kind))
    }

    /// What the missed-items recap prints under the French word (C26).
    ///
    /// The QUESTION's answer is usually not worth reading back: it is "True" or
    /// "False" for a true/false, and the French word itself — the line above it —
    /// for a translation or a reversed multiple choice. What the learner missed is
    /// the MEANING, and for a sentence format the sentence with the answer in it.
    /// The first miss of a gap fixes its recap line, so the line has to stand on
    /// its own whatever format produced it.
    static func recapAnswer(for q: LessonQuestion) -> String {
        let meaning = q.gap.englishTranslation.trimmingCharacters(in: .whitespacesAndNewlines)
        let answer = q.correctAnswer.trimmingCharacters(in: .whitespacesAndNewlines)
        switch q.kind {
        case .fillBlank:
            // The model's (or the content's) own sentence, with the blank filled.
            let filled = answer.isEmpty
                ? q.prompt
                : q.prompt.replacingOccurrences(of: AnswerGrader.blankToken, with: answer)
            let sentence = filled.trimmingCharacters(in: .whitespacesAndNewlines)
            return joinRecap(meaning, AnswerGrader.isCloze(sentence) ? "" : sentence)
        case .arrange:
            // `correctAnswer` is the target sentence.
            return joinRecap(meaning, answer)
        case .multipleChoice:
            // A reversed multiple choice answers with the French word itself.
            let echoesWord = AnswerGrader.normalize(answer) == AnswerGrader.normalize(q.gap.frenchWord)
            if q.isReversed || echoesWord || answer.isEmpty { return meaning }
            return answer
        case .trueFalse, .translation, .match:
            return meaning
        }
    }

    /// "meaning — sentence", dropping either half when it is empty.
    private static func joinRecap(_ meaning: String, _ sentence: String) -> String {
        if meaning.isEmpty { return sentence }
        if sentence.isEmpty { return meaning }
        return "\(meaning) — \(sentence)"
    }

    /// Queue a stepped-down remedial for a missed question (C6). False for capstones,
    /// probes, interstitials, and once the gap has had `maxRemedialsPerGap`.
    ///
    /// Never for a CHECK-IN either: the stepped-down remedial shows the answer before
    /// the pick, and it keeps the gap's selected role, so a missed check-in would bank
    /// a second, passing check-in on the same concept — the interval would grow instead
    /// of halving, the governor's window would take a spurious pass, and a provisional
    /// placement seed could be "verified" by answers it was just handed. One check-in
    /// asked is one check-in outcome; the miss halves the interval and the selector
    /// brings the concept back.
    private mutating func queueRemedial(for q: LessonQuestion) -> Bool {
        guard !isCapstone, !q.isProbe, !q.isCapstone, role(for: q.gap, in: q) != .checkIn else { return false }
        let attempt = (remedialsByGap[q.gap.id] ?? 0) + 1
        guard let remedial = config.scheduler.remedial(for: q, attempt: attempt, pool: lesson.gaps) else { return false }
        remedialsByGap[q.gap.id] = attempt
        schedule.insert(remedial, at: remedialInsertionIndex())
        return true
    }

    /// `remedialSpacing` questions after the current one, clamped to the end and
    /// never behind the probes that close the schedule.
    private func remedialInsertionIndex() -> Int {
        let earliest = position + 1 + max(0, config.remedialSpacing)
        let firstProbe = schedule.indices.first { $0 > position && schedule[$0].isProbe } ?? schedule.count
        return min(earliest, firstProbe, schedule.count)
    }

    private func pendingTargetCount(_ conceptId: String) -> Int {
        guard position + 1 < schedule.count else { return 0 }
        return schedule[(position + 1)...].filter {
            $0.role == .target && $0.conceptId == conceptId && !$0.isInterstitial && !$0.isProbe
        }.count
    }

    private mutating func resetRound() {
        currentAnswered = false
        matchedIds = []
        wrongLefts = []
        triedPairs = []
        roundHadWrong = false
    }

    private func evidence(for gap: GapItem, role: SelectedItemRole, correct: Bool, format: AnswerFormat,
                          firstTry: Bool, grade: ReviewGrade?, loggedAnswer: String?, correctAnswer: String,
                          confusedWith: String? = nil) -> LessonEvidence {
        LessonEvidence(gap: gap, correct: correct, format: format, firstTry: firstTry,
                       isCheckIn: role == .checkIn, conceptWeight: conceptWeight, grade: grade,
                       loggedAnswer: loggedAnswer, correctAnswer: correctAnswer,
                       confusedWithGapId: confusedWith)
    }

    /// The lesson item the learner actually picked, when a wrong answer IS another
    /// item on the table: the meaning or the French form of a different gap in this
    /// lesson (an "a / b" gloss matches on either side). Nil when the answer names no
    /// other item — a typed answer, a distractor built from outside the lesson, or a
    /// second reading of the same gap.
    func confusedGapId(for given: String, excluding gapId: String) -> String? {
        let sides = LessonScheduler.distractorSides(of: given)
        guard !sides.isEmpty else { return nil }
        return lesson.gaps.first { other in
            other.id != gapId && !other.isProbe
                && (!sides.isDisjoint(with: LessonScheduler.distractorSides(of: other.englishTranslation))
                    || !sides.isDisjoint(with: LessonScheduler.distractorSides(of: other.frenchWord)))
        }?.id
    }

    // MARK: Feedback (C10)

    /// Per-format feedback: the scheduler wrote `explanation` for the format (the
    /// completed sentence + note, the true meaning, the target sentence + translation,
    /// the expected form); typed formats add the other accepted forms.
    static func feedback(for q: LessonQuestion, correct: Bool, verdict: AnswerVerdict?,
                         revealed: Bool, combo: Int) -> LessonFeedback {
        let answer = q.correctAnswer
        var alternatives: [String] = []
        if q.kind.isTyped {
            let expected = AnswerGrader.normalize(answer)
            alternatives = AnswerGrader.acceptedForms(for: q.gap, expected: answer, kind: q.kind)
                .filter { $0.normalized != expected }
                .map { $0.display }
        }
        let speech = LessonSpeech.spokenAnswer(for: q)
        if revealed {
            return LessonFeedback(tone: .revealed, title: "The answer is “\(answer)”", detail: q.explanation,
                                  alternatives: alternatives, speech: speech)
        }
        if let verdict, case .closeAccents = verdict {
            return LessonFeedback(tone: .close, title: verdict.message ?? "Almost — check the accents",
                                  detail: q.explanation, alternatives: alternatives, speech: speech)
        }
        if correct {
            return LessonFeedback(tone: .correct, title: praise(combo: combo), detail: q.explanation,
                                  alternatives: alternatives, speech: speech)
        }
        return LessonFeedback(tone: .incorrect, title: "Answer: \(answer)", detail: q.explanation,
                              alternatives: alternatives, speech: speech)
    }

    /// The summary after a match round: every pair, with the missed ones named.
    static func matchFeedback(for q: LessonQuestion, wrongLefts: Set<String>, combo: Int) -> LessonFeedback {
        let pairs = q.matchGaps.map { "\($0.frenchWord) — \($0.englishTranslation)" }.joined(separator: "\n")
        let missed = q.matchGaps.filter { wrongLefts.contains($0.id) }
        if missed.isEmpty {
            return LessonFeedback(tone: .correct, title: praise(combo: combo), detail: pairs)
        }
        let names = missed.map { $0.frenchWord }.joined(separator: ", ")
        return LessonFeedback(tone: .incorrect,
                              title: "Round done — check \(names)",
                              detail: pairs)
    }

    static func praise(combo: Int) -> String {
        let multiplier = LessonScoring.comboMultiplier(combo)
        if combo >= Tuning.comboHighStreak { return "On fire! ×\(Self.format(multiplier)) XP" }
        if combo >= Tuning.comboMidStreak { return "Great streak! ×\(Self.format(multiplier)) XP" }
        return "Correct!"
    }

    private static func format(_ multiplier: Double) -> String {
        multiplier == multiplier.rounded() ? String(Int(multiplier)) : String(format: "%.1f", multiplier)
    }
}

// MARK: - Speech (C20)

/// What the speak buttons may read: French only, and never the answer before it
/// is on screen.
nonisolated enum LessonSpeech {
    /// The pause read in place of a fill-blank gap.
    static let blankPause = "…"

    /// Before the answer: the blanked sentence (the blank becomes a pause), the
    /// French headword for forward multiple choice and true/false, nothing for the
    /// English prompts (reversed multiple choice, translation) and for arrange /
    /// match, where the French would give the answer away.
    static func spokenPrompt(for q: LessonQuestion) -> String? {
        switch q.kind {
        case .fillBlank:
            let spoken = q.prompt.replacingOccurrences(of: #"_{3,}"#, with: blankPause, options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return spoken.isEmpty ? nil : spoken
        case .multipleChoice:
            return q.isReversed ? nil : speakableFrench(q.gap.frenchWord)
        case .trueFalse:
            return speakableFrench(q.gap.frenchWord)
        case .translation, .arrange, .match:
            return nil
        }
    }

    /// French worth reading aloud: nothing for a cloze item, whose "French" is a
    /// sentence with a hole in it ("___ gare").
    static func speakableFrench(_ french: String) -> String? {
        AnswerGrader.isCloze(french) ? nil : french
    }

    /// After the answer: the completed sentence, the French form, or the arranged sentence.
    static func spokenAnswer(for q: LessonQuestion) -> String? {
        switch q.kind {
        case .fillBlank:
            return q.gap.exampleSentence.isEmpty ? q.correctAnswer : q.gap.exampleSentence
        case .translation, .arrange:
            return q.correctAnswer
        case .multipleChoice:
            return q.isReversed ? q.correctAnswer : speakableFrench(q.gap.frenchWord)
        case .trueFalse:
            return speakableFrench(q.gap.frenchWord)
        case .match:
            return nil
        }
    }
}

// MARK: - Foreground timer (C14)

/// Counts lesson time only while the app is active: the view pauses it whenever
/// the scene leaves `.active` and resumes on return.
nonisolated struct LessonTimer: Equatable {
    private(set) var accumulated: TimeInterval = 0
    private(set) var runningSince: Date? = nil
    private(set) var isStarted = false

    var isRunning: Bool { runningSince != nil }

    mutating func start(at now: Date) {
        guard !isStarted else { return }
        isStarted = true
        runningSince = now
    }

    mutating func pause(at now: Date) {
        guard let since = runningSince else { return }
        accumulated += max(0, now.timeIntervalSince(since))
        runningSince = nil
    }

    mutating func resume(at now: Date) {
        guard isStarted, runningSince == nil else { return }
        runningSince = now
    }

    func elapsed(at now: Date) -> TimeInterval {
        accumulated + (runningSince.map { max(0, now.timeIntervalSince($0)) } ?? 0)
    }

    /// Minutes to credit, under the same rule as activity time (D9): nothing under
    /// `Tuning.minActivitySeconds`, rounded, never more than `Tuning.lessonCreditCapMinutes`.
    func creditedMinutes(at now: Date) -> Int {
        ActivityCredit.minutes(activeSeconds: elapsed(at: now), capMinutes: Tuning.lessonCreditCapMinutes)
    }
}
