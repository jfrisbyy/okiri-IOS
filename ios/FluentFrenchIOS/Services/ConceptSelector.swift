//
//  ConceptSelector.swift
//  FluentFrenchIOS
//
//  The ONE ranker of the gap-learning loop (Pass 2 — "one selection output").
//
//  Every lesson and every plan comes from `select(_:)`: it scores eligible
//  concepts, picks the spine (smart mode), gathers eligibility-checked review,
//  injects the rare blind-spot probe, and writes the per-item reasons and the
//  headline. Scoped mode keeps the learner's declared intent as a CONSTRAINT
//  (no target re-selection) but still applies eligibility, ordering and reasons.
//  Capstone mode ranks broadly across recent material with the same score plus a
//  tier bonus for learning-but-trending-mastered concepts.
//
//  Nothing outside this file ranks or pools items. `LessonAssembler` only groups,
//  pairs and decorates what was selected; `DailyPlanEngine` tilts the day from
//  `SelectionOutput.rankedConcepts`. Generation (the AI question writer + formats)
//  is intentionally untouched — this only decides WHICH gaps and in what ORDER.
//

import Foundation

// MARK: - Assembled output

nonisolated struct AssembledLesson: Identifiable {
    var id: String = UUID().uuidString
    /// The selector's answer this lesson was built from (mode, roles, reasons).
    var selection: SelectionOutput
    /// The lesson spine in smart mode. `nil` in scoped / capstone mode, where the
    /// user already declared intent (or the quiz spans many skills).
    var targetConcept: Concept?
    var gaps: [GapItem]
    var reasons: [String: String]       // gapId -> short data-driven reason
    var headline: String                // "why this lesson" one-liner
    var probeGapId: String?             // a blind-spot probe item, if injected
    var conceptBlocks: [ConceptBlock] = []   // teaching "skill cards", in order

    var isCapstone: Bool { selection.mode.isCapstone }
    var isScoped: Bool { selection.mode.isScoped }
}

/// One teaching "skill card" shown before a concept's practice items.
nonisolated struct ConceptBlock: Identifiable {
    var id: String { concept.id }
    let concept: Concept
    var explanation: String          // plain-language teaching summary
    let example: GapItem?            // a real worked example from the learner's gaps
    let reason: String?              // the "why you're seeing this" line
    /// Content v2 skill card (rule, examples, contrast, common mistake) when the
    /// content has one; nil falls back to `explanation`.
    var teaching: FoundationTeachingContent? = nil
    /// The concept has stalled (B15): the lesson shows this card again before practice.
    var isStalled: Bool = false
}

// MARK: - Selector

@MainActor
struct ConceptSelector {
    let store: AppStore
    var weights: ConceptSelectionWeights = .tuning
    var config: LessonAssemblyConfig = .tuning

    init(store: AppStore, weights: ConceptSelectionWeights = .tuning, config: LessonAssemblyConfig = .tuning) {
        self.store = store
        self.weights = weights
        self.config = config
    }

    /// The weights the ranker actually uses. While the retention governor is active
    /// (Pass 3 F6) the frontier weight is 0 and urgency counts
    /// `Tuning.governorUrgencyMultiplier`× — consolidate, don't expand.
    var effectiveWeights: ConceptSelectionWeights {
        guard store.isGovernorActive else { return weights }
        var w = weights
        w.frontier = 0
        w.urgency *= Tuning.governorUrgencyMultiplier
        return w
    }

    // MARK: Eligibility — concept level

    /// Learning concepts, plus frontier concepts (never-observed with all
    /// prerequisites mastered) that have something to teach: at least one
    /// practicable gap, or being this session's blind-spot probe (B12). A
    /// never-observed concept with unmet prereqs is never eligible; mastered
    /// concepts come back only through check-ins.
    func eligibleConcepts(now: Date = Date()) -> [Concept] {
        let probe = probeConcept()?.id
        return store.concepts.filter { concept in
            switch concept.state {
            case .learning:
                return true
            case .neverObserved:
                guard store.arePrerequisitesMet(concept) else { return false }
                return concept.id == probe || hasPracticableGap(concept, now: now)
            case .mastered:
                return false
            }
        }
    }

