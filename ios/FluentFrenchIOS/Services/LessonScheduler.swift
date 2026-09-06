//
//  LessonScheduler.swift
//  FluentFrenchIOS
//
//  Builds the local question schedule for an `AssembledLesson` (C18, C6, C16,
//  C19, B11, B13, C27). Pure and view-free: `LessonView` renders what this
//  returns and never decides formats itself.
//
//  Format progression is driven by each gap's OWN evidence:
//      no evidence (reviewCount == 0 or consecutiveCorrect == 0) → recognition (multiple choice, both directions)
//      some evidence                                             → recall (fill-blank when blankable, true/false)
//      strong evidence (consecutiveCorrect ≥ productionEvidenceFloor) → production (translation, arrange)
//  Non-testable rule-label items only ever get multiple choice. Probes are one
//  multiple-choice question built from the content's own distractors. Check-ins
//  are one recall-level question. A capstone is one recall-level question per
//  gap with no interstitial, no remedials.
//

import Foundation

// MARK: - Config

/// Lesson-loop knobs the scheduler reads. Defaults come from `Tuning`; the
/// struct exists so tests can pin them (and seed the shuffles).
nonisolated struct LessonSchedulerConfig {
    var masteryTarget: Int = Tuning.masteryTarget
    var productionEvidenceFloor: Int = Tuning.productionEvidenceFloor
    var maxRemedialsPerGap: Int = Tuning.maxRemedialsPerGap
    var matchInterstitialMinGaps: Int = Tuning.matchInterstitialMinGaps
    var matchGroupSize: Int = Tuning.matchGroupSize
    var arrangeMinTokens: Int = Tuning.arrangeMinTokens
    var arrangeMaxTokens: Int = Tuning.arrangeMaxTokens
    var minMultipleChoiceOptions: Int = Tuning.minMultipleChoiceOptions
    /// Seed for every shuffle the scheduler makes; nil → system randomness.
    var seed: UInt64? = nil

    static let tuning = LessonSchedulerConfig()
}

// MARK: - Randomness

