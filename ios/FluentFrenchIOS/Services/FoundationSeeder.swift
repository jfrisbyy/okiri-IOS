//
//  FoundationSeeder.swift
//  FluentFrenchIOS
//
//  Which Foundation content a learner is seeded with, and when it comes due
//  (Package D3 / D4). Pure functions over the loader's gaps so the store's
//  `applyPlacement` and `seedBridgeContentIfNeeded` stay thin and the rules are
//  testable without a bundle:
//
//    • A first run seeds the BASE concepts only (`ConceptTaxonomy.baseConceptIds`)
//      plus the Foundation gaps of every concept placement seeded as provisional
//      mastery — those gaps are the vehicles for the verification check-ins and
//      what gets taught if a seed fails (B7). Nothing above A1 is seeded on day one.
//    • The A2 "bridge" skills (A2 concepts outside the base set) are seeded once
//      reading opens, or at placement for a learner who skips Foundation, so a
//      straight-to-reading learner never starts with zero gaps (D4).
//    • Seeded gaps are STAGGERED in concept order: about `Tuning.foundationSeedBatch`
//      items come due per day, whole concepts at a time, so day one shows a
//      handful of cards as due rather than the whole curriculum (D3). Items that
//      are not yet due stay practicable for the selector — the stagger shapes the
//      "Due now" count and review urgency, never eligibility.
//

import Foundation

nonisolated enum FoundationSeeder {
    /// Taxonomy order of every concept id (the order concepts are seeded in).
    static var taxonomyOrder: [String] { ConceptTaxonomy.seed().map { $0.id } }

    /// Base concept ids in taxonomy order — the first-run Foundation spine.
    static var baseConceptIds: [String] {
        taxonomyOrder.filter { ConceptTaxonomy.baseConceptIds.contains($0) }
    }

    /// The bridge skills in taxonomy order: every concept up to A2 that is not a base
    /// concept (the A2 grammar bridge plus the A1 pronunciation / register skills the
    /// text placement never judges). Seeded when reading opens, never on day one.
    static var bridgeConceptIds: [String] {
        let levels = Dictionary(ConceptTaxonomy.seed().map { ($0.id, $0.cefrLevel) }, uniquingKeysWith: { a, _ in a })
        return taxonomyOrder.filter { id in
            guard let level = levels[id], !ConceptTaxonomy.baseConceptIds.contains(id) else { return false }
            return level == .A1 || level == .A2
        }
    }

    /// The concept ids a first run seeds: the base set plus every placement-seeded
    /// concept (provisional seeds keep their gaps for check-ins and re-teaching),
    /// in taxonomy order. Concepts unknown to the taxonomy come last.
    static func firstRunConceptIds(seededMastered: [String]) -> [String] {
        let wanted = ConceptTaxonomy.baseConceptIds.union(seededMastered)
        let ordered = taxonomyOrder.filter { wanted.contains($0) }
        let extra = seededMastered.filter { !taxonomyOrder.contains($0) }
        return ordered + extra
    }

    /// The gaps of `conceptIds` (grouped and ordered as `conceptIds`), skipping any
    /// whose headword is in `excludedHeadwords` (a placement already captured that
    /// word as a missed item) and any whose id is in `existingIds`.
    static func slice(from content: [GapItem], conceptIds: [String],
                      excludedHeadwords: Set<String> = [], existingIds: Set<String> = []) -> [GapItem] {
        let byConcept = Dictionary(grouping: content.filter { $0.conceptId != nil }, by: { $0.conceptId! })
        var result: [GapItem] = []
        for cid in conceptIds {
            for gap in byConcept[cid] ?? [] {
                guard !existingIds.contains(gap.id), !excludedHeadwords.contains(headwordKey(gap.frenchWord)) else { continue }
                result.append(gap)
            }
        }
        return result
    }

    /// Stagger `gaps` (already in concept order) so roughly `batch` items come due
    /// per day, whole concepts at a time: a concept's items all come due on the day
    /// `itemsBefore / batch` days after `now`. The first concepts are due at `now`.
    /// Both `nextReviewAt` and the FSRS `dueAt` move; nothing else changes.
    static func staggered(_ gaps: [GapItem], batch: Int, now: Date, calendar: Calendar = .current) -> [GapItem] {
        guard batch > 0 else { return gaps }
        var result: [GapItem] = []
        result.reserveCapacity(gaps.count)
        var itemsBefore = 0
        var currentConcept: String? = nil
        var conceptStart = 0
        for gap in gaps {
            if gap.conceptId != currentConcept {
                currentConcept = gap.conceptId
                conceptStart = itemsBefore
            }
            let dayOffset = conceptStart / batch
            let due = dayOffset == 0 ? now : (calendar.date(byAdding: .day, value: dayOffset, to: now)
                                              ?? now.addingTimeInterval(Double(dayOffset) * 86_400))
            var copy = gap
            copy.nextReviewAt = due
            copy.fsrs?.dueAt = due
            result.append(copy)
            itemsBefore += 1
        }
        return result
    }

    /// Normalised headword used to keep a placement's missed item and the same
    /// Foundation item from both being seeded.
    static func headwordKey(_ word: String) -> String {
        word.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
