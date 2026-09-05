//
//  ConceptSelector.swift
//  FluentFrenchIOS
//
//  The core intelligence of the gap-learning loop: score every eligible concept,
//  pick the lesson's spine (target concept), then assemble an interleaved item set
//  with data-driven reasons and an occasional blind-spot probe.
//
//  Generation (the AI question writer + formats) is intentionally untouched — this
//  only decides WHICH gaps and in what ORDER.
//

import Foundation

// MARK: - Output

nonisolated struct AssembledLesson: Identifiable {
    var id: String = UUID().uuidString
    /// The lesson spine in full (Home "Learn") mode. `nil` in scoped mode, where
    /// the user already declared intent by tapping a category / deck / review set.
    var targetConcept: Concept?
    var gaps: [GapItem]
    var reasons: [String: String]       // gapId -> short data-driven reason
    var headline: String                // "why this lesson" one-liner
    var probeGapId: String?             // a blind-spot probe item, if injected
    var conceptBlocks: [ConceptBlock] = []   // teaching "skill cards", in order
}

/// One teaching "skill card" shown before a concept's practice items.
nonisolated struct ConceptBlock: Identifiable {
    var id: String { concept.id }
    let concept: Concept
    var explanation: String          // plain-language teaching summary
    let example: GapItem?            // a real worked example from the learner's gaps
    let reason: String?              // the "why you're seeing this" line
}

// MARK: - Selector

@MainActor
struct ConceptSelector {
    let store: AppStore
    var weights: ConceptSelectionWeights = .tuning

    // MARK: Eligibility

    /// Learning concepts, plus frontier concepts (never-observed with all
    /// prerequisites mastered). A never-observed concept with unmet prereqs is
    /// never eligible.
    func eligibleConcepts() -> [Concept] {
        store.concepts.filter { concept in
            switch concept.state {
            case .learning:
                return true
            case .neverObserved:
                return store.arePrerequisitesMet(concept)
            case .mastered:
                return false
            }
        }
    }

    func isFrontier(_ concept: Concept) -> Bool {
        concept.state == .neverObserved && store.arePrerequisitesMet(concept)
    }

    // MARK: Scoring

    func score(_ concept: Concept) -> Double {
        let conceptGaps = store.gaps(forConcept: concept.id).filter { !$0.isMastered }

        let urgency = urgencyScore(conceptGaps)
        let leverage = leverageScore(concept)
        let frontierFit = frontierScore(concept)
        let confusion = confusionScore(conceptGaps)
        let recent = recentlyTaughtPenalty(concept)

        return weights.urgency * urgency
            + weights.leverage * leverage
            + weights.frontier * frontierFit
            + weights.confusion * confusion
            - weights.repeatDamp * recent
    }

    /// Max overdue-ness across this concept's gaps (0 if none due), normalized.
    private func urgencyScore(_ gaps: [GapItem]) -> Double {
        let now = Date()
        let maxOverdueDays = gaps
            .map { now.timeIntervalSince($0.nextReviewAt) / 86_400 }
            .filter { $0 > 0 }
            .max() ?? 0
        return min(1, maxOverdueDays / 7)
    }

    /// How many other concepts list this as a prerequisite, normalized by the
    /// busiest concept in the taxonomy.
    private func leverageScore(_ concept: Concept) -> Double {
        let dependents = store.dependents(of: concept.id).count
        let maxDependents = store.concepts
            .map { store.dependents(of: $0.id).count }
            .max() ?? 0
        guard maxDependents > 0 else { return 0 }
        return Double(dependents) / Double(maxDependents)
    }

    /// 1.0 for frontier concepts; for learning concepts, tapers toward 0 the
    /// further the concept sits below the learner's current ability.
    private func frontierScore(_ concept: Concept) -> Double {
        if isFrontier(concept) { return 1.0 }
        let abilityLevel = abilityCEFR().order
        let conceptLevel = concept.cefrLevel.order
        let below = Double(max(0, abilityLevel - conceptLevel))
        return max(0, 1 - below / 3.0)
    }

    private func confusionScore(_ gaps: [GapItem]) -> Double {
        let total = gaps.flatMap { $0.confusionLinks }.map { $0.strength }.reduce(0, +)
        return min(1, total)
    }

    private func recentlyTaughtPenalty(_ concept: Concept) -> Double {
        guard let taught = concept.lastTaughtSession else { return 0 }
        let delta = store.sessionIndex - taught
        if delta <= 0 { return 1.0 }
        if delta == 1 { return 0.5 }
        return 0
    }

    /// Map the learner's IRT ability to an approximate CEFR band for frontier fit.
    private func abilityCEFR() -> CEFRLevel {
        switch store.abilityTheta {
        case ..<(-0.4): return .A1
        case ..<0.4: return .A2
        case ..<1.2: return .B1
        case ..<2.0: return .B2
        case ..<2.6: return .C1
        default: return .C2
        }
    }

    // MARK: Selection

    /// Pick the highest-scoring concept as the lesson spine, plus ranked runners-up.
    func select() -> (target: Concept, ranked: [ScoredConcept])? {
        let scored = rankedEligible()
        guard let target = scored.first?.concept else { return nil }
        return (target, Array(scored.dropFirst()))
    }

    /// All eligible concepts scored and ranked high-to-low. Shared by the lesson
    /// selector and the daily-plan engine (one brain, two views).
    func rankedEligible() -> [ScoredConcept] {
        eligibleConcepts()
            .map { ScoredConcept(concept: $0, score: score($0), isFrontier: isFrontier($0)) }
            .sorted { $0.score > $1.score }
    }
}
