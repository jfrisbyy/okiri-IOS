//
//  LessonAssembler.swift
//  FluentFrenchIOS
//
//  Turns the selected target concept into an ordered, interleaved item set:
//  ~60–70% target-concept gaps as the spine, the rest the most-overdue reviews
//  from other concepts, confusion pairs placed adjacent, plus data-driven reasons
//  and an occasional blind-spot probe. Hands a plain ordered [GapItem] to the
//  existing LessonService/generator — question generation stays untouched.
//

import Foundation

@MainActor
struct LessonAssembler {
    let store: AppStore
    var config: LessonAssemblyConfig = .tuning
    var weights: ConceptSelectionWeights = .tuning

    func assemble() -> AssembledLesson? {
        let selector = ConceptSelector(store: store, weights: weights)
        guard let (target, _) = selector.select() else { return nil }

        let size = max(3, config.lessonSize)
        let spineCount = max(1, Int((Double(size) * config.targetRatio).rounded()))

        // 1. Spine — the target concept's active gaps, weakest first.
        let spine = store.gaps(forConcept: target.id)
            .filter { !$0.isMastered }
            .sorted { $0.retrievability < $1.retrievability }

        var chosen: [GapItem] = Array(spine.prefix(spineCount))
        var chosenIds = Set(chosen.map { $0.id })

        // 2. Interleaved review — most-overdue due gaps from OTHER concepts.
        let now = Date()
        let reviewPool = store.activeGaps
            .filter { !chosenIds.contains($0.id) && $0.conceptId != target.id }
            .filter { $0.nextReviewAt <= now.addingTimeInterval(config.dueWindowDays * 86_400) }
            .sorted { $0.nextReviewAt < $1.nextReviewAt }

        for gap in reviewPool {
            if chosen.count >= size { break }
            chosen.append(gap)
            chosenIds.insert(gap.id)
        }

        // Top up from the rest of the target concept / any active gap if short.
        if chosen.count < size {
            let filler = (spine.dropFirst(spineCount) + store.activeGaps)
                .filter { !chosenIds.contains($0.id) }
            for gap in filler {
                if chosen.count >= size { break }
                chosen.append(gap)
                chosenIds.insert(gap.id)
            }
        }

        // 3. Order: target-concept items first (teaching lead), then reviews.
        chosen.sort { a, b in
            let aTarget = a.conceptId == target.id
            let bTarget = b.conceptId == target.id
            if aTarget != bTarget { return aTarget }
            return a.retrievability < b.retrievability    // hardest near the end within group
        }

        // 4. Confusion rule: place confusion-linked pairs adjacent.
        chosen = applyConfusionAdjacency(chosen)

        // 5. Reasons + headline.
        let reasons = buildReasons(for: chosen, target: target)
        let headline = buildHeadline(target: target)

        // 6. Blind-spot probe (rare).
        var probeId: String? = nil
        if let probe = blindSpotProbe(excluding: chosenIds, selector: selector) {
            store.gaps.insert(probe, at: 0)   // track it so it persists / can be tagged
            chosen.append(probe)
            probeId = probe.id
        }

        // 7. Teaching skill cards — target concept first, then other blocks.
        let blocks = buildConceptBlocks(for: chosen, target: target, reasons: reasons)

        return AssembledLesson(targetConcept: target, gaps: chosen,
                               reasons: reasons, headline: headline, probeGapId: probeId,
                               conceptBlocks: blocks)
    }

    // MARK: - Scoped mode

    /// Order an already-chosen candidate set (a category, a deck, a review set)
    /// the same intelligent way as a full lesson — weakest first, confusion pairs
    /// adjacent, per-item reasons, a scope headline and skill cards — WITHOUT
    /// re-selecting a different target concept. The user already declared intent.
    func assembleScoped(candidates: [GapItem], scopeName: String) -> AssembledLesson {
        // Spine ordering: weakest (lowest retrievability) first.
        var ordered = candidates.sorted { $0.retrievability < $1.retrievability }
        // Confusion adjacency within the provided set only.
        ordered = applyConfusionAdjacency(ordered)

        let reasons = buildScopedReasons(for: ordered)
        let headline = "Reviewing: \(scopeName)"
        let blocks = buildConceptBlocks(for: ordered, target: nil, reasons: reasons)

        return AssembledLesson(targetConcept: nil, gaps: ordered,
                               reasons: reasons, headline: headline, probeGapId: nil,
                               conceptBlocks: blocks)
    }

