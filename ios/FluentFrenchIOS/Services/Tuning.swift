//
//  Tuning.swift
//  FluentFrenchIOS
//
//  Live-tuning knobs gathered in ONE place. These are deliberately NOT final —
//  the right values only reveal themselves once the loop runs on a real learner,
//  so they live here, clearly labeled, rather than scattered through the engines.
//
//  Rule (engine passes): every constant the engine uses is named here with a
//  one-line comment. No magic numbers in selection / assembly / planning logic.
//

import Foundation

nonisolated enum Tuning {
    // MARK: Lesson trigger (Prompt F)
    /// New + due material that must accumulate before a consolidated lesson is
    /// offered in the daily plan.
    static let consolidatedLessonThreshold: Int = 6

    // MARK: Capstone cadence (Prompt G)
    /// Lessons completed before a capstone milestone quiz appears.
    static let capstoneEveryNLessons: Int = 4
    /// How many items the capstone pulls from recent material.
    static let capstoneSize: Int = 12
    /// Extra mastery weight applied to capstone answers (delayed mixed test = strong signal).
    static let capstoneWeight: Double = 1.6

    // MARK: Capstone selection (Pass 2 — one ranker, two modes)
    /// Days back that count as "recent material" when the capstone gathers candidates.
    static let capstoneRecencyDays: Double = 14
    /// A learning concept at or above this mastery is "trending toward mastered".
    static let capstoneTrendingMasteryFloor: Double = 0.6
    /// Capstone tier bonus for any learning concept — sized above the ranker's full
    /// score SPREAD so learning concepts always outrank mastered ones. The shared
    /// score runs from -0.5 (repeatDamp 0.5 at full penalty) to 4.8 (governor
    /// urgency 1.0x2 + leverage 0.6 + frontier 0 + confusion 0.7 + stall 1.5),
    /// a spread of 5.3; 5.5 clears it.
    static let capstoneLearningWeight: Double = 5.5
    /// Extra capstone tier bonus for learning concepts at/above the trending floor
    /// (same sizing rule, so trending concepts always come first).
    static let capstoneTrendingWeight: Double = 5.5

    // MARK: Lesson shape (Pass 2 — request-level sizes)
    /// Items in a smart (Home "Learn") lesson.
    static let lessonSize: Int = 7
    /// Floor applied to any requested lesson size so a lesson is never degenerate.
    static let minLessonSize: Int = 3
    /// Items when the learner scopes a lesson themselves (deck, category, review set, pattern).
    static let scopedLessonSize: Int = 8
    /// Share of smart-lesson slots reserved for the target concept's own gaps.
    static let targetRatio: Double = 0.65
    /// Slots a smart lesson holds back for interleaved review of OTHER concepts, so
    /// spine + check-ins can never consume the whole lesson (blocked practice only).
    static let reviewSlotsPerLesson: Int = 2
    /// How far ahead (days) a gap still counts as "due" for interleaved review.
    static let dueWindowDays: Double = 3.0
    /// Blind-spot probe cadence in sessions (0 disables probes).
    static let probeEveryNSessions: Int = 3
    /// Cap on teaching skill cards shown before practice.
    static let maxConceptCards: Int = 4
    /// Misses (FSRS lapses — wrong answers, not reviews) an overdue item needs
    /// before its reason reads "you've missed this N×".
    static let repeatedMissReasonFloor: Int = 2

    // MARK: Instrumentation (Pass 2)
    /// Most recent selections kept in the in-memory SelectionLog.
    static let selectionLogCapacity: Int = 200

    // MARK: Activity time crediting (Prompt E)
    /// Minimum seconds in an activity surface before any minute is credited.
    static let minActivitySeconds: Double = 20

    // MARK: Store persistence & data safety (Package A)
    /// Seconds a `save()` waits for further mutations before writing to disk (coalesced writes).
    static let saveCoalesceInterval: TimeInterval = 0.25
    /// Most recent error records kept; older ones are dropped.
    static let errorHistoryCap: Int = 500
    /// Days of per-day activity / lesson minute history kept (lifetime totals are kept separately).
    static let activityHistoryDays: Int = 90
    /// Starting IRT ability before placement (θ ≈ A2 band; Home shows "Not placed" until placement).
    static let defaultAbilityTheta: Double = 0.2
    /// Quiet period after the last local change before the cloud snapshot is uploaded.
    /// Well above the gap between two answers, so a lesson uploads once at the end
    /// (`AppStore.flushToCloud`) instead of re-sending the whole record per answer (store-2-2).
    static let cloudPushDebounce: TimeInterval = 20

    // MARK: XP (Package A16 / C25)
    /// XP awarded per correct answer.
    static let xpPerCorrect: Int = 10
    /// XP awarded when a lesson is completed (not abandoned).
    static let xpPerLessonComplete: Int = 20
    /// Extra XP awarded on top of `xpPerLessonComplete` for a finished capstone.
    static let xpCapstoneBonus: Int = 50

    // MARK: Hearts (Package A16 / C5 — hearts are real)
    /// Hearts a lesson starts with; the lesson ends with a recap when they reach zero.
    static let lessonHearts: Int = 3
    /// The capstone quiz is a delayed mixed test, not a drill: it never ends early on hearts.
    static let capstoneHasHearts: Bool = false

    // MARK: Captured-gap difficulty (Package A16 / E7)
    /// IRT difficulty a learner-captured item gets from its CEFR level (a learner placed
    /// at that level has ≈50 % success on it).
    static func irtDifficulty(for level: CEFRLevel) -> Double {
        switch level {
        case .A1: return -0.8
        case .A2: return 0.0
        case .B1: return 0.8
        case .B2: return 1.5
        case .C1: return 2.2
        case .C2: return 2.8
        }
    }
    /// IRT difficulty bump applied on top of the level for a `.hard` capture tag.
    static let irtHardBump: Double = 0.4
    /// IRT difficulty bump (negative) for an `.easy` capture tag.
    static let irtEasyBump: Double = -0.3

    // MARK: FSRS memory model (Package B1 / B2)
    /// Difficulty a card starts at after a `.good` first answer (the neutral point; 1…10 scale).
    static let fsrsNeutralDifficulty: Double = 5.0
    /// Difficulty moved per grade step away from `.good` on the FIRST answer (again +2 steps, hard +1, easy −1).
    static let fsrsInitialDifficultyStep: Double = 1.0
    /// Difficulty moved per grade step away from `.good` (again +2 steps, hard +1, easy −1).
    static let fsrsDifficultyStep: Double = 0.1
    /// Stability (days) a card starts with after its first answer, by grade.
    static func fsrsInitialStability(for grade: ReviewGrade) -> Double {
        switch grade {
        case .again: return 0.4
        case .hard: return 1.2
        case .good: return 2.6
        case .easy: return 5.8
        }
    }
    /// Stability growth multiplier for a `.hard` success (below 1: a hard hit grows less).
    static let fsrsHardPenalty: Double = 0.8
    /// Stability growth multiplier for an `.easy` success (above 1: an easy hit grows more).
    static let fsrsEasyBonus: Double = 1.3
    /// Exponential scale of the growth term per point of difficulty headroom below the ceiling.
    static let fsrsGrowthScale: Double = 0.4
    /// Difficulty at which the growth term's headroom reaches zero (one above the 1…10 scale).
    static let fsrsGrowthDifficultyCeiling: Double = 11
    /// How much a success at LOW retrievability (a hard-won recall) boosts growth: 1 + w·(1 − r).
    static let fsrsGrowthRetrievabilityWeight: Double = 2
    /// Overall rate the growth term is applied to stability on a success.
    static let fsrsGrowthRate: Double = 0.1
    /// Difficulty a card drifts toward on every `.good` answer (below neutral so cards ease over time).
    static let fsrsDifficultyMeanReversion: Double = 4.0
    /// Fraction of the distance to `fsrsDifficultyMeanReversion` closed per `.good` answer.
    static let fsrsDifficultyReversionRate: Double = 0.1
    /// Base multiplier applied to stability on a lapse (`.again`) — a miss always shortens the interval.
    static let fsrsLapseFactorBase: Double = 0.5
    /// Per difficulty point above neutral the lapse multiplier shrinks by this fraction (harder cards lose more).
    static let fsrsLapseDifficultyShape: Double = 0.05
    /// A lapse when recall was already unlikely (low retrievability) is expected: the multiplier grows by up to this fraction.
    static let fsrsLapseRetrievabilityShape: Double = 0.3
    /// Hard cap on the lapse multiplier so post-lapse stability is always strictly below the previous value.
    static let fsrsLapseMaxRatio: Double = 0.7
    /// Floor on stability (days) so the curve never collapses to zero.
    static let fsrsMinStability: Double = 0.1

    // MARK: Gap mastery and evidence (Package B2 / B3)
    /// Consecutive correct answers that mark a gap mastered (the badge; it stays on the FSRS schedule).
    static let gapMasteryStreak: Int = 5
    /// A mastered gap is practicable again once its recall probability drops below this (or it is due).
    static let masteredRecallFloor: Double = 0.85
    /// IRT ability gain per correct answer, scaled by (1 − P(success)).
    static let thetaGainOnCorrect: Double = 0.06
    /// IRT ability loss per miss, scaled by P(success).
    static let thetaLossOnMiss: Double = 0.05
    /// How far above an ITEM's own IRT difficulty a correct answer on it may push ability.
    /// Answering easy items forever is not evidence of a higher level, so the gain stops
    /// at `item.irtDifficulty + this`; only harder material can carry the learner further.
    static let thetaEvidenceCeiling: Double = 1.0
    /// Concept-evidence multiplier for an item tagged `.hard` at capture.
    static let hardItemEvidenceWeight: Double = 1.3
    /// Concept-evidence multiplier for an item tagged `.easy` at capture.
    static let easyItemEvidenceWeight: Double = 0.8

    /// FSRS grade derived from HOW an answer was produced: recognition formats earn at
    /// most `.hard`, multiple choice `.good`, first-try production `.easy`; a retry of
    /// any format steps one grade down; every miss is `.again`.
    static func gradeMapping(format: AnswerFormat, correct: Bool, firstTry: Bool) -> ReviewGrade {
        guard correct else { return .again }
        switch format {
        case .match, .trueFalse:
            return .hard
        case .multipleChoice, .probe, .converse:
            return firstTry ? .good : .hard
        case .fillBlank, .arrange, .translation, .speaking:
            return firstTry ? .easy : .good
        }
    }

    /// How much concept evidence one answer in a format carries (production > recognition).
    static func formatEvidenceWeight(_ format: AnswerFormat) -> Double {
        switch format {
        case .trueFalse: return 0.5
        case .match: return 0.6
        case .multipleChoice: return 0.8
        case .fillBlank: return 1.0
        case .translation, .arrange: return 1.2
        case .probe: return 1.0
        case .speaking: return 1.0
        case .converse: return 0.8
        }
    }

    // MARK: Concept estimator (Pass 3 F3/F2 — Package B5)
    /// Recency λ: before every observation the Beta evidence decays toward the (1, 1)
    /// prior — alpha = 1 + (alpha − 1)·λ — so old answers count less than new ones.
    static let evidenceRecency: Double = 0.85
    /// Mastery (alpha / (alpha + beta)) at or above which a concept reads as mastered.
    static let masteryThreshold: Double = 0.75
    /// Raw, undecayed observations a concept needs before it can read as mastered.
    static let minObservations: Double = 4

    // MARK: Check-ins on mastered concepts (Pass 3 F4/F6 — Package B6/B7)
    /// Evidence multiplier for a MISS on a check-in (an answer on a concept that was mastered when selected).
    static let checkInMissWeight: Double = 2
    /// A mastered concept is due for a check-in once any reviewed core gap's recall drops below this.
    static let checkInRetrievability: Double = 0.8
    /// Days until the first check-in after a concept is mastered (the adaptive interval's start).
    static let checkInInitialDays: Double = 7
    /// Interval multiplier after a passed check-in.
    static let checkInGrowth: Double = 1.5
    /// Interval divisor after a missed check-in.
    static let checkInMissDivisor: Double = 2
    /// Shortest check-in interval (days) a run of misses can produce.
    static let checkInMinDays: Double = 1
    /// Longest check-in interval (days) a run of passes can produce.
    static let checkInMaxDays: Double = 60
    /// Days until a placement-seeded (provisional) mastery is first verified by a check-in —
    /// and between its verification check-ins until it has passed enough of them.
    static let seedVerificationDays: Double = 3
    /// Consecutive passed check-ins a provisional seed needs before it counts as verified
    /// and joins the normal check-in ladder (one lucky multiple-choice answer is not proof).
    static let seedVerificationPasses: Int = 3
    /// Check-in items a smart lesson carries at most (one item per mastered concept).
    static let checkInsPerLesson: Int = 2

    // MARK: Retention governor (Pass 3 F6 — Package B8)
    /// Rolling window of check-in outcomes the governor judges.
    static let governorWindow: Int = 12
    /// Check-in pass rate below which the governor engages.
    static let governorPassFloor: Double = 0.6
    /// Check-ins the window must hold before the governor can engage at all.
    static let governorMinSamples: Int = 6
    /// Urgency weight multiplier while the governor is active (frontier weight goes to 0).
    static let governorUrgencyMultiplier: Double = 2

    // MARK: Placement seeding (Pass 3 F5 — Package B9)
    /// Items the adaptive placement asks per concept before it trusts a "knows it" read.
    static let placementProbesPerConcept: Int = 3
    /// Fewest placement items asked before the staircase may stop.
    static let placementMinItems: Int = 6
    /// Most placement items asked before the staircase stops regardless.
    static let placementMaxItems: Int = 12
    /// Alpha evidence a placement seed adds to a concept the learner answered every
    /// probe on (`placementProbesPerConcept`, no miss) — blended, never hard-set; reads
    /// as provisional mastery.
    static let placementSeedAlpha: Double = 4
    /// Ceiling on alpha a placement seed can raise a concept to (repeat placements stop stacking here).
    static let placementSeedAlphaCap: Double = 9
    /// Alpha evidence a band-INFERRED seed adds to a never-observed concept (at or below
    /// a cleared band but not fully probed). Kept below `minObservations` so it reads
    /// as `.learning` — a head start, never mastery.
    static let placementInferredAlpha: Double = 2
    /// Real Foundation items seeded per concept the placement missed a probe on. The
    /// probe itself is a cloze stem, never a headword, so it can't become a card.
    static let placementMissSeedItems: Int = 1

    // MARK: Foundation pacing (Pass 3 F1 — Package B10)
    /// Short lessons the daily plan asks of a learner whose reading is still locked.
    static let foundationLessonsPerDay: Int = 3

    // MARK: In-session concept release (Pass 3 F7 — Package B11)
    /// Consecutive first-try correct answers on one concept after which the lesson
    /// drops that concept's remaining items and backfills from review.
    static let conceptReleaseStreak: Int = 3

    // MARK: Stalls (Package B14/B15)
    /// Consecutive lessons a concept can be the target without its mastery state
    /// changing before it counts as stalled.
    static let stallAttempts: Int = 3
    /// Score bonus the selector adds to the unmastered prerequisites of a stalled concept.
    static let stallPrerequisiteBonus: Double = 1.5

    // MARK: Engine metrics (Package B14)
    /// Most recent per-lesson metric snapshots kept in the MetricsLog.
    static let metricsLogCapacity: Int = 180

    // MARK: Retention analytics (Package B4)
    /// Recall probability at or above which a reviewed gap reads as "fresh".
    static let retentionFreshFloor: Double = 0.8
    /// Recall probability at or above which a reviewed gap reads as "fading" (below: "at risk").
    static let retentionFadingFloor: Double = 0.5
    /// Average recall (0…100) at or above which gap health reads "Healthy".
    static let gapHealthHealthyFloor: Int = 70
    /// Average recall (0…100) at or above which gap health reads "Needs attention" (below: "At risk").
    static let gapHealthAttentionFloor: Int = 50
}

