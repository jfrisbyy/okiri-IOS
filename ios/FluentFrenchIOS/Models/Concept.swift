//
//  Concept.swift
//  FluentFrenchIOS
//
//  A Concept is the underlying skill behind gaps — e.g. "gender agreement on
//  adjectives", "passé composé with être", "savoir vs connaître". Gaps are
//  evidence; Concepts are what we actually teach and track.
//
//  Mastery is modelled as Beta-distribution evidence (alpha = knowing,
//  beta = not knowing) that is SEPARATE from each gap's FSRS review schedule:
//  FSRS answers "when do we re-show this word", concept mastery answers "does
//  the learner actually understand this skill".
//

import Foundation

nonisolated struct Concept: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var category: GapCategory
    var cefrLevel: CEFRLevel
    /// Ids of concepts that should be mastered first (forms a dependency graph).
    var prerequisites: [String]
    /// One-sentence teaching summary.
    var description: String

    // MARK: Mastery evidence (Beta distribution)
    var alpha: Double = 1   // evidence of knowing
    var beta: Double = 1    // evidence of not knowing
    var lastTestedAt: Date? = nil

    // MARK: Bookkeeping for selection / legibility
    /// Session index when this concept was last used as a lesson spine (for damping).
    var lastTaughtSession: Int? = nil
    /// Flagged when prerequisites newly cleared so the UI can surface "New: ready for X".
    var newlyUnlocked: Bool = false

    // MARK: Derived (computed, never stored)

    var mastery: Double { alpha / (alpha + beta) }

    /// Real evidence accumulated (alpha + beta start at 1 each).
    var observations: Double { alpha + beta - 2 }

    enum MasteryState: String, Codable {
        case neverObserved
        case learning
        case mastered
    }

    var state: MasteryState {
        if observations < 1 { return .neverObserved }   // untested ≠ mastered
        if mastery >= 0.85 && observations >= 4 { return .mastered }
        return .learning
    }

    var isMastered: Bool { state == .mastered }
}
