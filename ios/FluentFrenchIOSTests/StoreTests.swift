//
//  StoreTests.swift
//  FluentFrenchIOSTests
//
//  Package A — store & data safety: honest empty state, tolerant decoding,
//  corrupt-blob preservation, complete resets, calendar-correct streaks,
//  concept-grouped error patterns, the capture factory, the plan of record,
//  XP / personal bests, coalesced persistence and probe exclusion.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

/// A throwaway UserDefaults suite that is wiped when the test ends.
nonisolated final class ScratchDefaults {
    let name: String
    let defaults: UserDefaults

    init() {
        name = "ff.tests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
    }

    deinit {
        defaults.removePersistentDomain(forName: name)
    }
}

@MainActor
struct StoreTests {
    private let now = EngineFixtures.now
    private let day = EngineFixtures.day

    private func encoder() -> JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }

    private func decoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    // MARK: A1 / A3 — fresh install and empty-array authority

    @Test func freshStoreIsHonestlyEmpty() {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        #expect(store.gaps.isEmpty, "no sample gaps on a fresh install")
        #expect(store.errors.isEmpty, "no sample errors on a fresh install")
        #expect(store.masteryDays.isEmpty, "no fake streak on a fresh install")
        #expect(store.currentStreak == 0)
        #expect(store.longestStreak == 0)
        #expect(store.xp == 0)
        #expect(store.personalBests.isEmpty)
        #expect(store.hasCompletedAssessment == false)
        #expect(store.preferences == nil)
        #expect(store.loadError == nil)
        #expect(store.concepts.count == ConceptTaxonomy.seed().count)
    }

    @Test func emptyPersistedArraysAreAuthoritative() {
        let scratch = ScratchDefaults()
        let first = AppStore(persistence: scratch.defaults)
        first.gaps = [EngineFixtures.gap("keep", concept: nil)]
        first.errors = [ErrorRecord(id: "e", gapId: "keep", category: .grammar, frenchWord: "x", userAnswer: "a",
                                    correctAnswer: "b", conceptLabel: "L", occurredAt: now)]
        first.save()
        first.flush()
        #expect(AppStore(persistence: scratch.defaults).gaps.count == 1)

        first.gaps = []
        first.errors = []
        first.save()
        first.flush()

        let reloaded = AppStore(persistence: scratch.defaults)
        #expect(reloaded.gaps.isEmpty, "an empty gap list the learner produced stays empty")
        #expect(reloaded.errors.isEmpty)
        #expect(reloaded.loadError == nil)
    }

    // MARK: A2 — tolerant decoding and corrupt-blob preservation

    @Test func oneBadElementIsDroppedNotTheWholeArray() throws {
        let scratch = ScratchDefaults()
        let good = EngineFixtures.gap("good", concept: nil)
        let goodJSON = try JSONSerialization.jsonObject(with: encoder().encode(good))
        let mixed: [Any] = [goodJSON, ["id": 42, "frenchWord": ["not", "a", "string"]]]
        scratch.defaults.set(try JSONSerialization.data(withJSONObject: mixed), forKey: "ff.gaps.v1")

        let store = AppStore(persistence: scratch.defaults)
        #expect(store.gaps.map { $0.id } == ["good"])
        #expect(store.loadError == nil)
    }

    @Test func unreadableBlobIsPreservedAndWritesRefusedUntilAcknowledged() {
        let scratch = ScratchDefaults()
        let garbage = Data("this is not json".utf8)
        scratch.defaults.set(garbage, forKey: "ff.gaps.v1")

        let store = AppStore(persistence: scratch.defaults)
        #expect(store.loadError == .corruptGaps)
        #expect(store.loadError?.message.isEmpty == false)
        #expect(store.canPushToCloud == false)
        #expect(store.gaps.isEmpty)
        #expect(store.corruptBlob(for: .corruptGaps) == garbage)

        store.gaps = [EngineFixtures.gap("new", concept: nil)]
        store.save()
        store.flush()
        #expect(scratch.defaults.data(forKey: "ff.gaps.v1") == garbage, "a failed load never overwrites the blob")
        #expect(store.hasPendingWrite, "the write stays pending, not lost")

        store.acknowledgeLoadError(discard: true)
        #expect(store.loadError == nil)
        store.flush()
        #expect(scratch.defaults.data(forKey: "ff.gaps.v1.corrupt") == nil, "discard removes the preserved copy")
        #expect(AppStore(persistence: scratch.defaults).gaps.map { $0.id } == ["new"])
    }

    @Test func keepingTheCorruptBlobSurvivesLaterWrites() {
        let scratch = ScratchDefaults()
        let garbage = Data("{{{{".utf8)
        scratch.defaults.set(garbage, forKey: "ff.errors.v1")
        let store = AppStore(persistence: scratch.defaults)
        #expect(store.loadError == .corruptErrors)
        store.acknowledgeLoadError(discard: false)
        store.recordError(gap: EngineFixtures.gap("g", concept: nil), userAnswer: "a", correctAnswer: "b", now: now)
        store.flush()
        #expect(scratch.defaults.data(forKey: "ff.errors.v1.corrupt") == garbage)
        #expect(AppStore(persistence: scratch.defaults).errors.count == 1)
    }

    @Test func oldGapJSONWithoutNewKeysDecodesWithDefaults() throws {
        var gap = EngineFixtures.gap("old", concept: "c")
        gap.isProbe = true
        gap.isTestable = false
        gap.needsTranslation = true
        gap.blankForm = "x"
        gap.acceptedAnswers = ["y"]
        gap.tagConfidence = 0.4
        var object = try #require(JSONSerialization.jsonObject(with: encoder().encode(gap)) as? [String: Any])
        for key in ["isProbe", "blankForm", "acceptedAnswers", "isTestable", "tagConfidence", "needsTranslation"] {
            object.removeValue(forKey: key)
        }
        let data = try JSONSerialization.data(withJSONObject: object)
        let decoded = try decoder().decode(GapItem.self, from: data)
        #expect(decoded.id == "old")
        #expect(decoded.conceptId == "c")
        #expect(decoded.isProbe == false)
        #expect(decoded.isTestable == true)
        #expect(decoded.needsTranslation == false)
        #expect(decoded.blankForm == nil)
        #expect(decoded.acceptedAnswers == nil)
        #expect(decoded.tagConfidence == nil)

        // And the new fields round-trip when present.
        let roundTrip = try decoder().decode(GapItem.self, from: encoder().encode(gap))
        #expect(roundTrip == gap)
    }

    // MARK: A4 — complete resets

    private func fillEverything(_ store: AppStore) {
        store.gaps = [EngineFixtures.gap("g", concept: nil)]
        store.concepts[0].alpha = 9
        store.errors = [ErrorRecord(id: "e", gapId: "g", category: .grammar, frenchWord: "x", userAnswer: "a",
                                    correctAnswer: "b", conceptLabel: "L", occurredAt: now)]
        store.abilityTheta = 1.7
        store.masteryDays = ["2026-01-01"]
        store.hasCompletedAssessment = true
        store.assessedLevel = .B2
        store.sessionIndex = 9
        store.preferences = .default
        store.recordActivityMinutes(.reading, minutes: 5, now: now)
        store.recordLessonMinutes(4, now: now)
        store.gapsSinceLastLesson = 3
        store.lessonsSinceCapstone = 2
        store.xp = 500
        store.recordLessonBest(kind: .smart, accuracy: 0.9, streak: 5, now: now)
        _ = store.planForToday(now: now) { DailyPlan(items: [], rationale: "r", isColdStart: true) }
        store.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
    }

    private func expectEmpty(_ store: AppStore) {
        #expect(store.gaps.isEmpty)
        #expect(store.concepts.allSatisfy { $0.alpha == 1 && $0.beta == 1 })
        #expect(store.concepts.count == ConceptTaxonomy.seed().count)
        #expect(store.errors.isEmpty)
        #expect(store.abilityTheta == Tuning.defaultAbilityTheta)
        #expect(store.masteryDays.isEmpty)
        #expect(store.hasCompletedAssessment == false)
        #expect(store.assessedLevel == .A1)
        #expect(store.sessionIndex == 0)
        #expect(store.preferences == nil)
        #expect(store.activityProgress.isEmpty)
        #expect(store.lifetimeMinutes.isEmpty)
        #expect(store.lessonMinutes.isEmpty)
        #expect(store.totalLessonMinutes == 0)
        #expect(store.lessonsCompletedByDay.isEmpty)
        #expect(store.gapsSinceLastLesson == 0)
        #expect(store.lessonsSinceCapstone == 0)
        #expect(store.xp == 0)
        #expect(store.personalBests.isEmpty)
        #expect(store.dailyPlanOfRecord == nil)
        #expect(store.dailyPlanDayKey == nil)
        #expect(store.loadError == nil)
    }

    @Test func resetProgressClearsEveryFieldAndPersists() {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        fillEverything(store)
        store.resetProgress()
        expectEmpty(store)
        #expect(store.localUpdatedAt != nil, "a reset is learner activity: it must win newest-wins and clear the cloud too")
        let reloaded = AppStore(persistence: scratch.defaults)
        #expect(reloaded.gaps.isEmpty)
        #expect(reloaded.masteryDays.isEmpty)
        #expect(reloaded.xp == 0)
        #expect(reloaded.preferences == nil)
        #expect(reloaded.hasCompletedAssessment == false)
    }

    @Test func clearForSignOutClearsEveryFieldWithoutMarkingActivity() {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        fillEverything(store)
        store.clearForSignOut()
        expectEmpty(store)
        #expect(store.localUpdatedAt == nil, "a sign-out is not learner activity")
        #expect(AppStore(persistence: scratch.defaults).gaps.isEmpty)
    }

    @Test func firstRunPlacementStartsTheRecordFromZero() {
        let store = EngineFixtures.store()
        fillEverything(store)
        // Pre-placement leftovers on a device that has never been placed.
        store.hasCompletedAssessment = false
        let result = PlacementResult(vocabBand: 3, grammarBand: 3, estimatedLevel: .B1, isTrueBeginner: false,
                                     masteredConceptIds: Array(ConceptTaxonomy.baseConceptIds),
                                     missedGaps: [EngineFixtures.gap("missed", concept: nil)], askedCount: 8,
                                     correctCount: 6)
        store.applyPlacement(result, isFirstRun: true)
        #expect(store.hasCompletedAssessment)
        #expect(store.assessedLevel == .B1)
        #expect(store.masteryDays.isEmpty)
        #expect(store.activityProgress.isEmpty)
        #expect(store.xp == 0)
        #expect(store.sessionIndex == 0)
        #expect(store.lessonsSinceCapstone == 0)
        // Every base concept was seeded, but seeds are provisional and never count
        // toward coverage (B8): the learner starts in Foundation, so the missed gap
        // leads and the Foundation slice follows it.
        #expect(store.isInFoundation && store.unlockedModalities.isEmpty)
        #expect(store.gaps.first?.id == "missed")
        #expect(store.gaps.filter { $0.id == "missed" }.count == 1)
        #expect(store.errors.isEmpty)
    }

    // MARK: A7 — a "first run" placement never wipes an already-placed record

    /// A foreground reconcile applied a snapshot that placed the learner on
    /// another device while the first-run assessment was still on screen. Tapping
    /// Finish must not start the record from zero (and push that over the
    /// account): the result is applied as a retake — level updated, fresh missed
    /// gaps added, everything else intact.
    @Test func firstRunPlacementOnAnAlreadyPlacedStoreBehavesLikeARetake() {
        let store = EngineFixtures.store()
        fillEverything(store)
        store.hasCompletedAssessment = true
        store.xp = 100
        store.masteryDays = ["2026-01-01", "2026-01-02"]
        let existingGapIds = store.gaps.map { $0.id }
        let bestsBefore = store.personalBests
        let sessionBefore = store.sessionIndex
        let lessonsBefore = store.lessonsSinceCapstone

        let result = PlacementResult(vocabBand: 2, grammarBand: 2, estimatedLevel: .A2, isTrueBeginner: false,
                                     masteredConceptIds: [],
                                     missedGaps: [EngineFixtures.gap("missed", concept: nil)], askedCount: 8,
                                     correctCount: 4)
        store.applyPlacement(result, isFirstRun: true, now: now)

        #expect(store.hasCompletedAssessment)
        // D8: a retake only adds evidence — the level and ability the learner
        // already earned (B2 / theta 1.7) are never lowered by a weaker result.
        #expect(store.assessedLevel == .B2, "a retake never demotes the earned level")
        #expect(store.abilityTheta == 1.7, "practice-grown ability survives a weaker retake")
        #expect(store.xp == 100, "XP is not wiped")
        #expect(store.masteryDays == ["2026-01-01", "2026-01-02"], "the streak is not wiped")
        #expect(store.personalBests == bestsBefore)
        #expect(store.sessionIndex == sessionBefore)
        #expect(store.lessonsSinceCapstone == lessonsBefore)
        #expect(!store.errors.isEmpty, "mistake history survives")
        #expect(store.gaps.map { $0.id } == ["missed"] + existingGapIds, "fresh missed gaps are added, existing ones kept")
        #expect(!store.activityProgress.isEmpty)
    }

    // MARK: A11 — calendar-correct streaks across DST

    @Test func streakWalksCalendarDaysAcrossSpringForward() throws {
        let store = EngineFixtures.store()
        var calendar = Calendar(identifier: .gregorian)
        let zone = try #require(TimeZone(identifier: "America/New_York"))
        calendar.timeZone = zone
        store.calendar = calendar

        // US DST starts 2026-03-08 (02:00 → 03:00): that day is 23 hours long.
        func local(_ y: Int, _ m: Int, _ d: Int, _ h: Int, _ min: Int) -> Date {
            calendar.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
        }
        store.masteryDays = ["2026-03-06", "2026-03-07", "2026-03-08"]

        // 00:30 on the day after the transition; today is empty, so the streak is
        // the three days before it. 86 400-second stepping lands on 23:30 Mar 7 and
        // skips Mar 8 entirely.
        #expect(store.currentStreak(now: local(2026, 3, 9, 0, 30)) == 3)
        #expect(store.currentStreak(now: local(2026, 3, 8, 23, 30)) == 3)
        #expect(store.practisedOn(local(2026, 3, 8, 0, 10)))
        #expect(store.practisedOn(local(2026, 3, 8, 23, 50)))
        #expect(!store.practisedOn(local(2026, 3, 9, 0, 10)))
        #expect(store.dayKey(local(2026, 3, 8, 2, 30)) == "2026-03-08", "the skipped hour still belongs to Mar 8")
        #expect(store.longestStreak == 3)

        // Fall back (2026-11-01, 25-hour day): the streak still counts each day once.
        store.masteryDays = ["2026-10-31", "2026-11-01", "2026-11-02"]
        #expect(store.currentStreak(now: local(2026, 11, 2, 1, 30)) == 3)
        #expect(store.longestStreak == 3)
        // A gap breaks it.
        store.masteryDays = ["2026-10-30", "2026-11-01", "2026-11-02"]
        #expect(store.currentStreak(now: local(2026, 11, 2, 12, 0)) == 2)
        #expect(store.longestStreak == 2)
    }

    @Test func dayKeyIsLocaleIndependentAndParsesBack() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "UTC"))
        let key = DayKey.key(for: now, calendar: calendar)
        #expect(key.count == 10)
        let parsed = try #require(DayKey.date(from: key, calendar: calendar))
        #expect(DayKey.key(for: parsed, calendar: calendar) == key)
        #expect(DayKey.date(from: "garbage", calendar: calendar) == nil)
    }

    // MARK: A12 — error patterns grouped by concept

    @Test func errorPatternsGroupByConceptWithWordFallback() {
        let g = EngineFixtures.smallGraph()
        let s = g.store
        let root2 = s.gaps.first { $0.id == "root-2" }!
        let root4 = s.gaps.first { $0.id == "root-4" }!
        var orphan = EngineFixtures.gap("orphan", concept: nil)
        orphan.frenchWord = "Orphelin"
        s.gaps.append(orphan)

        s.recordError(gap: root2, userAnswer: "a", correctAnswer: "b", now: now)
        s.recordError(gap: root4, userAnswer: "a", correctAnswer: "b", now: now.addingTimeInterval(60))
        s.recordError(gap: orphan, userAnswer: "a", correctAnswer: "b", now: now)

        let patterns = s.errorPatterns
        #expect(patterns.count == 2)
        let rootPattern = patterns.first { $0.id == "root" }
        #expect(rootPattern?.count == 2)
        #expect(rootPattern?.conceptLabel == "Concept root", "labelled with the concept's name, not a word")
        #expect(rootPattern?.records.first?.id == s.errors.first { $0.gapId == "root-4" }?.id, "newest first")
        #expect(rootPattern?.headline.contains("2 mistakes") == true)
        let wordPattern = patterns.first { $0.id == "word:orphelin" }
        #expect(wordPattern?.count == 1)
        #expect(wordPattern?.conceptLabel == "Orphelin")
        #expect(patterns.first?.id == "root", "largest group first")

        // Records persisted before `conceptId` existed group by the gap's current concept.
        s.errors = [ErrorRecord(id: "legacy", gapId: "root-1", category: .grammar, frenchWord: "x", userAnswer: "a",
                                correctAnswer: "b", conceptLabel: "old label", occurredAt: now)]
        #expect(s.errorPatterns.first?.id == "root")
    }

    @Test func errorHistoryIsCapped() {
        let s = EngineFixtures.store()
        let gap = EngineFixtures.gap("g", concept: nil)
        for i in 0..<(Tuning.errorHistoryCap + 25) {
            s.recordError(gap: gap, userAnswer: "\(i)", correctAnswer: "b", now: now.addingTimeInterval(Double(i)))
        }
        #expect(s.errors.count == Tuning.errorHistoryCap)
        #expect(s.errors.first?.userAnswer == "\(Tuning.errorHistoryCap + 24)", "newest are kept")
    }

    // MARK: A16 — capture factory and dedupe

    @Test func capturedGapsStartScheduledAndDedupeOnHeadword() {
        let s = EngineFixtures.store()
        let gap = s.makeCapturedGap(frenchWord: "  Bonjour ", englishTranslation: "hello", sourceType: .reading,
                                    category: .register, cefrLevel: .B1, difficulty: .hard, now: now)
        #expect(gap.frenchWord == "Bonjour")
        #expect(gap.fsrs != nil, "never a nil FSRS state")
        #expect(gap.fsrs?.dueAt == now)
        #expect(gap.nextReviewAt == now)
        #expect(gap.createdAt == now)
        #expect(gap.cefrLevel == .B1)
        #expect(gap.irtDifficulty == Tuning.irtDifficulty(for: .B1) + Tuning.irtHardBump)
        #expect(gap.reviewCount == 0 && gap.consecutiveCorrect == 0 && gap.masteredAt == nil)
        #expect(!gap.id.isEmpty)

        #expect(s.captureGap(gap))
        #expect(s.gaps.count == 1)
        #expect(s.gapsSinceLastLesson == 1)
        let dup = s.makeCapturedGap(frenchWord: "bonjour", englishTranslation: "hi", sourceType: .listening, now: now)
        #expect(!s.captureGap(dup), "same headword, case-insensitive → rejected")
        #expect(s.gaps.count == 1)
        #expect(s.hasGap(forWord: "BONJOUR"))

        // Level defaults to the learner's own level when the capture site has none.
        let leveled = s.makeCapturedGap(frenchWord: "merci", englishTranslation: "thanks", sourceType: .speech, now: now)
        #expect(leveled.cefrLevel == s.learnerLevel)
        #expect(leveled.irtDifficulty == Tuning.irtDifficulty(for: s.learnerLevel))
    }

    // MARK: D14 — plan of record

    @Test func planOfRecordIsComputedOncePerDayAndRollsOver() {
        let scratch = ScratchDefaults()
        let s = AppStore(persistence: scratch.defaults)
        var computeCount = 0
        func compute() -> DailyPlan {
            computeCount += 1
            return DailyPlan(items: [DailyPlanItem(modality: .reading, targetMinutes: 10 * computeCount)],
                             rationale: "plan \(computeCount)", isColdStart: false)
        }
        let first = s.planForToday(now: now, compute: compute)
        let again = s.planForToday(now: now.addingTimeInterval(3600), compute: compute)
        #expect(computeCount == 1)
        #expect(again == first)
        #expect(s.dailyPlanDayKey == s.dayKey(now))
        #expect(s.localUpdatedAt == nil, "a cache is not learner activity")

        // Survives a relaunch.
        s.flush()
        let reloaded = AppStore(persistence: scratch.defaults)
        #expect(reloaded.dailyPlanOfRecord == first)
        #expect(reloaded.dailyPlanDayKey == s.dayKey(now))

        // Next day → recomputed once.
        let tomorrow = s.calendar.date(byAdding: .day, value: 1, to: now)!
        let next = s.planForToday(now: tomorrow, compute: compute)
        #expect(computeCount == 2)
        #expect(next.rationale == "plan 2")

        // Explicit refresh.
        s.refreshPlan()
        #expect(s.dailyPlanOfRecord == nil)
        let refreshed = s.refreshPlan(now: tomorrow, compute: compute)
        #expect(computeCount == 3)
        #expect(refreshed.rationale == "plan 3")
    }

    // MARK: A16 — XP, bests, lesson minutes, lesson counters

    @Test func xpAndPersonalBestsPersist() {
        let scratch = ScratchDefaults()
        let s = AppStore(persistence: scratch.defaults)
        s.awardXP(Tuning.xpPerCorrect)
        s.awardXP(-5)
        #expect(s.xp == Tuning.xpPerCorrect)
        #expect(s.recordLessonBest(kind: .smart, accuracy: 0.8, streak: 3, now: now))
        #expect(!s.recordLessonBest(kind: .smart, accuracy: 0.7, streak: 9, now: now), "lower accuracy is not a best")
        #expect(s.recordLessonBest(kind: .smart, accuracy: 0.8, streak: 4, now: now), "same accuracy, longer streak")
        #expect(s.recordLessonBest(kind: .capstone, accuracy: 0.5, streak: 1, now: now), "kinds are independent")
        #expect(s.personalBest(for: .scoped) == nil)
        s.flush()

        let reloaded = AppStore(persistence: scratch.defaults)
        #expect(reloaded.xp == Tuning.xpPerCorrect)
        #expect(reloaded.personalBest(for: .smart)?.accuracy == 0.8)
        #expect(reloaded.personalBest(for: .smart)?.streak == 4)
        #expect(reloaded.personalBest(for: .capstone)?.accuracy == 0.5)
    }

    @Test func completeLessonAwardsXPCountsTheDayAndResetsTheTrigger() {
        let s = EngineFixtures.store()
        s.gapsSinceLastLesson = 4
        s.completeLesson(targetConceptId: nil, isCapstone: false, now: now)
        #expect(s.xp == Tuning.xpPerLessonComplete)
        #expect(s.lessonsCompleted(on: now) == 1)
        #expect(s.gapsSinceLastLesson == 0, "markLessonOffered runs inside completeLesson")
        #expect(s.sessionIndex == 1)
        #expect(s.lessonsSinceCapstone == 1)

        s.completeLesson(targetConceptId: nil, isCapstone: true, now: now)
        #expect(s.xp == 2 * Tuning.xpPerLessonComplete + Tuning.xpCapstoneBonus)
        #expect(s.lessonsSinceCapstone == 0)
        #expect(s.lessonsCompleted(on: now) == 2)

        // Abandoned with answers: bookkeeping, no completion XP, not a lesson done.
        s.completeLesson(targetConceptId: nil, isCapstone: false, abandoned: true, answered: 2, now: now)
        #expect(s.sessionIndex == 3)
        #expect(s.lessonsSinceCapstone == 1)
        #expect(s.lessonsCompleted(on: now) == 2)
        #expect(s.xp == 2 * Tuning.xpPerLessonComplete + Tuning.xpCapstoneBonus)

        // Abandoned with nothing answered: a no-op.
        s.completeLesson(targetConceptId: nil, isCapstone: false, abandoned: true, answered: 0, now: now)
        #expect(s.sessionIndex == 3)
    }

    @Test func lessonMinutesAndActivityHistoryArePrunedButTotalsSurvive() {
        let s = EngineFixtures.store()
        let old = s.calendar.date(byAdding: .day, value: -(Tuning.activityHistoryDays + 5), to: now)!
        s.recordActivityMinutes(.reading, minutes: 30, now: old)
        s.recordLessonMinutes(7, now: old)
        s.recordActivityMinutes(.reading, minutes: 5, now: now)
        s.recordLessonMinutes(3, now: now)
        #expect(s.activityProgress.count == 1, "the stale bucket is pruned")
        #expect(s.lessonMinutes.count == 1)
        #expect(s.totalMinutes(.reading) == 35, "lifetime minutes are never pruned")
        #expect(s.totalLessonMinutes == 10)
        #expect(s.lessonMinutes[s.dayKey(now)] == 3)
    }

    @Test func lifetimeMinutesMigrateFromLegacyBuckets() throws {
        let scratch = ScratchDefaults()
        let legacy = ["2026-05-01|reading": 12, "2026-05-02|reading": 8, "2026-05-02|listening": 4]
        scratch.defaults.set(try JSONEncoder().encode(legacy), forKey: "ff.activityProgress.v1")
        let s = AppStore(persistence: scratch.defaults)
        #expect(s.totalMinutes(.reading) == 20)
        #expect(s.totalMinutes(.listening) == 4)
    }

    // MARK: A9 — coalesced persistence

    @Test func saveIsCoalescedAndFlushWritesImmediately() async throws {
        let scratch = ScratchDefaults()
        let s = AppStore(persistence: scratch.defaults)
        s.gaps = [EngineFixtures.gap("a", concept: nil)]
        s.save()
        #expect(s.hasPendingWrite)
        #expect(scratch.defaults.data(forKey: "ff.gaps.v1") == nil, "nothing is encoded synchronously")
        // Poll rather than assume scheduling order: other main-actor tests (the
        // multi-day simulations) can delay the coalesced write's continuation.
        for _ in 0..<40 where s.hasPendingWrite {
            try await Task.sleep(for: .seconds(Tuning.saveCoalesceInterval))
        }
        #expect(!s.hasPendingWrite)
        #expect(AppStore(persistence: scratch.defaults).gaps.count == 1)

        s.gaps.append(EngineFixtures.gap("b", concept: nil))
        s.save()
        s.flush()
        #expect(!s.hasPendingWrite)
        #expect(AppStore(persistence: scratch.defaults).gaps.count == 2)
        #expect(s.localUpdatedAt != nil)
    }

    @Test func snapshotApplyClearsLoadErrorAndKeepsCorruptCopy() {
        let scratch = ScratchDefaults()
        let garbage = Data("nope".utf8)
        scratch.defaults.set(garbage, forKey: "ff.gaps.v1")
        let s = AppStore(persistence: scratch.defaults)
        #expect(s.loadError == .corruptGaps)
        s.xp = 40
        var snapshot = s.makeSnapshot()
        #expect(snapshot.xp == 40, "XP travels in the snapshot")
        snapshot.gaps = [EngineFixtures.gap("cloud", concept: nil)]
        snapshot.xp = 120
        s.apply(snapshot: snapshot)
        #expect(s.loadError == nil)
        #expect(s.gaps.map { $0.id } == ["cloud"])
        #expect(s.xp == 120)
        snapshot.xp = nil
        s.apply(snapshot: snapshot)
        #expect(s.xp == 120, "a pre-XP row keeps the device's XP")
        #expect(scratch.defaults.data(forKey: "ff.gaps.v1.corrupt") == garbage)
        #expect(AppStore(persistence: scratch.defaults).gaps.map { $0.id } == ["cloud"])
    }

    // MARK: A6 — everything sign-out wipes travels in the snapshot

    /// Sign out (backup, wipe), sign back in (apply the row): personal bests,
    /// lifetime / lesson minutes, lessons-per-day, the governor window, unlocked
    /// modalities and the journey start all come back. A row from a build that
    /// predates these fields leaves the device values alone.
    @Test func snapshotRoundTripsEverythingSignOutWipes() throws {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        fillEverything(store)
        store.checkInHistory = [true, false, true]
        // Unlocks travel with the coverage that earned them: a bookkeeping point
        // (load, snapshot) re-locks reading only when VERIFIED coverage has fallen
        // below the bridge (B8), so the fixture holds enough verified base mastery.
        let base = Array(ConceptTaxonomy.baseConceptIds).sorted()
        let needed = Int((Double(base.count) * ReadinessConfig.tuning.readingUnlock).rounded(.up))
        for cid in base.prefix(needed) {
            let idx = store.concepts.firstIndex { $0.id == cid }!
            store.concepts[idx].alpha = 9
            store.concepts[idx].beta = 1
            store.concepts[idx].observationCount = 8
        }
        #expect(store.baseCoverage >= ReadinessConfig.tuning.readingUnlock)
        store.unlockedModalities = ["reading", "listening"]
        store.journeyStartedAt = now.addingTimeInterval(-10 * day)
        let bests = store.personalBests
        let lifetime = store.lifetimeMinutes
        let lessonMinutes = store.lessonMinutes
        let totalLessonMinutes = store.totalLessonMinutes
        let lessonsByDay = store.lessonsCompletedByDay
        #expect(!bests.isEmpty && !lifetime.isEmpty && !lessonMinutes.isEmpty && totalLessonMinutes > 0 && !lessonsByDay.isEmpty)

        // The row survives an encode/decode like the cloud column does.
        let snapshot = try decoder().decode(ProgressSnapshot.self, from: encoder().encode(store.makeSnapshot()))
        #expect(snapshot.personalBests == bests)
        #expect(snapshot.lifetimeMinutes == lifetime)
        #expect(snapshot.totalLessonMinutes == totalLessonMinutes)
        #expect(snapshot.lessonMinutes == lessonMinutes)
        #expect(snapshot.lessonsCompletedByDay == lessonsByDay)
        #expect(snapshot.checkInHistory == [true, false, true])
        #expect(snapshot.unlockedModalities == ["listening", "reading"])
        #expect(snapshot.journeyStartedAt == now.addingTimeInterval(-10 * day))

        store.clearForSignOut()
        expectEmpty(store)
        #expect(store.checkInHistory.isEmpty && store.unlockedModalities.isEmpty && store.journeyStartedAt == nil)

        store.apply(snapshot: snapshot)
        #expect(store.personalBests == bests)
        #expect(store.lifetimeMinutes == lifetime)
        #expect(store.totalLessonMinutes == totalLessonMinutes)
        #expect(store.lessonMinutes == lessonMinutes)
        #expect(store.lessonsCompletedByDay == lessonsByDay)
        #expect(store.checkInHistory == [true, false, true])
        #expect(store.unlockedModalities == ["reading", "listening"])
        #expect(store.journeyStartedAt == now.addingTimeInterval(-10 * day))
        let reloaded = AppStore(persistence: scratch.defaults)
        #expect(reloaded.personalBests == bests)
        #expect(reloaded.totalLessonMinutes == totalLessonMinutes)
        #expect(reloaded.unlockedModalities == ["reading", "listening"])

        // A row written before these fields existed keeps what the device has.
        var old = snapshot
        old.personalBests = nil
        old.lifetimeMinutes = nil
        old.totalLessonMinutes = nil
        old.lessonMinutes = nil
        old.lessonsCompletedByDay = nil
        old.checkInHistory = nil
        old.unlockedModalities = nil
        old.journeyStartedAt = nil
        let legacy = try decoder().decode(ProgressSnapshot.self, from: encoder().encode(old))
        store.apply(snapshot: legacy)
        #expect(store.personalBests == bests)
        #expect(store.totalLessonMinutes == totalLessonMinutes)
        #expect(store.checkInHistory == [true, false, true])
        #expect(store.unlockedModalities == ["reading", "listening"])
        #expect(store.journeyStartedAt == now.addingTimeInterval(-10 * day))
    }

    // MARK: store-2-3 — saved scenario guides are part of the record

    /// A guide the learner saves must look like a change to the record: written
    /// to the shared key, dirty, sync clock moved, and carried in the next
    /// snapshot. Writing the key straight from the view left the device looking
    /// clean, so the guide was never uploaded and the next reconcile applied the
    /// account's older blob over it.
    @Test func savingScenarioGuidesMarksTheRecordDirtyAndTravelsInTheSnapshot() {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        store.save()
        store.flush()
        let before = store.localUpdatedAt

        let blob = Data("[{\"id\":\"guide-1\"}]".utf8)
        store.setSavedScenarios(blob)

        #expect(scratch.defaults.data(forKey: ScenarioStorage.defaultsKey) == blob)
        #expect(store.hasPendingWrite, "the guide marks the record dirty")
        #expect(store.makeSnapshot().savedScenarios == blob, "and travels to the account")
        if let before, let after = store.localUpdatedAt {
            #expect(after >= before, "the sync clock moves, so the device is the newer side")
        } else {
            Issue.record("the guide should have set a sync clock")
        }
    }

    /// The other half: a snapshot that carries guides replaces the device blob,
    /// so a restore on a new device brings the saved guides back.
    @Test func appliedSnapshotRestoresSavedScenarioGuides() {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        store.setSavedScenarios(Data("[]".utf8))
        store.flush()

        var remote = store.makeSnapshot()
        remote.savedScenarios = Data("[{\"id\":\"from-cloud\"}]".utf8)
        remote.clientUpdatedAt = now
        store.apply(snapshot: remote)

        #expect(scratch.defaults.data(forKey: ScenarioStorage.defaultsKey) == Data("[{\"id\":\"from-cloud\"}]".utf8))
    }

    // MARK: Recovery — the sequence CloudSync.restoreFromAccount drives

    /// "Restore from my account": the gutted post-load state is replaced by the
    /// account row, the preserved unreadable copy is deleted, and the reloaded
    /// store holds the account's data — never the gutted state.
    @Test func restoreFromAccountDiscardingTheUnreadableCopy() throws {
        let scratch = ScratchDefaults()
        let garbage = Data("not json".utf8)
        scratch.defaults.set(garbage, forKey: "ff.gaps.v1")
        scratch.defaults.set(now.addingTimeInterval(-day).timeIntervalSince1970, forKey: "ff.localUpdatedAt.v1")

        let store = AppStore(persistence: scratch.defaults)
        #expect(store.loadError == .corruptGaps)
        #expect(store.gaps.isEmpty, "the corrupt blob loads as an empty list")
        #expect(store.localUpdatedAt != nil, "the persisted clock survives the failed load")

        // The account row: what the learner actually has.
        var remote = store.makeSnapshot()
        remote.gaps = [EngineFixtures.gap("cloud-1", concept: nil), EngineFixtures.gap("cloud-2", concept: nil)]
        remote.xp = 300
        remote.clientUpdatedAt = now

        store.acknowledgeLoadError(discard: true)
        store.apply(snapshot: remote)

        #expect(store.loadError == nil)
        #expect(store.canPushToCloud)
        #expect(store.gaps.map { $0.id } == ["cloud-1", "cloud-2"])
        #expect(store.xp == 300)
        #expect(store.localUpdatedAt == now, "the device clock is the row's clock after a restore")
        #expect(scratch.defaults.data(forKey: "ff.gaps.v1.corrupt") == nil, "discard removes the preserved copy")
        let reloaded = AppStore(persistence: scratch.defaults)
        #expect(reloaded.loadError == nil)
        #expect(reloaded.gaps.map { $0.id } == ["cloud-1", "cloud-2"])
    }

    /// "Restore, but keep the unreadable copy": same restore, the corrupt blob
    /// stays on the device for support and does not affect the next launch.
    @Test func restoreFromAccountKeepingTheUnreadableCopy() {
        let scratch = ScratchDefaults()
        let garbage = Data("{{{{".utf8)
        scratch.defaults.set(garbage, forKey: "ff.errors.v1")

        let store = AppStore(persistence: scratch.defaults)
        #expect(store.loadError == .corruptErrors)
        var remote = store.makeSnapshot()
        remote.gaps = [EngineFixtures.gap("cloud", concept: nil)]
        remote.errors = []

        store.acknowledgeLoadError(discard: false)
        store.apply(snapshot: remote)

        #expect(store.loadError == nil)
        #expect(store.gaps.map { $0.id } == ["cloud"])
        #expect(scratch.defaults.data(forKey: "ff.errors.v1.corrupt") == garbage, "the copy is kept for support")
        let reloaded = AppStore(persistence: scratch.defaults)
        #expect(reloaded.loadError == nil, "a kept copy never re-triggers recovery")
        #expect(reloaded.gaps.map { $0.id } == ["cloud"])
    }

    /// Why the recovery path must bypass SnapshotReconciler: a gutted store on a
    /// single device still carries the markers of its last good sync, so the
    /// ordinary rule reports it as already in sync (clean) or, once touched, as
    /// the side to push — either way the good cloud row would be lost.
    @Test func ordinaryReconcileRuleCannotTellAGuttedStoreFromAGoodOne() {
        let synced = now.addingTimeInterval(-day)
        let server = now.addingTimeInterval(-day + 5)
        let clean = SnapshotReconciler.LocalState(
            updatedAt: synced, lastSyncedUpdatedAt: synced, lastSyncedServerUpdatedAt: server
        )
        let remote = SnapshotReconciler.RemoteState(clientUpdatedAt: synced, serverUpdatedAt: server)
        #expect(SnapshotReconciler.decide(local: clean, remote: remote) == .alreadyInSync)

        let touched = SnapshotReconciler.LocalState(
            updatedAt: now, lastSyncedUpdatedAt: synced, lastSyncedServerUpdatedAt: server
        )
        #expect(SnapshotReconciler.decide(local: touched, remote: remote) == .pushLocal)
    }

    // MARK: A13 — probes are evidence, not learner-visible gaps

    @Test func probesAreExcludedFromVisibleCountsAndRetention() throws {
        let g = EngineFixtures.smallGraph()
        let s = g.store
        let probeConcept = s.concept(g.probeMe)!
        let probe = try #require(s.materializeProbeGap(id: "probe-1", for: probeConcept, now: now))
        #expect(probe.isProbe)
        #expect(s.evidenceGaps.contains { $0.id == "probe-1" }, "the opt-in evidence view keeps probes")
        #expect(!s.activeGaps.contains { $0.id == "probe-1" }, "the view-facing list never lists a probe")
        #expect(!s.visibleGaps.contains { $0.id == "probe-1" })
        #expect(s.activeGaps.count == s.evidenceGaps.count - 1)
        #expect(s.visibleGaps.map { $0.id } == s.activeGaps.map { $0.id })
        #expect(!s.gaps(in: .pronunciation).contains { $0.id == "probe-1" })
        #expect(s.stats(for: .pronunciation).active == 0)
        let buckets = s.retention(at: now)
        let all = buckets.fresh + buckets.fading + buckets.atRisk + buckets.mastered + buckets.new
        #expect(!all.contains { $0.id == "probe-1" })
        #expect(probe.fsrs != nil, "a probe starts with a schedule like every store-made gap (B4)")
        #expect(!s.dueGaps(at: now).contains { $0.id == "probe-1" })
        #expect(!s.reviewQueue(at: now).contains { $0.id == "probe-1" })
        #expect(!s.candidateGapIds(for: .mixed, now: now).contains("probe-1"))
        #expect(s.materializeProbeGap(id: "probe-1", for: probeConcept, now: now)?.id == "probe-1", "reused, not duplicated")
        #expect(s.gaps.filter { $0.id == "probe-1" }.count == 1)
    }

    // MARK: B2 — grades and evidence weights derived from the answer format

    @Test func recordAnswerDerivesGradeAndWeightFromTheFormat() {
        // (format, correct, firstTry) → (grade, concept weight)
        let table: [(AnswerFormat, Bool, Bool, ReviewGrade, Double)] = [
            (.trueFalse, true, true, .hard, 0.5),
            (.match, true, true, .hard, 0.6),
            (.multipleChoice, true, true, .good, 0.8),
            (.multipleChoice, true, false, .hard, 0.8),
            (.fillBlank, true, true, .easy, 1.0),
            (.fillBlank, true, false, .good, 1.0),
            (.translation, true, true, .easy, 1.2),
            (.translation, true, false, .good, 1.2),
            (.arrange, true, true, .easy, 1.2),
            (.arrange, true, false, .good, 1.2),
            (.probe, true, true, .good, 1.0),
            (.speaking, true, true, .easy, 1.0),
            (.converse, true, true, .good, 0.8),
            (.translation, false, true, .again, 1.2),
            (.match, false, false, .again, 0.6),
        ]
        for (format, correct, firstTry, grade, weight) in table {
            #expect(Tuning.gradeMapping(format: format, correct: correct, firstTry: firstTry) == grade,
                    "\(format) correct=\(correct) firstTry=\(firstTry)")
            #expect(Tuning.formatEvidenceWeight(format) == weight, "\(format)")
        }
        for format in AnswerFormat.allCases {
            #expect(Tuning.formatEvidenceWeight(format) > 0)
            #expect(Tuning.gradeMapping(format: format, correct: false, firstTry: true) == .again)
            #expect(Tuning.gradeMapping(format: format, correct: false, firstTry: false) == .again)
            #expect(Tuning.gradeMapping(format: format, correct: true, firstTry: true).rawValue
                    >= Tuning.gradeMapping(format: format, correct: true, firstTry: false).rawValue, "a retry never grades higher")
        }

        // recordAnswer lands the grade on the FSRS state and the weight on the
        // concept — after the evidence decays toward the prior (B5).
        func fresh() -> AppStore {
            EngineFixtures.store(concepts: [EngineFixtures.learning("c", mastery: 0.5)],   // alpha 3.5, beta 3.5
                                 gaps: [EngineFixtures.gap("g", concept: "c")])
        }
        func decayed(_ x: Double) -> Double { 1 + (x - 1) * Tuning.evidenceRecency }
        let typed = fresh()
        typed.recordAnswer(gapId: "g", correct: true, format: .translation, firstTry: true, now: now)
        #expect(abs((typed.concept("c")?.alpha ?? 0) - (decayed(3.5) + 1.2)) < 1e-9)
        #expect(abs((typed.concept("c")?.observationCount ?? 0) - (5 + 1.2)) < 1e-9, "raw observations grow by the undecayed weight")
        let easy = FSRS.makeInitialState(grade: .easy, now: now)
        #expect(typed.gaps[0].fsrs?.stability == easy.stability)
        #expect(typed.gaps[0].fsrs?.difficulty == easy.difficulty)
        #expect(typed.gaps[0].nextReviewAt == easy.dueAt)

        let picked = fresh()
        picked.recordAnswer(gapId: "g", correct: true, format: .multipleChoice, firstTry: true, now: now)
        #expect(abs((picked.concept("c")?.alpha ?? 0) - (decayed(3.5) + 0.8)) < 1e-9)
        #expect((picked.gaps[0].fsrs?.stability ?? 0) < (typed.gaps[0].fsrs?.stability ?? 0), "recognition earns a shorter interval than production")
        #expect(picked.gaps[0].consecutiveCorrect == 1 && picked.gaps[0].reviewCount == 1)

        // The extra multiplier (capstone) stacks on the format weight; a miss is a
        // lapse. The concept is learning, so this is not a check-in: no doubling.
        picked.recordAnswer(gapId: "g", correct: false, format: .trueFalse, firstTry: true, conceptWeight: Tuning.capstoneWeight, now: now)
        #expect(abs((picked.concept("c")?.beta ?? 0) - (decayed(decayed(3.5)) + 0.5 * Tuning.capstoneWeight)) < 1e-9)
        #expect(picked.gaps[0].consecutiveCorrect == 0 && picked.gaps[0].fsrs?.lapses == 1)
        #expect(picked.checkInHistory.isEmpty)
    }

    // MARK: B3 — the mastered-gap schedule at the model level

    @Test func masteredGapIsDueForACheckWhenDueOrWhenRecallDrops() {
        let far = now.addingTimeInterval(30 * day)
        // Legacy (fsrs == nil) mastered gap: recall comes from the streak fallback.
        let high = EngineFixtures.gap("high", concept: nil, due: far, consecutiveCorrect: Tuning.gapMasteryStreak, mastered: now)
        #expect(high.isMastered && !high.isDueForMasteryCheck(at: now) && !high.isPracticable(at: now))
        #expect(high.isDueForMasteryCheck(at: far), "due date reached")
        let low = EngineFixtures.gap("low", concept: nil, due: far, consecutiveCorrect: 3, mastered: now)   // fallback 0.76 < floor
        #expect(low.retrievability(at: now) < Tuning.masteredRecallFloor)
        #expect(low.isDueForMasteryCheck(at: now) && low.isPracticable(at: now))
        let unmastered = EngineFixtures.gap("u", concept: nil, due: far)
        #expect(unmastered.isPracticable(at: now) && !unmastered.isDueForMasteryCheck(at: now))

        // With a real FSRS state the check falls out of the curve.
        var scheduled = EngineFixtures.gap("s", concept: nil, consecutiveCorrect: Tuning.gapMasteryStreak,
                                           reviewCount: Tuning.gapMasteryStreak, mastered: now)
        scheduled.fsrs = FSRS.makeInitialState(grade: .easy, now: now)
        scheduled.nextReviewAt = scheduled.fsrs!.dueAt
        #expect(!scheduled.isPracticable(at: now))
        #expect(scheduled.isPracticable(at: scheduled.nextReviewAt))
        #expect(scheduled.isPracticable(at: now.addingTimeInterval(60 * day)))
        let s = EngineFixtures.store()
        s.gaps = [high, low, unmastered, scheduled]
        #expect(Set(s.dueMasteredGaps(at: now).map { $0.id }) == ["low"])
        #expect(Set(s.dueMasteredGaps(at: far).map { $0.id }) == ["high", "low", "s"])
        #expect(Set(s.schedulableGaps(at: now).map { $0.id }) == ["low", "u"])
        #expect(s.masteredGaps.count == 3, "the badge is unchanged by the schedule")
    }

    // MARK: B4 — never-reviewed gaps are "new", not "at risk"

    @Test func neverReviewedGapsAreNewAndExcludedFromAverages() {
        let s = EngineFixtures.store()
        var seeded = EngineFixtures.gap("seeded", concept: nil)
        seeded.fsrs = EngineFixtures.freshFsrs(at: now)                 // scheduled, never answered
        let legacy = EngineFixtures.gap("legacy", concept: nil)         // fsrs nil, never answered
        var reviewed = EngineFixtures.gap("reviewed", concept: nil, reviewCount: 1)
        reviewed.fsrs = FSRS.makeInitialState(grade: .good, now: now)  // r = 1 right now
        let legacyReviewed = EngineFixtures.gap("legacy-reviewed", concept: nil, reviewCount: 2)   // fallback 0.4 → at risk
        let done = EngineFixtures.gap("done", concept: nil, consecutiveCorrect: Tuning.gapMasteryStreak,
                                      reviewCount: Tuning.gapMasteryStreak, mastered: now)
        s.gaps = [seeded, legacy, reviewed, legacyReviewed, done]

        let b = s.retention(at: now)
        #expect(Set(b.new.map { $0.id }) == ["seeded", "legacy"])
        #expect(b.fresh.map { $0.id } == ["reviewed"])
        #expect(b.atRisk.map { $0.id } == ["legacy-reviewed"], "only reviewed gaps can be at risk")
        #expect(b.fading.isEmpty)
        #expect(b.mastered.map { $0.id } == ["done"])
        #expect(s.overallRetention(at: now) == 70, "mean of 1.0 and 0.4 over the reviewed pool only")
        #expect(s.gapHealth(at: now).score == 70)
        #expect(s.gapHealth(at: now).label == "Healthy")
        #expect(!s.candidateGapIds(for: .retention(.atRisk), now: now).contains("seeded"))

        // No evidence at all: honest, not "at risk".
        s.gaps = [seeded, legacy]
        #expect(s.overallRetention(at: now) == 100)
        #expect(s.gapHealth(at: now).score == 100 && s.gapHealth(at: now).label == "No reviews yet")
        s.gaps = []
        #expect(s.gapHealth(at: now).score == 100 && s.gapHealth(at: now).label == "All clear")

        // Day one of Foundation: a full seed and nothing at risk.
        s.gaps = EngineFixtures.foundationGaps(for: Array(s.concepts.prefix(5)), perConcept: 6, at: now)
        #expect(s.retention(at: now).atRisk.isEmpty)
        #expect(s.retention(at: now).new.count == 30)
        #expect(s.candidateGapIds(for: .retention(.atRisk), now: now).isEmpty)

        // After the first answer the gap leaves "new".
        s.recordReview(gapId: s.gaps[0].id, correct: false, now: now)
        #expect(s.retention(at: now).new.count == 29)
        #expect(!s.retention(at: now).atRisk.isEmpty || !s.retention(at: now).fading.isEmpty || !s.retention(at: now).fresh.isEmpty)
    }

    // MARK: E13 / E10 — speaking and conversation evidence

    @Test func speakingEvidenceLandsOnTheConceptOnly() {
        let s = EngineFixtures.store()
        let cid = s.concepts[0].id
        s.recordSpeakingEvidence(conceptId: cid, correct: true, now: now)
        s.recordSpeakingEvidence(conceptId: cid, correct: false, now: now)
        s.recordSpeakingEvidence(conceptId: nil, correct: true, now: now)
        s.recordSpeakingEvidence(conceptId: "no-such-concept", correct: true, now: now)
        let w = Tuning.formatEvidenceWeight(.speaking)
        // The first answer lands on the (1, 1) prior; the second decays it first (B5).
        #expect(abs((s.concept(cid)?.alpha ?? 0) - (1 + w * Tuning.evidenceRecency)) < 1e-9)
        #expect(abs((s.concept(cid)?.beta ?? 0) - (1 + w)) < 1e-9)
        #expect(abs((s.concept(cid)?.observationCount ?? 0) - 2 * w) < 1e-9)
        #expect(s.concept(cid)?.lastTestedAt == now)
        #expect(s.gaps.isEmpty, "no gap is involved")
        #expect(s.concepts.filter { $0.alpha != 1 || $0.beta != 1 }.count == 1)
        #expect(s.localUpdatedAt != nil, "evidence is learner activity")
    }

    @Test func converseCorrectionCreatesADedupedGapAndRecordsALapse() throws {
        let s = EngineFixtures.store()
        let concept = s.concepts[0]
        let gap = try #require(s.recordConverseCorrection(originalFrench: "orig-x", correctedFrench: " Corr-x ", explanation: "why-x",
                                                          conceptId: concept.id, now: now))
        #expect(gap.frenchWord == "Corr-x")
        #expect(gap.explanation == "why-x")
        #expect(gap.conceptId == concept.id)
        #expect(gap.category == concept.category)
        #expect(gap.cefrLevel == concept.cefrLevel)
        #expect(gap.sourceType == .speech)
        #expect(gap.needsTranslation, "no gloss was supplied")
        #expect(gap.originalContext?.sentence == "orig-x")
        #expect(gap.originalContext?.sourceTab == "converse")
        // A store-made gap starts from the seeded `.again` state (lapses 1); the slip adds one.
        let seededLapses = FSRS.makeInitialState(grade: .again, now: now).lapses
        #expect(gap.fsrs != nil && gap.fsrs?.lapses == seededLapses + 1)
        #expect(gap.reviewCount == 1 && gap.consecutiveCorrect == 0)
        #expect(gap.lastReviewedAt == now)
        #expect(s.gaps.count == 1 && s.gapsSinceLastLesson == 1)
        #expect(s.concept(concept.id)?.beta == 1 + Tuning.formatEvidenceWeight(.converse))

        // The same corrected form again: deduped on the headword, another lapse on the same gap.
        let again = try #require(s.recordConverseCorrection(originalFrench: "orig-y", correctedFrench: "corr-x", explanation: "why-y",
                                                            conceptId: concept.id, now: now.addingTimeInterval(60)))
        #expect(again.id == gap.id)
        #expect(again.reviewCount == 2 && again.fsrs?.lapses == seededLapses + 2)
        #expect(s.gaps.count == 1)

        // Nothing to correct → nil and no gap.
        #expect(s.recordConverseCorrection(originalFrench: "same-z", correctedFrench: "same-z", explanation: "", conceptId: nil, now: now) == nil)
        #expect(s.recordConverseCorrection(originalFrench: "x", correctedFrench: "   ", explanation: "", conceptId: nil, now: now) == nil)
        #expect(s.gaps.count == 1)

        // With a gloss and an unknown concept: no translation flag, untagged, phrasing.
        let glossed = try #require(s.recordConverseCorrection(originalFrench: "a-1", correctedFrench: "b-1", explanation: "e",
                                                              conceptId: "no-such-concept", englishTranslation: "gloss-1", now: now))
        #expect(!glossed.needsTranslation)
        #expect(glossed.englishTranslation == "gloss-1")
        #expect(glossed.conceptId == nil)
        #expect(glossed.category == .phrasing)
        #expect(glossed.cefrLevel == s.learnerLevel)
        #expect(s.gaps.count == 2)

        // A lapse on a mastered word through this path clears the badge too.
        var mastered = EngineFixtures.gap("m", concept: nil, consecutiveCorrect: Tuning.gapMasteryStreak,
                                          reviewCount: Tuning.gapMasteryStreak, mastered: now)
        mastered.frenchWord = "Mot-m"
        s.gaps.append(mastered)
        let slipped = try #require(s.recordConverseCorrection(originalFrench: "mot-n", correctedFrench: "mot-m", explanation: "",
                                                              conceptId: nil, now: now))
        #expect(slipped.id == "m" && !slipped.isMastered && slipped.consecutiveCorrect == 0)
    }

    // MARK: firstrun-2-2 — ability is bounded by the difficulty of the evidence

    @Test func abilityStopsClimbingAboveTheDifficultyOfTheItemsBeingAnswered() {
        let s = EngineFixtures.store()
        s.abilityTheta = -0.8                              // where a fresh A1 placement lands
        var easy = EngineFixtures.gap("easy", concept: "definite-articles")
        easy.irtDifficulty = -1.1                          // an A1 Foundation item
        s.gaps = [easy]
        for _ in 0..<600 { s.recordReview(gapId: "easy", correct: true, now: now) }
        let ceiling = -1.1 + Tuning.thetaEvidenceCeiling
        #expect(s.abilityTheta <= ceiling + 1e-9, "θ = \(s.abilityTheta) climbed past its evidence")
        #expect(s.learnerLevel.order <= CEFRLevel.A2.order,
                "drilling A1 Foundation items must never display as B1 — read \(s.learnerLevel.rawValue)")

        // Harder material DOES carry the learner further.
        var hard = EngineFixtures.gap("hard", concept: "negation")
        hard.irtDifficulty = 0.8
        s.gaps.append(hard)
        for _ in 0..<400 { s.recordReview(gapId: "hard", correct: true, now: now) }
        #expect(s.abilityTheta > ceiling)
        #expect(s.abilityTheta <= 0.8 + Tuning.thetaEvidenceCeiling + 1e-9)

        // The ceiling bounds the GAIN only: a miss still lowers ability, and a
        // learner already placed above the ceiling is never demoted by answering
        // an easy item correctly.
        let earned = s.abilityTheta
        s.recordReview(gapId: "hard", correct: false, now: now)
        #expect(s.abilityTheta < earned)
        let afterMiss = s.abilityTheta
        s.recordReview(gapId: "easy", correct: true, now: now)
        #expect(s.abilityTheta == afterMiss, "an easy item below the ceiling neither raises nor lowers θ")
    }

    // MARK: firstrun-2-5 — seeded curriculum is not the learner's practice history

    @Test func seededGapsCountAsCurriculumAheadNotAsPractisedWeakSpots() {
        let s = EngineFixtures.store()
        let negation = s.concepts.filter { $0.id == "negation" }
        s.gaps = EngineFixtures.foundationGaps(for: negation, perConcept: 3, at: now)
        #expect(s.activeGaps.count == 3)
        #expect(s.practisedGaps.isEmpty, "day one: the learner has been asked about none of it")
        #expect(s.newGaps.count == 3)
        #expect(HomeCopy.learnCardStat(toLearn: 3, practised: 0) == "3 to learn")
        #expect(HomeCopy.toLearnLabel == "To learn")

        s.recordReview(gapId: s.gaps[0].id, correct: true, now: now)
        #expect(s.activeGaps.count == 3 && s.practisedGaps.count == 1 && s.newGaps.count == 2)
        #expect(HomeCopy.learnCardStat(toLearn: s.activeGaps.count, practised: s.practisedGaps.count)
                == "3 to learn · 1 practised")
    }

    // MARK: firstrun-2-3 — the streak counts practice, and says so

    @Test func theStreakCountsDaysPractisedNotDaysAWordWasMastered() {
        let s = EngineFixtures.store()
        s.gaps = EngineFixtures.foundationGaps(for: s.concepts.filter { $0.id == "negation" },
                                               perConcept: 1, at: now)
        let id = s.gaps[0].id
        s.recordReview(gapId: id, correct: true, now: now)
        #expect(s.practisedOn(now), "one correct answer marks the day")
        #expect(s.currentStreak(now: now) == 1)
        // …and that is NOT mastery, which needs `Tuning.gapMasteryStreak` in a row.
        #expect(s.masteredGaps.isEmpty)
        #expect(s.gaps[0].consecutiveCorrect < Tuning.gapMasteryStreak)
        #expect(s.masteredThisWeek == 0)
    }
}

