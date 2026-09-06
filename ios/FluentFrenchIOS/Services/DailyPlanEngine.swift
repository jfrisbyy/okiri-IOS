//
//  DailyPlanEngine.swift
//  FluentFrenchIOS
//
//  Prescribes the SHAPE of the day — minutes weighted across the learner's chosen
//  activities — while the learner always picks the content. The tilt comes from the
//  EXISTING concept model, not a parallel curriculum brain: one intelligence, two
//  views. Concretely (Pass 2): the tilt is computed from
//  `SelectionOutput.rankedConcepts` — the selector's own ranking — and from
//  nothing else. This engine never scores or re-ranks a concept.
//
//  Mechanism: take the top priority concepts, sum their priority-weighted modality
//  affinities into a distribution over activities, zero out activities the learner
//  didn't choose, renormalize, and scale to the time budget.
//

import Foundation

// MARK: - Tuning (NOT FINAL — tune live during testing)

nonisolated struct DailyPlanConfig {
    /// How many top priority concepts feed the plan's tilt.
    var topConceptCount: Int = 6
    /// Ceiling on how far observed gap-source data can tilt away from the prior.
    var observedBlendMax: Double = 0.7
    /// Gaps a concept needs before observed data dominates its prior.
    var observedSmoothing: Double = 3.0
    /// Uniform floor so every chosen activity still gets some time (non-punitive).
    var uniformFloor: Double = 0.2

    static let tuning = DailyPlanConfig()
}

// MARK: - Output

/// What a plan item asks for: minutes in an activity, a number of short lessons
/// (Foundation pacing, Pass 3 F1 — `Tuning.foundationLessonsPerDay`), or — when
/// every activity the learner chose is still locked — the one action that opens
/// them (D2).
nonisolated enum DailyPlanItemKind: String, Hashable, Codable {
    case minutes
    case lessons
    /// "15 min of Reading unlocks Listening & Speaking": `modality` is the activity
    /// to spend time in (the deep-link target) and `target` the lifetime minutes
    /// the gate asks for (`ReadinessConfig.higherDemonstratedMinutes`).
    case unlock
}

nonisolated struct DailyPlanItem: Identifiable, Hashable, Codable {
    var id: String {
        switch kind {
        case .minutes: return modality?.rawValue ?? "minutes"
        case .lessons: return "lessons"
        case .unlock: return "unlock-\(modality?.rawValue ?? "reading")"
        }
    }
    let kind: DailyPlanItemKind
    /// The activity for a `.minutes` item and the deep-link target of an `.unlock`
    /// item; nil for the `.lessons` item (lessons are not a `LearningModality`).
    let modality: LearningModality?
    /// Minutes for `.minutes`, lesson count for `.lessons`, lifetime minutes for `.unlock`.
    let target: Int

    /// Minutes asked of the learner TODAY (0 for a `.lessons` item, which is paced
    /// in lessons, and for an `.unlock` item, whose target is lifetime minutes).
    var targetMinutes: Int { kind == .minutes ? target : 0 }
    var isUnlock: Bool { kind == .unlock }

    init(kind: DailyPlanItemKind, modality: LearningModality?, target: Int) {
        self.kind = kind
        self.modality = modality
        self.target = target
    }

    /// A minutes-of-activity item.
    init(modality: LearningModality, targetMinutes: Int) {
        self.init(kind: .minutes, modality: modality, target: targetMinutes)
    }

    /// The Foundation pacing item: `count` short lessons today.
    static func lessons(_ count: Int) -> DailyPlanItem {
        DailyPlanItem(kind: .lessons, modality: nil, target: count)
    }

    /// The unlock action (D2): `minutes` lifetime minutes in `modality` open the
    /// activities the learner chose. Home renders it as the primary action.
    static func unlock(via modality: LearningModality, minutes: Int) -> DailyPlanItem {
        DailyPlanItem(kind: .unlock, modality: modality, target: minutes)
    }

    // Tolerant decoding so a plan stored before a field existed still reads:
    // a missing kind is a minutes item, a missing target is 0.
    private enum CodingKeys: String, CodingKey { case kind, modality, target }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = try c.decodeIfPresent(DailyPlanItemKind.self, forKey: .kind) ?? .minutes
        modality = try c.decodeIfPresent(LearningModality.self, forKey: .modality)
        target = try c.decodeIfPresent(Int.self, forKey: .target) ?? 0
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(kind, forKey: .kind)
        try c.encodeIfPresent(modality, forKey: .modality)
        try c.encode(target, forKey: .target)
    }
}

