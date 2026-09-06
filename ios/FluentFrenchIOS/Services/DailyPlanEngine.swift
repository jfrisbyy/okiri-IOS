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

        // Scale to budget, round into meaningful 5-minute blocks (min 5 each).
        var items: [DailyPlanItem] = []
        for m in chosen {
            let share = final[m] ?? 0
            let rawMin = share * Double(budget)
            let rounded = max(5, Int((rawMin / 5).rounded()) * 5)
            items.append(DailyPlanItem(modality: m, targetMinutes: rounded))
        }
        items.sort { $0.targetMinutes > $1.targetMinutes }

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

    private func evenSplit(chosen: [LearningModality], budget: Int, spine: DailyPlanItem, rationale: String) -> DailyPlan {
        let per = max(5, Int((Double(budget) / Double(chosen.count) / 5).rounded()) * 5)
        let items = chosen.map { DailyPlanItem(modality: $0, targetMinutes: per) }
        return DailyPlan(items: [spine] + items, rationale: rationale, isColdStart: true)
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