// MARK: - Selection weights (Prompt 4) — NOT FINAL, tune live during testing

/// All concept-ranking weights live here, deliberately exposed and deliberately not
/// final. Adjust these against a real learner; do not bury them in the engine.
/// Injectable so tests and the headless driver can pin them.
nonisolated struct ConceptSelectionWeights {
    var urgency: Double = 1.0       // overdue-ness of the concept's gaps
    var leverage: Double = 0.6      // how many other concepts it unlocks
    var frontier: Double = 0.8      // fit to the edge of current ability
    var confusion: Double = 0.7     // pressure from active confusion links
    var repeatDamp: Double = 0.5    // damp concepts taught very recently

    static let tuning = ConceptSelectionWeights()
}

/// Lesson shape knobs the selector and assembler share. Defaults come from the
/// named `Tuning` constants above; the struct exists so tests can override them.
nonisolated struct LessonAssemblyConfig {
    var lessonSize: Int = Tuning.lessonSize
    var targetRatio: Double = Tuning.targetRatio
    var reviewSlots: Int = Tuning.reviewSlotsPerLesson
    var dueWindowDays: Double = Tuning.dueWindowDays
    var probeEveryNSessions: Int = Tuning.probeEveryNSessions
    var maxConceptCards: Int = Tuning.maxConceptCards

    static let tuning = LessonAssemblyConfig()
}