nonisolated struct DailyPlan: Hashable, Codable {
    /// The paced `.lessons` item first (the day's spine), then `.minutes` items
    /// high to low; an `.unlock` item, when present, leads.
    var items: [DailyPlanItem]
    var rationale: String
    var isColdStart: Bool

    /// Minutes across `.minutes` items only; `.lessons` / `.unlock` items add nothing here.
    var totalMinutes: Int { items.reduce(0) { $0 + $1.targetMinutes } }
    /// The pacing item: the Foundation day's only item, or the post-unlock review spine.
    var lessonItem: DailyPlanItem? { items.first { $0.kind == .lessons } }
    var isLessonPaced: Bool { lessonItem != nil }
    /// The unlock action when every chosen activity is locked (D2); nil otherwise.
    var unlockItem: DailyPlanItem? { items.first { $0.kind == .unlock } }
    /// The minutes-of-activity rows, high to low.
    var minuteItems: [DailyPlanItem] { items.filter { $0.kind == .minutes } }
}

// MARK: - Engine

@MainActor
struct DailyPlanEngine {
    let store: AppStore
    var config: DailyPlanConfig = .tuning
    var weights: ConceptSelectionWeights = .tuning

    /// Today's plan, tilted by the selector's current ranking.
    func makePlan(now: Date = Date()) -> DailyPlan {
        let selection = ConceptSelector(store: store, weights: weights).select(.smart(now: now))
        return makePlan(from: selection)
    }

    /// The plan for a given selection output. The ONLY input that tilts the day is
    /// `selection.rankedConcepts`; the rest of the output (target, items, headline)
    /// is ignored here by design.
    func makePlan(from selection: SelectionOutput) -> DailyPlan {
        let prefs = store.preferences ?? .default
        let now = selection.request.now
        // Foundation pacing (Pass 3 F1): while reading is still locked the day is
        // paced in short lessons, not minutes — `Tuning.foundationLessonsPerDay` of
        // them. Progress is read live from `store.lessonsCompletedToday`.
        if store.readiness(for: .reading) != .unlocked {
            let count = Tuning.foundationLessonsPerDay
            let rationale = store.isGovernorActive
                ? "Consolidating your base before opening reading."
                : "\(count) short lessons today — each one builds toward unlocking reading."
            return DailyPlan(items: [.lessons(count)], rationale: rationale, isColdStart: false)
        }

        // Post-unlock pacing: the day keeps a lessons spine sized to what is waiting
        // (due reviews + captures since the last lesson), never fewer than
        // `Tuning.unlockedLessonsPerDayMin` nor more than the Foundation pace — one
        // lesson a day after unlock let true mastery decay in the 60-day trace.
        let spine = DailyPlanItem.lessons(lessonTarget(now: now))

        // Only ever prescribe activities the learner is actually ready for — the
        // readiness gate filters out anything still locked behind Foundation.
        let chosen = LearningModality.allCases.filter {
            prefs.modalities.contains($0) && store.readiness(for: $0) == .unlocked
        }
        let lockedChosen = LearningModality.allCases.filter {
            prefs.modalities.contains($0) && store.readiness(for: $0) != .unlocked
        }
        let governor = store.isGovernorActive

        guard !chosen.isEmpty else {
            // Nothing chosen at all: only the spine, and an honest nudge.
            guard !lockedChosen.isEmpty else {
                return DailyPlan(items: [spine],
                                 rationale: "Pick the activities you want in Preferences to shape your day.",
                                 isColdStart: true)
            }
            // Every chosen activity is locked (D2): name the ONE action that opens
            // them and deep-link to it, instead of an empty plan. The bar is
            // demonstrated Reading minutes; Reading is open (it gates the rest).
            let bar = readiness.higherDemonstratedMinutes
            let readingDone = store.totalMinutes(.reading)
            if governor, readingDone >= bar {
                // The minutes are in; only the governor holds the gate — lessons open it.
                return DailyPlan(items: [spine], rationale: ReadinessCopy.governorHeadline(for: lockedChosen),
                                 isColdStart: false)
            }
            let unlock = DailyPlanItem.unlock(via: .reading, minutes: bar)
            let rationale = governor
                ? ReadinessCopy.governorHeadline(for: lockedChosen)
                : ReadinessCopy.unlockHeadline(for: lockedChosen)
            return DailyPlan(items: [unlock, spine], rationale: rationale, isColdStart: false)
        }
        let budget = prefs.timeBudget.minutes

        let ranked = Array(selection.rankedConcepts.prefix(config.topConceptCount))

        // The governor rationale stays whenever the governor is active (Pass 3 F6).
        let governorRationale: String? = governor
            ? (lockedChosen.isEmpty ? ReadinessCopy.governorConsolidating : ReadinessCopy.governorHeadline(for: lockedChosen))
            : nil

        // Cold start: too little signal to tilt — even, honest split.
        guard ranked.contains(where: { $0.score > 0 }) else {
            return evenSplit(chosen: chosen, budget: budget, spine: spine,
                             rationale: governorRationale ?? "Still learning your weak spots — today's an even spread.")
        }

        // Sum priority-weighted modality affinities.
        var raw: [LearningModality: Double] = [:]
        for sc in ranked {
            let w = max(0, sc.score)
            guard w > 0 else { continue }
            for (modality, value) in affinity(for: sc.concept) {
                raw[modality, default: 0] += w * value
            }
        }

        // Zero out unchosen, renormalize.
        var tilted = raw.filter { chosen.contains($0.key) }
        let tiltedTotal = tilted.values.reduce(0, +)
        guard tiltedTotal > 0 else {
            return evenSplit(chosen: chosen, budget: budget, spine: spine,
                             rationale: governorRationale ?? "Today's a balanced spread across your activities.")
        }
        for k in tilted.keys { tilted[k]! /= tiltedTotal }

        // Mix in a uniform floor so every chosen activity gets some time.
        let uniform = 1.0 / Double(chosen.count)
        var final: [LearningModality: Double] = [:]
        for m in chosen {
            final[m] = (1 - config.uniformFloor) * (tilted[m] ?? 0) + config.uniformFloor * uniform
        }

        // Scale to budget in whole `Tuning.planMinuteBlock` blocks. The plan never
        // asks for more time than the learner chose, so a budget too small to give
        // every activity a block drops the lowest-share activities instead of
        // floor-inflating the day past the budget.
        let items = allocate(budget: budget, chosen: chosen, shares: final)

        return DailyPlan(items: [spine] + items,
                         rationale: governorRationale ?? rationale(for: items, ranked: ranked),
                         isColdStart: false)
    }

