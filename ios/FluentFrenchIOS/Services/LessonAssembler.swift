//
//  LessonAssembler.swift
//  FluentFrenchIOS
//
//  Turns a `SelectionOutput` into an ordered lesson. It picks NOTHING: every gap
//  here was chosen by `ConceptSelector`. The assembler resolves the selected items
//  to gap records (materialising a probe on demand), groups them by role — target
//  spine first as the teaching lead, then interleaved review, probe last — places
//  confusion-linked pairs adjacent, attaches the selector's reasons and headline,
//  and builds the teaching "skill cards". Hands a plain ordered [GapItem] to the
//  existing LessonService/generator — question generation stays untouched.
//

import Foundation

@MainActor
struct LessonAssembler {
    let store: AppStore
    var config: LessonAssemblyConfig = .tuning

    init(store: AppStore, config: LessonAssemblyConfig = .tuning) {
        self.store = store
        self.config = config
    }

    // MARK: - Assemble (the only way a lesson is built)

    /// Order, pair and decorate the items the selector chose. Returns nil when the
    /// selection is empty or none of its items can be resolved.
    func assemble(_ output: SelectionOutput) -> AssembledLesson? {
        guard !output.items.isEmpty else { return nil }
        let target = store.concept(output.targetConceptId)

        // 1. Resolve items to gap records. Probes have no record until now.
        var byId: [String: GapItem] = [:]
        for gap in store.gaps where byId[gap.id] == nil { byId[gap.id] = gap }

        var resolved: [(item: SelectedItem, gap: GapItem)] = []
        var probeGapId: String? = nil
        for item in output.items {
            if let gap = byId[item.gapId] {
                resolved.append((item, gap))
                if item.role == .probe { probeGapId = gap.id }
            } else if item.role == .probe || item.role == .checkIn, let concept = store.concept(item.conceptId),
                      let gap = store.materializeProbeGap(id: item.gapId, for: concept, now: output.request.now) {
                // A probe — or a check-in on a concept with no gaps of its own — is a
                // real French probe item built from the content's `probes` (B13).
                resolved.append((item, gap))
                if item.role == .probe { probeGapId = gap.id }
            }
            // An item whose gap is gone (or a probe with no content behind it) is
            // dropped: nothing is substituted for it.
        }
        guard !resolved.isEmpty else { return nil }

        // 2. Order by role (target → check-in → review → probe), keeping the
        //    selector's own priority order within each role.
        let ordered = resolved.enumerated()
            .sorted { a, b in
                let ra = Self.roleRank(a.element.item.role), rb = Self.roleRank(b.element.item.role)
                if ra != rb { return ra < rb }
                return a.offset < b.offset
            }
            .map { $0.element.gap }

        // 3. Confusion rule: place confusion-linked pairs adjacent.
        let gaps = applyConfusionAdjacency(ordered)

        // 4. Reasons + headline come from the selector; skill cards are built here.
        //    A capstone is a pure test: no teaching cards.
        let reasons = output.reasonsByGapId
        // A probe item is never teaching material: a card built from it would hand
        // the learner the answer to the very question that is meant to diagnose
        // whether they already knew it.
        let probeIds = Set(resolved.filter { $0.item.role == .probe || $0.gap.isProbe }.map { $0.gap.id })
        let blocks = output.mode.isCapstone ? [] : buildConceptBlocks(for: gaps, target: target, reasons: reasons,
                                                                       stalled: Set(output.stalledConceptIds),
                                                                       probeGapIds: probeIds)

        return AssembledLesson(selection: output, targetConcept: target, gaps: gaps,
                               reasons: reasons, headline: output.headline,
                               probeGapId: probeGapId, conceptBlocks: blocks)
    }

    nonisolated private static func roleRank(_ role: SelectedItemRole) -> Int {
        switch role {
        case .target: return 0
        case .checkIn: return 1
        case .review: return 2
        case .probe: return 3
        }
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

    // MARK: - Teaching skill cards

    /// One ConceptBlock per distinct concept present in the lesson, target first.
    /// Pulls a real worked example from the lesson's own gaps and reuses the
    /// already-built reason line. Capped so lessons don't become a slog.
    ///
    /// Probe items are invisible to this: a concept carried only by a blind-spot
    /// probe gets NO card, and no card ever takes its worked example from a probe.
    /// Teaching a skill — with the probe's own sentence and its translation — right
    /// before probing it turns the diagnosis into a memory test of the last screen.
    private func buildConceptBlocks(for gaps: [GapItem], target: Concept?, reasons: [String: String],
                                    stalled: Set<String> = [], probeGapIds: Set<String> = []) -> [ConceptBlock] {
        var blocks: [ConceptBlock] = []
        var seen = Set<String>()
        let taught = gaps.filter { !$0.isProbe && !probeGapIds.contains($0.id) }

        func makeBlock(_ concept: Concept) -> ConceptBlock {
            let example = taught.first { $0.conceptId == concept.id && !$0.exampleSentence.isEmpty }
                ?? taught.first { $0.conceptId == concept.id }
                ?? store.gaps(forConcept: concept.id).first { !$0.isProbe && !$0.exampleSentence.isEmpty }
            let reason = example.flatMap { reasons[$0.id] }
            return ConceptBlock(concept: concept, explanation: concept.description,
                                example: example, reason: reason,
                                teaching: FoundationContentLoader.teaching(for: concept.id),
                                isStalled: stalled.contains(concept.id))
        }

        if let target {
            blocks.append(makeBlock(target))
            seen.insert(target.id)
        }
        for gap in taught {
            guard let cid = gap.conceptId, !seen.contains(cid),
                  let concept = store.concept(cid) else { continue }
            seen.insert(cid)
            blocks.append(makeBlock(concept))
            if blocks.count >= config.maxConceptCards { break }
        }
        return blocks
    }
}