    /// At least one non-probe gap of the concept can be practiced right now.
    func hasPracticableGap(_ concept: Concept, now: Date) -> Bool {
        store.gaps(forConcept: concept.id).contains { !$0.isProbe && $0.isPracticable(at: now) }
    }

    func isFrontier(_ concept: Concept) -> Bool {
        concept.state == .neverObserved && store.arePrerequisitesMet(concept)
    }

    // MARK: Check-ins (Pass 3 F4/F6)

    /// One eligible check-in: a mastered concept the schedule wants re-tested, the
    /// item that will carry it, and how overdue it is (for ranking).
    nonisolated struct CheckInCandidate {
        let concept: Concept
        /// The gap to show. A concept with no gaps of its own is checked with a
        /// content probe (materialised by the assembler).
        let gapId: String
        let isProbeVehicle: Bool
        /// Days since the concept last produced any evidence (∞ when it never has).
        let daysSinceTested: Double
        let overdueDays: Double
        let lowestRecall: Double
    }

    /// Whether a mastered concept is due for a check-in (FSRS-driven, Pass 3 F4):
    /// any REVIEWED non-probe gap is due on its own schedule or has recall below
    /// `Tuning.checkInRetrievability`, or the concept's adaptive interval has elapsed
    /// (a mastered concept never scheduled counts as due). Never-answered gaps carry
    /// no recall evidence and never trigger one.
    func isCheckInDue(_ concept: Concept, now: Date) -> Bool {
        guard concept.state == .mastered else { return false }
        if let next = concept.nextCheckInAt {
            if next <= now { return true }
        } else {
            return true
        }
        return reviewedGaps(of: concept).contains {
            $0.nextReviewAt <= now || $0.retrievability(at: now) < Tuning.checkInRetrievability
        }
    }

    /// The concept's reviewed, non-probe gaps — the ones with recall evidence.
    private func reviewedGaps(of concept: Concept) -> [GapItem] {
        store.gaps(forConcept: concept.id).filter { !$0.isProbe && !$0.isNew }
    }

    /// Lowest recall among the concept's reviewed, non-probe gaps (nil with none).
    private func lowestReviewedRecall(_ concept: Concept, now: Date) -> Double? {
        reviewedGaps(of: concept).map { $0.retrievability(at: now) }.min()
    }

    /// How overdue the check-in is, in days: the later of the adaptive date and the
    /// most overdue reviewed gap (0 when nothing is past due yet).
    func checkInOverdueDays(_ concept: Concept, now: Date) -> Double {
        let ladder = concept.nextCheckInAt.map { max(0, now.timeIntervalSince($0) / 86_400) } ?? 0
        let schedule = reviewedGaps(of: concept).map { max(0, now.timeIntervalSince($0.nextReviewAt) / 86_400) }.max() ?? 0
        return max(ladder, schedule)
    }

    /// The item a check-in rides on: the weakest reviewed gap, else the weakest
    /// gap of any kind, else a fresh content probe when the concept has probe content.
    func checkInVehicle(for concept: Concept, now: Date, excluding chosen: Set<String> = []) -> (gapId: String, isProbe: Bool)? {
        let gaps = store.gaps(forConcept: concept.id).filter { !chosen.contains($0.id) }
        let reviewed = gaps.filter { !$0.isProbe && !$0.isNew }.sorted(by: Self.weakestFirst(now: now))
        if let gap = reviewed.first { return (gap.id, false) }
        let any = gaps.filter { !$0.isProbe }.sorted(by: Self.weakestFirst(now: now))
        if let gap = any.first { return (gap.id, false) }
        let probes = gaps.filter { $0.isProbe }.sorted(by: Self.weakestFirst(now: now))
        if let gap = probes.first { return (gap.id, true) }
        guard store.hasProbeContent(for: concept.id) else { return nil }
        return (Self.probeGapId(for: concept, session: store.sessionIndex), true)
    }

