//
//  ConceptTaxonomyTests.swift
//  FluentFrenchIOSTests
//
//  Package D6.2 — the concept map is a directed acyclic graph and shipped ids are
//  permanent. These tests are the guard rail for the taxonomy itself: every
//  prerequisite resolves, nothing depends on a concept above its own CEFR band,
//  the graph never loops, and none of the 49 ids that were live before the A1–C1
//  extension can be renamed, removed or re-levelled — persisted learner state
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