// MARK: - Per-package extension blocks (concurrent editing: each package edits ONLY its own block)

nonisolated extension Tuning {
    // MARK: Package C — lesson loop constants
    /// Correct answers a gap needs inside one lesson to count as "mastered" for the session (questions per ordinary gap).
    static let masteryTarget: Int = 2
    /// Consecutive correct answers (gap evidence) from which a gap is asked in production formats (translation / arrange).
    static let productionEvidenceFloor: Int = 3
    /// Stepped-down remedial questions a gap can get in one lesson after misses (capstones get none).
    static let maxRemedialsPerGap: Int = 2
    /// Seconds the AI question writer may take before the lesson falls back to the local scheduler.
    static let lessonGenerationTimeout: TimeInterval = 10
    /// "Show me" reveals a lesson allows before the button is spent (C12).
    static let hintsPerLesson: Int = 3
    /// Fewest non-probe gaps with distinct English a lesson needs before a match-the-pairs interstitial is added.
    static let matchInterstitialMinGaps: Int = 3
    /// Pairs in a match-the-pairs interstitial.
    static let matchGroupSize: Int = 4
    /// Fewest tokens an example sentence needs to be offered as arrange-the-words.
    static let arrangeMinTokens: Int = 3
    /// Most tokens an example sentence may have to be offered as arrange-the-words.
    static let arrangeMaxTokens: Int = 9
    /// Floor on multiple-choice options regardless of the ability-flexed count.
    static let minMultipleChoiceOptions: Int = 3
    /// Combo length from which a correct answer earns `comboMidMultiplier` XP.
    static let comboMidStreak: Int = 3
    /// Combo length from which a correct answer earns `comboHighMultiplier` XP.
    static let comboHighStreak: Int = 5
    /// XP multiplier at `comboMidStreak`.
    static let comboMidMultiplier: Double = 1.5
    /// XP multiplier at `comboHighStreak`.
    static let comboHighMultiplier: Double = 2.0
    /// A "Show me" reveal is an admitted "I don't know": recorded as a miss, never a lost heart (C12).
    static let revealCostsHeart: Bool = false
    /// A missed blind-spot probe diagnoses an untaught concept; it never costs a heart (C19).
    static let probeMissCostsHeart: Bool = false
    /// Questions between a miss and its stepped-down remedial (C6); never past the trailing probes.
    static let remedialSpacing: Int = 2
    /// Word cards shown in the teaching stage before practice (never-reviewed items first).
    static let teachingWordCards: Int = 6
    /// A stored concept description shorter than this is "thin": the AI summary may replace it only when the content has no teaching block (C17).
    static let thinExplanationLength: Int = 40
    /// Seconds a "Mastered!" / "moving on" flash stays on screen during practice.
    static let lessonFlashSeconds: Double = 1.4
    /// First-attempt accuracy (percent) from which the completion screen praises the lesson.
    static let lessonPraiseAccuracy: Int = 80
    /// First-attempt accuracy (percent) from which the completion screen calls it solid work (below: "keep going").
    static let lessonEncourageAccuracy: Int = 50
    /// A lesson that ended at zero hearts counts toward the day's lesson count and earns the finishing XP (it does not: only a lesson played to the end completes).
    static let outOfHeartsCountsAsComplete: Bool = false
    /// Most foreground minutes one lesson can credit (lesson time follows the activity rule: nothing under `minActivitySeconds`, rounded, capped) — C14 / D9.
    static let lessonCreditCapMinutes: Int = 30
}