    /// Every mastered concept due for a check-in that has an item to carry it.
    /// Provisional seeds (never verified) come first — they are the riskiest
    /// claims the engine holds — then the concept that has gone longest without
    /// producing any evidence, so slots rotate fairly across mastered concepts
    /// (ties: most overdue, lowest recall, then id).
    func checkInCandidates(now: Date = Date()) -> [CheckInCandidate] {
        store.concepts
            .filter { isCheckInDue($0, now: now) }
            .compactMap { concept -> CheckInCandidate? in
                guard let vehicle = checkInVehicle(for: concept, now: now) else { return nil }
                let sinceTested = concept.lastTestedAt.map { now.timeIntervalSince($0) / 86_400 } ?? .infinity
                return CheckInCandidate(concept: concept, gapId: vehicle.gapId, isProbeVehicle: vehicle.isProbe,
                                        daysSinceTested: sinceTested,
                                        overdueDays: checkInOverdueDays(concept, now: now),
                                        lowestRecall: lowestReviewedRecall(concept, now: now) ?? 1)
            }
            .sorted { a, b in
                if a.concept.isProvisional != b.concept.isProvisional { return a.concept.isProvisional }
                if a.daysSinceTested != b.daysSinceTested { return a.daysSinceTested > b.daysSinceTested }
                if a.overdueDays != b.overdueDays { return a.overdueDays > b.overdueDays }
                if a.lowestRecall != b.lowestRecall { return a.lowestRecall < b.lowestRecall }
                return a.concept.id < b.concept.id
            }
    }

    /// Gaps of a mastered concept come back only through check-ins, never through
    /// the review pool — that is what keeps mastered material from crowding the day.
    func belongsToMasteredConcept(_ gap: GapItem) -> Bool {
        guard let cid = gap.conceptId, let concept = store.concept(cid) else { return false }
        return concept.state == .mastered
    }

    /// Never observed AND its prerequisites are not all mastered: material the
    /// learner is not ready for. Nothing may pull it into a lesson.
    func isPrerequisiteBlocked(_ concept: Concept) -> Bool {
        concept.state == .neverObserved && !store.arePrerequisitesMet(concept)
    }

    // MARK: Eligibility — item level

    /// A gap may be practiced when its own schedule offers it (`GapItem.isPracticable`:
    /// unmastered, or mastered and due for a check — B3) and it is not evidence of
    /// a prerequisite-blocked concept. Gaps of mastered concepts stay practicable
    /// when FSRS says they are due (item schedule ≠ concept mastery); untagged
    /// gaps carry no prerequisite chain and stay practicable.
    func isPracticable(_ gap: GapItem, at now: Date = Date()) -> Bool {
        guard gap.isPracticable(at: now) else { return false }
        guard let cid = gap.conceptId, let concept = store.concept(cid) else { return true }
        return !isPrerequisiteBlocked(concept)
    }

    // MARK: Scoring

    func score(_ concept: Concept, now: Date = Date()) -> Double {
        let conceptGaps = store.gaps(forConcept: concept.id).filter { $0.isPracticable(at: now) }
        let w = effectiveWeights

        let urgency = urgencyScore(conceptGaps, now: now)
        let leverage = leverageScore(concept)
        let frontierFit = frontierScore(concept)
        let confusion = confusionScore(conceptGaps)
        let recent = recentlyTaughtPenalty(concept)

        return w.urgency * urgency
            + w.leverage * leverage
            + w.frontier * frontierFit
            + w.confusion * confusion
            - w.repeatDamp * recent
            + stallPrerequisiteBonus(concept)
    }

