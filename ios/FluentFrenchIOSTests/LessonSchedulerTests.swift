//
//  LessonSchedulerTests.swift
//  FluentFrenchIOSTests
//
//  Package C part 1 — the local question schedule (C18 progression, C19/B13
//  probes, B6 check-ins, C16 capstone, C6 remedials, B11 in-session release,
//  C27 distractors) and the AI merge rule (C7).
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct LessonSchedulerTests {
    private let now = EngineFixtures.now

    private var scheduler: LessonScheduler {
        var config = LessonSchedulerConfig.tuning
        config.seed = 7
        return LessonScheduler(config: config)
    }

    // MARK: Fixtures

    /// A synthetic testable gap with a blankable example ("<id>-fr example").
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

    private func smartLesson() throws -> AssembledLesson {
        let g = EngineFixtures.smallGraph()
        return try #require(LessonPipeline(store: g.store).lesson(for: .smart(now: now)))
    }

    private func questions(for gapId: String, in schedule: [LessonQuestion]) -> [LessonQuestion] {
        schedule.filter { $0.gap.id == gapId && !$0.isInterstitial }
    }

    // MARK: C18 — progression by the gap's own evidence

    @Test func levelFollowsTheGapsOwnEvidence() {
        let s = scheduler
        #expect(s.level(for: gap("new")) == .recognition)
        #expect(s.level(for: gap("streak-but-unreviewed", consecutiveCorrect: 4)) == .recognition, "no reviews → no evidence")
        #expect(s.level(for: gap("lapsed", reviewCount: 5, consecutiveCorrect: 0)) == .recognition, "a lapse resets to recognition")
        #expect(s.level(for: gap("some", reviewCount: 3, consecutiveCorrect: 1)) == .recall)
        #expect(s.level(for: gap("almost", reviewCount: 3, consecutiveCorrect: Tuning.productionEvidenceFloor - 1)) == .recall)
        #expect(s.level(for: gap("strong", reviewCount: 6, consecutiveCorrect: Tuning.productionEvidenceFloor)) == .production)
        var label = gap("rule", reviewCount: 9, consecutiveCorrect: 9)
        label.isTestable = false
        #expect(s.level(for: label) == .recognition && s.kinds(for: label) == [.multipleChoice], "rule labels are MC only")
    }

    @Test func kindsPerLevelRespectBlankableAndArrangeable() {
        let s = scheduler
        #expect(s.kinds(for: gap("new")) == [.multipleChoice, .multipleChoice])
        let recall = gap("recall", reviewCount: 2, consecutiveCorrect: 1)
        #expect(s.kinds(for: recall) == [.fillBlank, .trueFalse])
        var twice = recall
        twice.exampleSentence = "recall-fr et recall-fr"   // blank occurs twice → never fill-blank
        #expect(!LessonScheduler.isBlankable(twice))
        #expect(s.kinds(for: twice) == [.trueFalse, .multipleChoice])
        var production = gap("prod", reviewCount: 6, consecutiveCorrect: 4)
        production.exampleSentence = "prod-fr a b c d"   // 5 tokens → arrangeable
        #expect(s.isArrangeable(production))
        #expect(s.kinds(for: production) == [.translation, .arrange])
        production.exampleSentence = "prod-fr ici"        // 2 tokens → not arrangeable, still blankable
        #expect(s.kinds(for: production) == [.translation, .fillBlank])
        production.exampleSentence = "prod-fr prod-fr"    // neither
        #expect(s.kinds(for: production) == [.translation, .multipleChoice])
    }

    @Test func fillBlankIsNeverAskedWhenTheBlankIsAmbiguous() {
        var g = gap("dup", reviewCount: 2, consecutiveCorrect: 1)
        g.exampleSentence = "dup-fr dup-fr"
        let others = (0..<4).map { gap("o\($0)", reviewCount: 2, consecutiveCorrect: 1) }
        let schedule = scheduler.build(for: lesson([g] + others), abilityOptionCount: 4)
        #expect(!questions(for: "dup", in: schedule).contains { $0.kind == .fillBlank })
        #expect(questions(for: "o0", in: schedule).contains { $0.kind == .fillBlank }, "blankable siblings still get fill-blank")
        for q in schedule where q.kind == .fillBlank {
            #expect(q.prompt.contains(AnswerGrader.blankToken))
            #expect(q.correctAnswer == AnswerGrader.blankForm(for: q.gap))
        }
    }

    /// A learner-captured phrase (example == headword, empty translation) with
    /// some evidence sits at recall but is never asked as fill-blank — neither in
    /// the round schedule nor as a stepped-down remedial.
    @Test func capturedPhraseWhoseExampleIsThePhraseIsNeverFillBlank() throws {
        var phrase = gap("phrase", reviewCount: 2, consecutiveCorrect: 1, category: .phrasing)
        phrase.exampleSentence = phrase.frenchWord
        phrase.exampleTranslation = ""
        let others = (0..<4).map { gap("o\($0)", reviewCount: 2, consecutiveCorrect: 1) }
        #expect(scheduler.level(for: phrase) == .recall)
        #expect(!LessonScheduler.isBlankable(phrase))
        #expect(scheduler.kinds(for: phrase) == [.trueFalse, .multipleChoice])

        let schedule = scheduler.build(for: lesson([phrase] + others), abilityOptionCount: 4)
        let qs = questions(for: "phrase", in: schedule)
        #expect(qs.count == Tuning.masteryTarget)
        #expect(!qs.contains { $0.kind == .fillBlank })
        #expect(qs.allSatisfy { $0.kind == .trueFalse || $0.kind == .multipleChoice })
        for q in schedule {
            #expect(q.prompt.trimmingCharacters(in: .whitespacesAndNewlines) != AnswerGrader.blankToken, "a prompt is never only the blank")
        }

        // The C6 step-down from a production format lands on multiple choice, not an empty blank.
        var strong = phrase
        strong.consecutiveCorrect = Tuning.productionEvidenceFloor
        strong.reviewCount = Tuning.productionEvidenceFloor
        var rng = LessonRandom(seed: 3)
        let translation = try #require(scheduler.question(for: strong, kind: .translation, pool: [strong] + others, optionCount: 4, rng: &rng))
        let stepped = try #require(scheduler.remedial(for: translation, attempt: 1, pool: [strong] + others))
        #expect(stepped.kind == .multipleChoice && stepped.isRemedial)
        let asked = try #require(scheduler.question(for: strong, kind: .fillBlank, pool: [strong] + others, optionCount: 4, rng: &rng))
        #expect(asked.kind == .multipleChoice, "a direct fill-blank request falls back to multiple choice")
    }

    // MARK: Build — roles, mastery target, interstitial, probe, check-in

    @Test func smartLessonScheduleFollowsRoles() throws {
        let lesson = try smartLesson()
        let roles = LessonScheduler.roles(in: lesson)
        let schedule = scheduler.build(for: lesson, abilityOptionCount: 4)

        let probeGap = try #require(lesson.gaps.first { $0.isProbe })
        let probeQs = questions(for: probeGap.id, in: schedule)
        #expect(probeQs.count == 1, "a probe is exactly one question")
        let probe = try #require(probeQs.first)
        #expect(probe.isProbe && probe.kind == .multipleChoice && probe.role == .probe && probe.answerFormat == .probe)
        #expect(Set(probe.options) == Set((probeGap.probeOptions ?? []) + [probeGap.englishTranslation]), "content distractors + answer, nothing else")
        #expect(schedule.last?.id == probe.id, "probe last")
        #expect(!probe.isReversed && !probe.showsAnswer)

        let checkInGaps = lesson.gaps.filter { roles[$0.id] == .checkIn }
        #expect(!checkInGaps.isEmpty, "the fixture's mastered concept supplies a check-in")
        for g in checkInGaps {
            let qs = questions(for: g.id, in: schedule)
            #expect(qs.count == 1, "a check-in is one question")
            #expect(qs.first?.level == .recall && qs.first?.isCheckIn == true)
        }

        for g in lesson.gaps where !g.isProbe && roles[g.id] != .checkIn {
            let qs = questions(for: g.id, in: schedule)
            #expect(qs.count == Tuning.masteryTarget, "\(g.id): masteryTarget questions per ordinary gap")
            #expect(qs.allSatisfy { $0.role == roles[g.id] && !$0.isProbe && !$0.isCapstone })
            // Every fixture gap is unreviewed → recognition: MC forward, then MC reversed.
            #expect(qs.map { $0.kind } == [.multipleChoice, .multipleChoice])
            #expect(qs[0].isReversed == false && qs[1].isReversed == true)
            #expect(qs[0].options.count == 4 && qs[0].options.contains(g.englishTranslation))
            #expect(qs[1].options.count == 4 && qs[1].options.contains(g.frenchWord) && qs[1].correctAnswer == g.frenchWord)
        }

        let matches = schedule.filter { $0.isInterstitial }
        #expect(matches.count == 1, "one match interstitial")
        let match = try #require(matches.first)
        #expect(match.matchGaps.count == Tuning.matchGroupSize)
        #expect(match.matchGaps.allSatisfy { !$0.isProbe })
        #expect(Set(match.matchGaps.map { $0.englishTranslation }).count == match.matchGaps.count, "distinct English")
        let firstRoundCount = lesson.gaps.filter { !$0.isProbe }.count
        #expect(schedule.firstIndex { $0.isInterstitial } == firstRoundCount, "between the first and second round")
    }

    @Test func probeUsesContentOptionsOrIsDropped() {
        var probe = gap("p", concept: "probe-me")
        probe.isProbe = true
        probe.probeOptions = ["d1", "d2", "d3"]
        let filler = (0..<3).map { gap("f\($0)") }
        let l = lesson([probe] + filler, roles: ["p": .probe])
        let schedule = scheduler.build(for: l, abilityOptionCount: 6)
        let qs = questions(for: "p", in: schedule)
        #expect(qs.count == 1 && qs[0].options.count == 4, "never padded from smartDistractors, whatever the ability count")
        #expect(Set(qs[0].options) == ["d1", "d2", "d3", "p-en"])

        probe.probeOptions = []
        let dropped = scheduler.build(for: lesson([probe] + filler, roles: ["p": .probe]), abilityOptionCount: 4)
        #expect(questions(for: "p", in: dropped).isEmpty, "no distractors → no question, nothing substituted")
        #expect(!dropped.contains { $0.matchGaps.contains { $0.id == "p" } }, "probes never sit in a match")
    }

    @Test func matchInterstitialNeedsThreeDistinctEnglish() {
        let two = scheduler.build(for: lesson([gap("a"), gap("b")]), abilityOptionCount: 4)
        #expect(!two.contains { $0.isInterstitial })

        var dup = gap("c")
        dup.englishTranslation = "a-en"   // same English as "a"
        let three = scheduler.build(for: lesson([gap("a"), gap("b"), dup]), abilityOptionCount: 4)
        #expect(!three.contains { $0.isInterstitial }, "only two distinct meanings")

        let ok = scheduler.build(for: lesson([gap("a"), gap("b"), gap("c")]), abilityOptionCount: 4)
        #expect(ok.filter { $0.isInterstitial }.count == 1)
        #expect(ok.first { $0.isInterstitial }?.matchGaps.count == 3)
    }

    @Test func nonTestableGapsOnlyGetMultipleChoice() {
        var label = gap("label", reviewCount: 9, consecutiveCorrect: 9)
        label.isTestable = false
        let schedule = scheduler.build(for: lesson([label] + (0..<3).map { gap("x\($0)") }), abilityOptionCount: 4)
        let qs = questions(for: "label", in: schedule)
        #expect(qs.count == Tuning.masteryTarget)
        #expect(qs.allSatisfy { $0.kind == .multipleChoice && !$0.isReversed })
    }

    @Test func reversedMultipleChoiceNeedsFrenchDistractors() {
        // A lone gap cannot be asked in reverse: no French to borrow, none invented.
        let alone = scheduler.build(for: lesson([gap("solo")]), abilityOptionCount: 4)
        let qs = questions(for: "solo", in: alone)
        #expect(qs.count == 2 && qs.allSatisfy { $0.kind == .multipleChoice && !$0.isReversed })
        #expect(qs.allSatisfy { $0.options.count == 4 && $0.options.contains("solo-en") }, "English fallbacks pad the forward question")
        for q in qs { #expect(q.options.allSatisfy { LessonScheduler.fallbackDistractors.contains($0) || $0 == "solo-en" }) }
    }

    @Test func optionCountIsFlooredAndCorrectAnswerIsAlwaysPresent() {
        let schedule = scheduler.build(for: lesson((0..<5).map { gap("g\($0)") }), abilityOptionCount: 1)
        for q in schedule where q.kind == .multipleChoice {
            #expect(q.options.count == Tuning.minMultipleChoiceOptions)
            #expect(q.options.contains(q.correctAnswer))
            #expect(Set(q.options).count == q.options.count, "no duplicate options")
        }
    }

    // MARK: C16 — capstone

    @Test func capstoneIsOneRecallQuestionPerGapWithNoInterstitialOrRemedial() {
        var gaps = (0..<6).map { gap("k\($0)", reviewCount: 3, consecutiveCorrect: 1) }
        gaps[5].isTestable = false
        // A materialised probe gap that survived selection (C-R4): never asked in a capstone.
        var probe = gap("probe", concept: "probe-me")
        probe.isProbe = true
        probe.probeOptions = ["d1", "d2", "d3"]
        var roleProbe = gap("role-probe", reviewCount: 3, consecutiveCorrect: 1)
        roleProbe.probeOptions = ["d1", "d2", "d3"]
        let l = lesson(gaps + [probe, roleProbe], roles: ["role-probe": .probe], mode: .capstone)
        let schedule = scheduler.build(for: l, abilityOptionCount: 4)
        #expect(schedule.count == gaps.count)
        #expect(!schedule.contains { $0.isInterstitial })
        #expect(!schedule.contains { $0.isProbe || $0.gap.isProbe || $0.role == .probe }, "no blind-spot check inside a capstone")
        #expect(questions(for: "probe", in: schedule).isEmpty && questions(for: "role-probe", in: schedule).isEmpty)
        #expect(schedule.allSatisfy { $0.isCapstone }, "every capstone question is scored into the tally")
        for g in gaps {
            let qs = questions(for: g.id, in: schedule)
            #expect(qs.count == 1)
            let q = qs[0]
            #expect(q.isCapstone && q.hint == nil)
            #expect(g.isTestable ? q.level == .recall : q.kind == .multipleChoice)
            #expect(scheduler.remedial(for: q, attempt: 1) == nil, "capstones never remediate")
        }
        // Capstone ignores AI questions entirely.
        let ai = [LessonQuestion(gap: gaps[0], kind: .multipleChoice, prompt: "?", correctAnswer: "k0-en", options: ["k0-en", "b", "c"]),
                  LessonQuestion(gap: gaps[0], kind: .multipleChoice, prompt: "?", correctAnswer: "k0-en", options: ["k0-en", "b", "c"])]
        let merged = scheduler.schedule(for: l, abilityOptionCount: 4, ai: ai)
        #expect(merged.allSatisfy { $0.source == .local && $0.isCapstone })
    }

    // MARK: C6 — remedials step down and stop

    @Test func remedialsStepDownShowTheAnswerOnceAndStopAtTheCap() throws {
        let g = gap("r", reviewCount: 6, consecutiveCorrect: 4)
        let pool = [g] + (0..<4).map { gap("p\($0)") }
        var rng = LessonRandom(seed: 1)
        let fill = try #require(scheduler.question(for: g, kind: .fillBlank, pool: pool, optionCount: 5, rng: &rng))

        let first = try #require(scheduler.remedial(for: fill, attempt: 1, pool: pool))
        #expect(first.kind == .multipleChoice && first.isRemedial && first.showsAnswer)
        #expect(first.options.count == Tuning.minMultipleChoiceOptions && first.options.contains("r-en"))
        #expect(first.gap.id == g.id && first.role == fill.role)

        let second = try #require(scheduler.remedial(for: first, attempt: 2, pool: pool))
        #expect(second.kind == .multipleChoice && second.isRemedial && !second.showsAnswer, "the answer is shown once")
        #expect(scheduler.remedial(for: second, attempt: Tuning.maxRemedialsPerGap + 1, pool: pool) == nil)
        #expect(scheduler.remedial(for: fill, attempt: 0, pool: pool) == nil)

        let translation = try #require(scheduler.question(for: g, kind: .translation, pool: pool, optionCount: 4, rng: &rng))
        let stepped = try #require(scheduler.remedial(for: translation, attempt: 1, pool: pool))
        #expect(stepped.kind == .fillBlank && !stepped.showsAnswer, "translation → fill-blank when blankable")

        var unblankable = g
        unblankable.exampleSentence = "r-fr r-fr"
        let t2 = try #require(scheduler.question(for: unblankable, kind: .translation, pool: pool, optionCount: 4, rng: &rng))
        let s2 = try #require(scheduler.remedial(for: t2, attempt: 1, pool: pool))
        #expect(s2.kind == .multipleChoice && s2.showsAnswer, "translation → MC when not blankable")

        let arrange = try #require(scheduler.question(for: g, kind: .arrange, pool: pool, optionCount: 4, rng: &rng))
        #expect(arrange.kind == .fillBlank, "a two-token sentence cannot be arranged: falls back to the blank")

        var probe = gap("probe")
        probe.isProbe = true
        probe.probeOptions = ["a", "b", "c"]
        let pq = try #require(scheduler.probeQuestion(for: probe, rng: &rng))
        #expect(scheduler.remedial(for: pq, attempt: 1, pool: pool) == nil, "probes are never remediated")
    }

    // MARK: B11 — in-session release

    @Test func releasingTheTargetDropsItsRemainingQuestionsAndBackfillsFromReview() throws {
        let lesson = try smartLesson()
        let target = try #require(lesson.targetConcept?.id)
        let schedule = scheduler.build(for: lesson, abilityOptionCount: 4)
        let position = 1
        let released = scheduler.releaseTargetConcept(conceptId: target, from: schedule, after: position)

        #expect(released.prefix(position + 1).map { $0.id } == schedule.prefix(position + 1).map { $0.id }, "answered questions stay")
        let remaining = released.dropFirst(position + 1)
        #expect(!remaining.contains { $0.role == .target && $0.conceptId == target && !$0.isInterstitial })
        #expect(remaining.contains { $0.isInterstitial }, "the interstitial stays")
        #expect(remaining.contains { $0.isProbe }, "the probe stays")
        #expect(released.count == schedule.count, "every dropped question is backfilled from review")
        let dropped = schedule.dropFirst(position + 1).filter { $0.role == .target && $0.conceptId == target && !$0.isInterstitial }.count
        let originalIds = Set(schedule.map { $0.id })
        let backfill = remaining.filter { !originalIds.contains($0.id) }
        #expect(backfill.count == dropped)
        #expect(backfill.allSatisfy { q in q.role == .review && q.conceptId != target })

        #expect(scheduler.releaseTargetConcept(conceptId: target, from: schedule, after: schedule.count - 1).map { $0.id } == schedule.map { $0.id })
        #expect(scheduler.releaseTargetConcept(conceptId: "unknown", from: schedule, after: 0).map { $0.id } == schedule.map { $0.id })
    }

    @Test func releaseWithoutReviewGapsOnlyDrops() {
        let gaps = (0..<3).map { gap("t\($0)", concept: "c") }
        let l = lesson(gaps, roles: Dictionary(uniqueKeysWithValues: gaps.map { ($0.id, SelectedItemRole.target) }), target: "c")
        let schedule = scheduler.build(for: l, abilityOptionCount: 4)
        let released = scheduler.releaseTargetConcept(conceptId: "c", from: schedule, after: 0)
        #expect(released.count == 1 + schedule.filter { $0.isInterstitial }.count)
    }

    @Test func releaseTrackerFiresOnceAtTheStreak() {
        var tracker = ConceptReleaseTracker()
        let n = Tuning.conceptReleaseStreak
        #expect(tracker.record(conceptId: nil, firstTryCorrect: true, releaseStreak: n) == nil)
        for _ in 0..<(n - 1) { #expect(tracker.record(conceptId: "c", firstTryCorrect: true, releaseStreak: n) == nil) }
        #expect(tracker.record(conceptId: "c", firstTryCorrect: false, releaseStreak: n) == nil, "a miss resets")
        for _ in 0..<(n - 1) { #expect(tracker.record(conceptId: "c", firstTryCorrect: true, releaseStreak: n) == nil) }
        #expect(tracker.record(conceptId: "c", firstTryCorrect: true, releaseStreak: n) == "c")
        #expect(tracker.record(conceptId: "c", firstTryCorrect: true, releaseStreak: n) == nil, "never twice")
        #expect(tracker.released == ["c"])
    }

    // MARK: C27 — distractors reject near-duplicates

    @Test func smartDistractorsRejectNearDuplicates() {
        var answer = gap("ans", category: .grammar)
        answer.englishTranslation = "the (masculine singular)"
        var fem = gap("fem", category: .grammar); fem.englishTranslation = "the (feminine singular)"
        var dupCase = gap("dup", category: .grammar); dupCase.englishTranslation = "The (Masculine Singular)"
        var accent = gap("acc", category: .grammar); accent.englishTranslation = "thé (masculine singular)"
        var pair = gap("pair", category: .vocabulary); pair.englishTranslation = "house / home"
        var home = gap("home", category: .vocabulary); home.englishTranslation = "home"
        let pool = [answer, fem, dupCase, accent, pair, home]
        var rng = LessonRandom(seed: 3)
        let picked = LessonScheduler.smartDistractors(for: answer, from: pool, count: 5, rng: &rng)
        #expect(picked.count == 5)
        #expect(picked.contains("the (feminine singular)"), "a different tag is a real distractor")
        #expect(!picked.contains("The (Masculine Singular)") && !picked.contains("thé (masculine singular)"), "case / accent duplicates of the answer")
        #expect(picked.filter { $0 == "house / home" || $0 == "home" }.count == 1, "glosses sharing a side never both appear")
        #expect(Set(picked.map { AnswerGrader.fold($0) }).count == picked.count)
        #expect(LessonScheduler.distractorSides(of: "to the / at the (masculine)") == ["to the", "at the (masculine)"])
    }

    // MARK: C7 — merging AI questions

    @Test func aiQuestionsReplaceLocalOnlyWithFullPerGapCoverage() throws {
        let gaps = [gap("full"), gap("partial"), gap("over", reviewCount: 2, consecutiveCorrect: 1), gap("plain")]
        var probe = gap("probe"); probe.isProbe = true; probe.probeOptions = ["a", "b", "c"]
        let check = gap("check", reviewCount: 4, consecutiveCorrect: 2)
        let l = lesson(gaps + [check, probe], roles: ["full": .target, "partial": .target, "check": .checkIn, "probe": .probe])

        func mc(_ g: GapItem, _ tag: String) -> LessonQuestion {
            LessonQuestion(gap: g, kind: .multipleChoice, prompt: "ai \(tag)", correctAnswer: g.englishTranslation,
                           options: [g.englishTranslation, "b", "c"])
        }
        let ai: [LessonQuestion] = [
            mc(gaps[0], "1"), mc(gaps[0], "2"), mc(gaps[0], "3"),        // full coverage
            mc(gaps[1], "1"),                                            // partial → local kept
            mc(gaps[2], "1"),                                            // one MC plus…
            LessonQuestion(gap: gaps[2], kind: .translation, prompt: "Translate to French:", correctAnswer: gaps[2].frenchWord),  // …above its level → filtered
            mc(check, "1"), mc(check, "2"), mc(probe, "1"), mc(probe, "2"),   // never merged
        ]
        let merged = scheduler.schedule(for: l, abilityOptionCount: 4, ai: ai)
        let local = scheduler.build(for: l, abilityOptionCount: 4)
        #expect(merged.count == local.count, "the merge keeps the schedule's shape")

        let full = questions(for: "full", in: merged)
        #expect(full.count == Tuning.masteryTarget && full.allSatisfy { $0.source == .ai && $0.role == .target })
        #expect(full.map { $0.prompt } == ["ai 1", "ai 2"], "the first masteryTarget usable questions, in the schedule's slots")
        #expect(questions(for: "partial", in: merged).allSatisfy { $0.source == .local })
        #expect(questions(for: "over", in: merged).allSatisfy { $0.source == .local }, "one usable question is partial")
        #expect(questions(for: "plain", in: merged).allSatisfy { $0.source == .local })
        #expect(questions(for: "check", in: merged).allSatisfy { $0.source == .local } && questions(for: "check", in: merged).count == 1)
        #expect(questions(for: "probe", in: merged).allSatisfy { $0.source == .local && $0.isProbe })
        #expect(merged.filter { $0.isInterstitial }.count == 1)
    }

    @Test func allowedAIKindsFollowTheLevel() {
        let s = scheduler
        #expect(s.allowedAIKinds(for: gap("new")) == [.multipleChoice])
        #expect(s.allowedAIKinds(for: gap("recall", reviewCount: 2, consecutiveCorrect: 1)) == [.multipleChoice, .trueFalse, .fillBlank])
        #expect(s.allowedAIKinds(for: gap("prod", reviewCount: 6, consecutiveCorrect: 5)) == [.multipleChoice, .trueFalse, .fillBlank, .translation])
        var label = gap("label", reviewCount: 6, consecutiveCorrect: 5); label.isTestable = false
        #expect(s.allowedAIKinds(for: label) == [.multipleChoice])
        var probe = gap("probe"); probe.isProbe = true
        #expect(s.allowedAIKinds(for: probe).isEmpty)
    }

    // MARK: C9 — cache signature

    @Test func formatSignatureIsOrderIndependentAndEvidenceSensitive() {
        let a = gap("a"), b = gap("b", reviewCount: 2, consecutiveCorrect: 1)
        let s = scheduler
        #expect(s.formatSignature(for: lesson([a, b]), abilityOptionCount: 4) == s.formatSignature(for: lesson([b, a]), abilityOptionCount: 4))
        var bStrong = b
        bStrong.consecutiveCorrect = Tuning.productionEvidenceFloor
        #expect(s.formatSignature(for: lesson([a, b]), abilityOptionCount: 4) != s.formatSignature(for: lesson([a, bStrong]), abilityOptionCount: 4))
        #expect(s.formatSignature(for: lesson([a, b]), abilityOptionCount: 4) != s.formatSignature(for: lesson([a, b]), abilityOptionCount: 5))
        #expect(s.formatSignature(for: lesson([a, b]), abilityOptionCount: 1) == s.formatSignature(for: lesson([a, b]), abilityOptionCount: Tuning.minMultipleChoiceOptions), "floored")
        #expect(s.formatSignature(for: lesson([a, b]), abilityOptionCount: 4) != s.formatSignature(for: lesson([a, b], mode: .capstone), abilityOptionCount: 4))
    }

    // MARK: Seeded determinism, explanations, scoring

    @Test func seededBuildsAreReproducible() throws {
        let lesson = try smartLesson()
        let one = scheduler.build(for: lesson, abilityOptionCount: 4)
        let two = scheduler.build(for: lesson, abilityOptionCount: 4)
        #expect(one.map { $0.kind } == two.map { $0.kind })
        #expect(one.map { $0.options } == two.map { $0.options })
        #expect(one.map { $0.statement } == two.map { $0.statement })
    }

    @Test func questionsCarryHonestExplanations() throws {
        var g = gap("e", reviewCount: 6, consecutiveCorrect: 4)
        g.exampleSentence = "e-fr est ici pour toi"
        g.exampleTranslation = "e-en is here for you"
        g.explanation = "note"
        let pool = [g] + (0..<3).map { gap("q\($0)") }
        var rng = LessonRandom(seed: 5)
        let fill = try #require(scheduler.question(for: g, kind: .fillBlank, pool: pool, optionCount: 4, rng: &rng))
        #expect(fill.prompt == "_____ est ici pour toi" && fill.hint == "e-en is here for you")
        #expect(fill.explanation == "e-fr est ici pour toi — e-en is here for you\nnote")
        let tf = try #require(scheduler.question(for: g, kind: .trueFalse, pool: pool, optionCount: 4, rng: &rng))
        #expect(tf.explanation == "“e-fr” means “e-en”.\nnote")
        #expect(tf.statement.hasPrefix("“e-fr” means “"))
        #expect(tf.correctAnswer == (tf.statement.contains("“e-en”") ? "True" : "False"))
        let tr = try #require(scheduler.question(for: g, kind: .translation, pool: pool, optionCount: 4, rng: &rng))
        #expect(tr.hint == nil, "no misleading 'mind the accents' hint")
        #expect(tr.statement == "e-en" && tr.correctAnswer == "e-fr")
        let ar = try #require(scheduler.question(for: g, kind: .arrange, pool: pool, optionCount: 4, rng: &rng))
        #expect(ar.kind == .arrange && ar.correctOrder == ["e-fr", "est", "ici", "pour", "toi"])
        #expect(Set(ar.tokens) == Set(ar.correctOrder) && ar.tokens != ar.correctOrder)
        #expect(ar.explanation == "e-fr est ici pour toi — e-en is here for you")
    }

    @Test func comboScoringReadsTuning() {
        #expect(LessonScoring.xp(forCombo: 1) == Tuning.xpPerCorrect)
        #expect(LessonScoring.xp(forCombo: Tuning.comboMidStreak) == Int((Double(Tuning.xpPerCorrect) * Tuning.comboMidMultiplier).rounded()))
        #expect(LessonScoring.xp(forCombo: Tuning.comboHighStreak) == Int((Double(Tuning.xpPerCorrect) * Tuning.comboHighMultiplier).rounded()))
        #expect(LessonScoring.comboMultiplier(0) == 1)
    }
}
