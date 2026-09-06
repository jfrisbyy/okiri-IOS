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
    private static func keywordHits(_ concept: Concept, signals: Signals) -> Int {
        let themeVocabulary = concept.category == .vocabulary && concept.id != "savoir-vs-connaitre"
        if signals.isPhrase && themeVocabulary { return 0 }
        // Taxonomy concepts have curated triggers; a learner- or AI-created concept
        // is matched on the significant words of its own name.
        let keys = triggers[concept.id] ?? nameTokens(concept.name)
        var hits = 0
        var seen = Set<String>()
        for key in keys {
            let k = SentenceExtractor.fold(key).trimmingCharacters(in: .whitespaces)
            guard !k.isEmpty, seen.insert(k).inserted else { continue }
            if k.contains(" ") || k.contains("'") {
                // Phrase keys match whole words inside the padded haystack; a key that
                // ends in an elision ("de l'") only needs its start to match.
                let needle = k.hasSuffix("'") ? " " + k : " " + k + " "
                if signals.haystack.contains(needle) { hits += 1 }
            } else if functionWords.contains(k) {
                // Articles, pronouns, possessives: only when the capture IS that word.
                if signals.word == k { hits += 1 }
            } else if signals.isPhrase {
                // A single word buried inside a captured phrase is not what the
                // phrase is about ("avoir" in "avoir le bras long" is not the
                // irregular-verb skill), so only phrase keys speak for a phrase.
                continue
            } else if signals.tokens.contains(k) {
                hits += 1
            }
        }
        if concept.id == "formal-register", signals.registerMarked { hits += 1 }
        return hits
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

    // MARK: Signals extracted from the gap

    private struct Signals {
        let word: String
        let isPhrase: Bool
        let partOfSpeech: String
        let registerMarked: Bool
        let category: GapCategory
        let level: CEFRLevel?
        let haystack: String
        let tokens: Set<String>

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
            // The headword, its base form and its meaning ONLY. The explanation is
            // deliberately excluded: it is free LLM prose (and carries the learner's
            // own note), so a gloss that happens to say "you need to know" or "a
            // common expression" would otherwise tag the card `savoir-vs-connaitre`
            // or `idioms` at full confidence.
            let fields = [gap.frenchWord, gap.baseForm ?? "", gap.englishTranslation]
            let joined = fields.filter { !$0.isEmpty }.joined(separator: " ").replacingOccurrences(of: "’", with: "'")
            haystack = " " + SentenceExtractor.fold(joined) + " "
            tokens = Set(SentenceExtractor.tokens(in: joined))
        }
    }

    // MARK: Tables

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

    /// Curated trigger keys per taxonomy concept id. Phrase keys (with a space or a
    /// trailing apostrophe) match as substrings; single words match whole tokens.
    private static let triggers: [String: [String]] = [
        "definite-articles": ["le", "la", "les", "definite article"],
        "indefinite-articles": ["un", "une", "des", "indefinite article"],
        "partitive-articles": ["du", "de la", "de l'", "partitive"],
        "noun-gender": ["noun gender", "grammatical gender", "masculine or feminine"],
        "subject-pronouns": ["je", "il", "elle", "nous", "ils", "elles", "subject pronoun"],
        "present-er-verbs": ["-er verb", "er verb", "regular verb", "present tense"],
        "present-irregular": ["être", "avoir", "aller", "faire", "irregular verb"],
        "basic-prepositions": ["dans", "sur", "sous", "avec", "pour", "chez", "preposition"],
        "plurals": ["plural", "pluriel"],
        "negation": ["ne pas", "ne… pas", "ne ... pas", "jamais", "rien", "personne", "negation", "negative"],
        "questions": ["est-ce que", "question word", "pourquoi", "comment", "quand", "combien", "quel", "quelle"],
        "possessive-adjectives": ["mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre", "possessive"],
        "c-est-il-y-a": ["c'est", "il y a", "there is", "there are"],
        "numbers-time": ["number", "o'clock", "heure", "minute", "cent", "mille", "vingt", "trente", "quarante", "cinquante", "soixante", "quatre-vingt", "dix", "onze", "douze", "quinze", "midi", "minuit", "date"],
        "family-vocab": ["family", "mère", "père", "frère", "sœur", "fils", "fille", "parents", "grand-mère", "grand-père", "oncle", "tante", "cousin", "cousine", "mari", "épouse", "mother", "father", "brother", "sister", "daughter", "uncle", "aunt", "grandmother", "grandfather", "husband", "wife", "relative"],
        "food-drink-vocab": ["food", "drink", "meal", "pain", "fromage", "vin", "eau", "café", "repas", "déjeuner", "dîner", "petit-déjeuner", "légume", "fruit", "viande", "poisson", "bread", "cheese", "wine", "coffee", "breakfast", "lunch", "dinner", "vegetable", "meat", "fish", "dessert", "boulangerie", "cuisine", "recipe", "dish"],
        "home-vocab": ["home", "house", "maison", "appartement", "chambre", "salon", "kitchen", "bedroom", "room", "furniture", "meuble", "porte", "fenêtre", "door", "window", "chaise", "lit", "bathroom", "salle de bain"],
        "colors-vocab": ["colour", "color", "rouge", "bleu", "vert", "jaune", "noir", "blanc", "gris", "rose", "violet", "marron", "red", "blue", "green", "yellow", "black", "white", "grey", "gray", "pink", "purple", "brown"],
        "body-vocab": ["body", "tête", "bras", "jambe", "main", "pied", "œil", "yeux", "bouche", "nez", "oreille", "dos", "cœur", "ventre", "head", "arm", "leg", "hand", "foot", "eye", "eyes", "mouth", "nose", "ear", "heart", "stomach", "knee", "genou", "doigt", "finger"],
        "clothing-vocab": ["clothing", "clothes", "vêtement", "chemise", "pantalon", "robe", "jupe", "chaussure", "manteau", "veste", "chapeau", "shirt", "trousers", "pants", "dress", "skirt", "shoe", "shoes", "coat", "jacket", "hat", "wear", "porter"],
        "weather-vocab": ["weather", "météo", "pluie", "neige", "soleil", "vent", "nuage", "il fait", "rain", "snow", "sunny", "wind", "cloud", "cloudy", "froid", "chaud", "cold", "température", "temperature", "orage", "storm", "brouillard", "fog"],
        "places-town-vocab": ["town", "city", "ville", "gare", "banque", "magasin", "marché", "école", "hôpital", "pharmacie", "église", "mairie", "station", "bank", "shop", "store", "market", "school", "hospital", "pharmacy", "church", "museum", "musée", "library", "bibliothèque", "parc", "rue", "street"],
        "directions-vocab": ["direction", "directions", "gauche", "droite", "tout droit", "left", "right", "straight ahead", "turn", "tourner", "près", "loin", "en face", "à côté", "next to", "opposite"],
        "jobs-vocab": ["job", "profession", "occupation", "métier", "médecin", "professeur", "infirmier", "infirmière", "avocat", "ingénieur", "boulanger", "serveur", "doctor", "teacher", "nurse", "lawyer", "engineer", "baker", "waiter", "waitress"],
        "days-months-seasons": ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "janvier", "février", "avril", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre", "printemps", "automne", "hiver", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "april", "june", "july", "august", "september", "october", "november", "december", "spring", "summer", "autumn", "winter", "season", "month"],
        "common-adjectives": [],
        "common-verbs": [],
        "guttural-r": ["guttural", "throat", "uvular", "french r"],
        "nasal-vowels": ["nasal"],
        "greetings-politeness": ["bonjour", "bonsoir", "salut", "merci", "s'il vous plaît", "s'il te plaît", "au revoir", "pardon", "excusez-moi", "enchanté", "greeting", "polite", "politeness", "please", "thank you", "goodbye", "hello"],
        "tu-vs-vous": ["vous", "tu", "tu vs", "formal you", "informal you", "polite form"],
        "adjective-agreement": ["agreement", "agree with the noun", "agrees", "feminine form", "plural form"],
        "adjective-placement": ["before the noun", "after the noun", "placement"],
        "near-future": ["aller +", "near future", "going to", "futur proche"],
        "reflexive-verbs": ["reflexive", "pronominal", "se lever", "se laver", "se coucher", "se réveiller", "s'appeler", "s'asseoir", "s'habiller", "s'amuser", "s'arrêter", "s'occuper", "s'endormir", "s'ennuyer", "s'inquiéter", "s'intéresser"],
        "passe-compose-avoir": ["passé composé", "passe compose", "compound past", "past participle", "j'ai", "a été"],
        "passe-compose-etre": ["être vs avoir", "with être", "auxiliary être", "je suis allé", "est allé", "sont allés", "suis parti"],
        "prepositions-place-time": ["pendant", "depuis", "avant", "après", "during", "since", "preposition of place", "preposition of time"],
        "liaison": ["liaison", "linking"],
        "everyday-connectors": ["mais", "donc", "parce que", "alors", "puis", "ensuite", "connector", "conjunction", "however", "therefore", "because"],
        "imparfait": ["imparfait", "imperfect", "used to", "was -ing", "were -ing"],
        "imparfait-vs-pc": ["imparfait vs", "vs passé composé", "description vs event"],
        "object-pronouns": ["object pronoun", "direct object", "indirect object", "lui", "leur"],
        "subjunctive-intro": ["subjunctive", "subjonctif", "il faut que", "que je", "qu'il"],
        "savoir-vs-connaitre": ["savoir", "connaître", "connaitre", "to know", "know how to"],
        "spoken-fillers": ["du coup", "quoi", "bref", "enfin", "bah", "ben", "euh", "filler", "discourse marker", "genre", "voilà"],
        "idioms": ["idiom", "idiomatic", "figurative", "proverb", "fixed expression", "idiomatic expression", "set expression", "figure of speech"],
        "formal-register": ["formal", "informal", "register", "soutenu", "familier", "slang", "argot", "colloquial"],
    ]

    private static func level(of conceptId: String, in concepts: [Concept]) -> Int {
        guard let c = concepts.first(where: { $0.id == conceptId }) else { return 0 }
        return CaptureBuilder.rank(c.cefrLevel)
    }
}