// MARK: - Session, lesson and low-stakes-corruption safety (audit round 1)

/// The store side of the sign-in / sign-out / mid-lesson rules the coordinator
/// (ContentView + CloudSync) drives: an involuntary sign-out must not destroy
/// unsynced work, a different learner must not inherit the previous one's data
/// (including saved scenario guides), a lost plan preference must not block the
/// app, and a lesson in flight must be visible to the reconcile scheduler.
@MainActor
struct StoreSessionSafetyTests {
    private func encoder() -> JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }

    // MARK: store-1-2 — only a different learner wipes the device record

    @Test func firstSignInKeepsThePreLoginRecordForMigration() {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        store.gaps = [EngineFixtures.gap("pre-login", concept: nil)]
        store.save()
        store.flush()

        #expect(store.beginSession(userId: "user-1") == false, "nothing to clear on a first sign-in")
        #expect(store.gaps.map { $0.id } == ["pre-login"], "the record is migrated, not wiped")
        #expect(store.lastSignedInUserId == "user-1")
    }

    @Test func sameLearnerSigningBackInKeepsUnsyncedProgress() {
        let scratch = ScratchDefaults()
        let first = AppStore(persistence: scratch.defaults)
        first.beginSession(userId: "user-1")
        first.gaps = [EngineFixtures.gap("answered-offline", concept: nil)]
        first.save()
        first.flush()

        // Relaunch after the session expired on its own: nothing was signed out.
        let relaunched = AppStore(persistence: scratch.defaults)
        #expect(relaunched.lastSignedInUserId == "user-1", "the account is remembered across launches")
        #expect(relaunched.beginSession(userId: "user-1") == false)
        #expect(relaunched.gaps.map { $0.id } == ["answered-offline"],
                "work done since the last upload survives an involuntary sign-out")
    }

    @Test func aDifferentLearnerStartsFromACleanRecord() {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        store.beginSession(userId: "user-1")
        store.gaps = [EngineFixtures.gap("theirs", concept: nil)]
        store.xp = 120
        store.save()
        store.flush()
        scratch.defaults.set(Data("[]".utf8), forKey: ScenarioStorage.defaultsKey)

        #expect(store.beginSession(userId: "user-2"), "a new learner clears the device")
        #expect(store.gaps.isEmpty)
        #expect(store.xp == 0)
        #expect(store.lastSignedInUserId == "user-2")
        #expect(scratch.defaults.data(forKey: ScenarioStorage.defaultsKey) == nil,
                "saved scenario guides do not bleed to the next learner")
        #expect(AppStore(persistence: scratch.defaults).gaps.isEmpty, "the wipe is persisted")
    }

    @Test func explicitSignOutForgetsTheAccountAndTheGuides() {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        store.beginSession(userId: "user-1")
        scratch.defaults.set(Data("[]".utf8), forKey: ScenarioStorage.defaultsKey)

        store.clearForSignOut()
        #expect(store.lastSignedInUserId == nil)
        #expect(scratch.defaults.string(forKey: "ff.lastSignedInUserId.v1") == nil)
        #expect(scratch.defaults.data(forKey: ScenarioStorage.defaultsKey) == nil)
        #expect(AppStore(persistence: scratch.defaults).lastSignedInUserId == nil)
    }

    // MARK: store-1-4 — saved scenario guides travel with the account

    @Test func savedScenarioGuidesAreBackedUpAndRestored() {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        let guides = Data(#"[{"id":"s1"}]"#.utf8)
        scratch.defaults.set(guides, forKey: ScenarioStorage.defaultsKey)

        #expect(store.makeSnapshot().savedScenarios == guides, "guides ride along in the cloud snapshot")

        scratch.defaults.removeObject(forKey: ScenarioStorage.defaultsKey)
        var snapshot = store.makeSnapshot()
        snapshot.savedScenarios = guides
        store.apply(snapshot: snapshot)
        #expect(scratch.defaults.data(forKey: ScenarioStorage.defaultsKey) == guides,
                "a restore brings the saved guides back")

        var older = store.makeSnapshot()
        older.savedScenarios = nil
        store.apply(snapshot: older)
        #expect(scratch.defaults.data(forKey: ScenarioStorage.defaultsKey) == guides,
                "a row written before the field existed never deletes them")
    }

    // MARK: store-1-5 — a low-stakes blob never blocks the app

    @Test func unreadablePreferencesRaiseANoticeInsteadOfBlockingTheApp() throws {
        let scratch = ScratchDefaults()
        let keep = [EngineFixtures.gap("keep", concept: nil)]
        scratch.defaults.set(try encoder().encode(keep), forKey: "ff.gaps.v1")
        let garbage = Data("not json".utf8)
        scratch.defaults.set(garbage, forKey: "ff.preferences.v1")
        scratch.defaults.set(garbage, forKey: "ff.activityProgress.v1")

        let store = AppStore(persistence: scratch.defaults)
        #expect(store.loadError == nil, "the app is not held behind a cloud restore")
        #expect(store.canPushToCloud, "and the learner's real record can still sync")
        #expect(store.loadNotices == [.corruptPreferences, .corruptActivityProgress])
        #expect(store.loadNoticeMessage?.isEmpty == false)
        #expect(store.gaps.map { $0.id } == ["keep"], "learner data is untouched")
        #expect(store.preferences == nil)
        #expect(store.activityProgress.isEmpty)
        #expect(store.corruptBlob(for: .corruptPreferences) == garbage, "the unreadable copy is preserved")

        store.acknowledgeLoadNotices()
        #expect(store.loadNoticeMessage == nil)
        #expect(store.corruptBlob(for: .corruptPreferences) == garbage, "dismissing the notice keeps the copy")
    }

    @Test func unreadableLearnerDataStillBlocks() {
        let scratch = ScratchDefaults()
        scratch.defaults.set(Data("not json".utf8), forKey: "ff.concepts.v1")
        let store = AppStore(persistence: scratch.defaults)
        #expect(store.loadError == .corruptConcepts)
        #expect(store.canPushToCloud == false)
        #expect(StoreLoadError.corruptConcepts.isBlocking)
        #expect(StoreLoadError.corruptPreferences.isBlocking == false)
    }

    // MARK: store-1-3 — a lesson in flight is visible to the reconcile scheduler

    @Test func lessonInProgressBracketsTheLesson() {
        let store = AppStore(persistence: nil)
        #expect(store.isLessonInProgress == false)
        store.beginLesson()
        #expect(store.isLessonInProgress)
        store.endLesson()
        #expect(store.isLessonInProgress == false)
        store.beginLesson()
        store.clearForSignOut()
        #expect(store.isLessonInProgress == false, "a reset never leaves the flag stuck")
    }
}