    /// Stall remediation (B15): when a concept has stalled, its UNMASTERED
    /// prerequisites get `Tuning.stallPrerequisiteBonus` so the next lesson shores
    /// up what the stalled skill rests on.
    func stallPrerequisiteBonus(_ concept: Concept) -> Double {
        guard concept.state != .mastered else { return 0 }
        let stalledDependents = store.dependents(of: concept.id).filter { $0.isStalled }
        return stalledDependents.isEmpty ? 0 : Tuning.stallPrerequisiteBonus
    }

    /// Ids of stalled concepts (`Concept.isStalled`).
    func stalledConceptIds() -> [String] {
        store.concepts.filter { $0.isStalled }.map { $0.id }
    }

    /// Max overdue-ness across this concept's gaps (0 if none due), normalized.
    private func urgencyScore(_ gaps: [GapItem], now: Date) -> Double {
        let maxOverdueDays = gaps
            .map { now.timeIntervalSince($0.nextReviewAt) / 86_400 }
            .filter { $0 > 0 }
            .max() ?? 0
        return min(1, maxOverdueDays / 7)
    }

    /// How many other concepts list this as a prerequisite, normalized by the
    /// busiest concept in the taxonomy.
    private func leverageScore(_ concept: Concept) -> Double {
        let dependents = store.dependents(of: concept.id).count
        let maxDependents = store.concepts
            .map { store.dependents(of: $0.id).count }
            .max() ?? 0
        guard maxDependents > 0 else { return 0 }
        return Double(dependents) / Double(maxDependents)
    }

    /// 1.0 for frontier concepts; for learning concepts, tapers toward 0 the
    /// further the concept sits below the learner's current ability.
    private func frontierScore(_ concept: Concept) -> Double {
        if isFrontier(concept) { return 1.0 }
        let abilityLevel = learnerLevel().order
        let conceptLevel = concept.cefrLevel.order
        let below = Double(max(0, abilityLevel - conceptLevel))
        return max(0, 1 - below / 3.0)
    }

    private func confusionScore(_ gaps: [GapItem]) -> Double {
        let total = gaps.flatMap { $0.confusionLinks }.map { $0.strength }.reduce(0, +)
        return min(1, total)
    }

    private func recentlyTaughtPenalty(_ concept: Concept) -> Double {
        guard let taught = concept.lastTaughtSession else { return 0 }
        let delta = store.sessionIndex - taught
        if delta <= 0 { return 1.0 }
        if delta == 1 { return 0.5 }
        return 0
    }

    /// The learner's IRT ability mapped to an approximate CEFR band. This is the
    /// one notion of "level" the engine has: frontier fit uses it, and surfaces
    /// that gate by level (e.g. conversation scenarios) read it from here.
    func learnerLevel() -> CEFRLevel {
        switch store.abilityTheta {
        case ..<(-0.4): return .A1
        case ..<0.4: return .A2
        case ..<1.2: return .B1
        case ..<2.0: return .B2
        case ..<2.6: return .C1
        default: return .C2
        }
    }

    // MARK: Ranking

    /// All eligible concepts scored and ranked high-to-low, ties broken by id so
    /// a selection is reproducible. Shared by every mode and by the daily plan
    /// (one brain, two views).
    func rankedEligible(now: Date = Date()) -> [ScoredConcept] {
        eligibleConcepts(now: now)
            .map { ScoredConcept(concept: $0, score: score($0, now: now), isFrontier: isFrontier($0)) }
            .sorted { a, b in
                if a.score != b.score { return a.score > b.score }
                return a.concept.id < b.concept.id
            }
    }

    // MARK: Selection — the ONE entry point

    func select(_ request: SelectionRequest) -> SelectionOutput {
        let ranked = rankedEligible(now: request.now)
        let level = learnerLevel()
        switch request.mode {
        case .smart:
            return selectSmart(request, ranked: ranked, level: level)
        case .scoped(let candidateGapIds):
            return selectScoped(request, candidateGapIds: candidateGapIds, ranked: ranked, level: level)
        case .capstone:
            return selectCapstone(request, ranked: ranked, level: level)
        }
    }

