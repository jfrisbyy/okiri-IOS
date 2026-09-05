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
    /// Evidence of knowing. Decays toward the prior by `Tuning.evidenceRecency`
    /// before every observation (recent answers count more — Pass 3 F3).
    var alpha: Double = 1
    /// Evidence of not knowing (decays the same way).
    var beta: Double = 1
    var lastTestedAt: Date? = nil
    /// Raw, UNDECAYED observation weight ever recorded. The min-observations gate
    /// reads this, never alpha + beta, so decay can't hide how little was seen.
    var observationCount: Double = 0

    // MARK: Bookkeeping for selection / legibility
    /// Session index when this concept was last used as a lesson spine (for damping).
    var lastTaughtSession: Int? = nil
    /// Flagged when prerequisites newly cleared so the UI can surface "New: ready for X".
    var newlyUnlocked: Bool = false

    // MARK: Check-ins (Pass 3 F4/F5/F6)
    /// Mastery came from a placement seed and has not yet been verified by
    /// `Tuning.seedVerificationPasses` consecutive passed check-ins.
    var isProvisional: Bool = false
    /// Consecutive passed check-ins while provisional (reset by a miss).
    var provisionalPasses: Int = 0
    /// When the adaptive check-in schedule next wants this (mastered) concept re-tested.
    /// Nil on a mastered concept means it was never scheduled: treated as due.
    var nextCheckInAt: Date? = nil
    /// Current adaptive check-in interval in days (×`Tuning.checkInGrowth` on a pass,
    /// ÷`Tuning.checkInMissDivisor` on a miss, capped at `Tuning.checkInMaxDays`).
    var checkInIntervalDays: Double? = nil

    // MARK: Stalls (Package B14/B15)
    /// Consecutive lessons this concept was the target without its state changing.
    var stallAttempts: Int = 0
    /// The state this concept was in when it was last selected as a lesson target
    /// (set by the pipeline at selection; compared at `completeLesson`).
    var lastTaughtState: MasteryState? = nil

    // MARK: Derived (computed, never stored)

    var mastery: Double { alpha / (alpha + beta) }

    /// Real evidence accumulated — the raw, undecayed count.
    var observations: Double { observationCount }

    enum MasteryState: String, Codable {
        case neverObserved
        case learning
        case mastered
    }

    /// `neverObserved` until any evidence lands; `mastered` needs both the mastery
    /// threshold and the raw observation floor (`Tuning.masteryThreshold`,
    /// `Tuning.minObservations`); everything else is `learning`.
    var state: MasteryState {
        if observationCount <= 0 { return .neverObserved }   // untested ≠ mastered
        if mastery >= Tuning.masteryThreshold && observationCount >= Tuning.minObservations { return .mastered }
        return .learning
    }

    var isMastered: Bool { state == .mastered }

    /// Mastered AND not a provisional placement seed: earned through practice, or a
    /// seed that passed its verification check-ins. Coverage counts only these (B8).
    var isVerifiedMastered: Bool { state == .mastered && !isProvisional }

    /// Stalled: the target of `Tuning.stallAttempts` consecutive lessons with no state change.
    var isStalled: Bool { stallAttempts >= Tuning.stallAttempts }

    enum CodingKeys: String, CodingKey {
        case id, name, category, cefrLevel, prerequisites, description
        case alpha, beta, lastTestedAt, observationCount
        case lastTaughtSession, newlyUnlocked
        case isProvisional, provisionalPasses, nextCheckInAt, checkInIntervalDays
        case stallAttempts, lastTaughtState
    }
}

nonisolated extension Concept {
    /// Back-compat decoding: fields added after the first release fall back to their
    /// defaults. A concept persisted before `observationCount` existed migrates its
    /// count from the undecayed evidence it carried (`max(0, alpha + beta − 2)`).
    /// Lives in an extension so the memberwise initializer stays available.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        category = try c.decode(GapCategory.self, forKey: .category)
        cefrLevel = try c.decode(CEFRLevel.self, forKey: .cefrLevel)
        prerequisites = try c.decodeIfPresent([String].self, forKey: .prerequisites) ?? []
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        alpha = try c.decodeIfPresent(Double.self, forKey: .alpha) ?? 1
        beta = try c.decodeIfPresent(Double.self, forKey: .beta) ?? 1
        lastTestedAt = try c.decodeIfPresent(Date.self, forKey: .lastTestedAt)
        observationCount = try c.decodeIfPresent(Double.self, forKey: .observationCount) ?? max(0, alpha + beta - 2)
        lastTaughtSession = try c.decodeIfPresent(Int.self, forKey: .lastTaughtSession)
        newlyUnlocked = try c.decodeIfPresent(Bool.self, forKey: .newlyUnlocked) ?? false
        isProvisional = try c.decodeIfPresent(Bool.self, forKey: .isProvisional) ?? false
        provisionalPasses = try c.decodeIfPresent(Int.self, forKey: .provisionalPasses) ?? 0
        nextCheckInAt = try c.decodeIfPresent(Date.self, forKey: .nextCheckInAt)
        checkInIntervalDays = try c.decodeIfPresent(Double.self, forKey: .checkInIntervalDays)
        stallAttempts = try c.decodeIfPresent(Int.self, forKey: .stallAttempts) ?? 0
        lastTaughtState = try c.decodeIfPresent(MasteryState.self, forKey: .lastTaughtState)
    }
}