nonisolated extension Tuning {
    // MARK: Package D-home — Home screen, daily plan, gates constants
    // (append `static let` constants here, one-line comment each)
    /// A single activity session can earn at most (plan target × this) minutes — a surface left open never pads the day (D9).
    static let activityCreditCapMultiplier: Double = 2
    /// Fewest paced lessons the plan asks for on a day once reading is unlocked (post-unlock pacing floor).
    static let unlockedLessonsPerDayMin: Int = 1
    /// Streak length at which Kiri celebrates (trophy pose + festive sparkles) — never below 1.
    static let kiriCelebrationStreak: Int = 14
    /// Streak length at which Kiri reads as happy rather than merely encouraging.
    static let kiriHappyStreak: Int = 3
    /// Streak length the Home greeting starts calling "momentum".
    static let streakMomentumDays: Int = 3
    /// Streak length the Home greeting calls a strong run.
    static let streakStrongDays: Int = 7
    /// Granularity the daily plan prescribes minutes in: rows are whole blocks of
    /// this many minutes, and the plan's total never exceeds the learner's budget.
    static let planMinuteBlock: Int = 5
    /// Seconds a Home toast (empty-lesson headline, capture summary) stays on screen.
    static let homeToastSeconds: Double = 2.6
}

nonisolated extension Tuning {
    // MARK: Package D-flow — placement, preferences, deck/gap-map/retention constants
    /// Days ahead a gap counts as "Coming up" (due within the window, not due now) — D13.
    static let upcomingWindowDays: Double = 3
    /// Seeded Foundation items released as due per day, in concept order (≈ two
    /// concepts' worth); the rest stagger out day by day so day one never shows "380 due" — D3.
    static let foundationSeedBatch: Int = 20
    /// Days-per-week goals the preferences screen offers (D11).
    static let weeklyGoalChoices: [Int] = [3, 4, 5, 6, 7]
    /// Gap cards the deck previews inline before it offers "See all N" (the rest
    /// expand in place and lazily, so a Foundation deck of several hundred cards
    /// never renders behind the sections below it).
    static let deckPreviewCount: Int = 12
    /// Consecutive lowest-band misses in ONE category (vocabulary or grammar) before the
    /// placement stops asking that category; the learner is a true beginner only when
    /// every category has bottomed out — a weak grammar never hides a strong vocabulary (D6/B9).
    static let placementBottomOutMisses: Int = 2
    /// Items a band the BANK CANNOT PROBE IN FULL still needs before an all-correct
    /// run clears it (D6/round 3). The top band holds only a couple of hand-written
    /// items — fewer than `placementProbesPerConcept` — so without this no answer,
    /// however strong, could ever place a learner above the highest band the content
    /// covers. Two clean answers on the only items that exist is the bar.
    static let placementThinBandMinItems: Int = 2
}