    // MARK: Smart mode

    /// A concept's practicable, non-probe gaps, weakest first — the spine it would
    /// get as the target. Probes are one-shot diagnostics (B13): their prompt is a
    /// question and their "translation" the answer, so they never ride in a lesson
    /// as spine, review or filler.
    private func practicableSpine(of concept: Concept, now: Date) -> [GapItem] {
        store.gaps(forConcept: concept.id)
            .filter { !$0.isProbe && $0.isPracticable(at: now) }
            .sorted(by: Self.weakestFirst(now: now))
    }

    private func selectSmart(_ request: SelectionRequest, ranked: [ScoredConcept], level: CEFRLevel) -> SelectionOutput {
        let now = request.now
        let size = max(Tuning.minLessonSize, request.lessonSize)

        // The target is the top-ranked concept that has something to teach RIGHT NOW
        // (B12): a learning concept whose gaps are all mastered and resting would
        // otherwise headline "Today: X" with an empty spine and stall forever. With
        // no such concept the lesson is a consolidation session (target nil).
        var target: Concept? = nil
        var spine: [GapItem] = []
        for scored in ranked {
            let candidate = practicableSpine(of: scored.concept, now: now)
            if !candidate.isEmpty {
                target = scored.concept
                spine = candidate
                break
            }
        }

        func isTargetGap(_ gap: GapItem) -> Bool {
            guard let target, let cid = gap.conceptId else { return false }
            return cid == target.id
        }

        var items: [SelectedItem] = []
        var chosen = Set<String>()
        func take(_ gap: GapItem, role: SelectedItemRole) {
            guard !chosen.contains(gap.id) else { return }
            chosen.insert(gap.id)
            items.append(SelectedItem(gapId: gap.id, conceptId: gap.conceptId, role: role,
                                      reason: smartReason(for: gap, role: role, target: target, now: now)))
        }

        // 1. Spine — the target concept's practicable gaps, weakest first.
        if target != nil {
            let spineCount = max(1, Int((Double(size) * config.targetRatio).rounded()))
            for gap in spine.prefix(spineCount) { take(gap, role: .target) }
        }

        // 2. Check-ins (Pass 3 F4/F6): up to `Tuning.checkInsPerLesson` MASTERED
        //    concepts the schedule wants re-tested, most overdue first — one item
        //    each. Mastered material comes back through here and only here; a miss
        //    weighs double and feeds the retention governor. With nothing left to
        //    teach (no target) the lesson is a consolidation session and check-ins
        //    fill it to the requested size instead.
        let checkInBudget = target == nil ? size : Tuning.checkInsPerLesson
        var checkIns = 0
        for candidate in checkInCandidates(now: now) {
            if checkIns >= checkInBudget { break }
            guard !chosen.contains(candidate.gapId) else { continue }
            chosen.insert(candidate.gapId)
            checkIns += 1
            items.append(SelectedItem(gapId: candidate.gapId, conceptId: candidate.concept.id, role: .checkIn,
                                      reason: checkInReason(for: candidate.concept)))
        }

        // 3. Interleaved review — most-overdue PRACTICABLE gaps of other UNMASTERED
        //    concepts, due within the window. Eligibility applies here too:
        //    prerequisite-blocked material never rides in through the review pool
        //    (audit §5.7), and mastered concepts only return as check-ins.
        let dueBy = now.addingTimeInterval(config.dueWindowDays * 86_400)
        let review = store.schedulableGaps(at: now)
            .filter { !$0.isProbe && !chosen.contains($0.id) && !isTargetGap($0) && !belongsToMasteredConcept($0) }
            .filter { isPracticable($0, at: now) && $0.nextReviewAt <= dueBy }
            .sorted(by: Self.mostOverdueFirst(now: now))
        for gap in review {
            if items.count >= size { break }
            take(gap, role: .review)
        }

        // 4. Top up if short: the rest of the spine, then other practicable gaps of
        //    unmastered concepts, weakest first. Never anything prerequisite-blocked.
        if items.count < size {
            let rest = spine.filter { !chosen.contains($0.id) }
            let others = store.schedulableGaps(at: now)
                .filter { !$0.isProbe && !chosen.contains($0.id) && !isTargetGap($0) && !belongsToMasteredConcept($0) && isPracticable($0, at: now) }
                .sorted(by: Self.weakestFirst(now: now))
            for gap in rest + others {
                if items.count >= size { break }
                take(gap, role: isTargetGap(gap) ? .target : .review)
            }
        }

        // 5. Blind-spot probe (rare): ONE never-observed frontier concept the
        //    learner has no gap for yet, carried by a real content probe (B13).
        //    Materialised by the assembler.
        if let probe = probeConcept() {
            items.append(SelectedItem(gapId: Self.probeGapId(for: probe, session: store.sessionIndex),
                                      conceptId: probe.id, role: .probe,
                                      reason: "Quick check on a skill you haven't met yet: \(probe.name)."))
        }

        let headline: String
        if let target {
            headline = smartHeadline(for: target, now: now)
        } else if items.isEmpty {
            headline = "Nothing to practice right now."
        } else if checkIns > 0 && items.count == checkIns {
            headline = "Today: check-ins — making sure what you've learned still holds."
        } else {
            headline = "Today: review — keeping what you've learned fresh."
        }

        // Stalled concepts in this lesson (target or any item) get their skill card again.
        let present = Set(items.compactMap { $0.conceptId } + [target?.id].compactMap { $0 })
        let stalled = stalledConceptIds().filter { present.contains($0) }

        return SelectionOutput(request: request, targetConceptId: target?.id, items: items,
                               headline: headline, rankedConcepts: ranked, learnerLevel: level,
                               stalledConceptIds: stalled, governorActive: store.isGovernorActive)
    }