/// The scheduler's generator: seeded (SplitMix64) for reproducible tests, the
/// system generator otherwise.
nonisolated struct LessonRandom: RandomNumberGenerator {
    private var state: UInt64
    private let seeded: Bool

    init(seed: UInt64?) {
        seeded = seed != nil
        state = seed ?? 0
    }

    mutating func next() -> UInt64 {
        guard seeded else {
            var system = SystemRandomNumberGenerator()
            return system.next()
        }
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

// MARK: - Scheduler

nonisolated struct LessonScheduler {
    var config: LessonSchedulerConfig

    init(config: LessonSchedulerConfig = .tuning) {
        self.config = config
    }

    /// English fallbacks used as distractors only when the lesson's own gaps
    /// cannot supply enough (a one- or two-item lesson). English, never French.
    static let fallbackDistractors = ["hello", "thank you", "house", "to go", "water", "day", "small", "red", "to speak", "always"]

    // MARK: Progression (C18)

    /// The tier a gap is asked at, from its own evidence.
    func level(for gap: GapItem) -> QuestionLevel {
        guard gap.isTestable else { return .recognition }
        if gap.reviewCount == 0 || gap.consecutiveCorrect == 0 { return .recognition }
        if gap.consecutiveCorrect >= config.productionEvidenceFloor { return .production }
        return .recall
    }

    /// The gap's example sentence contains its blank form exactly once as a whole word (C1).
    static func isBlankable(_ gap: GapItem) -> Bool {
        gap.isTestable && AnswerGrader.blankedPrompt(for: gap) != nil
    }

    /// The gap's example sentence has enough — and not too many — words to arrange.
    func isArrangeable(_ gap: GapItem) -> Bool {
        guard gap.isTestable else { return false }
        let n = Self.tokens(of: gap.exampleSentence).count
        return n >= config.arrangeMinTokens && n <= config.arrangeMaxTokens
    }

    /// The question kinds a gap is asked in at its level, in round order
    /// (round r uses `kinds[r % count]`). Recognition asks multiple choice twice —
    /// forward, then reversed (English prompt, French options).
    func kinds(for gap: GapItem) -> [QuestionKind] {
        kinds(for: gap, at: level(for: gap))
    }

    func kinds(for gap: GapItem, at level: QuestionLevel) -> [QuestionKind] {
        guard gap.isTestable else { return [.multipleChoice] }
        switch level {
        case .recognition:
            return [.multipleChoice, .multipleChoice]
        case .recall:
            return Self.isBlankable(gap) ? [.fillBlank, .trueFalse] : [.trueFalse, .multipleChoice]
        case .production:
            if isArrangeable(gap) { return [.translation, .arrange] }
            return [.translation, Self.isBlankable(gap) ? .fillBlank : .multipleChoice]
        }
    }

    /// AI-written questions a gap may receive: never above its level, never a
    /// typed format for a non-testable item, never arrange/match (local only).
    func allowedAIKinds(for gap: GapItem) -> Set<QuestionKind> {
        guard gap.isTestable, !gap.isProbe else { return gap.isProbe ? [] : [.multipleChoice] }
        switch level(for: gap) {
        case .recognition: return [.multipleChoice]
        case .recall: return [.multipleChoice, .trueFalse, .fillBlank]
        case .production: return [.multipleChoice, .trueFalse, .fillBlank, .translation]
        }
    }

    // MARK: Build

    /// The local schedule for a lesson. `abilityOptionCount` is `store.optionCount`
    /// (floored at `minMultipleChoiceOptions`).
    func build(for lesson: AssembledLesson, abilityOptionCount: Int) -> [LessonQuestion] {
        var rng = LessonRandom(seed: config.seed)
        let optionCount = max(config.minMultipleChoiceOptions, abilityOptionCount)
        let roles = Self.roles(in: lesson)
        let pool = lesson.gaps
        let roundCount = max(1, config.masteryTarget)
        var rounds: [[LessonQuestion]] = Array(repeating: [], count: roundCount)
        var probes: [LessonQuestion] = []

        for gap in lesson.gaps {
            let role = roles[gap.id] ?? .review
            if lesson.isCapstone && (gap.isProbe || role == .probe) {
                // C16: a capstone is a pure held / slipped tally — a blind-spot probe
                // that slipped through selection is never asked inside it.
                continue
            }
            if role == .checkIn, gap.isProbe {
                // A mastered concept with no items of its own is verified on a probe
                // item. The ROLE decides how it is asked: this is a scored check-in
                // on the riskiest claim the engine holds — never a throwaway
                // blind-spot probe — so it keeps the content's own distractors but
                // none of the probe's exemptions.
                if var q = probeQuestion(for: gap, role: .checkIn, rng: &rng) {
                    q.isProbe = false
                    rounds[0].append(q)
                }
                continue
            }
            if gap.isProbe || role == .probe {
                // B13 / C19: exactly one MC item from the content's own distractors.
                if let q = probeQuestion(for: gap, role: role, rng: &rng) { probes.append(q) }
                continue
            }
            if lesson.isCapstone {
                // C16: one recall-level item per gap, first attempt is the tally.
                let kind = kinds(for: gap, at: min(.recall, maxLevel(for: gap)))[0]
                if var q = question(for: gap, kind: kind, role: role, pool: pool, optionCount: optionCount, rng: &rng) {
                    q.isCapstone = true
                    q.hint = nil
                    rounds[0].append(q)
                }
                continue
            }
            if role == .checkIn {
                // B6: one recall-level question verifies a mastered concept.
                let kind = kinds(for: gap, at: min(.recall, maxLevel(for: gap)))[0]
                if let q = question(for: gap, kind: kind, role: role, pool: pool, optionCount: optionCount, rng: &rng) {
                    rounds[0].append(q)
                }
                continue
            }
            let ks = kinds(for: gap)
            for round in 0..<roundCount {
                if let q = question(for: gap, kind: ks[round % ks.count], variant: round, role: role,
                                    pool: pool, optionCount: optionCount, rng: &rng) {
                    rounds[round].append(q)
                }
            }
        }

        var schedule = rounds.flatMap { $0 }

        // Match interstitial between the first and second round, only with enough
        // distinct pairs (never in a capstone, never with probes).
        if !lesson.isCapstone, let match = matchInterstitial(for: lesson, roles: roles, rng: &rng) {
            let insertAt = min(schedule.count, rounds[0].count)
            schedule.insert(match, at: insertAt)
        }
        schedule.append(contentsOf: probes)
        return schedule
    }

    /// The local schedule with AI-written questions merged in (C7): a gap's local
    /// questions are replaced only when the AI supplied at least `masteryTarget`
    /// usable questions for it; partial coverage keeps the local questions.
    /// Probes, check-ins and capstones are always local.
    func schedule(for lesson: AssembledLesson, abilityOptionCount: Int, ai: [LessonQuestion]) -> [LessonQuestion] {
        var local = build(for: lesson, abilityOptionCount: abilityOptionCount)
        guard !lesson.isCapstone, !ai.isEmpty else { return local }
        let roles = Self.roles(in: lesson)
        let byGap = Dictionary(grouping: ai, by: { $0.gap.id })

        for gap in lesson.gaps {
            let role = roles[gap.id] ?? .review
            guard !gap.isProbe, role != .probe, role != .checkIn, let candidates = byGap[gap.id] else { continue }
            let allowed = allowedAIKinds(for: gap)
            let usable = candidates.filter { allowed.contains($0.kind) }
            guard usable.count >= config.masteryTarget else { continue }

            // Prefer distinct kinds, then fill from the rest.
            var picked: [LessonQuestion] = []
            var kindsSeen = Set<QuestionKind>()
            for q in usable where picked.count < config.masteryTarget && kindsSeen.insert(q.kind).inserted { picked.append(q) }
            for q in usable where picked.count < config.masteryTarget && !picked.contains(where: { $0.id == q.id }) { picked.append(q) }

            let slots = local.indices.filter { local[$0].gap.id == gap.id && !local[$0].isInterstitial }
            for (i, idx) in slots.enumerated() where i < picked.count {
                var q = picked[i]
                q.role = role
                q.source = .ai
                local[idx] = q
            }
        }
        return local
    }

    /// Sorted gap ids + the level each is asked at + the option count: the same
    /// lesson re-opened with the same evidence yields the same signature (C9 cache key).
    func formatSignature(for lesson: AssembledLesson, abilityOptionCount: Int) -> String {
        let parts = lesson.gaps.map { "\($0.id):\(level(for: $0).rawValue)" }.sorted()
        return parts.joined(separator: ",") + "|opt=\(max(config.minMultipleChoiceOptions, abilityOptionCount))|cap=\(lesson.isCapstone)"
    }

    // MARK: Single questions

    /// One question of a kind for a gap. `variant` is the round index: the second
    /// recognition round asks multiple choice in reverse. Falls back to multiple
    /// choice when the requested format is not available for the gap; nil only
    /// when even that cannot be built (never, in practice: fallbacks are English).
    func question(for gap: GapItem, kind: QuestionKind, variant: Int = 0, role: SelectedItemRole = .review,
                  pool: [GapItem], optionCount: Int, rng: inout LessonRandom) -> LessonQuestion? {
        let count = max(config.minMultipleChoiceOptions, optionCount)
        let note = gap.explanation.trimmingCharacters(in: .whitespacesAndNewlines)
        switch kind {
        case .multipleChoice:
            if variant % 2 == 1, gap.isTestable, let reversed = reversedMultipleChoice(for: gap, role: role, pool: pool, optionCount: count, rng: &rng) {
                return reversed
            }
            var options = Self.smartDistractors(for: gap, from: pool, count: count - 1, rng: &rng) + [gap.englishTranslation]
            options.shuffle(using: &rng)
            return LessonQuestion(gap: gap, kind: .multipleChoice,
                                  prompt: "What does “\(gap.frenchWord)” mean?",
                                  correctAnswer: gap.englishTranslation, options: options,
                                  hint: nil, role: role,
                                  explanation: note.isEmpty ? nil : note)

        case .fillBlank:
            guard gap.isTestable, let prompt = AnswerGrader.blankedPrompt(for: gap) else {
                return question(for: gap, kind: .multipleChoice, role: role, pool: pool, optionCount: count, rng: &rng)
            }
            let answer = AnswerGrader.blankForm(for: gap)
            let translation = gap.exampleTranslation.trimmingCharacters(in: .whitespacesAndNewlines)
            var explanation = gap.exampleSentence
            if !translation.isEmpty { explanation += " — \(translation)" }
            if !note.isEmpty { explanation += "\n\(note)" }
            return LessonQuestion(gap: gap, kind: .fillBlank, prompt: prompt, correctAnswer: answer,
                                  hint: translation.isEmpty ? nil : translation, role: role,
                                  explanation: explanation)

        case .trueFalse:
            var makeTrue = Bool.random(using: &rng)
            var shown = gap.englishTranslation
            if !makeTrue {
                if let distractor = Self.smartDistractors(for: gap, from: pool, count: 1, rng: &rng).first {
                    shown = distractor
                } else {
                    makeTrue = true
                }
            }
            var explanation = "“\(gap.frenchWord)” means “\(gap.englishTranslation)”."
            if !note.isEmpty { explanation += "\n\(note)" }
            return LessonQuestion(gap: gap, kind: .trueFalse, prompt: "True or false?",
                                  correctAnswer: makeTrue ? "True" : "False",
                                  statement: "“\(gap.frenchWord)” means “\(shown)”.",
                                  hint: nil, role: role, explanation: explanation)

        case .translation:
            guard gap.isTestable else {
                return question(for: gap, kind: .multipleChoice, role: role, pool: pool, optionCount: count, rng: &rng)
            }
            var explanation = "\(gap.frenchWord) — \(gap.englishTranslation)"
            if !gap.exampleSentence.isEmpty { explanation += "\n\(gap.exampleSentence)" }
            if !note.isEmpty { explanation += "\n\(note)" }
            return LessonQuestion(gap: gap, kind: .translation, prompt: "Translate to French:",
                                  correctAnswer: gap.frenchWord, statement: gap.englishTranslation,
                                  hint: nil, role: role, explanation: explanation)

        case .arrange:
            guard isArrangeable(gap) else {
                return question(for: gap, kind: Self.isBlankable(gap) ? .fillBlank : .multipleChoice,
                                role: role, pool: pool, optionCount: count, rng: &rng)
            }
            let target = Self.tokens(of: gap.exampleSentence)
            var bank = target
            var tries = 0
            repeat {
                bank.shuffle(using: &rng)
                tries += 1
            } while bank == target && tries < 8
            let translation = gap.exampleTranslation.trimmingCharacters(in: .whitespacesAndNewlines)
            var explanation = gap.exampleSentence
            if !translation.isEmpty { explanation += " — \(translation)" }
            return LessonQuestion(gap: gap, kind: .arrange, prompt: "Tap the words in order:",
                                  correctAnswer: target.joined(separator: " "),
                                  hint: translation.isEmpty ? nil : translation,
                                  tokens: bank, correctOrder: target, role: role,
                                  explanation: explanation)

        case .match:
            return matchQuestion(for: [gap])
        }
    }

    /// English prompt, French options. Nil when the lesson cannot supply enough
    /// distinct French distractors (no French is ever invented in code).
    private func reversedMultipleChoice(for gap: GapItem, role: SelectedItemRole, pool: [GapItem],
                                        optionCount: Int, rng: inout LessonRandom) -> LessonQuestion? {
        let answerKey = Self.distractorSides(of: gap.frenchWord)
        var candidates = pool.filter { $0.id != gap.id && !$0.isProbe }.map { $0.frenchWord }
        candidates.shuffle(using: &rng)
        var taken: [String] = []
        var takenSides = answerKey
        for c in candidates where taken.count < optionCount - 1 {
            let sides = Self.distractorSides(of: c)
            guard !sides.isEmpty, sides.isDisjoint(with: takenSides) else { continue }
            taken.append(c)
            takenSides.formUnion(sides)
        }
        guard taken.count >= config.minMultipleChoiceOptions - 1 else { return nil }
        var options = taken + [gap.frenchWord]
        options.shuffle(using: &rng)
        let note = gap.explanation.trimmingCharacters(in: .whitespacesAndNewlines)
        var q = LessonQuestion(gap: gap, kind: .multipleChoice,
                               prompt: "Which one means “\(gap.englishTranslation)”?",
                               correctAnswer: gap.frenchWord, options: options,
                               hint: nil, role: role,
                               explanation: note.isEmpty ? nil : note)
        q.isReversed = true
        return q
    }

    /// The single diagnostic question for a probe (B13 / C19): the content's own
    /// distractors plus the answer, never `smartDistractors`. Nil when the probe
    /// carries no distractors — it is then dropped, not substituted.
    func probeQuestion(for gap: GapItem, role: SelectedItemRole = .probe, rng: inout LessonRandom) -> LessonQuestion? {
        let distractors = (gap.probeOptions ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        guard !distractors.isEmpty else { return nil }
        var options = distractors + [gap.englishTranslation]
        options.shuffle(using: &rng)
        // Many probes are cloze items — "___ gare", "tu ___ (parler)" — whose answer
        // is the French form that fills the blank, not a meaning. Asking "What does
        // “___ gare” mean?" over four French options is unanswerable as written.
        let prompt = AnswerGrader.isCloze(gap.frenchWord)
            ? "Which one fits? \(gap.frenchWord)"
            : "What does “\(gap.frenchWord)” mean?"
        var q = LessonQuestion(gap: gap, kind: .multipleChoice,
                               prompt: prompt,
                               correctAnswer: gap.englishTranslation, options: options,
                               hint: nil, role: role)
        q.isProbe = true
        q.explanation = gap.explanation.isEmpty ? nil : gap.explanation
        return q
    }

    /// A match-the-pairs question over several gaps (`gap` is the first pair).
    func matchQuestion(for gaps: [GapItem]) -> LessonQuestion {
        LessonQuestion(gap: gaps[0], kind: .match, prompt: "Match each word to its meaning",
                       correctAnswer: "", matchGaps: gaps)
    }

    /// The interstitial for a lesson: up to `matchGroupSize` non-probe gaps with
    /// distinct English, only when at least `matchInterstitialMinGaps` qualify.
    ///
    /// CHECK-IN gaps are left out along with probes. A match round pairs the word with
    /// its meaning, so including one either hands over the answer to the check-in that
    /// follows or, after it, banks a SECOND check-in outcome on the same concept —
    /// growing the interval the miss just halved and feeding the governor a pass the
    /// learner never earned. One check-in asked is one check-in recorded.
    func matchInterstitial(for lesson: AssembledLesson, roles: [String: SelectedItemRole]? = nil,
                           rng: inout LessonRandom) -> LessonQuestion? {
        let roles = roles ?? Self.roles(in: lesson)
        var seen = Set<String>()
        var distinct: [GapItem] = []
        for gap in lesson.gaps where !gap.isProbe && roles[gap.id] != .probe && roles[gap.id] != .checkIn {
            let key = AnswerGrader.fold(AnswerGrader.normalize(gap.englishTranslation))
            guard !key.isEmpty, seen.insert(key).inserted else { continue }
            distinct.append(gap)
        }
        guard distinct.count >= config.matchInterstitialMinGaps else { return nil }
        distinct.shuffle(using: &rng)
        return matchQuestion(for: Array(distinct.prefix(config.matchGroupSize)))
    }

    // MARK: Remedials (C6)

    /// A stepped-down retry for a missed question, or nil when the gap has had
    /// `maxRemedialsPerGap` already (attempt is 1-based), or for probes and
    /// capstone items. Typed / arranged formats step down to fill-blank when the
    /// gap is blankable, otherwise to multiple choice; everything else steps down
    /// to multiple choice at the minimum option count, showing the answer once.
    func remedial(for question: LessonQuestion, attempt: Int, pool: [GapItem] = []) -> LessonQuestion? {
        guard !question.isCapstone, !question.isProbe,
              attempt >= 1, attempt <= config.maxRemedialsPerGap else { return nil }
        let gap = question.gap
        if gap.isProbe {
            // A check-in riding a probe item can only be re-asked with the probe's
            // own distractors: `smartDistractors` would offer English meanings
            // against a French answer.
            var rng = LessonRandom(seed: config.seed.map { $0 &+ UInt64(attempt) })
            guard var r = probeQuestion(for: gap, role: question.role, rng: &rng) else { return nil }
            r.isProbe = false
            r.isRemedial = true
            r.showsAnswer = !question.showsAnswer
            return r
        }
        let stepped: QuestionKind
        switch question.kind {
        case .translation, .arrange:
            stepped = Self.isBlankable(gap) ? .fillBlank : .multipleChoice
        case .fillBlank, .trueFalse, .match, .multipleChoice:
            stepped = .multipleChoice
        }
        var rng = LessonRandom(seed: config.seed.map { $0 &+ UInt64(attempt) })
        guard var r = self.question(for: gap, kind: stepped, role: question.role, pool: pool,
                                    optionCount: config.minMultipleChoiceOptions, rng: &rng) else { return nil }
        r.isRemedial = true
        r.showsAnswer = r.kind == .multipleChoice && !question.showsAnswer
        return r
    }

    // MARK: In-session release (B11)

    /// Drop the remaining questions of a released target concept (after
    /// `position`) and backfill the same number of questions from the lesson's
    /// review gaps. Interstitials stay. Nothing changes when there is nothing to drop.
    ///
    /// The backfill lands BEFORE the trailing probes — a blind-spot probe closes the
    /// lesson — and goes to the gaps with the fewest questions so far: a third
    /// asking of an item already answered `masteryTarget` times teaches nothing.
    func releaseTargetConcept(conceptId: String, from schedule: [LessonQuestion], after position: Int) -> [LessonQuestion] {
        let cut = max(0, position + 1)
        guard cut < schedule.count else { return schedule }
        let kept = Array(schedule[..<cut])
        let rest = Array(schedule[cut...])
        let dropped = rest.filter { Self.isReleasable($0, conceptId: conceptId) }
        guard !dropped.isEmpty else { return schedule }
        var remaining = rest.filter { !Self.isReleasable($0, conceptId: conceptId) }

        // Backfill from review gaps already in the lesson, cycling through them.
        var reviewGaps: [GapItem] = []
        var seen = Set<String>()
        for q in schedule where q.role == .review && !q.isProbe && !q.isInterstitial && !q.gap.isProbe && q.conceptId != conceptId {
            if seen.insert(q.gap.id).inserted { reviewGaps.append(q.gap) }
        }
        if !reviewGaps.isEmpty {
            var pool: [GapItem] = []
            var poolSeen = Set<String>()
            for q in schedule {
                for g in [q.gap] + q.matchGaps where poolSeen.insert(g.id).inserted { pool.append(g) }
            }
            let optionCount = schedule.filter { $0.kind == .multipleChoice && !$0.isProbe && !$0.isRemedial }
                .map { $0.options.count }.max() ?? config.minMultipleChoiceOptions
            var usage: [String: Int] = [:]
            for q in schedule where !q.isInterstitial { usage[q.gap.id, default: 0] += 1 }
            var order: [String: Int] = [:]
            for (i, gap) in reviewGaps.enumerated() { order[gap.id] = i }
            var rng = LessonRandom(seed: config.seed.map { $0 ^ 0xA5A5 })
            var backfill: [LessonQuestion] = []
            for _ in 0..<dropped.count {
                // Least-asked first: a gap still short of `masteryTarget` questions
                // is backfilled before one that has already had its full round.
                guard let gap = reviewGaps.min(by: { a, b in
                    let ua = usage[a.id, default: 0], ub = usage[b.id, default: 0]
                    if ua != ub { return ua < ub }
                    return (order[a.id] ?? 0) < (order[b.id] ?? 0)
                }) else { break }
                let n = usage[gap.id, default: 0]
                usage[gap.id] = n + 1
                // A gap that has already had its full round comes back one tier UP
                // — this lesson just supplied the evidence for it — rather than as
                // the same recognition question a third time.
                var tier = level(for: gap)
                if n >= config.masteryTarget, let up = QuestionLevel(rawValue: tier.rawValue + 1) {
                    tier = min(up, maxLevel(for: gap))
                }
                let ks = kinds(for: gap, at: tier)
                if let q = question(for: gap, kind: ks[n % ks.count], variant: n, role: .review,
                                    pool: pool, optionCount: optionCount, rng: &rng) {
                    backfill.append(q)
                }
            }
            let insertAt = remaining.firstIndex { $0.isProbe } ?? remaining.count
            remaining.insert(contentsOf: backfill, at: insertAt)
        }
        return kept + remaining
    }

    private static func isReleasable(_ q: LessonQuestion, conceptId: String) -> Bool {
        q.role == .target && q.conceptId == conceptId && !q.isInterstitial && !q.isProbe
    }

    // MARK: Distractors (C27)

    /// English distractors from the lesson's own gaps (same category first), then
    /// the English fallback list. Rejects near-duplicates of the answer and of
    /// each other: diacritic-insensitive equality, and "a / b" glosses that share a side.
    static func smartDistractors(for gap: GapItem, from pool: [GapItem], count: Int, rng: inout LessonRandom) -> [String] {
        guard count > 0 else { return [] }
        let others = pool.filter { $0.id != gap.id && !$0.isProbe }
        var same = others.filter { $0.category == gap.category }.map { $0.englishTranslation }
        var other = others.filter { $0.category != gap.category }.map { $0.englishTranslation }
        same.shuffle(using: &rng)
        other.shuffle(using: &rng)
        let candidates = same + other + fallbackDistractors

        var taken: [String] = []
        var takenSides = distractorSides(of: gap.englishTranslation)
        for c in candidates where taken.count < count {
            let sides = distractorSides(of: c)
            guard !sides.isEmpty, sides.isDisjoint(with: takenSides) else { continue }
            taken.append(c)
            takenSides.formUnion(sides)
        }
        return taken
    }

    /// The comparison sides of a gloss: "house / home" → {house, home}, folded
    /// (case- and diacritic-insensitive). Parenthetical tags are kept — "the
    /// (masculine singular)" and "the (feminine singular)" are distinct answers.
    static func distractorSides(of gloss: String) -> Set<String> {
        var out = Set<String>()
        for side in gloss.split(separator: "/") {
            let key = AnswerGrader.fold(side.trimmingCharacters(in: .whitespacesAndNewlines))
                .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            if !key.isEmpty { out.insert(key) }
        }
        return out
    }

    // MARK: Helpers

    static func tokens(of sentence: String) -> [String] {
        sentence.split(whereSeparator: { $0 == " " || $0 == "\n" })
            .map { $0.trimmingCharacters(in: CharacterSet(charactersIn: " ")) }
            .filter { !$0.isEmpty }
    }

    /// Role per gap id from the lesson's selection (`.review` when unknown).
    static func roles(in lesson: AssembledLesson) -> [String: SelectedItemRole] {
        var out: [String: SelectedItemRole] = [:]
        for item in lesson.selection.items { out[item.gapId] = item.role }
        return out
    }

    /// The highest level a gap can be asked at regardless of evidence.
    private func maxLevel(for gap: GapItem) -> QuestionLevel {
        gap.isTestable ? .production : .recognition
    }
}

// MARK: - Concept release tracker (B11)

/// Counts consecutive first-try correct answers per concept inside one lesson
/// and says when a concept has earned its release. Owned by the view as `@State`.
nonisolated struct ConceptReleaseTracker {
    private(set) var streaks: [String: Int] = [:]
    private(set) var released: Set<String> = []

    /// Record one answer. Returns the concept id the FIRST time its streak reaches
    /// `releaseStreak` (a miss resets the streak; a released concept never re-triggers).
    mutating func record(conceptId: String?, firstTryCorrect: Bool, releaseStreak: Int) -> String? {
        guard let conceptId else { return nil }
        guard firstTryCorrect else {
            streaks[conceptId] = 0
            return nil
        }
        let streak = (streaks[conceptId] ?? 0) + 1
        streaks[conceptId] = streak
        guard releaseStreak > 0, streak >= releaseStreak, released.insert(conceptId).inserted else { return nil }
        return conceptId
    }
}

// MARK: - Scoring (C25)

/// XP per correct answer under the combo multiplier. Reads `Tuning` only.
nonisolated enum LessonScoring {
    static func comboMultiplier(_ combo: Int) -> Double {
        if combo >= Tuning.comboHighStreak { return Tuning.comboHighMultiplier }
        if combo >= Tuning.comboMidStreak { return Tuning.comboMidMultiplier }
        return 1
    }

    /// XP awarded for a correct answer at this combo length (after the increment).
    static func xp(forCombo combo: Int) -> Int {
        Int((Double(Tuning.xpPerCorrect) * comboMultiplier(combo)).rounded())
    }
}
