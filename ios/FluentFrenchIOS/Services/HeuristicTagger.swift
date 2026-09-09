//
//  HeuristicTagger.swift
//  FluentFrenchIOS
//
//  The on-device concept tagger (E1): scores every existing concept against a
//  captured gap from four signals — a content-lexicon hit (the headword is one
//  of the concept's own items), curated keyword triggers, the gloss's part of
//  speech, and category/level fit — and returns the best match ONLY when its
//  confidence clears `Tuning.tagConfidenceFloor`. Below the floor the gap stays
//  untagged (conceptId nil, `tagConfidence` recorded): an untagged gap is still
//  practicable, a wrongly tagged one lands on the wrong skill. It never falls
//  back to "the easiest concept in the category".
//
//  Pure and nonisolated so the harness runs it; the networking matcher lives in
//  `ConceptTagger` and uses this as its offline path.
//

import Foundation

/// The outcome of tagging one gap.
nonisolated enum ConceptTagResult: Equatable {
    /// An existing concept fits, at this confidence (0…1).
    case existing(id: String, confidence: Double)
    /// Nothing fits and the matcher proposes a new concept (AI path only).
    case new(Concept)
    /// The best candidate scored below the floor: leave `conceptId` nil.
    case untagged(confidence: Double)
}

nonisolated enum HeuristicTagger {
    // MARK: Result of scoring one concept

    struct Candidate: Equatable {
        let conceptId: String
        let confidence: Double
    }

    // MARK: Entry point

    /// Tag a gap against the learner's concepts. `lexicon` maps a normalised French
    /// headword to the concept whose content items contain it (see `lexicon(from:)`).
    static func tag(gap: GapItem, concepts: [Concept], lexicon: [String: String] = [:]) -> ConceptTagResult {
        let ranked = rank(gap: gap, concepts: concepts, lexicon: lexicon)
        guard let best = ranked.first else { return .untagged(confidence: 0) }
        if best.confidence >= Tuning.tagConfidenceFloor {
            return .existing(id: best.conceptId, confidence: best.confidence)
        }
        return .untagged(confidence: best.confidence)
    }

    /// Every concept with a non-zero score, best first (ties: lower level first,
    /// then taxonomy order). Exposed for tests and diagnostics.
    static func rank(gap: GapItem, concepts: [Concept], lexicon: [String: String] = [:]) -> [Candidate] {
        let signals = Signals(gap: gap)
        let lexiconHit = lexiconConcept(for: gap, lexicon: lexicon)
        var scored: [(Candidate, Int)] = []
        for (index, concept) in concepts.enumerated() {
            let score = score(concept, signals: signals, lexiconHit: lexiconHit)
            if score > 0 {
                scored.append((Candidate(conceptId: concept.id, confidence: min(1, score)), index))
            }
        }
        scored.sort { a, b in
            if a.0.confidence != b.0.confidence { return a.0.confidence > b.0.confidence }
            let la = level(of: a.0.conceptId, in: concepts), lb = level(of: b.0.conceptId, in: concepts)
            if la != lb { return la < lb }
            return a.1 < b.1
        }
        return scored.map { $0.0 }
    }

    // MARK: Scoring

    private static func score(_ concept: Concept, signals: Signals, lexiconHit: String?) -> Double {
        var primary: Double = 0
        if lexiconHit == concept.id { primary = max(primary, Tuning.tagLexiconWeight) }

        let hits = keywordHits(concept, signals: signals)
        if hits > 0 {
            primary = max(primary, min(0.95, Tuning.tagKeywordWeight + 0.1 * Double(hits - 1)))
        }
        if posConcepts(for: signals).contains(concept.id) {
            primary = max(primary, Tuning.tagPartOfSpeechWeight)
        }
        guard primary > 0 else { return 0 }

        var score = primary
        if signals.category == concept.category { score += Tuning.tagCategoryWeight }
        if let gapLevel = signals.level {
            let delta = abs(CaptureBuilder.rank(gapLevel) - CaptureBuilder.rank(concept.cefrLevel))
            if delta <= 1 { score += Tuning.tagLevelWeight } else { score -= Tuning.tagLevelWeight * Double(delta - 1) }
        }
        return max(0, score)
    }

    /// Curated triggers plus the concept's own name tokens, matched against the
    /// headword / base form / meaning only (never the explanation — see `Signals`).
    /// Phrase keys match as a substring of the haystack; single-word keys must equal
    /// a whole token, so "un" never matches inside "lundi", and are ignored entirely
    /// for a multi-word capture. Theme-vocabulary triggers are ignored for multi-word
    /// captures too (an idiom about bread is not food vocabulary).
    ///
    /// A curated key is matched against the SIDE it belongs to: a French key against
    /// the headword and its base form, an English key against the gloss (read-7-1).
    /// One mixed bag filed the adjective "principal" ("main") on The body and "le
    /// ressort" ("spring") on Days, months & seasons at full confidence.
    private static func keywordHits(_ concept: Concept, signals: Signals) -> Int {
        let themeVocabulary = concept.category == .vocabulary && concept.id != "savoir-vs-connaitre"
        if signals.isPhrase && themeVocabulary { return 0 }
        // Taxonomy concepts are matched on their curated triggers ONLY. A shipped
        // skill with no triggers scores 0 and the gap stays untagged: matching the
        // tokens of a skill's English NAME would file "un ami" on false-friends and
        // "le train" on être-en-train-de (read-6-1). A learner- or AI-created
        // concept has no curated row, so it is matched on the significant words of
        // its own name — that name is the only description of it there is, and it
        // may describe either side, so those keys match both.
        let curated = resolvedTriggers[concept.id]
        let keys: [TriggerKey]
        if let curated {
            keys = curated
        } else if taxonomyIds.contains(concept.id) {
            keys = []
        } else {
            keys = nameTokens(concept.name).map { TriggerKey(text: $0, side: .either) }
        }
        var hits = 0
        var frenchHits = 0
        for key in keys where matches(key, signals: signals) {
            hits += 1
            if key.side != .english { frenchHits += 1 }
        }
        if concept.id == "formal-register", signals.registerMarked { hits += 1 }
        // A theme-vocabulary skill is a list of FRENCH words; an English gloss that
        // happens to contain one of its meanings is not membership of the theme. The
        // English keys can reinforce a French hit, never win on their own.
        if themeVocabulary, curated != nil, frenchHits == 0 { return 0 }
        return hits
    }

    /// Whether one trigger key fires for this capture, on its own side only.
    private static func matches(_ key: TriggerKey, signals: Signals) -> Bool {
        let k = key.text
        if k.contains(" ") || k.contains("'") {
            // Phrase keys match whole words inside the padded haystack; a key that
            // ends in an elision ("de l'") only needs its start to match.
            let needle = k.hasSuffix("'") ? " " + k : " " + k + " "
            return signals.haystacks(for: key.side).contains { $0.contains(needle) }
        }
        if functionWords.contains(k) {
            // Articles, pronouns, possessives: only when the capture IS that word.
            // Every function-word key is French, so this reads the headword.
            return signals.word == k
        }
        if signals.isPhrase {
            // A single word buried inside a captured phrase is not what the phrase
            // is about ("avoir" in "avoir le bras long" is not the irregular-verb
            // skill), so only phrase keys speak for a phrase.
            return false
        }
        return signals.tokenSets(for: key.side).contains { $0.contains(k) }
    }

    /// Concepts a part of speech points at on its own.
    private static func posConcepts(for signals: Signals) -> Set<String> {
        let pos = signals.partOfSpeech
        let word = signals.word
        if pos.hasPrefix("verb") || pos == "v" {
            if word.hasPrefix("se ") || word.hasPrefix("s'") { return ["reflexive-verbs"] }
            return ["common-verbs"]
        }
        if pos.hasPrefix("adj") { return ["common-adjectives"] }
        if pos.hasPrefix("pronoun") {
            return subjectPronouns.contains(word) ? ["subject-pronouns"] : ["object-pronouns"]
        }
        if pos.hasPrefix("prep") { return ["basic-prepositions"] }
        if pos.hasPrefix("conj") { return ["everyday-connectors"] }
        if pos.hasPrefix("article") || pos.hasPrefix("determiner") {
            if definiteArticles.contains(word) { return ["definite-articles"] }
            if indefiniteArticles.contains(word) { return ["indefinite-articles"] }
            if partitiveArticles.contains(word) { return ["partitive-articles"] }
            if possessives.contains(word) { return ["possessive-adjectives"] }
            return []
        }
        if pos.hasPrefix("interj") || pos.contains("filler") { return ["spoken-fillers"] }
        return []
    }

    // MARK: Lexicon (content items → concept)

    /// The concept whose content items contain the gap's headword (or base form).
    static func lexiconConcept(for gap: GapItem, lexicon: [String: String]) -> String? {
        guard !lexicon.isEmpty else { return nil }
        for candidate in [gap.frenchWord, gap.baseForm ?? ""] where !candidate.isEmpty {
            for key in lexiconKeys(for: candidate) {
                if let id = lexicon[key] { return id }
            }
        }
        return nil
    }

    /// Build the headword → concept map from the bundled content: every item's
    /// `fr` (and its article-stripped form) names the skill it belongs to. The first
    /// skill to claim a headword keeps it.
    static func lexicon(from file: FoundationContentFile?) -> [String: String] {
        guard let file else { return [:] }
        var map: [String: String] = [:]
        for skill in file.skills {
            for item in skill.items {
                for key in lexiconKeys(for: item.fr) where map[key] == nil {
                    map[key] = skill.id
                }
            }
        }
        return map
    }

    /// Normalised forms a headword is looked up under: as written, and with a
    /// leading article removed ("le pain" → "pain"). Parenthetical tags are dropped.
    static func lexiconKeys(for headword: String) -> [String] {
        var base = headword
        if let open = base.firstIndex(of: "(") { base = String(base[..<open]) }
        base = base.replacingOccurrences(of: "’", with: "'")
        let folded = SentenceExtractor.tokens(in: base).joined(separator: " ")
        guard !folded.isEmpty else { return [] }
        var keys = [folded]
        let parts = folded.split(separator: " ").map(String.init)
        if parts.count >= 2, leadingArticles.contains(parts[0]) {
            keys.append(parts.dropFirst().joined(separator: " "))
        }
        if parts.count >= 3, parts[0] == "de", leadingArticles.contains(parts[1]) {
            keys.append(parts.dropFirst(2).joined(separator: " "))
        }
        return keys
    }

    // MARK: Near-duplicate concept names (E3)

    /// An existing concept whose name means the same thing as `name` (token overlap
    /// at or above `Tuning.tagNearDuplicateSimilarity`, or one name contained in the
    /// other), so the store folds a proposed `.new` concept into it instead of
    /// creating "Past tense" next to "Passé composé".
    static func nearDuplicate(named name: String, id: String, among concepts: [Concept]) -> Concept? {
        let wanted = nameTokenSet(name)
        let wantedId = SentenceExtractor.fold(id)
        for concept in concepts {
            if SentenceExtractor.fold(concept.id) == wantedId { return concept }
            let have = nameTokenSet(concept.name)
            guard !wanted.isEmpty, !have.isEmpty else { continue }
            if wanted == have { return concept }
            // One name contained in the other counts unless the shorter one is a
            // lone generic word ("verbs" is not "Common verbs").
            let smaller = wanted.count <= have.count ? wanted : have
            let larger = wanted.count <= have.count ? have : wanted
            if smaller.isSubset(of: larger), smaller.count >= 2 || !smaller.contains(where: { genericNameTokens.contains($0) }) {
                return concept
            }
            let union = wanted.union(have).count
            let jaccard = Double(wanted.intersection(have).count) / Double(union)
            if jaccard >= Tuning.tagNearDuplicateSimilarity { return concept }
        }
        return nil
    }

    /// Significant tokens of a concept name, with common tense/register aliases
    /// collapsed so "compound past" and "passé composé" compare equal.
    static func nameTokenSet(_ name: String) -> Set<String> {
        var text = SentenceExtractor.fold(name)
        for (alias, canonical) in aliases {
            text = text.replacingOccurrences(of: alias, with: canonical)
        }
        var tokens: [String] = []
        for token in SentenceExtractor.tokens(in: text) {
            for piece in token.split(separator: "/") {
                var word = String(piece)
                if word.hasSuffix("s") && word.count > 4 { word = String(word.dropLast()) }
                if word.count >= 3 && !nameStopwords.contains(word) { tokens.append(word) }
            }
        }
        return Set(tokens)
    }

    private static func nameTokens(_ name: String) -> [String] {
        Array(nameTokenSet(name)).filter { $0.count >= 4 }
    }

    // MARK: Trigger keys

    /// Which side of a capture a trigger key may be matched against.
    private enum TriggerSide {
        /// A French key: the headword and its base form only.
        case french
        /// An English key: the gloss only.
        case english
        /// The same string in both languages ("station", "dessert"), or a
        /// learner/AI concept's own name, which may describe either side.
        case either
    }

    private struct TriggerKey {
        let text: String
        let side: TriggerSide
    }

    /// A curated trigger row, split by language. French keys speak for the French
    /// word, English keys for its meaning; a key listed on both sides matches
    /// either (read-7-1).
    private struct TriggerRow {
        let fr: [String]
        let en: [String]
        init(fr: [String] = [], en: [String] = []) { self.fr = fr; self.en = en }
    }

    // MARK: Signals extracted from the gap

    private struct Signals {
        let word: String
        let isPhrase: Bool
        let partOfSpeech: String
        let registerMarked: Bool
        let category: GapCategory
        let level: CEFRLevel?
        /// The headword + base form, folded and space-padded.
        let frenchHaystack: String
        /// The gloss, folded and space-padded.
        let englishHaystack: String
        let frenchTokens: Set<String>
        let englishTokens: Set<String>

        func haystacks(for side: TriggerSide) -> [String] {
            switch side {
            case .french: return [frenchHaystack]
            case .english: return [englishHaystack]
            case .either: return [frenchHaystack, englishHaystack]
            }
        }

        func tokenSets(for side: TriggerSide) -> [Set<String>] {
            switch side {
            case .french: return [frenchTokens]
            case .english: return [englishTokens]
            case .either: return [frenchTokens, englishTokens]
            }
        }

        init(gap: GapItem) {
            let rawWord = gap.frenchWord.replacingOccurrences(of: "’", with: "'")
            word = SentenceExtractor.fold(rawWord.trimmingCharacters(in: .whitespacesAndNewlines))
            // "le pain" is a noun with its article, not a phrase.
            let parts = word.split(separator: " ").map(String.init)
            let withoutArticle = (parts.count >= 2 && HeuristicTagger.leadingArticles.contains(parts[0]))
                ? parts.dropFirst().joined(separator: " ") : word
            isPhrase = CaptureBuilder.isPhrase(withoutArticle)
            partOfSpeech = SentenceExtractor.fold(gap.partOfSpeech ?? "").trimmingCharacters(in: .whitespaces)
            let reg = SentenceExtractor.fold(gap.register ?? "").trimmingCharacters(in: .whitespaces)
            registerMarked = !reg.isEmpty && reg != "neutral" && reg != "standard"
            category = gap.category
            level = gap.cefrLevel
            // The headword, its base form and its meaning ONLY, and kept apart so a
            // French key can never fire on the English gloss. The explanation is
            // deliberately excluded: it is free LLM prose (and carries the learner's
            // own note), so a gloss that happens to say "you need to know" or "a
            // common expression" would otherwise tag the card `savoir-vs-connaitre`
            // or `idioms` at full confidence.
            let french = [gap.frenchWord, gap.baseForm ?? ""]
                .filter { !$0.isEmpty }.joined(separator: " ")
                .replacingOccurrences(of: "’", with: "'")
            let english = gap.englishTranslation.replacingOccurrences(of: "’", with: "'")
            frenchHaystack = " " + SentenceExtractor.fold(french) + " "
            englishHaystack = " " + SentenceExtractor.fold(english) + " "
            frenchTokens = Set(SentenceExtractor.tokens(in: french))
            englishTokens = Set(SentenceExtractor.tokens(in: english))
        }
    }

    // MARK: Tables

    /// Ids of the shipped taxonomy, read once: `keywordHits` asks per concept.
    private static let taxonomyIds: Set<String> = ConceptTaxonomy.ids

    private static let subjectPronouns: Set<String> = ["je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles"]
    private static let definiteArticles: Set<String> = ["le", "la", "les", "l'"]
    private static let indefiniteArticles: Set<String> = ["un", "une", "des"]
    private static let partitiveArticles: Set<String> = ["du", "de la", "de l'"]
    private static let possessives: Set<String> = ["mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre", "leur", "nos", "vos", "leurs"]
    static let leadingArticles: Set<String> = ["le", "la", "les", "l", "un", "une", "des", "du"]
    /// Single-word keys that only count when they ARE the captured word.
    private static let functionWords: Set<String> = ["le", "la", "les", "un", "une", "des", "du", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre", "leur", "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "lui", "ne", "pas", "dans", "sur", "sous", "avec", "pour", "chez", "mais", "donc", "alors", "puis", "quoi", "bref", "enfin", "bah", "ben", "euh", "genre", "jamais", "rien", "personne", "quand", "comment", "pourquoi", "combien", "quel", "quelle"]
    /// Words too generic to make two concept names the same on their own.
    private static let genericNameTokens: Set<String> = ["verb", "noun", "adjective", "adverb", "pronoun", "article", "tense", "word", "vocabulary", "vocab", "grammar", "expression", "phrase", "sound", "sounds", "rule", "rules", "french", "english", "practice", "skill"]
    private static let nameStopwords: Set<String> = ["the", "and", "with", "for", "from", "into", "vs", "versus", "your", "common", "basic", "everyday", "core", "first", "some", "les", "des"]

    /// Alias phrases collapsed before name comparison (all pre-folded).
    private static let aliases: [(String, String)] = [
        ("compound past", "passe compose"),
        ("past tense", "passe compose"),
        ("perfect tense", "passe compose"),
        ("imperfect tense", "imparfait"),
        ("imperfect", "imparfait"),
        ("subjunctive", "subjonctif"),
        ("near future", "futur proche"),
        ("going to future", "futur proche"),
        ("colour", "color"),
        ("connaitre", "connaitre"),
    ]

    /// Curated trigger keys per taxonomy concept id, split by language. Phrase keys
    /// (with a space or a trailing apostrophe) match as substrings; single words
    /// match whole tokens. `fr` is matched against the headword and its base form,
    /// `en` against the gloss — never the other way round, or "principal" ("main")
    /// lands on The body and "le ressort" ("spring") on Days, months & seasons
    /// (read-7-1). A word that is the same in both languages is listed on both sides.
    private static let triggers: [String: TriggerRow] = [
        "definite-articles": TriggerRow(fr: ["le", "la", "les"], en: ["definite article"]),
        "indefinite-articles": TriggerRow(fr: ["un", "une", "des"], en: ["indefinite article"]),
        "partitive-articles": TriggerRow(fr: ["du", "de la", "de l'"], en: ["partitive"]),
        "noun-gender": TriggerRow(en: ["noun gender", "grammatical gender", "masculine or feminine"]),
        "subject-pronouns": TriggerRow(fr: ["je", "il", "elle", "nous", "ils", "elles"], en: ["subject pronoun"]),
        "present-er-verbs": TriggerRow(en: ["-er verb", "er verb", "regular verb", "present tense"]),
        "present-irregular": TriggerRow(fr: ["être", "avoir", "aller", "faire"], en: ["irregular verb"]),
        "basic-prepositions": TriggerRow(fr: ["dans", "sur", "sous", "avec", "pour", "chez"], en: ["preposition"]),
        "plurals": TriggerRow(fr: ["pluriel"], en: ["plural"]),
        "negation": TriggerRow(fr: ["ne pas", "ne… pas", "ne ... pas", "jamais", "rien", "personne"],
                               en: ["negation", "negative"]),
        "questions": TriggerRow(fr: ["est-ce que", "pourquoi", "comment", "quand", "combien", "quel", "quelle"],
                                en: ["question word"]),
        "possessive-adjectives": TriggerRow(fr: ["mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre"],
                                            en: ["possessive"]),
        "c-est-il-y-a": TriggerRow(fr: ["c'est", "il y a"], en: ["there is", "there are"]),
        "numbers-time": TriggerRow(fr: ["heure", "minute", "cent", "mille", "vingt", "trente", "quarante", "cinquante",
                                        "soixante", "quatre-vingt", "dix", "onze", "douze", "quinze", "midi", "minuit", "date"],
                                   en: ["number", "o'clock", "minute", "date"]),
        "family-vocab": TriggerRow(fr: ["mère", "père", "frère", "sœur", "fils", "fille", "parents", "grand-mère",
                                        "grand-père", "oncle", "tante", "cousin", "cousine", "mari", "épouse"],
                                   en: ["family", "mother", "father", "brother", "sister", "daughter", "uncle", "aunt",
                                        "grandmother", "grandfather", "husband", "wife", "relative", "parents", "cousin"]),
        "food-drink-vocab": TriggerRow(fr: ["pain", "fromage", "vin", "eau", "café", "repas", "déjeuner", "dîner",
                                            "petit-déjeuner", "légume", "fruit", "viande", "poisson", "boulangerie",
                                            "cuisine", "dessert"],
                                       en: ["food", "drink", "meal", "bread", "cheese", "wine", "coffee", "breakfast",
                                            "lunch", "dinner", "vegetable", "meat", "fish", "dessert", "recipe", "dish",
                                            "fruit", "cuisine"]),
        "home-vocab": TriggerRow(fr: ["maison", "appartement", "chambre", "salon", "meuble", "porte", "fenêtre",
                                      "chaise", "lit", "salle de bain"],
                                 en: ["home", "house", "kitchen", "bedroom", "room", "furniture", "door", "window", "bathroom"]),
        "colors-vocab": TriggerRow(fr: ["rouge", "bleu", "vert", "jaune", "noir", "blanc", "gris", "rose", "violet", "marron"],
                                   en: ["colour", "color", "red", "blue", "green", "yellow", "black", "white", "grey",
                                        "gray", "pink", "purple", "brown", "rose", "violet"]),
        "body-vocab": TriggerRow(fr: ["tête", "bras", "jambe", "main", "pied", "œil", "yeux", "bouche", "nez", "oreille",
                                      "dos", "cœur", "ventre", "genou", "doigt"],
                                 en: ["body", "head", "arm", "leg", "hand", "foot", "eye", "eyes", "mouth", "nose", "ear",
                                      "heart", "stomach", "knee", "finger"]),
        // "porter" is deliberately NOT a French key: on its own it is as much "to
        // carry" as "to wear", and the gloss is what tells the two apart.
        "clothing-vocab": TriggerRow(fr: ["vêtement", "chemise", "pantalon", "robe", "jupe", "chaussure", "manteau",
                                          "veste", "chapeau"],
                                     en: ["clothing", "clothes", "shirt", "trousers", "pants", "dress", "skirt", "shoe",
                                          "shoes", "coat", "jacket", "hat", "wear"]),
        "weather-vocab": TriggerRow(fr: ["météo", "pluie", "neige", "soleil", "vent", "nuage", "il fait", "froid",
                                         "chaud", "température", "orage", "brouillard"],
                                    en: ["weather", "rain", "snow", "sunny", "wind", "cloud", "cloudy", "cold",
                                         "temperature", "storm", "fog"]),
        "places-town-vocab": TriggerRow(fr: ["ville", "gare", "banque", "magasin", "marché", "école", "hôpital",
                                             "pharmacie", "église", "mairie", "musée", "bibliothèque", "parc", "rue", "station"],
                                        en: ["town", "city", "station", "bank", "shop", "store", "market", "school",
                                             "hospital", "pharmacy", "church", "museum", "library", "street"]),
        "directions-vocab": TriggerRow(fr: ["gauche", "droite", "tout droit", "tourner", "près", "loin", "en face", "à côté"],
                                       en: ["direction", "directions", "left", "right", "straight ahead", "turn",
                                            "next to", "opposite"]),
        "jobs-vocab": TriggerRow(fr: ["métier", "médecin", "professeur", "infirmier", "infirmière", "avocat",
                                      "ingénieur", "boulanger", "serveur", "profession", "occupation"],
                                 en: ["job", "profession", "occupation", "doctor", "teacher", "nurse", "lawyer",
                                      "engineer", "baker", "waiter", "waitress"]),
        "days-months-seasons": TriggerRow(fr: ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
                                               "janvier", "février", "avril", "juin", "juillet", "août", "septembre",
                                               "octobre", "novembre", "décembre", "printemps", "automne", "hiver"],
                                          en: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
                                               "sunday", "january", "february", "april", "june", "july", "august",
                                               "september", "october", "november", "december", "spring", "summer",
                                               "autumn", "winter", "season", "month"]),
        "common-adjectives": TriggerRow(),
        "common-verbs": TriggerRow(),
        "guttural-r": TriggerRow(en: ["guttural", "throat", "uvular", "french r"]),
        "nasal-vowels": TriggerRow(en: ["nasal"]),
        "greetings-politeness": TriggerRow(fr: ["bonjour", "bonsoir", "salut", "merci", "s'il vous plaît",
                                                "s'il te plaît", "au revoir", "pardon", "excusez-moi", "enchanté"],
                                           en: ["greeting", "polite", "politeness", "please", "thank you", "goodbye", "hello"]),
        "tu-vs-vous": TriggerRow(fr: ["vous", "tu"], en: ["tu vs", "formal you", "informal you", "polite form"]),
        "adjective-agreement": TriggerRow(en: ["agreement", "agree with the noun", "agrees", "feminine form", "plural form"]),
        "adjective-placement": TriggerRow(en: ["before the noun", "after the noun", "placement"]),
        "near-future": TriggerRow(fr: ["aller +", "futur proche"], en: ["near future", "going to"]),
        "reflexive-verbs": TriggerRow(fr: ["se lever", "se laver", "se coucher", "se réveiller", "s'appeler",
                                           "s'asseoir", "s'habiller", "s'amuser", "s'arrêter", "s'occuper",
                                           "s'endormir", "s'ennuyer", "s'inquiéter", "s'intéresser"],
                                      en: ["reflexive", "pronominal"]),
        "passe-compose-avoir": TriggerRow(fr: ["passé composé", "passe compose", "j'ai", "a été"],
                                          en: ["compound past", "past participle"]),
        "passe-compose-etre": TriggerRow(fr: ["je suis allé", "est allé", "sont allés", "suis parti"],
                                         en: ["être vs avoir", "with être", "auxiliary être"]),
        "prepositions-place-time": TriggerRow(fr: ["pendant", "depuis", "avant", "après"],
                                              en: ["during", "since", "preposition of place", "preposition of time"]),
        "liaison": TriggerRow(fr: ["liaison"], en: ["liaison", "linking"]),
        "everyday-connectors": TriggerRow(fr: ["mais", "donc", "parce que", "alors", "puis", "ensuite"],
                                          en: ["connector", "conjunction", "however", "therefore", "because"]),
        "imparfait": TriggerRow(fr: ["imparfait"], en: ["imperfect", "used to", "was -ing", "were -ing"]),
        "imparfait-vs-pc": TriggerRow(fr: ["imparfait vs", "vs passé composé"], en: ["description vs event"]),
        "object-pronouns": TriggerRow(fr: ["lui", "leur"], en: ["object pronoun", "direct object", "indirect object"]),
        "subjunctive-intro": TriggerRow(fr: ["subjonctif", "il faut que", "que je", "qu'il"], en: ["subjunctive"]),
        "savoir-vs-connaitre": TriggerRow(fr: ["savoir", "connaître", "connaitre"], en: ["to know", "know how to"]),
        "spoken-fillers": TriggerRow(fr: ["du coup", "quoi", "bref", "enfin", "bah", "ben", "euh", "genre", "voilà"],
                                     en: ["filler", "discourse marker"]),
        "idioms": TriggerRow(en: ["idiom", "idiomatic", "figurative", "proverb", "fixed expression",
                                  "idiomatic expression", "set expression", "figure of speech"]),
        "formal-register": TriggerRow(fr: ["soutenu", "familier", "argot"],
                                      en: ["formal", "informal", "register", "slang", "colloquial"]),
    ]

    /// The trigger table folded once and deduplicated: a key on both sides becomes
    /// `.either`, so it still counts as a single hit.
    private static let resolvedTriggers: [String: [TriggerKey]] = {
        var out: [String: [TriggerKey]] = [:]
        for (id, row) in triggers {
            var order: [String] = []
            var sides: [String: TriggerSide] = [:]
            func add(_ raw: String, _ side: TriggerSide) {
                let k = SentenceExtractor.fold(raw).trimmingCharacters(in: .whitespaces)
                guard !k.isEmpty else { return }
                if let existing = sides[k] {
                    if existing != side { sides[k] = .either }
                } else {
                    sides[k] = side
                    order.append(k)
                }
            }
            for key in row.fr { add(key, .french) }
            for key in row.en { add(key, .english) }
            out[id] = order.map { TriggerKey(text: $0, side: sides[$0] ?? .either) }
        }
        return out
    }()

    private static func level(of conceptId: String, in concepts: [Concept]) -> Int {
        guard let c = concepts.first(where: { $0.id == conceptId }) else { return 0 }
        return CaptureBuilder.rank(c.cefrLevel)
    }
}