    /// Every N sessions, the lowest-level frontier concept with no gap yet — and
    /// with probe content to carry it (a concept without probes is skipped, B13).
    func probeConcept() -> Concept? {
        guard config.probeEveryNSessions > 0,
              store.sessionIndex % config.probeEveryNSessions == 0 else { return nil }
        return store.concepts
            .filter { isFrontier($0) && store.gaps(forConcept: $0.id).isEmpty && store.hasProbeContent(for: $0.id) }
            .sorted { a, b in
                if a.cefrLevel.order != b.cefrLevel.order { return a.cefrLevel.order < b.cefrLevel.order }
                return a.id < b.id
            }
            .first
    }

    private func checkInReason(for concept: Concept) -> String {
        if concept.isProvisional {
            return "Verifying what placement said you know: \(concept.name)."
        }
        return "Check-in: does \(concept.name) still hold?"
    }

    nonisolated static func probeGapId(for concept: Concept, session: Int) -> String {
        "probe-\(concept.id)-\(session)"
    }

    // MARK: Scoped mode

    /// The learner declared intent (a category, a deck, a review set). Keep the
    /// scope as a constraint: no target re-selection, interleave only from within
    /// the candidates — but still apply eligibility, ordering and reasons.
    private func selectScoped(_ request: SelectionRequest, candidateGapIds: [String],
                              ranked: [ScoredConcept], level: CEFRLevel) -> SelectionOutput {
        let now = request.now
        let size = max(Tuning.minLessonSize, request.lessonSize)

        // Resolve ids once, in the order given, dropping duplicates and unknowns.
        var byId: [String: GapItem] = [:]
        for gap in store.gaps where byId[gap.id] == nil { byId[gap.id] = gap }
        var seen = Set<String>()
        var candidates: [GapItem] = []
        for id in candidateGapIds where !seen.contains(id) {
            seen.insert(id)
            if let gap = byId[id] { candidates.append(gap) }
        }

        let chosen = candidates
            .filter { isPracticable($0, at: now) }
            .sorted(by: Self.weakestFirst(now: now))
            .prefix(size)

        let items = chosen.map { gap in
            SelectedItem(gapId: gap.id, conceptId: gap.conceptId, role: .review,
                         reason: scopedReason(for: gap, now: now))
        }

        let name = request.scopeName ?? "your selection"
        let headline = items.isEmpty ? "Nothing in \(name) is ready to practice." : "Reviewing: \(name)"
        return SelectionOutput(request: request, targetConceptId: nil, items: items,
                               headline: headline, rankedConcepts: ranked, learnerLevel: level)
    }

