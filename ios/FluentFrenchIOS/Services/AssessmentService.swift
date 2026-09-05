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
    let options: [String]
    let correctAnswer: String
    let explanation: String
    let exampleSentence: String
    let exampleTranslation: String
    /// Base concept this item is evidence of (for seeding mastery), if any.
    let conceptId: String?

    var level: CEFRLevel { AssessmentService.level(forBand: band) }
}

// MARK: - Result

nonisolated struct PlacementResult {
    /// Highest vocab band the learner cleared (0 = none cleared → true beginner on vocab).
    var vocabBand: Int
    /// Highest grammar band the learner cleared.
    var grammarBand: Int
    var estimatedLevel: CEFRLevel
    var isTrueBeginner: Bool
    /// Base concepts the learner demonstrably knows → seed as mastered.
    var masteredConceptIds: [String]
    /// Gaps built from the items the learner missed → seed as things to teach.
    var missedGaps: [GapItem]
    /// How many items were actually asked (for the results summary).
    var askedCount: Int
    /// How many were answered correctly.
    var correctCount: Int
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
    /// Consecutive misses at the lowest band → graceful "true beginner" bottom-out.
    private var lowestBandMisses: Int = 0
    /// Whether the learner self-declared a complete beginner (skip → full Foundation).
    private(set) var declaredBeginner: Bool = false

    private let minItems = 6
    private let maxItems = 12
    private let minBand = 1
    private let maxBand = 4

    init(bank: [AssessmentQuestion] = AssessmentService.bank) {
        self.bank = bank
    }

    /// The next item to present, or nil when the test should stop.
    mutating func next() -> AssessmentQuestion? {
        if declaredBeginner { return nil }
        if asked.count >= maxItems { return nil }
        if lowestBandMisses >= 2 { return nil }          // bottomed out → true beginner
        if asked.count >= minItems && hasStabilized() { return nil }

        // Pick an unused item closest to the current band, alternating category
        // so we gather evidence on both vocab and grammar.
        let askedIds = Set(asked.map { $0.id })
        let pool = bank.filter { !askedIds.contains($0.id) }
        guard !pool.isEmpty else { return nil }

        let preferredCategory: GapCategory? = {
            let vocabAsked = asked.filter { $0.category == .vocabulary }.count
            let grammarAsked = asked.filter { $0.category == .grammar }.count
            if vocabAsked <= grammarAsked { return .vocabulary }
            return .grammar
        }()

        func pick(in band: Int) -> AssessmentQuestion? {
            let atBand = pool.filter { $0.band == band }
            if let c = preferredCategory, let m = atBand.first(where: { $0.category == c }) { return m }
            return atBand.first
        }
        // Search outward from the target band.
        for delta in 0...maxBand {
            if let m = pick(in: band + delta) { return m }
            if delta > 0, let m = pick(in: band - delta) { return m }
        }
        return pool.first
    }

    mutating func record(_ q: AssessmentQuestion, correct: Bool) {
        asked.append(q)
        if correct {
            correctCount += 1
            band = min(maxBand, band + 1)       // staircase up
            if q.band > minBand { lowestBandMisses = 0 }
        } else {
            missed.append(q)
            band = max(minBand, band - 1)       // staircase down
            if q.band <= minBand { lowestBandMisses += 1 } else { lowestBandMisses = 0 }
        }
    }

    /// Route straight to full Foundation.
    mutating func declareBeginner() { declaredBeginner = true }

    /// Stable once the staircase is bouncing within one band of itself — i.e. the
    /// last few answers alternate correct/incorrect near the same band.
    private func hasStabilized() -> Bool {
        guard asked.count >= 4 else { return false }
        let recent = asked.suffix(4)
        let bands = recent.map { $0.band }
        guard let lo = bands.min(), let hi = bands.max() else { return false }
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

        return PlacementResult(
            vocabBand: vocab,
            grammarBand: grammar,
            estimatedLevel: level,
            isTrueBeginner: beginner,
            masteredConceptIds: AssessmentService.masteredConcepts(vocabBand: vocab, grammarBand: grammar),
            missedGaps: AssessmentService.gaps(forMissed: missed),
            askedCount: asked.count,
            correctCount: correctCount
        )
    }

    /// Highest band b such that every tested band ≤ b was answered ≥50% correctly.
    private func clearedBand(for category: GapCategory) -> Int {
        var cleared = 0
        for b in minBand...maxBand {
            let pool = asked.filter { $0.category == category && $0.band == b }
            guard !pool.isEmpty else { continue }                 // untested band — skip, keep going
            let hit = pool.filter { !missed.contains($0) }.count
            if Double(hit) / Double(pool.count) >= 0.5 { cleared = b } else { break }
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

    /// Base concepts the learner demonstrably knows, from the cleared bands. We only
    /// seed grammar + vocabulary (a text test can't fairly judge pronunciation,
    /// phrasing or register), leaving those never-observed for Foundation.
    static func masteredConcepts(vocabBand: Int, grammarBand: Int) -> [String] {
        ConceptTaxonomy.seed().compactMap { concept in
            guard ConceptTaxonomy.baseConceptIds.contains(concept.id) else { return nil }
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

    private static func bandForLevel(_ level: CEFRLevel) -> Int {
        switch level {
        case .A1: return 1
        case .A2: return 2
        case .B1: return 3
        default: return 4
        }
    }

    /// Build gap items from the questions the learner missed.
    static func gaps(forMissed missed: [AssessmentQuestion]) -> [GapItem] {
        let now = Date()
        return missed.map { q in
            GapItem(
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
