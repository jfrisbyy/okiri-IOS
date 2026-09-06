//
//  AssessmentService.swift
//  FluentFrenchIOS
//
//  The adaptive placement check — the front door that ROUTES each new learner.
//  It draws lightweight recognition items from frequency-banded vocabulary plus a
//  few core-grammar discriminators, adapts up/down by answer, and stops early once
//  it has a confident read (or bottoms out for a true beginner). Frequency rank IS
//  the difficulty — we do not calibrate item difficulty from user data.
//
//  It estimates TWO things separately — vocab coverage and grammar control — and
//  outputs a PlacementResult that seeds concept mastery and a per-modality route.
//

import Foundation

// MARK: - Item

nonisolated struct AssessmentQuestion: Identifiable, Hashable {
    let id = UUID()
    /// Frequency / difficulty band: 1 (top ~100) → 4 (top ~2000 / B2). KNOWN difficulty.
    let band: Int
    let category: GapCategory
    let prompt: String
    let french: String
    let english: String
    /// Answer choices. Re-shuffled every time the item is presented (D6), so the
    /// correct answer never sits in a fixed slot; `id` is unchanged by a shuffle.
    var options: [String]
    let correctAnswer: String
    let explanation: String
    let exampleSentence: String
    let exampleTranslation: String
    /// Base concept this item is evidence of (for seeding mastery), if any.
    let conceptId: String?

    var level: CEFRLevel { AssessmentService.level(forBand: band) }

    /// The same item (same `id`) with its options in a fresh random order.
    func presented<G: RandomNumberGenerator>(using generator: inout G) -> AssessmentQuestion {
        var copy = self
        copy.options.shuffle(using: &generator)
        return copy
    }
}