    // MARK: - Capstone

    /// Build a broad, mixed quiz set pulling from everything touched recently,
    /// leaning toward 'learning' concepts trending toward mastery (does the skill
    /// survive interleaving and time?). Pure test — no teaching cards.
    func capstoneGaps() -> [GapItem] {
        func priority(_ g: GapItem) -> Int {
            guard let c = store.concept(g.conceptId) else { return 0 }
            if c.state == .learning && c.mastery >= 0.6 { return 2 }
            if c.state == .learning { return 1 }
            return 0
        }
        let pool = store.gaps.filter { !$0.isMastered }
        let sorted = pool.sorted { a, b in
            let pa = priority(a), pb = priority(b)
            if pa != pb { return pa > pb }
            return (a.lastReviewedAt ?? .distantPast) > (b.lastReviewedAt ?? .distantPast)
        }
        return Array(sorted.prefix(Tuning.capstoneSize))
    }

    // MARK: - Confusion adjacency

    private func applyConfusionAdjacency(_ gaps: [GapItem]) -> [GapItem] {
        var result = gaps
        let ids = Set(gaps.map { $0.id })
        var i = 0
        while i < result.count {
            let gap = result[i]
            if let link = gap.confusionLinks.sorted(by: { $0.strength > $1.strength }).first(where: { ids.contains($0.partnerGapId) }),
               let partnerIdx = result.firstIndex(where: { $0.id == link.partnerGapId }),
               partnerIdx != i + 1, partnerIdx != i {
                let partner = result.remove(at: partnerIdx)
                let insertAt = result.firstIndex(where: { $0.id == gap.id }).map { $0 + 1 } ?? (i + 1)
                result.insert(partner, at: min(insertAt, result.count))
            }
            i += 1
        }
        return result
    }

    // MARK: - Reasons (legibility)

    private func buildReasons(for gaps: [GapItem], target: Concept) -> [String: String] {
        var reasons: [String: String] = [:]
        let now = Date()
        for gap in gaps {
            if let link = gap.confusionLinks.max(by: { $0.strength < $1.strength }),
               let partner = store.gaps.first(where: { $0.id == link.partnerGapId }) {
                reasons[gap.id] = "You keep confusing this with “\(partner.frenchWord)”."
            } else if gap.conceptId == target.id, target.newlyUnlocked {
                reasons[gap.id] = "New skill you're ready for: \(target.name)."
            } else if gap.reviewCount >= 2 && gap.nextReviewAt < now {
                reasons[gap.id] = "You've missed this \(gap.reviewCount)× — time to lock it in."
            } else if !store.dependents(of: gap.conceptId ?? "").isEmpty,
                      let dep = store.dependents(of: gap.conceptId ?? "").first {
                reasons[gap.id] = "This unlocks \(dep.name)."
            } else if gap.conceptId == target.id {
                reasons[gap.id] = "Today's focus: \(target.name)."
            } else {
                reasons[gap.id] = "Due for review."
            }
        }
        return reasons
    }

