//
//  ConceptTaxonomyTests.swift
//  FluentFrenchIOSTests
//
//  Package D6.2 — the concept map is a directed acyclic graph and shipped ids are
//  permanent. These tests are the guard rail for the taxonomy itself: every
//  prerequisite resolves, nothing depends on a concept above its own CEFR band,
//  the graph never loops, and no concept id that has shipped (all 181 of the A1–C1
//  map, engine-11-7) can be renamed, removed or re-levelled — persisted learner state
//  (`gaps.conceptId`), `baseConceptIds` and the FoundationContent skill ids all
//  point at them by slug.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct ConceptTaxonomyTests {

    private let taxonomy = ConceptTaxonomy.seed()
    private var byId: [String: Concept] { Dictionary(taxonomy.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a }) }

    /// The 49 concepts that shipped before the A1–C1 extension, with the level each
    /// shipped at. Hard-coded on purpose: this list is the regression guard, so it
    /// must not be derived from the taxonomy it is checking.
    private static let shippedIds: [(String, CEFRLevel)] = [
        ("definite-articles", .A1), ("indefinite-articles", .A1), ("noun-gender", .A1),
        ("subject-pronouns", .A1), ("present-er-verbs", .A1), ("present-irregular", .A1),
        ("basic-prepositions", .A1), ("plurals", .A1), ("negation", .A1), ("questions", .A1),
        ("possessive-adjectives", .A1), ("c-est-il-y-a", .A1), ("everyday-vocab", .A1),
        ("numbers-time", .A1), ("family-vocab", .A1), ("food-drink-vocab", .A1),
        ("home-vocab", .A1), ("colors-vocab", .A1), ("body-vocab", .A1), ("clothing-vocab", .A1),
        ("weather-vocab", .A1), ("places-town-vocab", .A1), ("directions-vocab", .A1),
        ("jobs-vocab", .A1), ("days-months-seasons", .A1), ("common-adjectives", .A1),
        ("common-verbs", .A1), ("guttural-r", .A1), ("nasal-vowels", .A1),
        ("greetings-politeness", .A1), ("tu-vs-vous", .A1),
        ("adjective-agreement", .A2), ("adjective-placement", .A2), ("partitive-articles", .A2),
        ("near-future", .A2), ("reflexive-verbs", .A2), ("passe-compose-avoir", .A2),
        ("passe-compose-etre", .A2), ("prepositions-place-time", .A2), ("liaison", .A2),
        ("everyday-connectors", .A2),
        ("imparfait", .B1), ("imparfait-vs-pc", .B1), ("object-pronouns", .B1),
        ("subjunctive-intro", .B1), ("savoir-vs-connaitre", .B1), ("spoken-fillers", .B1),
        ("idioms", .B1), ("formal-register", .B1),
    ]

    /// EVERY concept id that has shipped, with its level: all 181 of the A1–C1 map
    /// (engine-11-7). Every one is written into each learner's persisted `concepts`
    /// blob and cloud snapshot, and since the A1/A2 content merge 82 of them carry
    /// content skill ids and seeded gaps — yet the guard above froze only the 49 that
    /// predate the extension, so renaming or re-levelling `il-faut-necessity` or
    /// `polite-requests` failed no test. Hard-coded for the same reason as
    /// `shippedIds`. This list may only GROW: a new concept is appended here when it
    /// ships, and nothing in it is ever edited or removed.
    private static let frozenIds: [(String, CEFRLevel)] = [
        ("definite-articles", .A1), ("indefinite-articles", .A1), ("noun-gender", .A1),
        ("subject-pronouns", .A1), ("present-er-verbs", .A1), ("present-irregular", .A1),
        ("basic-prepositions", .A1), ("plurals", .A1), ("negation", .A1), ("questions", .A1),
        ("possessive-adjectives", .A1), ("c-est-il-y-a", .A1), ("everyday-vocab", .A1), ("numbers-time", .A1),
        ("family-vocab", .A1), ("food-drink-vocab", .A1), ("home-vocab", .A1), ("colors-vocab", .A1),
        ("body-vocab", .A1), ("clothing-vocab", .A1), ("weather-vocab", .A1), ("places-town-vocab", .A1),
        ("directions-vocab", .A1), ("jobs-vocab", .A1), ("days-months-seasons", .A1),
        ("common-adjectives", .A1), ("common-verbs", .A1), ("guttural-r", .A1), ("nasal-vowels", .A1),
        ("greetings-politeness", .A1), ("silent-final-consonants", .A1), ("accent-marks", .A1),
        ("elision", .A1), ("avoir-expressions", .A1), ("tu-vs-vous", .A1), ("adjective-agreement", .A2),
        ("adjective-placement", .A2), ("partitive-articles", .A2), ("near-future", .A2),
        ("reflexive-verbs", .A2), ("passe-compose-avoir", .A2), ("passe-compose-etre", .A2),
        ("prepositions-place-time", .A2), ("liaison", .A2), ("everyday-connectors", .A2),
        ("present-ir-re-verbs", .A2), ("imperative", .A2), ("modal-verbs", .A2), ("il-faut-necessity", .A2),
        ("futur-simple", .A2), ("venir-de-recent-past", .A2), ("etre-en-train-de", .A2), ("on-pronoun", .A2),
        ("stressed-pronouns", .A2), ("contractions-au-du", .A2), ("de-after-negation", .A2),
        ("quantity-expressions", .A2), ("demonstrative-adjectives", .A2), ("comparatives-superlatives", .A2),
        ("adverb-formation", .A2), ("countries-prepositions", .A2), ("depuis-pendant-il-y-a", .A2),
        ("shopping-money-vocab", .A2), ("travel-transport-vocab", .A2), ("health-vocab", .A2),
        ("daily-routine-vocab", .A2), ("leisure-sports-vocab", .A2), ("describing-people", .A2),
        ("feelings-vocab", .A2), ("e-muet", .A2), ("vowel-contrasts", .A2), ("rhythm-and-stress", .A2),
        ("everyday-transactions", .A2), ("polite-requests", .A2), ("imparfait", .B1), ("imparfait-vs-pc", .B1),
        ("object-pronouns", .B1), ("subjunctive-intro", .B1), ("savoir-vs-connaitre", .B1),
        ("spoken-fillers", .B1), ("idioms", .B1), ("formal-register", .B1), ("en-y-pronouns", .B1),
        ("pronoun-order", .B1), ("imperative-with-pronouns", .B1), ("possessive-pronouns", .B1),
        ("demonstrative-pronouns", .B1), ("reversed-verbs-manquer-plaire", .B1), ("relative-qui-que", .B1),
        ("relative-dont-ou", .B1), ("interrogative-pronouns", .B1), ("plus-que-parfait", .B1),
        ("past-participle-agreement", .B1), ("conditionnel-present", .B1), ("si-clauses-present", .B1),
        ("si-clauses-imperfect", .B1), ("future-after-quand", .B1), ("subjunctive-after-emotion", .B1),
        ("gerund-en-participle", .B1), ("infinitive-complements", .B1), ("pronominal-verbs-uses", .B1),
        ("impersonal-expressions", .B1), ("negation-beyond-pas", .B1), ("irregular-comparatives", .B1),
        ("written-homophones", .B1), ("work-and-study-vocab", .B1), ("technology-internet-vocab", .B1),
        ("false-friends", .B1), ("leaving-verbs", .B1), ("bringing-taking-verbs", .B1), ("liaison-rules", .B1),
        ("intonation", .B1), ("sequencing-a-story", .B1), ("expressing-opinion", .B1),
        ("spoken-vs-written-french", .B1), ("subjunctive-after-conjunctions", .B2), ("subjunctive-past", .B2),
        ("subjunctive-vs-indicative", .B2), ("conditionnel-passe", .B2), ("si-clauses-past", .B2),
        ("reported-speech", .B2), ("reported-questions", .B2), ("passive-voice", .B2),
        ("passive-alternatives", .B2), ("causative-faire", .B2), ("relative-lequel", .B2),
        ("futur-anterieur", .B2), ("participle-agreement-pronominal", .B2), ("infinitive-clauses", .B2),
        ("adjective-position-meaning", .B2), ("indefinite-pronouns", .B2), ("prepositions-nuance", .B2),
        ("stylistic-inversion", .B2), ("news-and-media-vocab", .B2), ("society-politics-vocab", .B2),
        ("business-and-economy-vocab", .B2), ("science-environment-vocab", .B2), ("arts-culture-vocab", .B2),
        ("word-building", .B2), ("spoken-reductions", .B2), ("linking-and-enchainement", .B2),
        ("verb-noun-collocations", .B2), ("argument-connectors", .B2), ("structuring-an-argument", .B2),
        ("hedging-and-nuance", .B2), ("polite-disagreement", .B2), ("cleft-and-dislocation", .B2),
        ("reformulating", .B2), ("fixed-prepositional-phrases", .B2), ("soutenu-courant-familier", .B2),
        ("professional-writing-register", .B2), ("passe-simple", .C1), ("literary-tenses", .C1),
        ("subjunctive-in-relative-clauses", .C1), ("subjunctive-after-superlative", .C1),
        ("sequence-of-tenses", .C1), ("conditional-of-report", .C1), ("ne-expletif", .C1),
        ("soutenu-negation", .C1), ("participle-agreement-edge-cases", .C1),
        ("perception-and-causative-verbs", .C1), ("aspectual-periphrases", .C1), ("impersonal-soutenu", .C1),
        ("academic-lexicon", .C1), ("administrative-french", .C1), ("proverbs-and-references", .C1),
        ("anglicisms-and-neologisms", .C1), ("french-varieties", .C1), ("synonym-precision", .C1),
        ("regional-accents", .C1), ("expressive-intonation", .C1), ("idiomatic-fluency", .C1),
        ("irony-and-understatement", .C1), ("written-cohesion", .C1), ("debate-and-persuasion", .C1),
        ("storytelling-and-anecdote", .C1), ("register-switching", .C1), ("argot-and-familiar-speech", .C1),
        ("verlan-and-youth-language", .C1), ("strong-language-awareness", .C1),
        ("literary-and-journalistic-register", .C1),
    ]

    // MARK: Identity

    @Test func idsAreUniqueAndWellFormed() {
        let ids = taxonomy.map { $0.id }
        #expect(Set(ids).count == ids.count, "duplicate concept id")
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789-")
        for concept in taxonomy {
            #expect(concept.id.unicodeScalars.allSatisfy { allowed.contains($0) },
                    "\(concept.id) is not a lowercase-hyphenated slug")
            #expect(!concept.name.isEmpty && !concept.description.isEmpty, "\(concept.id) needs a name and a description")
        }
    }

    /// Constraint 1: shipped slugs are load-bearing for persisted learner state.
    @Test func everyShippedConceptIsStillPresentAtItsOriginalLevel() throws {
        let map = byId
        #expect(Self.shippedIds.count == 49)
        for (id, level) in Self.shippedIds {
            let concept = try #require(map[id], "\(id) was removed or renamed — persisted gaps point at it")
            #expect(concept.cefrLevel == level, "\(id) was re-levelled from \(level) to \(concept.cefrLevel)")
        }
    }

    /// engine-11-7: no shipped concept — not only the first 49 — may be renamed,
    /// removed or re-levelled, and a concept added to the map must be frozen here.
    @Test func everyFrozenConceptIsStillPresentAtItsLevelAndNewOnesAreFrozen() throws {
        let map = byId
        #expect(Self.frozenIds.count >= 181, "the frozen list only grows; it held 181 ids when it was written")
        #expect(Set(Self.frozenIds.map { $0.0 }).count == Self.frozenIds.count, "an id is frozen twice")
        for (id, level) in Self.frozenIds {
            let concept = try #require(map[id], "\(id) was removed or renamed — persisted concepts and gaps point at it")
            #expect(concept.cefrLevel == level, "\(id) was re-levelled from \(level) to \(concept.cefrLevel)")
        }
        let frozen = Set(Self.frozenIds.map { $0.0 })
        for concept in taxonomy where !frozen.contains(concept.id) {
            Issue.record("\(concept.id) is new: append it to frozenIds so its id is guarded from now on")
        }
        // The original 49 are a subset, at the same levels.
        let frozenLevels = Dictionary(Self.frozenIds.map { ($0.0, $0.1) }, uniquingKeysWith: { a, _ in a })
        for (id, level) in Self.shippedIds {
            #expect(frozenLevels[id] == level, "\(id) is missing from frozenIds or frozen at another level")
        }
    }

    @Test func baseConceptIdsAllResolve() {
        let map = byId
        for id in ConceptTaxonomy.baseConceptIds {
            #expect(map[id] != nil, "baseConceptIds references \(id), which is not in the taxonomy")
        }
        #expect(ConceptTaxonomy.ids == Set(taxonomy.map { $0.id }))
    }

    // MARK: The graph

    @Test func everyPrerequisiteResolves() {
        let map = byId
        for concept in taxonomy {
            for prerequisite in concept.prerequisites {
                #expect(map[prerequisite] != nil,
                        "\(concept.id) requires \(prerequisite), which is not a concept")
            }
        }
    }

    /// A prerequisite above its dependent's band is always an authoring bug: it makes
    /// the dependent unreachable inside the learner's own level.
    @Test func noPrerequisiteSitsAboveItsDependentsLevel() {
        let map = byId
        for concept in taxonomy {
            for prerequisite in concept.prerequisites {
                guard let required = map[prerequisite] else { continue }
                #expect(required.cefrLevel.order <= concept.cefrLevel.order,
                        "\(concept.id) (\(concept.cefrLevel)) requires \(prerequisite) (\(required.cefrLevel))")
            }
        }
    }

    /// Depth-first search with an explicit recursion stack: a prerequisite edge back
    /// into the stack is a cycle, and the selector would loop on it forever.
    @Test func theGraphIsAcyclic() {
        let map = byId
        var visited = Set<String>()
        var stack: [String] = []
        var onStack = Set<String>()
        var cycles: [String] = []

        func walk(_ id: String) {
            if onStack.contains(id) {
                let loop = stack.drop(while: { $0 != id }) + [id]
                cycles.append(loop.joined(separator: " → "))
                return
            }
            if visited.contains(id) { return }
            visited.insert(id)
            onStack.insert(id)
            stack.append(id)
            for prerequisite in map[id]?.prerequisites ?? [] where map[prerequisite] != nil {
                walk(prerequisite)
            }
            stack.removeLast()
            onStack.remove(id)
        }

        for concept in taxonomy { walk(concept.id) }
        #expect(cycles.isEmpty, "prerequisite cycle: \(cycles.joined(separator: "; "))")
        #expect(visited.count == taxonomy.count)
    }

    @Test func noConceptRequiresItself() {
        for concept in taxonomy {
            #expect(!concept.prerequisites.contains(concept.id), "\(concept.id) requires itself")
            #expect(Set(concept.prerequisites).count == concept.prerequisites.count,
                    "\(concept.id) lists a prerequisite twice")
        }
    }

    // MARK: Coverage

    @Test func everyCategoryIsRepresented() {
        let byCategory = Dictionary(grouping: taxonomy, by: { $0.category })
        for category in GapCategory.allCases {
            #expect(!(byCategory[category] ?? []).isEmpty, "no concept in \(category.rawValue)")
        }
        // Phrasing is what separates B2 from B1, so it must exist above A2.
        #expect(taxonomy.contains { $0.category == .phrasing && $0.cefrLevel == .B2 })
        #expect(taxonomy.contains { $0.category == .phrasing && $0.cefrLevel == .C1 })
    }

    @Test func everyBandFromA1ToC1IsSubstantial() {
        let byLevel = Dictionary(grouping: taxonomy, by: { $0.cefrLevel })
        for level in [CEFRLevel.A1, .A2, .B1, .B2, .C1] {
            let count = (byLevel[level] ?? []).count
            #expect(count >= 20, "\(level) has only \(count) concepts")
        }
        #expect((byLevel[.C2] ?? []).isEmpty, "the map stops at C1")
    }

    /// Above A1 every concept hangs off something: a band-2-and-up concept with no
    /// prerequisites is an orphan the selector would offer to a day-one beginner.
    @Test func everyConceptAboveA1HasAPrerequisite() {
        for concept in taxonomy where concept.cefrLevel != .A1 {
            #expect(!concept.prerequisites.isEmpty, "\(concept.id) (\(concept.cefrLevel)) has no prerequisite")
        }
    }
}
