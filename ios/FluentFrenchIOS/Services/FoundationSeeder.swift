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
        var taken = existingIds
        for cid in conceptIds {
            for gap in byConcept[cid] ?? [] {
                guard !excludedHeadwords.contains(headwordKey(gap.frenchWord)) else { continue }
                // An id already on the record under a headword that is NOT excluded is a
                // different item: content ids are array positions, so an item inserted
                // into a skill takes the id of the item it displaced. It used to be
                // skipped as "already present" and never delivered (engine-10-6).
                var copy = gap
                copy.id = availableId(for: gap, taken: taken)
                guard !taken.contains(copy.id) else { continue }
                taken.insert(copy.id)
                result.append(copy)
            }
        }
        return result
    }

    /// What says a content item is already on the learner's record: its stable
    /// content id, or its headword (content carries no id in hand-written tests, and
    /// a word the learner captured is the same card as the item with its headword).
    nonisolated struct ContentKey: Hashable {
        let itemId: String?
        let headword: String
    }

    /// Each concept's content items as `ContentKey`s.
    static func contentKeys(_ content: [GapItem]) -> [String: [ContentKey]] {
        var result: [String: [ContentKey]] = [:]
        for item in content {
            guard let cid = item.conceptId else { continue }
            result[cid, default: []].append(ContentKey(itemId: item.contentItemId, headword: headwordKey(item.frenchWord)))
        }
        return result
    }

    /// True when the learner's cards of one concept (`conceptGaps`) already hold its
    /// curriculum: at least `Tuning.foundationTopUpSeededShare` of its content items
    /// (`keys`), matched by content id or headword. A Foundation card that matches no
    /// current item still counts as one item held: only content seeding makes
    /// Foundation cards, so it is an item of an earlier content version (or of the
    /// inline fallback curriculum) the learner already has. A concept with no content
    /// holds all there is.
    ///
    /// The seeding door used to close on ANY card of the concept (engine-11-1): the
    /// one item a placement miss seeds (`Tuning.placementMissSeedItems`), or a word
    /// captured while reading and filed on the skill, stood in for the whole skill.
    /// Its other eleven authored items were never seeded by any path — the probe skips
    /// a concept with cards, the bridge stops at A2, the launch top-up waits for half
    /// the skill — and the concept was certified mastered on that single card. The
    /// share is the same line the launch top-up uses (`FoundationContentLoader.refreshSeeded`),
    /// so between them a skill is either seeded here or topped up there, never neither.
    static func holdsCurriculum(_ keys: [ContentKey], conceptGaps: [GapItem]) -> Bool {
        guard !keys.isEmpty else { return true }
        let cards = conceptGaps.filter { !$0.isProbe }
        let ids = Set(cards.compactMap { $0.contentItemId })
        let headwords = Set(cards.map { headwordKey($0.frenchWord) })
        let matched = keys.filter { key in
            (key.itemId.map { ids.contains($0) } ?? false) || headwords.contains(key.headword)
        }.count
        let keyIds = Set(keys.compactMap { $0.itemId })
        let keyHeadwords = Set(keys.map { $0.headword })
        let stale = cards.filter { card in
            card.sourceType == .foundation
                && !(card.contentItemId.map { keyIds.contains($0) } ?? false)
                && !keyHeadwords.contains(headwordKey(card.frenchWord))
        }.count
        let held = min(keys.count, matched + stale)
        return Double(held) >= Double(keys.count) * Tuning.foundationTopUpSeededShare
    }

    /// The gap's own id when it is free, else one derived from its headword — stable
    /// across launches, so the same item always lands under the same fallback id
    /// (engine-10-6).
    static func availableId(for gap: GapItem, taken: Set<String>) -> String {
        guard taken.contains(gap.id) else { return gap.id }
        return "\(gap.id)-\(stableHash(headwordKey(gap.frenchWord)))"
    }

    /// FNV-1a (64-bit) of a string, in hex: the same in every process, unlike Swift's
    /// per-run-seeded `Hasher`, so ids and fingerprints built from it persist safely.
    static func stableHash(_ text: String) -> String {
        let offsetBasis: UInt64 = 0xcbf2_9ce4_8422_2325   // FNV-1a 64-bit offset basis (algorithm constant)
        let prime: UInt64 = 0x0000_0100_0000_01B3          // FNV-1a 64-bit prime (algorithm constant)
        var hash = offsetBasis
        for byte in text.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* prime
        }
        return String(hash, radix: 16)
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