    /// Reasons for a scoped lesson — no target concept, so lean on confusion,
    /// miss-count, due-ness and concept membership.
    private func buildScopedReasons(for gaps: [GapItem]) -> [String: String] {
        var reasons: [String: String] = [:]
        let now = Date()
        for gap in gaps {
            if let link = gap.confusionLinks.max(by: { $0.strength < $1.strength }),
               let partner = store.gaps.first(where: { $0.id == link.partnerGapId }) {
                reasons[gap.id] = "You keep confusing this with “\(partner.frenchWord)”."
            } else if gap.reviewCount >= 2 && gap.nextReviewAt < now {
                reasons[gap.id] = "You've missed this \(gap.reviewCount)× — time to lock it in."
            } else if gap.nextReviewAt <= now {
                reasons[gap.id] = "Due for review."
            } else if let concept = store.concept(gap.conceptId) {
                reasons[gap.id] = "Part of \(concept.name)."
            } else {
                reasons[gap.id] = "Strengthening this one."
            }
        }
        return reasons
    }

    // MARK: - Teaching skill cards

    /// One ConceptBlock per distinct concept present in the lesson, target first.
    /// Pulls a real worked example from the lesson's own gaps and reuses the
    /// already-built reason line. Capped so lessons don't become a slog.
    private func buildConceptBlocks(for gaps: [GapItem], target: Concept?, reasons: [String: String]) -> [ConceptBlock] {
        var blocks: [ConceptBlock] = []
        var seen = Set<String>()

        func makeBlock(_ concept: Concept) -> ConceptBlock {
            let example = gaps.first { $0.conceptId == concept.id && !$0.exampleSentence.isEmpty }
                ?? gaps.first { $0.conceptId == concept.id }
                ?? store.gaps(forConcept: concept.id).first { !$0.exampleSentence.isEmpty }
            let reason = example.flatMap { reasons[$0.id] }
            return ConceptBlock(concept: concept, explanation: concept.description,
                                example: example, reason: reason)
        }

        if let target {
            blocks.append(makeBlock(target))
            seen.insert(target.id)
        }
        for gap in gaps {
            guard let cid = gap.conceptId, !seen.contains(cid),
                  let concept = store.concept(cid) else { continue }
            seen.insert(cid)
            blocks.append(makeBlock(concept))
            if blocks.count >= config.maxConceptCards { break }
        }
        return blocks
    }

    private func buildHeadline(target: Concept) -> String {
        let conceptGaps = store.gaps(forConcept: target.id).filter { !$0.isMastered }
        let missed = conceptGaps.map { $0.reviewCount }.reduce(0, +)
        if target.newlyUnlocked {
            return "Today: \(target.name) — you're ready for this new skill."
        }
        if missed > 0 {
            return "Today: \(target.name) — you've slipped on it \(missed) time\(missed == 1 ? "" : "s")."
        }
        return "Today: \(target.name)."
    }

    // MARK: - Blind-spot probe

    /// Occasionally inject ONE diagnostic item for a never-observed frontier concept
    /// the learner has no gap for yet. Kept rare so lessons stay relevant.
    private func blindSpotProbe(excluding excluded: Set<String>, selector: ConceptSelector) -> GapItem? {
        guard config.probeEveryNSessions > 0,
              store.sessionIndex % config.probeEveryNSessions == 0 else { return nil }

        // Frontier concepts the user has NOT generated a gap for.
        let frontier = store.concepts.filter {
            selector.isFrontier($0) && store.gaps(forConcept: $0.id).isEmpty
        }
        guard let concept = frontier.sorted(by: { $0.cefrLevel.order < $1.cefrLevel.order }).first else { return nil }

        let now = Date()
        return GapItem(
            id: "probe-\(UUID().uuidString)",
            frenchWord: concept.name,
            englishTranslation: concept.description,
            explanation: "Quick check: \(concept.description)",
            exampleSentence: "",
            exampleTranslation: "",
            pronunciation: nil,
            sourceType: .foundation,
            category: concept.category,
            difficulty: .okay,
            reviewCount: 0,
            consecutiveCorrect: 0,
            lastReviewedAt: nil,
            nextReviewAt: now,
            masteredAt: nil,
            createdAt: now,
            cefrLevel: concept.cefrLevel,
            easeFactor: 2.5,
            currentInterval: 0,
            irtDifficulty: 0,
            fsrs: nil,
            originalContext: nil,
            confusionLinks: [],
            conceptId: concept.id
        )
    }
}