nonisolated extension Tuning {
    // MARK: Package E-read — reading / capture / tagger constants
    /// Heuristic tagger confidence (0…1) below which a captured gap is left UNTAGGED (conceptId nil) — E1.
    static let tagConfidenceFloor: Double = 0.55
    /// Confidence recorded when the AI matcher (not the heuristic) names an existing concept.
    static let tagAIConfidence: Double = 0.9
    /// Confidence recorded on a gap that created (or was folded into) a new concept.
    static let tagNewConceptConfidence: Double = 0.7
    /// Tagger score for a French headword that appears verbatim in a concept's content items (a content-named skill).
    static let tagLexiconWeight: Double = 1.0
    /// Tagger score for a keyword hit on the concept's trigger list.
    static let tagKeywordWeight: Double = 0.75
    /// Tagger score for a part-of-speech signal that points at the concept (sized so POS + category alone stays below the floor).
    static let tagPartOfSpeechWeight: Double = 0.3
    /// Tagger score for the gap and concept sharing a category (weak on its own — never enough alone).
    static let tagCategoryWeight: Double = 0.2
    /// Tagger score for the gap's level sitting at or next to the concept's level.
    static let tagLevelWeight: Double = 0.1
    /// Normalised-name token overlap (Jaccard) at or above which two concept names are near-duplicates — E3.
    static let tagNearDuplicateSimilarity: Double = 0.6
    /// Most words a captured headword may contain: a phrase a lesson can ask about
    /// is a few words, not the paragraph a finger swept across in the reader.
    static let maxCaptureWords: Int = 8
    /// Highest curated level Reading shows while the gate is in its bridge state (E20 / D5).
    static let readingBridgeMaxLevel: CEFRLevel = .A2
    /// Bands away from the learner's level a piece may sit and still be "at your level" in the library.
    static let readingLevelWindow: Int = 1
    /// Seconds a word/phrase lookup may take before the sheet shows an explicit error (bounded spinner — E26).
    static let glossTimeoutSeconds: TimeInterval = 12
    /// Seconds a sentence translation may take before the translator shows an explicit error.
    static let translateTimeoutSeconds: TimeInterval = 15
    /// Seconds a headline fetch or search may take before the feed shows an explicit error.
    static let newsTimeoutSeconds: TimeInterval = 10
    /// Most offline captures the store re-translates in one pass after a gloss succeeds (E4).
    static let pendingTranslationBatch: Int = 5
    /// Per-term failures in a row that end a pending-translation pass: one word the
    /// service chokes on is skipped so the rest still get their meaning, but a
    /// service that is evidently down is not asked five times over (E4).
    static let pendingTranslationFailureStreak: Int = 2
    /// Entries kept in the on-device translation cache (LRU).
    static let translationCacheLocalLimit: Int = 600
    /// Sentences per body text (mean words/sentence) at or above which a text reads as B2 rather than B1.
    static let readabilityB2WordsPerSentence: Double = 20
    /// Mean words per sentence at or above which a text reads as B1 rather than A2.
    static let readabilityB1WordsPerSentence: Double = 13
    /// Mean words per sentence at or above which a text reads as A2 rather than A1.
    static let readabilityA2WordsPerSentence: Double = 8
    /// Share of long words (≥ `readabilityLongWordLength` letters) that bumps the estimate one band up.
    static let readabilityLongWordShare: Double = 0.28
    /// Letters from which a word counts as "long" for the readability estimate.
    static let readabilityLongWordLength: Int = 9
}

