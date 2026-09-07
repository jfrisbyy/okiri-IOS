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
    nonisolated static let day: TimeInterval = 86_400
    /// A fixed clock so every selection in the tests is reproducible.
    nonisolated static let now = Date(timeIntervalSince1970: 1_800_000_000)

    /// An in-memory store: seed taxonomy, no gaps, nothing persisted. Probe content
    /// is synthetic (no bundle on the test host), so probes and gap-less check-ins work.
    static func store() -> AppStore {
        let s = AppStore(persistence: nil)
        s.probeContent = syntheticProbes
        return s
    }

    /// An in-memory store holding exactly these concepts and gaps.
    static func store(concepts: [Concept], gaps: [GapItem], theta: Double = 0.2) -> AppStore {
        let s = store()
        s.concepts = concepts
        s.gaps = gaps
        s.abilityTheta = theta
        return s
    }

    /// The concepts the shipped `FoundationContent.json` actually covers. The map
    /// spans A1–C1 (D6.1) but content is authored band by band (D6.5): a concept
    /// with no content has no teaching, no probes and no items in the app — it shows
    /// on the map with its real state and seeds nothing. Fixtures must not invent
    /// content for it either, or every simulation measures a curriculum the product
    /// does not ship. GROW THIS LIST as each band is authored.
    nonisolated static let authoredConceptIds: Set<String> = [
        "definite-articles", "indefinite-articles", "noun-gender", "subject-pronouns",
        "present-er-verbs", "present-irregular", "basic-prepositions", "plurals", "negation",
        "questions", "possessive-adjectives", "c-est-il-y-a", "everyday-vocab", "numbers-time",
        "family-vocab", "food-drink-vocab", "home-vocab", "colors-vocab", "body-vocab",
        "clothing-vocab", "weather-vocab", "places-town-vocab", "directions-vocab", "jobs-vocab",
        "days-months-seasons", "common-adjectives", "common-verbs", "guttural-r", "nasal-vowels",
        "greetings-politeness", "tu-vs-vous", "adjective-agreement", "adjective-placement",
        "partitive-articles", "near-future", "reflexive-verbs", "passe-compose-avoir",
        "passe-compose-etre", "prepositions-place-time", "liaison", "everyday-connectors",
        "imparfait", "imparfait-vs-pc", "object-pronouns", "subjunctive-intro",
        "savoir-vs-connaitre", "spoken-fillers", "idioms", "formal-register",
    ]

    /// A `foundationContent` closure that supplies synthetic items for exactly the
    /// named concepts. Anything that asks whether a concept is TEACHABLE reads this
    /// same source (`AppStore.isTeachable`), so a fixture built on concepts that are
    /// not in the shipped content file must say so here — otherwise the store is
    /// correctly of the view that the app cannot teach them.
    nonisolated static func syntheticContent(for conceptIds: [String],
                                             itemsEach: Int = 3) -> (Date) -> [GapItem] {
        let skills = conceptIds.map { cid in
            FoundationSkillContent(id: cid, category: GapCategory.grammar.rawValue,
                                   items: (0..<itemsEach).map { i in
                                       FoundationItemContent(fr: "\(cid)-w\(i)", en: "\(cid)-e\(i)", note: "n",
                                                             ex: "x \(cid)-w\(i) y", exEn: "t", blank: "\(cid)-w\(i)")
                                   })
        }
        let file = FoundationContentFile(version: 2, skills: skills)
        return { when in FoundationContentLoader.gaps(from: file, now: when) }
    }

    /// Taxonomy concepts with no authored content yet.
    nonisolated static let unauthoredConceptIds: Set<String> =
        ConceptTaxonomy.ids.subtracting(authoredConceptIds)

    /// The concepts a fixture builds content for: the authored taxonomy concepts,
    /// plus anything outside the taxonomy (a synthetic graph names its own).
    nonisolated static func authoredConcepts(_ concepts: [Concept]) -> [Concept] {
        concepts.filter { !unauthoredConceptIds.contains($0.id) }
    }

    /// Three synthetic content-v2 probes per concept (tokens, not French): the
    /// prompt, the answer and three distractors, exactly the shape the loader yields.
    /// A concept in an unauthored band has none, exactly as in the shipped file.
    nonisolated static func syntheticProbes(for conceptId: String) -> [FoundationProbeContent] {
        guard !unauthoredConceptIds.contains(conceptId) else { return [] }
        return (0..<3).map { i in
            FoundationProbeContent(fr: "\(conceptId)-probe-\(i)-fr", en: "\(conceptId)-probe-\(i)-answer",
                                   ex: "\(conceptId)-probe-\(i)-ex", exEn: "\(conceptId)-probe-\(i)-exEn",
                                   options: ["\(conceptId)-d1", "\(conceptId)-d2", "\(conceptId)-d3"])
        }
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
        // Raw observations mirror the decode migration: the undecayed evidence
        // above the (1, 1) prior.
        Concept(id: id, name: "Concept \(id)", category: category, cefrLevel: level,
                prerequisites: prerequisites, description: "Synthetic concept \(id).",
                alpha: alpha, beta: beta, lastTestedAt: nil, observationCount: max(0, alpha + beta - 2),
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

    /// An FSRS memory state as the Foundation loader creates it (fresh, never-answered
    /// card: due now, zero lapses — see `FSRS.makeUnseenState`).
    static func freshFsrs(at when: Date = now) -> FsrsState {
        FSRS.makeUnseenState(now: when)
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
