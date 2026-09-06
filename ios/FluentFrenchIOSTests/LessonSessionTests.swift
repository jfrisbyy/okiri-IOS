//
//  LessonSessionTests.swift
//  FluentFrenchIOSTests
//
//  Package C part 2 — the lesson state machine: real hearts (C5), the schedule
//  cursor, stepped-down remedials (C6), "Show me" (C12), the accent slip (C3),
//  match rounds (C4 / B6), in-session release (B11), probes (C19), check-in
//  roles (B6), capstone rules (C16), the foreground timer (C14) and what the
//  speak buttons may read (C20).
//
//  Note: `#expect` / `#require` rewrite their argument into a closure, so every
//  mutating call on a session is hoisted into a local first.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct LessonSessionTests {
    private let now = EngineFixtures.now

    private var scheduler: LessonScheduler {
        var config = LessonSchedulerConfig.tuning
        config.seed = 11
        return LessonScheduler(config: config)
    }

    private func config(hearts: Int? = nil, masteryTarget: Int? = nil) -> LessonSessionConfig {
        var config = LessonSessionConfig.tuning
        config.scheduler = scheduler
        if let hearts { config.hearts = hearts }
        if let masteryTarget { config.masteryTarget = masteryTarget }
        return config
    }

    // MARK: Fixtures

    private func gap(_ id: String, concept: String? = "c", reviewCount: Int = 0, consecutiveCorrect: Int = 0,
                     category: GapCategory = .vocabulary) -> GapItem {
        EngineFixtures.gap(id, concept: concept, category: category, consecutiveCorrect: consecutiveCorrect, reviewCount: reviewCount)
    }

    private func lesson(_ gaps: [GapItem], roles: [String: SelectedItemRole] = [:], mode: SelectionMode = .smart,
                        target: String? = nil) -> AssembledLesson {
        let items = gaps.map { SelectedItem(gapId: $0.id, conceptId: $0.conceptId, role: roles[$0.id] ?? .review, reason: "") }
        let output = SelectionOutput(request: SelectionRequest(mode: mode, now: now), targetConceptId: target,
                                     items: items, headline: "test", rankedConcepts: [], learnerLevel: .A1)
        return AssembledLesson(selection: output, targetConcept: nil, gaps: gaps, reasons: [:],
                               headline: "test", probeGapId: nil)
    }

    /// A session started on the scheduler's own schedule for the lesson.
    private func session(for lesson: AssembledLesson, isCapstone: Bool = false,
                         config: LessonSessionConfig? = nil) -> LessonSession {
        let cfg = config ?? self.config()
        var s = LessonSession(lesson: lesson, isCapstone: isCapstone, config: cfg)
        s.start(with: cfg.scheduler.build(for: lesson, abilityOptionCount: Tuning.minMultipleChoiceOptions))
        return s
    }

    private func correctAnswer(for q: LessonQuestion) -> LessonAnswer {
        switch q.kind {
        case .multipleChoice, .trueFalse: return .option(q.correctAnswer)
        case .fillBlank, .translation: return .typed(q.correctAnswer)
        case .arrange: return .arranged(q.correctOrder)
        case .match: return .option("")
        }
    }

    private func wrongAnswer(for q: LessonQuestion) -> LessonAnswer {
        switch q.kind {
        case .multipleChoice, .trueFalse: return .option("not-the-answer-\(q.id.uuidString)")
        case .fillBlank, .translation: return .typed("zzz-wrong")
        case .arrange: return .arranged(Array(q.correctOrder.reversed()))
        case .match: return .option("")
        }
    }

    /// Match every pair of the current match round correctly; returns the round's outcome.
    private func completeMatch(_ s: inout LessonSession, _ q: LessonQuestion) -> LessonAnswerOutcome? {
        var last: LessonAnswerOutcome? = nil
        for g in q.matchGaps { last = s.matchPair(left: g.id, right: g.id) }
        return last
    }

    /// Answer the current question (any kind) correctly.
    private func answerCorrectly(_ s: inout LessonSession) throws -> LessonAnswerOutcome {
        let q = try #require(s.current)
        let outcome: LessonAnswerOutcome?
        if q.kind == .match {
            outcome = completeMatch(&s, q)
        } else {
            outcome = s.submit(correctAnswer(for: q))
        }
        return try #require(outcome)
    }

    /// Answer the current question wrongly (a match round: the first pair crossed).
    private func answerWrongly(_ s: inout LessonSession) throws -> LessonAnswerOutcome {
        let q = try #require(s.current)
        let outcome: LessonAnswerOutcome?
        if q.kind == .match {
            outcome = s.matchPair(left: q.matchGaps[0].id, right: q.matchGaps[1].id)
        } else {
            outcome = s.submit(wrongAnswer(for: q))
        }
        return try #require(outcome)
    }

    // MARK: C5 — hearts are real

    @Test func heartsFallOnMissesAndEndTheLesson() throws {
        let gaps = (1...4).map { gap("g\($0)") }
        var s = session(for: lesson(gaps))
        #expect(s.hasHearts && s.hearts == Tuning.lessonHearts)
        var lost = 0
        var lastOutcome: LessonAnswerOutcome? = nil
        while s.end == nil, s.current != nil {
            let out = try answerWrongly(&s)
            #expect(out.heartLost && !out.correct)
            lost += 1
            lastOutcome = out
            if s.end == nil {
                let advanced = s.advance()
                #expect(advanced)
            }
        }
        #expect(lost == Tuning.lessonHearts)
        #expect(s.end == .outOfHearts && s.hearts == 0)
        #expect(lastOutcome?.endedByHearts == true)
        #expect(lastOutcome?.remedialQueued == false, "no remedial once the lesson is over")
        let lateSubmit = s.submit(.option("x"))
        let lateReveal = s.reveal()
        let lateAdvance = s.advance()
        #expect(lateSubmit == nil && lateReveal == nil && !lateAdvance)
        let summary = s.summary
        #expect(summary.end == .outOfHearts)
        #expect(!summary.missed.isEmpty && summary.missed.count <= lost)
        #expect(summary.answered == lost)
        #expect(summary.missedGapIds.contains("g1"))
    }

    /// Hearts-out is a recap, not a finished lesson (C-R2): the store keeps the
    /// evidence and the per-answer XP but neither counts the day nor pays the
    /// finishing bonus; a lesson played to the end does both.
    @Test func outOfHeartsIsNotBookedAsACompletedLesson() throws {
        let gaps = (1...4).map { gap("g\($0)") }
        let store = EngineFixtures.store(concepts: [], gaps: gaps)
        var s = session(for: lesson(gaps))
        var answerXP = 0
        let first = try answerCorrectly(&s)
        answerXP += first.xp
        store.awardXP(first.xp)
        #expect(first.xp > 0)
        while s.end == nil, s.advance() {
            let out = try answerWrongly(&s)
            answerXP += out.xp
            store.awardXP(out.xp)
        }
        let summary = s.summary
        #expect(summary.end == .outOfHearts && !summary.isCompleted)
        #expect(summary.answered == 1 + Tuning.lessonHearts)
        let xpBefore = store.xp
        let unlocked = store.completeLesson(targetConceptId: nil, isCapstone: false,
                                            abandoned: !summary.isCompleted, answered: summary.answered, now: now)
        #expect(unlocked.isEmpty)
        #expect(store.lessonsCompleted(on: now) == 0, "hearts-out never counts toward the day's lessons")
        #expect(store.xp == xpBefore && store.xp == answerXP, "only the per-answer XP, no finishing bonus")
        #expect(store.sessionIndex == 1 && store.lessonsSinceCapstone == 1, "…but the session itself is still recorded")

        // The same bookkeeping for a quit; a finished lesson counts and pays the bonus.
        var quit = session(for: lesson(gaps))
        quit.quit()
        #expect(!quit.summary.isCompleted)
        var done = session(for: lesson(gaps))
        repeat { _ = try answerCorrectly(&done) } while done.advance()
        let finished = done.summary
        #expect(finished.end == .finished && finished.isCompleted)
        _ = store.completeLesson(targetConceptId: nil, isCapstone: false,
                                 abandoned: !finished.isCompleted, answered: finished.answered, now: now)
        #expect(store.lessonsCompleted(on: now) == 1)
        #expect(store.xp == answerXP + Tuning.xpPerLessonComplete)
    }

    @Test func quitEndsTheSession() throws {
        var s = session(for: lesson([gap("g1"), gap("g2")]))
        _ = try answerCorrectly(&s)
        s.quit()
        #expect(s.end == .quit && s.summary.end == .quit && s.summary.answered == 1)
        let lateSubmit = s.submit(.option("x"))
        let lateAdvance = s.advance()
        #expect(lateSubmit == nil && !lateAdvance)
    }

    // MARK: C16 — capstone rules

    @Test func capstoneHasNoHeartsRemedialsRevealsOrMasteryFlashes() throws {
        let gaps = (1...3).map { gap("g\($0)", reviewCount: 3, consecutiveCorrect: 1) }
        let l = lesson(gaps, mode: .capstone)
        var s = session(for: l, isCapstone: true, config: config(masteryTarget: 1))
        #expect(!s.hasHearts && s.hearts == nil)
        #expect(s.schedule.count == gaps.count, "one question per gap")
        #expect(s.conceptWeight == Tuning.capstoneWeight)
        let reveal = s.reveal()
        #expect(!s.canReveal && reveal == nil)

        let miss = try answerWrongly(&s)
        #expect(!miss.heartLost && !miss.endedByHearts && !miss.remedialQueued && miss.masteredWord == nil)
        #expect(s.schedule.count == gaps.count && s.end == nil)
        #expect(miss.evidence.first?.conceptWeight == Tuning.capstoneWeight)
        let advanced1 = s.advance()
        #expect(advanced1)

        let hit = try answerCorrectly(&s)
        #expect(hit.masteredWord == nil, "no mastery flash in a capstone")
        #expect(hit.evidence.first?.conceptWeight == Tuning.capstoneWeight)
        let advanced2 = s.advance()
        #expect(advanced2)
        _ = try answerCorrectly(&s)
        let advanced3 = s.advance()
        #expect(!advanced3 && s.end == .finished)

        let summary = s.summary
        #expect(summary.held.map { $0.id } == ["g2", "g3"] && summary.slipped.map { $0.id } == ["g1"])
        #expect(summary.masteredCount == 0)
        #expect(summary.scored == 3 && summary.scoredCorrect == 2)
    }

    // MARK: C6 — remedials

    @Test func remedialsAreSteppedDownSpacedAndCapped() throws {
        let gaps = (1...5).map { gap("g\($0)", reviewCount: 3, consecutiveCorrect: 1) }   // recall → fill-blank first
        var s = session(for: lesson(gaps), config: config(hearts: 20))
        let q = try #require(s.current)
        #expect(q.kind == .fillBlank && q.gap.id == "g1")
        let before = s.schedule.count
        let submitted = s.submit(.typed("nope"))
        let miss = try #require(submitted)
        #expect(miss.remedialQueued && s.schedule.count == before + 1)
        #expect(miss.evidence.first?.loggedAnswer == "nope", "a wrong typed answer is logged")
        let remedial = s.schedule[s.position + 1 + Tuning.remedialSpacing]
        #expect(remedial.isRemedial && remedial.gap.id == "g1" && remedial.kind == .multipleChoice && remedial.showsAnswer)

        // Keep missing g1 in every form: remedials stop at the cap, the lesson still finishes.
        while s.end == nil, s.advance(), let cur = s.current {
            if cur.kind == .match {
                _ = completeMatch(&s, cur)
            } else if cur.gap.id == "g1" {
                _ = s.submit(wrongAnswer(for: cur))
            } else {
                _ = s.submit(correctAnswer(for: cur))
            }
        }
        #expect(s.end == .finished)
        #expect(s.schedule.filter { $0.isRemedial && $0.gap.id == "g1" }.count == Tuning.maxRemedialsPerGap)
        #expect(s.summary.missed.map { $0.id } == ["g1"])
    }

    @Test func remedialNeverLandsBehindTheProbes() throws {
        var probe = gap("p", concept: "cp")
        probe.isProbe = true
        probe.probeOptions = ["a", "b", "c"]
        let l = lesson([gap("g1"), gap("g2"), probe], roles: ["p": .probe])
        var s = session(for: l, config: config(hearts: 20))
        #expect(s.schedule.last?.isProbe == true)
        while s.end == nil, let cur = s.current, !cur.isProbe {
            _ = s.submit(wrongAnswer(for: cur))
            #expect(s.schedule.last?.isProbe == true, "the probe stays last")
            #expect(s.schedule.filter { $0.isProbe }.count == 1)
            _ = s.advance()
        }
        #expect(s.current?.isProbe == true)
    }

    // MARK: C12 — "Show me"

    @Test func revealIsAMissWithoutHeartOrErrorLog() throws {
        var s = session(for: lesson((1...3).map { gap("g\($0)") }))
        let heartsBefore = s.hearts
        let q = try #require(s.current)
        #expect(s.canReveal)
        let revealed = s.reveal()
        let out = try #require(revealed)
        #expect(!out.correct && !out.firstTry && !out.heartLost && s.hearts == heartsBefore)
        let e = try #require(out.evidence.first)
        #expect(!e.correct && !e.firstTry && e.loggedAnswer == nil && e.format == q.answerFormat && e.gapId == q.gap.id)
        #expect(out.feedback?.tone == .revealed && out.feedback?.title.contains(q.correctAnswer) == true)
        #expect(out.remedialQueued, "a revealed item still gets its stepped-down retry")
        #expect(s.revealsLeft == Tuning.hintsPerLesson - 1)
        let again = s.reveal()
        #expect(again == nil, "already answered")
        #expect(s.summary.missed.first?.gap.id == q.gap.id)

        var used = 1
        while s.end == nil, s.advance(), s.canReveal {
            _ = s.reveal()
            used += 1
        }
        #expect(used == Tuning.hintsPerLesson && s.revealsLeft == 0 && !s.canReveal)
        #expect(s.hearts == heartsBefore, "reveals never cost hearts")
    }

    // MARK: C3 — accent slip

    @Test func accentSlipCountsAsAHardSuccess() throws {
        var cafe = gap("cafe", reviewCount: 6, consecutiveCorrect: Tuning.productionEvidenceFloor)
        cafe.frenchWord = "café"
        cafe.exampleSentence = "un café noir"
        var s = session(for: lesson([cafe, gap("g2"), gap("g3")]))
        let q = try #require(s.current)
        #expect(q.kind == .translation && q.gap.id == "cafe")
        let submitted = s.submit(.typed("cafe"))
        let out = try #require(submitted)
        #expect(out.correct && out.firstTry && out.xp > 0 && !out.heartLost)
        let e = try #require(out.evidence.first)
        #expect(e.correct && e.grade == .hard && e.loggedAnswer == nil)
        #expect(out.feedback?.tone == .close && out.feedback?.title.contains("accents") == true)
        #expect(out.feedback?.isCorrect == true)
        #expect(s.summary.scoredCorrect == 1 && s.summary.missed.isEmpty)
    }

    @Test func storeRecordsAGradedAnswerAtTheGivenGrade() {
        let hard = EngineFixtures.store(concepts: [], gaps: [gap("g", concept: nil)])
        hard.recordGradedAnswer(gapId: "g", grade: .hard, format: .translation, now: now)
        let easy = EngineFixtures.store(concepts: [], gaps: [gap("g", concept: nil)])
        easy.recordAnswer(gapId: "g", correct: true, format: .translation, firstTry: true, now: now)
        let h = hard.gaps[0], e = easy.gaps[0]
        #expect(h.reviewCount == 1 && h.consecutiveCorrect == 1, "a hard grade is still a success")
        #expect(h.nextReviewAt < e.nextReviewAt, "…but comes back sooner than an easy first try")
        let again = EngineFixtures.store(concepts: [], gaps: [gap("g", concept: nil, consecutiveCorrect: 2)])
        again.recordGradedAnswer(gapId: "g", grade: .again, format: .fillBlank, now: now)
        #expect(again.gaps[0].consecutiveCorrect == 0, ".again is a miss")
    }

    // MARK: B11 — in-session release

    @Test func releaseDropsRemainingTargetItemsAndBackfillsFromReview() throws {
        let streak = Tuning.conceptReleaseStreak
        let targets = (1...streak).map { gap("t\($0)", concept: "T") }
        let reviews = (1...2).map { gap("r\($0)", concept: "R") }
        var roles: [String: SelectedItemRole] = [:]
        for t in targets { roles[t.id] = .target }
        for r in reviews { roles[r.id] = .review }
        var s = session(for: lesson(targets + reviews, roles: roles, target: "T"))
        #expect(s.releaseStreak == streak && s.targetConceptId == "T")

        var released: String? = nil
        var targetAnswers = 0
        while s.end == nil, released == nil, let q = s.current {
            let out = try answerCorrectly(&s)
            if q.role == .target { targetAnswers += 1 }
            released = out.releasedConceptId
            if released == nil { _ = s.advance() }
        }
        #expect(released == "T" && targetAnswers == streak)
        let rest = s.schedule[(s.position + 1)...]
        #expect(!rest.contains { $0.role == .target && $0.conceptId == "T" && !$0.isInterstitial })
        #expect(rest.contains { $0.gap.conceptId == "R" && !$0.isInterstitial }, "backfilled from review")

        while s.end == nil, s.advance() { _ = try answerCorrectly(&s) }
        #expect(s.end == .finished && s.summary.releasedConceptIds == ["T"])
    }

    // MARK: Option grading keeps tags

    /// Options that differ only in their parenthetical tag are different answers:
    /// exactly one of "the (masculine singular)" / "the (feminine singular)" is right.
    @Test func taggedOptionsAreGradedApart() throws {
        var article = gap("le", concept: "definite-articles", category: .grammar)
        article.englishTranslation = "the (masculine singular)"
        let q = LessonQuestion(gap: article, kind: .multipleChoice,
                               prompt: "What does “le” mean?",
                               correctAnswer: article.englishTranslation,
                               options: ["the (masculine singular)", "the (feminine singular)", "the (plural)"])
        #expect(LessonSession.grade(.option("the (masculine singular)"), for: q).correct)
        #expect(!LessonSession.grade(.option("the (feminine singular)"), for: q).correct)
        #expect(!LessonSession.grade(.option("the (plural)"), for: q).correct)
        #expect(!LessonSession.grade(.option("the"), for: q).correct)

        var s = LessonSession(lesson: lesson([article]), isCapstone: false, config: config())
        s.start(with: [q])
        let submitted = s.submit(.option("the (feminine singular)"))
        let out = try #require(submitted)
        #expect(!out.correct && out.xp == 0 && out.heartLost)
        #expect(out.evidence.first?.loggedAnswer == "the (feminine singular)")
    }

    // MARK: Mastery is earned unaided

    /// A remedial shows the answer before the pick (C6), so it can never be the
    /// evidence that flashes "Mastered!".
    @Test func remedialCorrectDoesNotCountTowardMastery() throws {
        var s = session(for: lesson([gap("g1"), gap("g2")]), config: config(hearts: 20, masteryTarget: 2))
        let first = try #require(s.current)
        _ = try answerWrongly(&s)
        #expect(s.masteredGapIds.isEmpty)
        var remedialsAnswered = 0
        var flashes: [String] = []
        while s.advance() {
            let q = try #require(s.current)
            let out = try answerCorrectly(&s)
            if q.isRemedial { remedialsAnswered += 1 }
            if let word = out.masteredWord { flashes.append(word) }
        }
        #expect(remedialsAnswered > 0, "the miss queued a remedial")
        #expect(!s.masteredGapIds.contains(first.gap.id), "the missed word was handed its answer, not mastered")
        #expect(!flashes.contains(first.gap.frenchWord))
    }

    // MARK: C4 / B6 — match rounds

    /// Guessing down the right column must not stack lapses: one miss per left
    /// row per round, and a pair already tried does nothing at all.
    @Test func repeatedWrongPairsRecordOneMissPerRow() throws {
        let gaps = (1...4).map { gap("g\($0)") }
        var s = LessonSession(lesson: lesson(gaps), isCapstone: false, config: config(hearts: 20))
        s.start(with: [scheduler.matchQuestion(for: gaps)])

        let first = s.matchPair(left: "g1", right: "g2")
        let wrong = try #require(first)
        #expect(!wrong.correct && wrong.evidence.count == 1 && wrong.remedialQueued)
        let remedialsAfterFirst = s.schedule.filter { $0.isRemedial }.count

        let repeated = s.matchPair(left: "g1", right: "g2")
        #expect(repeated == nil, "the same pair again is not a new answer")

        let other = s.matchPair(left: "g1", right: "g3")
        let second = try #require(other)
        #expect(!second.correct, "still wrong, so the row still flashes")
        #expect(second.evidence.isEmpty, "one miss per left row per round")
        #expect(!second.remedialQueued && s.schedule.filter { $0.isRemedial }.count == remedialsAfterFirst)
        #expect(!second.heartLost && s.hearts == 19, "the round's one heart was already spent")

        var last: LessonAnswerOutcome? = nil
        for g in gaps { last = s.matchPair(left: g.id, right: g.id) }
        let done = try #require(last)
        #expect(done.roundComplete && !done.correct)
        #expect(s.summary.missed.map { $0.id } == ["g1"], "only g1 was missed, once")
    }

    @Test func matchRoundIsOneQuestionWithEvidencePerPair() throws {
        let gaps = (1...4).map { gap("g\($0)") }
        var s = LessonSession(lesson: lesson(gaps), isCapstone: false, config: config())
        s.start(with: [scheduler.matchQuestion(for: gaps)])

        let crossed = s.matchPair(left: "g1", right: "g2")
        let wrong = try #require(crossed)
        #expect(!wrong.correct && !wrong.roundComplete && wrong.heartLost && s.hearts == Tuning.lessonHearts - 1)
        let e = try #require(wrong.evidence.first)
        #expect(e.gapId == "g1" && !e.correct && e.format == .match && e.firstTry && e.loggedAnswer == "g2-en")
        #expect(wrong.remedialQueued && s.schedule.count == 2 && s.schedule[1].gap.id == "g1" && s.schedule[1].isRemedial)

        let crossedAgain = s.matchPair(left: "g2", right: "g3")
        let wrongAgain = try #require(crossedAgain)
        #expect(!wrongAgain.heartLost && s.hearts == Tuning.lessonHearts - 1, "one heart per round")
        let unknown = s.matchPair(left: "zz", right: "g1")
        #expect(unknown == nil, "unknown rows are ignored")

        let retried = s.matchPair(left: "g1", right: "g1")
        let retry = try #require(retried)
        #expect(retry.correct && !retry.roundComplete && retry.evidence.first?.firstTry == false)
        var last: LessonAnswerOutcome? = nil
        for id in ["g2", "g3", "g4"] { last = s.matchPair(left: id, right: id) }
        let done = try #require(last)
        #expect(done.roundComplete && !done.correct && done.xp == 0)
        #expect(done.feedback?.tone == .incorrect && done.feedback?.title.contains("g1-fr") == true)
        #expect(done.feedback?.detail?.contains("g4-fr — g4-en") == true)
        let afterRound = s.matchPair(left: "g1", right: "g1")
        #expect(afterRound == nil, "the round is over")
        #expect(s.summary.missed.map { $0.id } == ["g1", "g2"])
        #expect(s.summary.scored == 1 && s.summary.scoredCorrect == 0 && s.summary.answered == 1)
        let advanced = s.advance()
        #expect(advanced && s.current?.isRemedial == true)
    }

    @Test func cleanMatchRoundScoresOnce() throws {
        let gaps = (1...3).map { gap("g\($0)") }
        var s = LessonSession(lesson: lesson(gaps), isCapstone: false, config: config())
        s.start(with: [scheduler.matchQuestion(for: gaps)])
        let done = try answerCorrectly(&s)
        #expect(done.roundComplete && done.correct && done.xp == LessonScoring.xp(forCombo: 1))
        #expect(done.feedback?.tone == .correct)
        #expect(s.hearts == Tuning.lessonHearts && s.summary.scoredCorrect == 1 && s.summary.xp == done.xp)
        #expect(s.progress == 1)
    }

    @Test func outOfHeartsMidRoundEndsTheLesson() throws {
        let gaps = (1...3).map { gap("g\($0)") }
        var s = LessonSession(lesson: lesson(gaps), isCapstone: false, config: config(hearts: 1))
        s.start(with: [scheduler.matchQuestion(for: gaps)])
        let wrong = try answerWrongly(&s)
        #expect(wrong.endedByHearts && s.end == .outOfHearts && !wrong.remedialQueued)
        let late = s.matchPair(left: "g1", right: "g1")
        #expect(late == nil)
    }

    // MARK: firstTry, probes, roles

    @Test func firstTryFollowsEarlierMisses() throws {
        var s = session(for: lesson((1...3).map { gap("g\($0)") }), config: config(hearts: 20))
        let first = try #require(s.current)
        #expect(s.firstTry(for: first))
        _ = try answerWrongly(&s)
        var seenRemedial = false
        var seenRoundTwo = false
        while s.end == nil, s.advance(), let cur = s.current {
            if cur.kind == .match {
                _ = completeMatch(&s, cur)
                continue
            }
            let out = try answerCorrectly(&s)
            if cur.gap.id == first.gap.id {
                #expect(!s.firstTry(for: cur) && out.evidence.first?.firstTry == false)
                if cur.isRemedial { seenRemedial = true } else { seenRoundTwo = true }
            } else {
                #expect(out.evidence.first?.firstTry == true)
            }
        }
        #expect(seenRemedial && seenRoundTwo)
    }

    @Test func probeMissIsADiagnosisNotASlip() throws {
        var probe = gap("p", concept: "cp")
        probe.isProbe = true
        probe.probeOptions = ["a", "b", "c"]
        var s = session(for: lesson([gap("g1"), probe], roles: ["p": .probe]))
        while let cur = s.current, !cur.isProbe {
            _ = try answerCorrectly(&s)
            _ = s.advance()
        }
        let q = try #require(s.current)
        #expect(q.isProbe && q.answerFormat == .probe)
        let scoredBefore = s.summary.scored
        let out = try answerWrongly(&s)
        #expect(!out.heartLost && s.hearts == Tuning.lessonHearts && !out.remedialQueued)
        #expect(out.evidence.first?.format == .probe && out.evidence.first?.correct == false)
        #expect(out.evidence.first?.loggedAnswer == nil, "a probe miss is a diagnosis, not a mistake to log")
        #expect(!s.summary.missedGapIds.contains("p") && s.summary.scored == scoredBefore)
        let advanced = s.advance()
        #expect(!advanced && s.end == .finished)
    }

    @Test func checkInRoleFlowsIntoEvidence() throws {
        let checkIn = gap("c1", concept: "M", reviewCount: 4, consecutiveCorrect: 2)
        var s = session(for: lesson([checkIn, gap("g2")], roles: ["c1": .checkIn]))
        let q = try #require(s.current)
        #expect(q.gap.id == "c1" && q.isCheckIn)
        let out = try answerCorrectly(&s)
        #expect(out.evidence.first?.isCheckIn == true)
        let advanced = s.advance()
        #expect(advanced)
        let other = try answerCorrectly(&s)
        #expect(other.evidence.first?.isCheckIn == false)
    }

    // MARK: Cursor and scoring

    @Test func cleanRunFinishesWithFullAccuracyAndMastery() throws {
        let gaps = (1...3).map { gap("g\($0)") }
        var s = session(for: lesson(gaps))
        let total = s.schedule.count
        #expect(total == gaps.count * Tuning.masteryTarget + 1, "two rounds plus the match interstitial")
        var expectedXP = 0
        var mastered: [String] = []
        var n = 0
        repeat {
            let out = try answerCorrectly(&s)
            n += 1
            expectedXP += LessonScoring.xp(forCombo: n)
            #expect(out.xp == LessonScoring.xp(forCombo: n))
            if let word = out.masteredWord { mastered.append(word) }
        } while s.advance()
        #expect(s.end == .finished && s.progress == 1 && s.isLast)
        let summary = s.summary
        #expect(summary.answered == total && summary.scored == total && summary.scoredCorrect == total)
        #expect(summary.accuracy == 1 && summary.accuracyPercent == 100)
        #expect(summary.xp == expectedXP && summary.bestCombo == total)
        #expect(summary.masteredCount == gaps.count && Set(mastered) == Set(gaps.map { $0.frenchWord }))
        #expect(summary.missed.isEmpty && summary.held.isEmpty && summary.slipped.isEmpty)
    }

    @Test func progressTracksAnsweredQuestions() throws {
        var s = session(for: lesson([gap("g1"), gap("g2")]))
        let total = Double(s.schedule.count)
        #expect(s.progress == 0)
        _ = try answerCorrectly(&s)
        #expect(s.progress == 1 / total)
        let advanced = s.advance()
        #expect(advanced && s.progress == 1 / total)
        _ = try answerCorrectly(&s)
        #expect(s.progress == 2 / total)
    }

    @Test func bareGapListBecomesAScopedLesson() {
        let gaps = [gap("a"), gap("b")]
        let scoped = LessonSession.lesson(for: gaps, assembled: nil, isCapstone: false)
        #expect(scoped.isScoped && !scoped.isCapstone && scoped.gaps.count == 2)
        #expect(scoped.selection.items.map { $0.gapId } == ["a", "b"])
        let capstone = LessonSession.lesson(for: gaps, assembled: nil, isCapstone: true)
        #expect(capstone.isCapstone)
        let given = lesson(gaps)
        #expect(LessonSession.lesson(for: gaps, assembled: given, isCapstone: false).id == given.id)
    }

    // MARK: C14 — foreground time

    @Test func timerCountsForegroundTimeOnly() {
        var t = LessonTimer()
        #expect(t.elapsed(at: now) == 0 && !t.isStarted)
        t.resume(at: now)
        #expect(!t.isRunning, "resume before start is a no-op")
        t.start(at: now)
        t.pause(at: now.addingTimeInterval(90))
        t.pause(at: now.addingTimeInterval(400))
        t.resume(at: now.addingTimeInterval(600))
        #expect(t.elapsed(at: now.addingTimeInterval(630)) == 120)
        #expect(t.creditedMinutes(at: now.addingTimeInterval(630)) == 2)
        // Lesson time follows the activity rule (D9 / C-R3): nothing under the
        // threshold, rounded, capped — a tap-and-quit credits no minute.
        var short = LessonTimer()
        short.start(at: now)
        let threshold = Tuning.minActivitySeconds
        #expect(short.creditedMinutes(at: now.addingTimeInterval(threshold - 1)) == 0, "under the activity threshold nothing is credited")
        #expect(short.creditedMinutes(at: now.addingTimeInterval(threshold)) == 1, "at the threshold one minute")
        #expect(short.creditedMinutes(at: now.addingTimeInterval(89)) == 1 && short.creditedMinutes(at: now.addingTimeInterval(91)) == 2, "rounded, not floored")
        for seconds in [threshold, 45, 120, 600] {
            #expect(short.creditedMinutes(at: now.addingTimeInterval(seconds))
                    == ActivityCredit.minutes(activeSeconds: seconds, capMinutes: Tuning.lessonCreditCapMinutes), "same rule as activity credit")
        }
        let long = Double(Tuning.lessonCreditCapMinutes + 30) * 60
        #expect(short.creditedMinutes(at: now.addingTimeInterval(long)) == Tuning.lessonCreditCapMinutes, "capped")
        var untouched = LessonTimer()
        #expect(untouched.creditedMinutes(at: now.addingTimeInterval(3600)) == 0, "a timer never started credits nothing")
        untouched.pause(at: now)
        #expect(untouched.elapsed(at: now) == 0)
    }

    // MARK: C20 — speech

    @Test func speechNeverReadsTheAnswerBeforeItIsShown() throws {
        let g = gap("g1", reviewCount: 3, consecutiveCorrect: 1)
        var rng = LessonRandom(seed: 1)
        let fillQuestion = scheduler.question(for: g, kind: .fillBlank, pool: [g], optionCount: 3, rng: &rng)
        let fill = try #require(fillQuestion)
        let spoken = try #require(LessonSpeech.spokenPrompt(for: fill))
        #expect(!spoken.contains(AnswerGrader.blankToken) && !spoken.contains("g1-fr") && spoken.contains(LessonSpeech.blankPause))
        #expect(LessonSpeech.spokenAnswer(for: fill) == g.exampleSentence)

        let translationQuestion = scheduler.question(for: g, kind: .translation, pool: [g], optionCount: 3, rng: &rng)
        let translation = try #require(translationQuestion)
        #expect(LessonSpeech.spokenPrompt(for: translation) == nil, "the English side is never read in a French voice")
        #expect(LessonSpeech.spokenAnswer(for: translation) == "g1-fr")

        let pool = (1...4).map { gap("g\($0)") }
        let reversedQuestion = scheduler.question(for: pool[0], kind: .multipleChoice, variant: 1, pool: pool, optionCount: 3, rng: &rng)
        let reversed = try #require(reversedQuestion)
        #expect(reversed.isReversed)
        #expect(LessonSpeech.spokenPrompt(for: reversed) == nil && LessonSpeech.spokenAnswer(for: reversed) == "g1-fr")
        let forwardQuestion = scheduler.question(for: pool[0], kind: .multipleChoice, pool: pool, optionCount: 3, rng: &rng)
        let forward = try #require(forwardQuestion)
        #expect(LessonSpeech.spokenPrompt(for: forward) == "g1-fr")

        var long = g
        long.exampleSentence = "g1-fr a b c d"
        let arrangeQuestion = scheduler.question(for: long, kind: .arrange, pool: [long], optionCount: 3, rng: &rng)
        let arrange = try #require(arrangeQuestion)
        #expect(arrange.kind == .arrange && LessonSpeech.spokenPrompt(for: arrange) == nil)
        #expect(LessonSpeech.spokenAnswer(for: arrange) == "g1-fr a b c d")
        #expect(LessonSpeech.spokenPrompt(for: scheduler.matchQuestion(for: pool)) == nil)
    }

    // MARK: C10 — feedback

    @Test func feedbackListsAcceptedAlternatives() throws {
        var g = gap("g1", reviewCount: 6, consecutiveCorrect: Tuning.productionEvidenceFloor)
        g.acceptedAnswers = ["g1-alt"]
        var rng = LessonRandom(seed: 3)
        let question = scheduler.question(for: g, kind: .translation, pool: [g], optionCount: 3, rng: &rng)
        let q = try #require(question)
        let wrong = LessonSession.feedback(for: q, correct: false, verdict: .incorrect, revealed: false, combo: 0)
        #expect(wrong.tone == .incorrect && wrong.title == "Answer: g1-fr" && wrong.alternatives == ["g1-alt"])
        #expect(wrong.detail == q.explanation && wrong.speech == "g1-fr")
        let hot = LessonSession.feedback(for: q, correct: true, verdict: .correct, revealed: false, combo: Tuning.comboHighStreak)
        #expect(hot.tone == .correct && hot.title.contains("XP"))
        #expect(LessonSession.praise(combo: 1) == "Correct!")
    }
}