    /// The readiness thresholds the plan quotes (the unlock bar).
    private var readiness: ReadinessConfig { .tuning }

    /// Post-unlock lessons per day: enough short lessons to work through what is
    /// waiting — everything due now, or the captures since the last lesson when
    /// those are more — at `Tuning.lessonSize` items each, clamped to
    /// [`Tuning.unlockedLessonsPerDayMin`, `Tuning.foundationLessonsPerDay`].
    /// The two are not summed: a capture starts due now (`makeCapturedGap` seeds
    /// its schedule at capture), so it is already in the due count.
    func lessonTarget(now: Date) -> Int {
        let waiting = max(store.dueNow(at: now).count, store.gapsSinceLastLesson)
        let needed = Int((Double(waiting) / Double(max(1, Tuning.lessonSize))).rounded(.up))
        return min(max(needed, Tuning.unlockedLessonsPerDayMin), Tuning.foundationLessonsPerDay)
    }

    // MARK: - Affinity

    /// Where practicing this concept pays off: a blend of a static category prior
    /// (works at cold start) and the observed source distribution of its gaps
    /// (sharpens over time). Returns weights over modalities summing to ~1.
    private func affinity(for concept: Concept) -> [LearningModality: Double] {
        let prior = categoryPrior(concept.category)
        let gaps = store.gaps(forConcept: concept.id)
        guard let (observed, count) = observedDistribution(gaps), count > 0 else { return prior }

        let w = config.observedBlendMax * (Double(count) / (Double(count) + config.observedSmoothing))
        var blended: [LearningModality: Double] = [:]
        for m in LearningModality.allCases {
            blended[m] = (1 - w) * (prior[m] ?? 0) + w * (observed[m] ?? 0)
        }
        return blended
    }

    /// Static prior: where each gap category is best practiced.
    private func categoryPrior(_ category: GapCategory) -> [LearningModality: Double] {
        switch category {
        case .vocabulary:    return [.reading: 0.7, .listening: 0.15, .watching: 0.15]
        case .grammar:       return [.reading: 0.7, .watching: 0.2, .speaking: 0.1]
        case .pronunciation: return [.speaking: 0.5, .listening: 0.5]
        case .phrasing:      return [.reading: 0.4, .watching: 0.4, .speaking: 0.2]
        case .register:      return [.reading: 0.4, .watching: 0.4, .speaking: 0.2]
        }
    }

    /// Distribution of a concept's gaps over modalities, from where they were
    /// captured (sourceType). Foundation gaps carry no modality signal and are
    /// skipped. Returns nil when there's no usable signal.
    private func observedDistribution(_ gaps: [GapItem]) -> (dist: [LearningModality: Double], count: Int)? {
        var counts: [LearningModality: Double] = [:]
        var total = 0
        for gap in gaps {
            guard let m = modality(for: gap.sourceType) else { continue }
            counts[m, default: 0] += 1
            total += 1
        }
        guard total > 0 else { return nil }
        for k in counts.keys { counts[k]! /= Double(total) }
        return (counts, total)
    }