    // MARK: Capstone mode

    /// Milestone quiz: broad, mixed, pulled from everything touched recently and
    /// weighted toward learning concepts trending toward mastered. Same score as
    /// every other mode, plus the capstone's tier bonus — one ranker, two modes.
    private func selectCapstone(_ request: SelectionRequest, ranked: [ScoredConcept], level: CEFRLevel) -> SelectionOutput {
        let now = request.now
        let size = max(Tuning.minLessonSize, request.lessonSize)
        let recentSince = now.addingTimeInterval(-Tuning.capstoneRecencyDays * 86_400)

        // A capstone tests what has been taught: never-observed concepts have
        // nothing to test, so only observed (learning or mastered) concepts rank.
        let capstoneRanked = store.concepts
            .filter { $0.state != .neverObserved }
            .map { ScoredConcept(concept: $0, score: capstoneScore($0, now: now), isFrontier: false) }
            .sorted { a, b in
                if a.score != b.score { return a.score > b.score }
                return a.concept.id < b.concept.id
            }

        // Per concept: practicable gaps touched inside the recency window, most
        // recent first; if none were, fall back to any practicable gap of the
        // concept so an early learner still gets a capstone.
        var queues: [[GapItem]] = capstoneRanked.map { scored in
            let gaps = store.gaps(forConcept: scored.concept.id).filter { isPracticable($0, at: now) }
            let recent = gaps.filter { ($0.lastReviewedAt ?? .distantPast) >= recentSince }
            return (recent.isEmpty ? gaps : recent).sorted(by: Self.mostRecentlyReviewedFirst)
        }

        // Round-robin across the ranked concepts so the quiz is broad — not one
        // skill twelve times.
        var items: [SelectedItem] = []
        var chosen = Set<String>()
        var progressed = true
        while items.count < size && progressed {
            progressed = false
            for i in queues.indices {
                if items.count >= size { break }
                guard !queues[i].isEmpty else { continue }
                let gap = queues[i].removeFirst()
                progressed = true
                guard !chosen.contains(gap.id) else { continue }
                chosen.insert(gap.id)
                items.append(SelectedItem(gapId: gap.id, conceptId: gap.conceptId, role: .review,
                                          reason: capstoneReason(for: gap)))
            }
        }

        let skills = Set(items.compactMap { $0.conceptId }).count
        let headline = items.isEmpty
            ? "Nothing recent to test yet — learn a little first."
            : "Capstone: a mixed check across \(skills) skill\(skills == 1 ? "" : "s")."
        return SelectionOutput(request: request, targetConceptId: nil, items: items,
                               headline: headline, rankedConcepts: ranked, learnerLevel: level)
    }

    /// The shared score plus the capstone tiers: learning concepts outrank mastered
    /// ones, and learning-but-trending-mastered outrank both. The tier weights are
    /// sized above the ranker's maximum so tiers hold; the score orders within a tier.
    func capstoneScore(_ concept: Concept, now: Date = Date()) -> Double {
        var total = score(concept, now: now)
        if concept.state == .learning {
            total += Tuning.capstoneLearningWeight
            if concept.mastery >= Tuning.capstoneTrendingMasteryFloor {
                total += Tuning.capstoneTrendingWeight
            }
        }
        return total
    }

