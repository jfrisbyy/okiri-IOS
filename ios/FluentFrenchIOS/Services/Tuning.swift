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
    /// Rank bonus added to trending-toward-mastered concepts in capstone mode.
    static let capstoneTrendingWeight: Double = 1.0

    // MARK: Lesson shape (Pass 2 — request-level sizes)
    /// Items in a smart (Home "Learn") lesson.
    static let lessonSize: Int = 7
    /// Floor applied to any requested lesson size so a lesson is never degenerate.
    static let minLessonSize: Int = 3
    /// Items when the learner scopes a lesson themselves (deck, category, review set, pattern).
    static let scopedLessonSize: Int = 8
    /// Share of smart-lesson slots reserved for the target concept's own gaps.
    static let targetRatio: Double = 0.65
    /// How far ahead (days) a gap still counts as "due" for interleaved review.
    static let dueWindowDays: Double = 3.0
    /// Blind-spot probe cadence in sessions (0 disables probes).
    static let probeEveryNSessions: Int = 3
    /// Cap on teaching skill cards shown before practice.
    static let maxConceptCards: Int = 4
    /// Reviews an overdue item needs before its reason reads "you've missed this N×".
    static let repeatedMissReasonFloor: Int = 2

    // MARK: Instrumentation (Pass 2)
    /// Most recent selections kept in the in-memory SelectionLog.
    static let selectionLogCapacity: Int = 200

    // MARK: Activity time crediting (Prompt E)
    /// Minimum seconds in an activity surface before any minute is credited.
    static let minActivitySeconds: Double = 20
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
    var dueWindowDays: Double = Tuning.dueWindowDays
    var probeEveryNSessions: Int = Tuning.probeEveryNSessions
    var maxConceptCards: Int = Tuning.maxConceptCards

    static let tuning = LessonAssemblyConfig()
}