nonisolated extension Tuning {
    // MARK: Package E-talk — converse / speaking constants
    /// Concept ids kept from one speaking-feedback list (mistakes / strengths) — more is noise, not evidence.
    static let speakFeedbackMaxConcepts: Int = 3
    /// Seconds the tutor may take to answer one Converse turn before the turn fails as "service unavailable".
    static let converseReplyTimeout: TimeInterval = 40
    /// Seconds a Converse hint request may take before it fails.
    static let converseHintTimeout: TimeInterval = 30
    /// Seconds the speaking-feedback request may take before it fails.
    static let speakFeedbackTimeout: TimeInterval = 40
    /// Seconds a scenario survival-guide request may take before it fails.
    static let scenarioGuideTimeout: TimeInterval = 45
    /// Seconds a speech-to-text upload may take before it fails.
    static let speechToTextTimeout: TimeInterval = 60
    /// Free-speech session lengths the Speak duration selector offers, in minutes (each is a hard recording cap).
    static let speakDurationChoicesMinutes: [Int] = [1, 2, 3, 5]
    /// Free-speech session length selected by default, in minutes.
    static let speakDefaultDurationMinutes: Int = 2
    /// Hard recording cap for one guided-prompt answer, in seconds.
    static let speakGuidedRecordingSeconds: Int = 90
    /// Hard recording cap for one spoken Converse turn, in seconds.
    static let converseRecordingSeconds: Int = 45
    /// Days (including today) the Speak header's "this week" minutes cover.
    static let speakStatsWindowDays: Int = 7
    /// Fluency score from which speaking feedback reads as strong (green).
    static let speakScoreStrongFloor: Int = 75
    /// Fluency score from which speaking feedback reads as fair (amber); below is weak.
    static let speakScoreFairFloor: Int = 50
}

