//
//  EngineFixtures.swift
//  FluentFrenchIOSTests
//
//  Synthetic concepts and gaps for driving the REAL engine headlessly. No French
//  is invented here: tokens are obviously synthetic ("c1-item-3"), which is all
//  the selector, assembler and plan engine need — they never read the text.
//

import Foundation
@testable import FluentFrenchIOS

@MainActor
enum EngineFixtures {
    static let day: TimeInterval = 86_400
    /// A fixed clock so every selection in the tests is reproducible.
    static let now = Date(timeIntervalSince1970: 1_800_000_000)

    /// An in-memory store: seed taxonomy, no gaps, nothing persisted.
    static func store() -> AppStore {
        AppStore(persistence: nil)
    }

    /// An in-memory store holding exactly these concepts and gaps.
    static func store(concepts: [Concept], gaps: [GapItem], theta: Double = 0.2) -> AppStore {
        let s = AppStore(persistence: nil)
        s.concepts = concepts
        s.gaps = gaps
        s.abilityTheta = theta
        return s
    }

    // MARK: Concepts

    static func concept(_ id: String,
                        category: GapCategory = .grammar,
                        level: CEFRLevel = .A1,
                        prerequisites: [String] = [],
                        alpha: Double = 1,
                        beta: Double = 1,
                        lastTaughtSession: Int? = nil,
                        newlyUnlocked: Bool = false) -> Concept {
        Concept(id: id, name: "Concept \(id)", category: category, cefrLevel: level,
                prerequisites: prerequisites, description: "Synthetic concept \(id).",
                alpha: alpha, beta: beta, lastTestedAt: nil,
                lastTaughtSession: lastTaughtSession, newlyUnlocked: newlyUnlocked)
    }

    /// Beta evidence that reads as `.learning` at EXACTLY the given mastery
    /// (alpha + beta = 7, i.e. 5 observations on top of the (1, 1) prior).
    static func learning(_ id: String, mastery: Double, category: GapCategory = .grammar,
                         level: CEFRLevel = .A1, prerequisites: [String] = []) -> Concept {
        let total = 7.0
        return concept(id, category: category, level: level, prerequisites: prerequisites,
                       alpha: total * mastery, beta: total * (1 - mastery))
    }

    /// Beta evidence that reads as `.mastered` (mastery 0.9, observations 8).
    static func mastered(_ id: String, category: GapCategory = .grammar, level: CEFRLevel = .A1,
                         prerequisites: [String] = []) -> Concept {
        concept(id, category: category, level: level, prerequisites: prerequisites, alpha: 9, beta: 1)
    }

    // MARK: Gaps

    /// A synthetic gap. With `fsrs == nil` the model's retrievability fallback is
    /// `min(0.95, 0.4 + 0.12 × consecutiveCorrect)`, which makes ordering tests exact.
    static func gap(_ id: String,
                    concept: String?,
                    category: GapCategory = .grammar,
                    level: CEFRLevel = .A1,
                    due: Date = now,
                    consecutiveCorrect: Int = 0,
                    reviewCount: Int = 0,
                    lastReviewed: Date? = nil,
                    mastered: Date? = nil,
                    sourceType: SourceType = .foundation,
                    difficulty: GapDifficulty = .okay,
                    fsrs: FsrsState? = nil,
                    confusion: [ConfusionLink] = []) -> GapItem {
        GapItem(
            id: id,
            frenchWord: "\(id)-fr",
            englishTranslation: "\(id)-en",
            explanation: "Synthetic item \(id).",
            exampleSentence: "\(id)-fr example",
            exampleTranslation: "\(id)-en example",
            pronunciation: nil,
            sourceType: sourceType,
            category: category,
            difficulty: difficulty,
            reviewCount: reviewCount,
            consecutiveCorrect: consecutiveCorrect,
            lastReviewedAt: lastReviewed,
            nextReviewAt: due,
            masteredAt: mastered,
            createdAt: now.addingTimeInterval(-7 * day),
            cefrLevel: level,
            easeFactor: 2.5,
            currentInterval: 0,
            irtDifficulty: 0,
            fsrs: fsrs,
            originalContext: nil,
            confusionLinks: confusion,
            conceptId: concept
        )
    }

    /// An FSRS memory state as the Foundation loader creates it (fresh card, due now).
    static func freshFsrs(at when: Date = now) -> FsrsState {
        var state = FSRS.makeInitialState(grade: .again, now: when)
        state.dueAt = when
        return state
    }

    /// Foundation-shaped gaps for a taxonomy: `perConcept` fresh, due-now cards per
    /// concept, mirroring what a declared beginner is seeded with.
    static func foundationGaps(for concepts: [Concept], perConcept: Int, at when: Date = now) -> [GapItem] {
        var result: [GapItem] = []
        for concept in concepts {
            for i in 0..<perConcept {
                var g = gap("\(concept.id)-item-\(i)", concept: concept.id, category: concept.category,
                            level: concept.cefrLevel, due: when)
                g.fsrs = freshFsrs(at: when)
                result.append(g)
            }
        }
        return result
    }

    // MARK: A small, fully controlled graph

    /// ```
    ///   root      (A1, learning 0.5)        ← eligible, has gaps
    ///   frontier  (A1, never observed)      ← eligible (no prereqs), has gaps
    ///   blocked   (A2, never observed, prereq root) ← NOT eligible, has due gaps
    ///   done      (A1, mastered)            ← not a target; its due gaps stay reviewable
    ///   probeMe   (A1, never observed, no gaps) ← probe candidate
    /// ```
    struct SmallGraph {
        let store: AppStore
        let root = "root"
        let frontier = "frontier"
        let blocked = "blocked"
        let done = "done"
        let probeMe = "probe-me"

        var rootGapIds: [String] { (0..<6).map { "root-\($0)" } }
        var frontierGapIds: [String] { (0..<3).map { "frontier-\($0)" } }
        var blockedGapIds: [String] { (0..<3).map { "blocked-\($0)" } }
        var doneGapIds: [String] { (0..<2).map { "done-\($0)" } }
    }

    static func smallGraph() -> SmallGraph {
        let concepts = [
            learning("root", mastery: 0.5),
            concept("frontier", category: .vocabulary),
            concept("blocked", level: .A2, prerequisites: ["root"]),
            mastered("done", category: .vocabulary),
            concept("probe-me", category: .pronunciation),
        ]
        var gaps: [GapItem] = []
        // root: six gaps with increasing consecutiveCorrect → retrievability 0.40 … 0.95
        for i in 0..<6 {
            gaps.append(gap("root-\(i)", concept: "root", due: now.addingTimeInterval(-Double(i) * day), consecutiveCorrect: i))
        }
        // frontier: three fresh gaps, due now
        for i in 0..<3 {
            gaps.append(gap("frontier-\(i)", concept: "frontier", category: .vocabulary, due: now))
        }
        // blocked: three OVERDUE gaps (the review pool must never pull these in)
        for i in 0..<3 {
            gaps.append(gap("blocked-\(i)", concept: "blocked", level: .A2, due: now.addingTimeInterval(-5 * day)))
        }
        // done: two due gaps of a mastered concept (FSRS still wants them)
        for i in 0..<2 {
            gaps.append(gap("done-\(i)", concept: "done", category: .vocabulary,
                            due: now.addingTimeInterval(-2 * day), consecutiveCorrect: 2, reviewCount: 4))
        }
        let s = store(concepts: concepts, gaps: gaps)
        return SmallGraph(store: s)
    }
}