    private func modality(for source: SourceType) -> LearningModality? {
        switch source {
        case .reading: return .reading
        case .speech: return .speaking
        case .listening: return .listening
        case .foundation: return nil
        }
    }

    // MARK: - Helpers

    /// Cold start: the same minutes for every activity that fits inside the budget.
    /// Whole `Tuning.planMinuteBlock` blocks, and the total never exceeds the
    /// budget — a "~10 min" day that cannot seat four activities seats the two it
    /// can rather than prescribing 20 minutes.
    private func evenSplit(chosen: [LearningModality], budget: Int, spine: DailyPlanItem, rationale: String) -> DailyPlan {
        let block = Tuning.planMinuteBlock
        let blocks = block > 0 ? budget / block : 0
        guard blocks > 0, !chosen.isEmpty else {
            return DailyPlan(items: [spine], rationale: rationale, isColdStart: true)
        }
        let each = blocks / chosen.count
        let kept = each > 0 ? chosen : Array(chosen.prefix(blocks))
        let per = max(1, each) * block
        let items = kept.map { DailyPlanItem(modality: $0, targetMinutes: per) }
        return DailyPlan(items: [spine] + items, rationale: rationale, isColdStart: true)
    }

    /// Split `budget` minutes across `chosen` in whole `Tuning.planMinuteBlock`
    /// blocks, weighted by `shares`, so that the plan's total is never more than
    /// the budget the learner picked (Preferences and Profile both quote that
    /// number, and the Home header quotes the plan's total — they have to agree).
    /// Every activity that gets a row gets at least one block; when there are more
    /// activities than blocks the lowest-share ones are left out of today.
    private func allocate(budget: Int, chosen: [LearningModality],
                          shares: [LearningModality: Double]) -> [DailyPlanItem] {
        let block = Tuning.planMinuteBlock
        guard block > 0, !chosen.isEmpty else { return [] }
        let blocks = budget / block
        guard blocks > 0 else { return [] }

        // Biggest share first; ties keep the stable `chosen` order so the plan is
        // deterministic for the same inputs.
        let ordered = chosen.enumerated().sorted { a, b in
            let sa = max(0, shares[a.element] ?? 0), sb = max(0, shares[b.element] ?? 0)
            return sa == sb ? a.offset < b.offset : sa > sb
        }.map { $0.element }
        let kept = Array(ordered.prefix(min(ordered.count, blocks)))

        var counts: [LearningModality: Int] = [:]
        for m in kept { counts[m] = 1 }
        var remaining = blocks - kept.count
        if remaining > 0 {
            let total = kept.reduce(0.0) { $0 + max(0, shares[$1] ?? 0) }
            let exact: [(LearningModality, Double)] = kept.map { m in
                let weight = total > 0 ? max(0, shares[m] ?? 0) / total : 1 / Double(kept.count)
                return (m, weight * Double(remaining))
            }
            for (m, value) in exact {
                let whole = max(0, Int(value))
                counts[m, default: 0] += whole
                remaining -= whole
            }
            // Whatever rounding left over goes to the largest fractional remainders.
            let byRemainder = exact.enumerated().sorted { a, b in
                let ra = a.element.1 - Double(Int(a.element.1)), rb = b.element.1 - Double(Int(b.element.1))
                return ra == rb ? a.offset < b.offset : ra > rb
            }.map { $0.element.0 }
            var i = 0
            while remaining > 0 && !byRemainder.isEmpty {
                counts[byRemainder[i % byRemainder.count], default: 0] += 1
                remaining -= 1
                i += 1
            }
        }

        return kept.enumerated()
            .map { (offset: $0.offset, item: DailyPlanItem(modality: $0.element, targetMinutes: (counts[$0.element] ?? 1) * block)) }
            .sorted { $0.item.targetMinutes == $1.item.targetMinutes ? $0.offset < $1.offset : $0.item.targetMinutes > $1.item.targetMinutes }
            .map { $0.item }
    }

    private func rationale(for items: [DailyPlanItem], ranked: [ScoredConcept]) -> String {
        guard let lead = items.first, let leadModality = lead.modality else { return "Here's today's plan." }
        // Name the dominant weak category for color.
        let topCategory = ranked.first?.concept.category.label.lowercased()
        let leadLabel = leadModality.label.lowercased()
        let secondLabel = items.count > 1 ? items[1].modality?.label.lowercased() : nil

        if let cat = topCategory, let second = secondLabel {
            return "Your weak spots lately are \(cat)-heavy, so today leans \(leadLabel) and \(second)."
        }
        if let cat = topCategory {
            return "Your weak spots lately are \(cat)-heavy, so today leans \(leadLabel)."
        }
        return "Today leans \(leadLabel) to work on your weak spots."
    }
}