    // MARK: Ordering (one comparator per notion, shared by every mode)

    /// Lowest recall probability first; ties by soonest due, then id.
    nonisolated static func weakestFirst(now: Date) -> (GapItem, GapItem) -> Bool {
        { a, b in
            let ra = a.retrievability(at: now), rb = b.retrievability(at: now)
            if ra != rb { return ra < rb }
            if a.nextReviewAt != b.nextReviewAt { return a.nextReviewAt < b.nextReviewAt }
            return a.id < b.id
        }
    }

    /// Soonest / most overdue due date first; ties by weakest, then id.
    nonisolated static func mostOverdueFirst(now: Date) -> (GapItem, GapItem) -> Bool {
        { a, b in
            if a.nextReviewAt != b.nextReviewAt { return a.nextReviewAt < b.nextReviewAt }
            let ra = a.retrievability(at: now), rb = b.retrievability(at: now)
            if ra != rb { return ra < rb }
            return a.id < b.id
        }
    }

    /// Most recently reviewed first; ties by id.
    nonisolated static func mostRecentlyReviewedFirst(_ a: GapItem, _ b: GapItem) -> Bool {
        let la = a.lastReviewedAt ?? .distantPast, lb = b.lastReviewedAt ?? .distantPast
        if la != lb { return la > lb }
        return a.id < b.id
    }

    // MARK: Reasons (legibility)

    private func strongestConfusionPartner(of gap: GapItem) -> GapItem? {
        guard let link = gap.confusionLinks.max(by: { $0.strength < $1.strength }) else { return nil }
        return store.gaps.first { $0.id == link.partnerGapId }
    }

    private func smartReason(for gap: GapItem, role: SelectedItemRole, target: Concept?, now: Date) -> String {
        if let partner = strongestConfusionPartner(of: gap) {
            return "You keep confusing this with “\(partner.frenchWord)”."
        }
        if let target, role == .target, target.newlyUnlocked {
            return "New skill you're ready for: \(target.name)."
        }
        if gap.reviewCount >= Tuning.repeatedMissReasonFloor && gap.nextReviewAt < now {
            return "You've missed this \(gap.reviewCount)× — time to lock it in."
        }
        if let cid = gap.conceptId, let dep = store.dependents(of: cid).first {
            return "This unlocks \(dep.name)."
        }
        if let target, role == .target {
            return "Today's focus: \(target.name)."
        }
        return "Due for review."
    }

    /// Reasons for a scoped lesson — no target concept, so lean on confusion,
    /// miss-count, due-ness and concept membership.
    private func scopedReason(for gap: GapItem, now: Date) -> String {
        if let partner = strongestConfusionPartner(of: gap) {
            return "You keep confusing this with “\(partner.frenchWord)”."
        }
        if gap.reviewCount >= Tuning.repeatedMissReasonFloor && gap.nextReviewAt < now {
            return "You've missed this \(gap.reviewCount)× — time to lock it in."
        }
        if gap.nextReviewAt <= now {
            return "Due for review."
        }
        if let concept = store.concept(gap.conceptId) {
            return "Part of \(concept.name)."
        }
        return "Strengthening this one."
    }

    private func capstoneReason(for gap: GapItem) -> String {
        if let concept = store.concept(gap.conceptId) {
            return "Capstone check: does \(concept.name) hold up in a mixed test?"
        }
        return "Capstone check."
    }

    private func smartHeadline(for target: Concept, now: Date) -> String {
        let conceptGaps = practicableSpine(of: target, now: now)
        let missed = conceptGaps.map { $0.reviewCount }.reduce(0, +)
        if target.newlyUnlocked {
            return "Today: \(target.name) — you're ready for this new skill."
        }
        if missed > 0 {
            return "Today: \(target.name) — you've slipped on it \(missed) time\(missed == 1 ? "" : "s")."
        }
        return "Today: \(target.name)."
    }
}