nonisolated extension Tuning {
    // MARK: Package E-media — listening / watching constants
    /// Seconds a natural-voice clip may take to arrive before the player falls back to the built-in voice (bounded buffering — E17).
    static let ttsFetchTimeout: TimeInterval = 12
    /// Natural-voice clips kept on disk before the least-recently-used are trimmed.
    static let ttsDiskCacheFiles: Int = 400
    /// Seconds between checks of whether the one-shot voice is still producing sound, so a "playing" highlight clears when the audio ends.
    static let voicePlaybackPollInterval: TimeInterval = 0.2
    /// Seconds a trending-feed or search request may take before the Watch feed shows an explicit error.
    static let videoFeedTimeout: TimeInterval = 10
    /// Seconds one transcript request (captions, translation, backend) may take before it counts as failed.
    static let transcriptRequestTimeout: TimeInterval = 15
    /// Seconds the caption waterfall (every provider, plus one retry) may take before the panel shows an error — translation of English captions is budgeted separately.
    static let transcriptTotalTimeout: TimeInterval = 45
    /// Seconds to wait before the one retry of an empty transcript pass (transient provider hiccups).
    static let transcriptRetryDelay: TimeInterval = 0.8
    /// Caption lines translated per AI request when only English captions exist.
    static let transcriptTranslationBatch: Int = 20
    /// Most AI translation requests one transcript may make (× batch = the longest transcript translated in full); lines beyond stay English and the panel says so.
    static let transcriptTranslationMaxBatches: Int = 40
    /// Seconds the progressive English → French translation pass may run after captions are shown before remaining lines are left in English.
    static let transcriptTranslationTimeout: TimeInterval = 120
    /// Consecutive failed/unreadable translation batches before the pass stops and reports the service.
    static let transcriptTranslationMaxConsecutiveFailures: Int = 2
    /// Seconds the Watch skip-back / skip-forward buttons move by (must be a value SF Symbols draws: 5, 10, 15, 30, 45, 60, 75 or 90).
    static let watchSeekStepSeconds: Double = 5
}