/// The placement's source of randomness: the system generator in the app, a
/// SplitMix64 stream when a seed is given (tests and the headless driver replay
/// the exact same staircase).
nonisolated struct PlacementRandom: RandomNumberGenerator {
    private var state: UInt64?
    private var system = SystemRandomNumberGenerator()

    init(seed: UInt64? = nil) { state = seed }

    mutating func next() -> UInt64 {
        guard var s = state else { return system.next() }
        s &+= 0x9E37_79B9_7F4A_7C15
        state = s
        var z = s
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

// MARK: - Result

nonisolated struct PlacementResult {
    /// Highest vocab band the learner cleared (0 = none cleared → true beginner on vocab).
    var vocabBand: Int
    /// Highest grammar band the learner cleared.
    var grammarBand: Int
    var estimatedLevel: CEFRLevel
    var isTrueBeginner: Bool
    /// Base concepts the learner DEMONSTRABLY knows — asked
    /// `Tuning.placementProbesPerConcept` items and answered every one — seeded as
    /// (provisional) mastery. Never contains a concept the learner missed an item
    /// on (Pass 3 F5), and never one that was only inferred from its band (B9).
    var masteredConceptIds: [String]
    /// Gaps built from the items the learner missed → seed as things to teach.
    var missedGaps: [GapItem]
    /// How many items were actually asked (for the results summary).
    var askedCount: Int
    /// How many were answered correctly.
    var correctCount: Int
    /// Placement seeds are PROVISIONAL: they read as mastered but are verified by a
    /// first check-in after `Tuning.seedVerificationDays` (Pass 3 F5 / B7).
    var seedsAreProvisional: Bool = true
    /// Concepts the learner missed at least one item on (excluded from the seeds).
    var missedConceptIds: [String] = []
    /// Base concepts at or below a cleared band that were NOT fully probed (asked
    /// fewer than `Tuning.placementProbesPerConcept` items, or never) and not missed.
    /// Seeded as a `.learning` head start (`Tuning.placementInferredAlpha`), never
    /// as mastery — they rank first as targets and never count toward coverage.
    var inferredConceptIds: [String] = []
    /// Items asked per concept, so the store can tell the tiers apart.
    var askedCounts: [String: Int] = [:]

    /// Items the staircase asked on a concept (0 when it never came up).
    func askedCount(for conceptId: String) -> Int {
        askedCounts[conceptId] ?? 0
    }

    /// Concepts asked the full probe budget with no miss — the only ones that can be
    /// seeded as mastered.
    var fullyProbedConceptIds: Set<String> {
        let missed = Set(missedConceptIds)
        return Set(askedCounts.filter { $0.value >= Tuning.placementProbesPerConcept && !missed.contains($0.key) }.keys)
    }
}

// MARK: - Adaptive engine

/// Drives the adaptive staircase. The view calls `next()` for an item, shows it,
/// then `record(_:correct:)`, and repeats until `next()` returns nil.
nonisolated struct PlacementEngine {
    private let bank: [AssessmentQuestion]
    private(set) var asked: [AssessmentQuestion] = []
    private(set) var missed: [AssessmentQuestion] = []
    private(set) var correctCount: Int = 0

    /// Current target band (staircase position).
    private var band: Int = 2
    /// Consecutive misses at the lowest band, PER CATEGORY. The test estimates
    /// vocabulary and grammar separately (a false beginner typically has one and
    /// not the other), so bottoming out is per category too: a category that has
    /// missed `Tuning.placementBottomOutMisses` lowest-band items in a row is not
    /// asked again, and the learner is a true beginner only once EVERY category
    /// in the bank has bottomed out. Any correct answer in a category resets its
    /// counter (D7).
    private var lowestBandMisses: [GapCategory: Int] = [:]
    /// Whether the learner self-declared a complete beginner (skip → full Foundation).
    private(set) var declaredBeginner: Bool = false
    /// Random choice among equally good items and option order (D6).
    private var random: PlacementRandom

    /// Fewest / most items the staircase asks (`Tuning.placementMinItems` / `placementMaxItems`);
    /// the progress bar reads these.
    let minItems = Tuning.placementMinItems
    let maxItems = Tuning.placementMaxItems
    /// Items asked per concept before a "knows it" read is trusted (Pass 3 F5).
    let probesPerConcept = Tuning.placementProbesPerConcept
    /// Lowest-band misses in a row that bottom a category out.
    let bottomOutMisses = Tuning.placementBottomOutMisses
    private let minBand = 1
    private let maxBand = 4

    /// `seed` makes the staircase fully reproducible (tests, the headless driver);
    /// the app leaves it nil.
    init(bank: [AssessmentQuestion] = AssessmentService.bank, seed: UInt64? = nil) {
        self.bank = bank
        self.random = PlacementRandom(seed: seed)
    }

    /// Categories that have bottomed out at the lowest band.
    var bottomedOutCategories: Set<GapCategory> {
        Set(lowestBandMisses.filter { $0.value >= bottomOutMisses }.keys)
    }

    /// True once every category the bank holds has bottomed out — nothing is left
    /// to learn from asking; the learner starts from the beginning.
    private var hasBottomedOut: Bool {
        let categories = Set(bank.map { $0.category })
        guard !categories.isEmpty else { return false }
        return categories.isSubset(of: bottomedOutCategories)
    }

    /// Items already asked on a concept.
    func askedCount(for conceptId: String) -> Int {
        asked.filter { $0.conceptId == conceptId }.count
    }

    /// Items the bank still holds for a concept that have not been asked.
    private func unaskedCount(for conceptId: String) -> Int {
        let askedIds = Set(asked.map { $0.id })
        return bank.filter { $0.conceptId == conceptId && !askedIds.contains($0.id) }.count
    }

    /// Concepts with at least one missed item — never seeded as mastered.
    var missedConceptIds: Set<String> {
        Set(missed.compactMap { $0.conceptId })
    }

    /// Concepts asked the full probe budget (`probesPerConcept`) with no miss — a
    /// trusted "knows it" read (Pass 3 F5).
    var fullyProbedConceptIds: Set<String> {
        var counts: [String: Int] = [:]
        for q in asked { if let cid = q.conceptId { counts[cid, default: 0] += 1 } }
        let missedConcepts = missedConceptIds
        return Set(counts.filter { $0.value >= probesPerConcept && !missedConcepts.contains($0.key) }.keys)
    }

    /// The staircase band as it stands (tests read this to check the concept-level step).
    var currentBand: Int { band }

    /// The next item to present, or nil when the test should stop.
    mutating func next() -> AssessmentQuestion? {
        if declaredBeginner { return nil }
        if asked.count >= maxItems { return nil }
        if hasBottomedOut { return nil }                 // every category bottomed out → true beginner
        if asked.count >= minItems && hasStabilized() { return nil }

        // Pick an unused item closest to the current band, alternating category
        // so we gather evidence on both vocab and grammar. Among equally good
        // items the choice is random, and every item is presented with freshly
        // shuffled options (D6) — two learners, or two retakes, never see the
        // same sequence. A category that has bottomed out is never asked again.
        let askedIds = Set(asked.map { $0.id })
        let bottomed = bottomedOutCategories
        let pool = bank.filter { !askedIds.contains($0.id) && !bottomed.contains($0.category) }
        guard !pool.isEmpty else { return nil }

        // Pass 3 F5: one correct answer is not a read on a concept. Keep probing the
        // concept just answered correctly — up to `probesPerConcept` items — before
        // moving on. A missed concept is already excluded from the seeds, so there is
        // nothing more to learn by asking it again.
        if let last = asked.last, let cid = last.conceptId, !missed.contains(last),
           askedCount(for: cid) < probesPerConcept,
           let more = pool.filter({ $0.conceptId == cid }).randomElement(using: &random) {
            return more.presented(using: &random)
        }
        // Never ask a concept beyond its probe budget or one already missed.
        let missedConcepts = missedConceptIds
        let open = pool.filter { q in
            guard let cid = q.conceptId else { return true }
            return !missedConcepts.contains(cid) && askedCount(for: cid) < probesPerConcept
        }
        let candidates = open.isEmpty ? pool : open

        let preferredCategory: GapCategory? = {
            let vocabAsked = asked.filter { $0.category == .vocabulary }.count
            let grammarAsked = asked.filter { $0.category == .grammar }.count
            if vocabAsked <= grammarAsked { return .vocabulary }
            return .grammar
        }()

        func pick(in band: Int) -> AssessmentQuestion? {
            let atBand = candidates.filter { $0.band == band }
            if let c = preferredCategory, let m = atBand.filter({ $0.category == c }).randomElement(using: &random) { return m }
            return atBand.randomElement(using: &random)
        }
        // Search outward from the target band.
        for delta in 0...maxBand {
            if let m = pick(in: band + delta) { return m.presented(using: &random) }
            if delta > 0, let m = pick(in: band - delta) { return m.presented(using: &random) }
        }
        return candidates.randomElement(using: &random)?.presented(using: &random)
    }

    /// Record an answer. The staircase steps at the CONCEPT level (B9): DOWN once on
    /// a concept's first miss, UP once when a concept completes its probes clean —
    /// `probesPerConcept` items, or every item the bank holds for it when that is
    /// fewer. Three correct answers on one concept are one step, not three. An item
    /// with no concept is its own one-item concept and steps immediately.
    mutating func record(_ q: AssessmentQuestion, correct: Bool) {
        let firstMissOnConcept = q.conceptId.map { !missedConceptIds.contains($0) } ?? true
        asked.append(q)
        if correct {
            correctCount += 1
            lowestBandMisses[q.category] = 0                       // any correct answer resets its category's bottom-out counter (D7)
        } else {
            missed.append(q)
            if q.band <= minBand { lowestBandMisses[q.category, default: 0] += 1 } else { lowestBandMisses[q.category] = 0 }
        }
        guard let cid = q.conceptId else {
            band = correct ? min(maxBand, band + 1) : max(minBand, band - 1)
            return
        }
        if !correct {
            if firstMissOnConcept { band = max(minBand, band - 1) }          // staircase down, once per concept
        } else if askedCount(for: cid) >= probesPerConcept || unaskedCount(for: cid) == 0 {
            band = min(maxBand, band + 1)                                    // staircase up: concept complete, clean
        }
    }

    /// Route straight to full Foundation.
    mutating func declareBeginner() { declaredBeginner = true }

    /// Bands of the last `n` DISTINCT concepts asked (most recent first). Repeats
    /// of one concept are one entry, so probing a concept three times never
    /// counts as three stable readings.
    private func recentConceptBands(_ n: Int) -> [Int] {
        var seen = Set<String>()
        var bands: [Int] = []
        for q in asked.reversed() {
            let key = q.conceptId ?? q.id.uuidString
            guard !seen.contains(key) else { continue }
            seen.insert(key)
            bands.append(q.band)
            if bands.count == n { break }
        }
        return bands
    }

    /// Stable once the staircase is bouncing within one band of itself across the
    /// last four DISTINCT concepts.
    private func hasStabilized() -> Bool {
        let bands = recentConceptBands(4)
        guard bands.count >= 4, let lo = bands.min(), let hi = bands.max() else { return false }
        return hi - lo <= 1
    }

    func result() -> PlacementResult {
        if declaredBeginner {
            return PlacementResult(
                vocabBand: 0, grammarBand: 0, estimatedLevel: .A1, isTrueBeginner: true,
                masteredConceptIds: [], missedGaps: [], askedCount: 0, correctCount: 0
            )
        }
        let vocab = clearedBand(for: .vocabulary)
        let grammar = clearedBand(for: .grammar)
        let topBand = max(vocab, grammar)
        let beginner = topBand == 0
        let level = beginner ? .A1 : AssessmentService.level(forBand: topBand)

        let missedConcepts = missedConceptIds
        let fullyProbed = fullyProbedConceptIds
        var askedCounts: [String: Int] = [:]
        for q in asked { if let cid = q.conceptId { askedCounts[cid, default: 0] += 1 } }
        // Two tiers (B9): a concept asked the full probe budget clean is seeded as
        // (provisional) mastery; anything else at or below the cleared bands is only
        // an inferred head start.
        let inBand = AssessmentService.masteredConcepts(vocabBand: vocab, grammarBand: grammar, excluding: missedConcepts)
        let mastered = fullyProbed.filter { ConceptTaxonomy.baseConceptIds.contains($0) }.sorted()
        let inferred = inBand.filter { !fullyProbed.contains($0) }
        return PlacementResult(
            vocabBand: vocab,
            grammarBand: grammar,
            estimatedLevel: level,
            isTrueBeginner: beginner,
            masteredConceptIds: mastered,
            missedGaps: AssessmentService.gaps(forMissed: missed),
            askedCount: asked.count,
            correctCount: correctCount,
            seedsAreProvisional: true,
            missedConceptIds: missedConcepts.sorted(),
            inferredConceptIds: inferred,
            askedCounts: askedCounts
        )
    }

    /// Highest band b such that every tested band ≤ b was answered ≥50% correctly.
    /// A band with fewer than `probesPerConcept` items asked is inconclusive on its
    /// own (one lucky answer is not a cleared band) — unless a concept of this
    /// category was fully probed clean at or above it: three clean items on one
    /// concept are a trusted read of that concept's band even when its items were
    /// spread over two bands (a band-2 hand item plus two band-1 content probes),
    /// so a learner who demonstrably knows a concept never reads as a true beginner.
    private func clearedBand(for category: GapCategory) -> Int {
        let fullyProbed = fullyProbedConceptIds
        // The band a fully probed concept vouches for: the LOWEST band among its
        // items (conservative — a frequency-banded hand item never inflates it).
        var vouchedBand = 0
        for cid in fullyProbed {
            let bands = asked.filter { $0.category == category && $0.conceptId == cid }.map { $0.band }
            if let low = bands.min() { vouchedBand = max(vouchedBand, low) }
        }
        var cleared = 0
        for b in minBand...maxBand {
            let pool = asked.filter { $0.category == category && $0.band == b }
            guard pool.count >= probesPerConcept else {
                if b <= vouchedBand { cleared = b }                        // a trusted concept read covers this band
                continue                                                    // otherwise untested / thin — skip, keep going
            }
            let hit = pool.filter { !missed.contains($0) }.count
            if Double(hit) / Double(pool.count) >= 0.5 || b <= vouchedBand { cleared = b } else { break }
        }
        return cleared
    }
}

// MARK: - Service (bank + seeding helpers)

nonisolated enum AssessmentService {
    /// Band → CEFR mapping. Frequency rank IS the difficulty.
    static func level(forBand band: Int) -> CEFRLevel {
        switch band {
        case ..<1: return .A1
        case 1: return .A1
        case 2: return .A2
        case 3: return .B1
        default: return .B2
        }
    }

    /// Base concepts at or below the cleared bands. We only consider grammar +
    /// vocabulary (a text test can't fairly judge pronunciation, phrasing or
    /// register), leaving those never-observed for Foundation. A concept the learner
    /// missed an item on is never included, whatever its band (Pass 3 F5). The
    /// engine splits this list into the mastered tier (fully probed) and the
    /// inferred tier (`PlacementResult.inferredConceptIds`).
    static func masteredConcepts(vocabBand: Int, grammarBand: Int, excluding missed: Set<String> = []) -> [String] {
        ConceptTaxonomy.seed().compactMap { concept in
            guard ConceptTaxonomy.baseConceptIds.contains(concept.id), !missed.contains(concept.id) else { return nil }
            let conceptBand = bandForLevel(concept.cefrLevel)
            switch concept.category {
            case .vocabulary:
                return conceptBand <= vocabBand ? concept.id : nil
            case .grammar:
                return conceptBand <= grammarBand ? concept.id : nil
            default:
                return nil
            }
        }
    }

    static func bandForLevel(_ level: CEFRLevel) -> Int {
        switch level {
        case .A1: return 1
        case .A2: return 2
        case .B1: return 3
        default: return 4
        }
    }

    // MARK: - Content probes as placement items (B9 / D6)

    /// Placement items built from a concept's content-v2 probes (three real
    /// multiple-choice items per concept). The banked bank alone holds one or two
    /// items for most concepts, so the `Tuning.placementProbesPerConcept` read that
    /// seeds mastery is only reachable when these are added:
    /// `PlacementEngine(bank: AssessmentService.bank + AssessmentService.contentBank(...))`.
    /// Only grammar and vocabulary concepts are used (the same categories the seeds
    /// cover). Nothing is authored here: stem, answer, distractors and example are
    /// the content's own.
    static func questions(fromProbes probes: [FoundationProbeContent], for concept: Concept) -> [AssessmentQuestion] {
        guard concept.category == .grammar || concept.category == .vocabulary else { return [] }
        let band = bandForLevel(concept.cefrLevel)
        return probes.compactMap { probe in
            guard !probe.fr.isEmpty, !probe.en.isEmpty, !probe.options.isEmpty else { return nil }
            let prompt = probe.fr.contains("___") ? "Fill in the blank: “\(probe.fr)”" : "What does “\(probe.fr)” mean?"
            return q(band, concept.category, prompt, probe.fr, probe.en, probe.options, probe.en,
                     "", probe.ex, probe.exEn, concept.id)
        }
    }

    /// The content-probe bank for a taxonomy: every grammar / vocabulary concept's
    /// probes as placement items, `probes` being the content lookup
    /// (`FoundationContentLoader.probes(for:)` in the app, synthetic in tests).
    static func contentBank(concepts: [Concept], probes: (String) -> [FoundationProbeContent]) -> [AssessmentQuestion] {
        concepts.flatMap { questions(fromProbes: probes($0.id), for: $0) }
    }

    /// The bank the placement screen runs on (D6 / B9): the content probes for every
    /// grammar / vocabulary concept (three real items each, so the staircase's
    /// `Tuning.placementProbesPerConcept` rule has material), with the hand-written
    /// items kept ONLY where content is missing — a concept with no usable probes,
    /// a band no probe reaches (band 4 has no taxonomy concept), or an item tied to
    /// no concept. With a complete content file the hand-written items never show.
    static func placementBank(concepts: [Concept], probes: (String) -> [FoundationProbeContent]) -> [AssessmentQuestion] {
        let content = contentBank(concepts: concepts, probes: probes)
        let coveredConcepts = Set(content.compactMap { $0.conceptId })
        let coveredBands = Set(content.map { $0.band })
        let fallback = bank.filter { q in
            guard let cid = q.conceptId else { return true }
            return !coveredConcepts.contains(cid) || !coveredBands.contains(q.band)
        }
        return content + fallback
    }

    /// Build gap items from the questions the learner missed. Like every gap the
    /// store creates they start with an FSRS state due now (B4), so a missed
    /// placement item is on the schedule from day one.
    static func gaps(forMissed missed: [AssessmentQuestion], now: Date = Date()) -> [GapItem] {
        return missed.map { q in
            var gap = GapItem(
                id: UUID().uuidString,
                frenchWord: q.french,
                englishTranslation: q.english,
                explanation: q.explanation,
                exampleSentence: q.exampleSentence,
                exampleTranslation: q.exampleTranslation,
                pronunciation: nil,
                sourceType: .foundation,
                category: q.category,
                difficulty: .hard,
                reviewCount: 0,
                consecutiveCorrect: 0,
                lastReviewedAt: nil,
                nextReviewAt: now,
                masteredAt: nil,
                createdAt: now,
                cefrLevel: q.level,
                easeFactor: 2.5,
                currentInterval: 0,
                irtDifficulty: Double(q.band) * 0.6 - 0.8,
                fsrs: nil,
                originalContext: nil,
                confusionLinks: [],
                conceptId: q.conceptId
            )
            gap.fsrs = FSRS.makeInitialState(grade: .again, now: now)
            gap.fsrs?.dueAt = now
            return gap
        }
    }

    // MARK: - Banked item bank (curated, lightweight recognition)

    private static func q(_ band: Int, _ cat: GapCategory, _ prompt: String, _ french: String,
                          _ english: String, _ options: [String], _ answer: String,
                          _ explanation: String, _ example: String, _ exampleTr: String,
                          _ concept: String?) -> AssessmentQuestion {
        var opts = options
        if !opts.contains(answer) { opts.append(answer) }
        opts.shuffle()
        return AssessmentQuestion(band: band, category: cat, prompt: prompt, french: french,
                                  english: english, options: opts, correctAnswer: answer,
                                  explanation: explanation, exampleSentence: example,
                                  exampleTranslation: exampleTr, conceptId: concept)
    }

    static let bank: [AssessmentQuestion] = [
        // MARK: Band 1 — top ~100 words / A1 foundations
        q(1, .vocabulary, "What does “bonjour” mean?", "bonjour", "hello",
          ["hello", "goodbye", "thanks", "sorry"], "hello",
          "The default daytime greeting.", "Bonjour !", "Hello!", "greetings-politeness"),
        q(1, .vocabulary, "What does “eau” mean?", "eau", "water",
          ["water", "bread", "milk", "wine"], "water",
          "A top-frequency noun.", "Je bois de l'eau.", "I drink water.", "everyday-vocab"),
        q(1, .vocabulary, "What does “maison” mean?", "maison", "house",
          ["house", "car", "street", "garden"], "house",
          "Everyday noun.", "Je rentre à la maison.", "I go home.", "everyday-vocab"),
        q(1, .grammar, "Pick the correct article: “___ chat” (the cat)", "le chat", "the cat",
          ["le", "la", "les", "une"], "le",
          "“Chat” is masculine → le.", "Le chat dort.", "The cat sleeps.", "definite-articles"),
        q(1, .grammar, "“Je ___ français.” (I speak French)", "je parle", "I speak",
          ["parle", "parles", "parlez", "parlent"], "parle",
          "Regular -er verb, 1st person.", "Je parle français.", "I speak French.", "present-er-verbs"),
        q(1, .vocabulary, "What does “mère” mean?", "mère", "mother",
          ["mother", "sister", "daughter", "aunt"], "mother",
          "A core family word.", "Ma mère est gentille.", "My mother is kind.", "family-vocab"),
        q(1, .vocabulary, "What does “pomme” mean?", "pomme", "apple",
          ["apple", "potato", "pear", "plum"], "apple",
          "A common food word.", "Je mange une pomme.", "I eat an apple.", "food-drink-vocab"),
        q(1, .vocabulary, "What colour is “rouge”?", "rouge", "red",
          ["red", "blue", "green", "black"], "red",
          "A basic colour.", "une pomme rouge", "a red apple", "colors-vocab"),
        q(1, .grammar, "Make it negative: “Je ___ sais ___.” (I don't know)", "ne... pas", "not",
          ["ne... pas", "pas... ne", "non... pas", "ne... non"], "ne... pas",
          "Negation wraps the verb.", "Je ne sais pas.", "I don't know.", "negation"),
        q(1, .grammar, "Choose the possessive: “___ livre” (my book, m)", "mon livre", "my book",
          ["mon", "ma", "mes", "ton"], "mon",
          "Possessive agrees with the noun.", "mon livre", "my book", "possessive-adjectives"),

        // MARK: Band 2 — top ~500 / A2
        q(2, .vocabulary, "What does “bientôt” mean?", "bientôt", "soon",
          ["soon", "yesterday", "never", "often"], "soon",
          "Common time adverb.", "À bientôt !", "See you soon!", "numbers-time"),
        q(2, .vocabulary, "What does “travail” mean?", "travail", "work",
          ["work", "trip", "holiday", "meal"], "work",
          "Everyday noun.", "Je vais au travail.", "I go to work.", "everyday-vocab"),
        q(2, .grammar, "Past tense: “Hier, j'___ mangé.” (I ate)", "j'ai mangé", "I ate",
          ["ai", "suis", "vais", "était"], "ai",
          "Passé composé of manger uses avoir.", "J'ai mangé.", "I ate.", "passe-compose-avoir"),
        q(2, .grammar, "Choose the partitive: “Je voudrais ___ pain.” (some bread)", "du pain", "some bread",
          ["du", "le", "un", "des"], "du",
          "Partitive for uncountable nouns.", "Je voudrais du pain.", "I'd like some bread.", "partitive-articles"),
        q(2, .grammar, "Make it agree: “une voiture ___” (red)", "rouge", "red",
          ["rouge", "rouges", "rouger", "rougé"], "rouge",
          "“Rouge” doesn't change for gender here.", "une voiture rouge", "a red car", "adjective-agreement"),
        q(2, .grammar, "Plural of “un animal”?", "des animaux", "animals",
          ["animaux", "animals", "animales", "animaus"], "animaux",
          "Nouns in -al become -aux.", "des animaux", "animals", "plurals"),
        q(2, .grammar, "Ask a yes/no question: “___ tu viens ?”", "est-ce que", "(question marker)",
          ["Est-ce que", "Qu'est-ce", "Est-ce", "Que est"], "Est-ce que",
          "‘Est-ce que’ forms a yes/no question.", "Est-ce que tu viens ?", "Are you coming?", "questions"),
        q(2, .grammar, "Near future: “Je ___ manger.” (I'm going to eat)", "je vais manger", "I'm going to eat",
          ["vais", "suis", "ai", "vas"], "vais",
          "aller + infinitive = near future.", "Je vais manger.", "I'm going to eat.", "near-future"),
        q(2, .vocabulary, "What does “magasin” mean?", "magasin", "shop",
          ["shop", "street", "bank", "market"], "shop",
          "A common place in town.", "Le magasin est ouvert.", "The shop is open.", "places-town-vocab"),

        // MARK: Band 3 — top ~1000 / B1
        q(3, .vocabulary, "What does “du coup” mean (casual)?", "du coup", "so / as a result",
          ["so / as a result", "of course", "by the way", "no way"], "so / as a result",
          "Very common spoken connector.", "Du coup, on y va ?", "So, shall we go?", "spoken-fillers"),
        q(3, .vocabulary, "“Je ___ nager.” (I know how to swim)", "je sais", "I know how to",
          ["sais", "connais", "sait", "connait"], "sais",
          "Savoir = know how to / a fact.", "Je sais nager.", "I know how to swim.", "savoir-vs-connaitre"),
        q(3, .grammar, "Imparfait: “Quand j'étais petit, je ___ au foot.” (played)", "je jouais", "I played",
          ["jouais", "ai joué", "joue", "jouerai"], "jouais",
          "Habitual past = imparfait.", "Je jouais au foot.", "I used to play football.", "imparfait"),
        q(3, .grammar, "Object pronoun: “Tu vois Marie ? Oui, je ___ vois.”", "je la vois", "I see her",
          ["la", "lui", "le", "leur"], "la",
          "Direct object (her) → la.", "Je la vois.", "I see her.", "object-pronouns"),

        // MARK: Band 4 — top ~2000 / B2
        q(4, .grammar, "Subjunctive: “Il faut que tu ___.” (go)", "que tu ailles", "that you go",
          ["ailles", "vas", "allé", "iras"], "ailles",
          "“Il faut que” triggers the subjunctive.", "Il faut que tu ailles.", "You must go.", "subjunctive-intro"),
        q(4, .vocabulary, "What does “avoir le cafard” mean?", "avoir le cafard", "to feel down",
          ["to feel down", "to be hungry", "to be lucky", "to be late"], "to feel down",
          "Idiom — literally 'have the cockroach'.", "J'ai le cafard.", "I feel down.", "idioms"),
        q(4, .grammar, "Imparfait vs passé composé: “Je dormais quand il ___.” (arrived)", "il est arrivé", "he arrived",
          ["est arrivé", "arrivait", "arrive", "arrivera"], "est arrivé",
          "Completed event interrupts the background.", "Il est arrivé.", "He arrived.", "imparfait-vs-pc"),
    ]
}
