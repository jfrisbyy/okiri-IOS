//
//  TranslationService.swift
//  FluentFrenchIOS
//
//  Live French→English word/phrase lookups and sentence translation via
//  OpenRouter (public client key from Config). Every call answers with a typed
//  result: a real gloss/translation, or an explicit `TranslationFailure`
//  (no key, offline, service error) the surface renders honestly. There is no
//  placeholder text any more — a failed lookup never looks like a meaning.
//
//  The cache (device → shared cloud) is consulted first, so a word someone else
//  already looked up resolves even with no key, and every request is bounded by
//  `Tuning.glossTimeoutSeconds` / `Tuning.translateTimeoutSeconds`.
//

import Foundation

nonisolated enum TranslationService {
    private static var apiKey: String { Config.EXPO_PUBLIC_OPENROUTER_API_KEY }
    static var hasKey: Bool { !apiKey.isEmpty }

    private static let endpoint = "https://openrouter.ai/api/v1/chat/completions"
    private static let glossDirection = "fr-en"

    // MARK: - Word / phrase lookup

    /// Look up a French word or phrase. `context` is the sentence it was met in
    /// (see `SentenceExtractor`), which sharpens the gloss for ambiguous words and
    /// keys the cache.
    static func lookup(term: String, context: String = "") async -> GlossLookup {
        let clean = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return .unavailable(.serviceError) }

        if let payload = await TranslationCache.cached(kind: "gloss", term: clean, context: context, direction: glossDirection),
           let cached = glossFromPayload(payload, term: clean) {
            return .gloss(cached)
        }

        guard hasKey else { return .unavailable(.notConfigured) }
        guard let url = URL(string: endpoint) else { return .unavailable(.serviceError) }

        let system = """
        You are a precise French dictionary for English speakers. Given a French word or phrase (and optional surrounding sentence), reply ONLY with minified JSON using exactly these keys:
        {"translation":"…","explanation":"…","example":"…","exampleTranslation":"…","partOfSpeech":"…","gender":"…","article":"…","baseForm":"…","baseFormNote":"…","pronunciation":"…","register":"…","otherMeanings":["…"],"relatedWords":["…"],"similarPhrases":["…"]}
        Rules:
        - translation: natural English meaning in context.
        - explanation: one short plain-English sentence about usage/grammar.
        - example: a NEW simple French sentence using the term. exampleTranslation: its English translation.
        - partOfSpeech: e.g. noun, verb, adjective, adverb, phrase. Empty for multi-word phrases if unclear.
        - gender: "masculine" or "feminine" for nouns, else "".
        - article: definite/indefinite articles for nouns like "le / un", else "".
        - baseForm: dictionary form if the term is conjugated/plural (infinitive or singular), else "". baseFormNote: short note like "from aller", else "".
        - pronunciation: a SIMPLE sound-it-out spelling using plain English-readable syllables separated by hyphens, with the STRESSED syllable in CAPITAL letters. Example: "renouvelables" -> "re-nou-VELLE-ah-bel". Never use IPA or technical phonetic symbols. "" if unclear.
        - register: "formal", "casual", "slang", "neutral", or "".
        - otherMeanings: up to 3 other common English senses (omit the one already in translation); [] if none.
        - relatedWords: ONLY for a SINGLE word — up to 4 French synonyms or closely related words. ALWAYS [] for multi-word phrases.
        - similarPhrases: ONLY for a MULTI-WORD phrase — up to 4 French phrases with a similar meaning. ALWAYS [] for single words.
        Use "" or [] when a field does not apply. No markdown, no extra keys.
        """
        let user = context.isEmpty ? "Term: \(clean)" : "Term: \(clean)\nSentence: \(context)"

        let request = makeRequest(url: url, system: system, user: user, temperature: 0.3,
                                  timeout: Tuning.glossTimeoutSeconds)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                return .unavailable(.serviceError)
            }
            let decoded = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            guard let content = decoded.choices.first?.message.content,
                  let parsed = parseGloss(content, term: clean) else {
                return .unavailable(.serviceError)
            }
            TranslationCache.store(kind: "gloss", term: clean, context: context, direction: glossDirection,
                                   payload: payloadFromGloss(parsed))
            return .gloss(parsed)
        } catch {
            return .unavailable(NetworkErrors.failure(for: error))
        }
    }

    /// Legacy entry point kept for callers that still expect a `WordGloss`. A
    /// failed lookup comes back as `WordGloss.unavailable(for:failure:)` — no
    /// meaning (`isUsable == false`), the failure message as the explanation — so
    /// it can never be persisted as a translation. Prefer `lookup(term:context:)`.
    static func gloss(for term: String, context: String = "") async -> WordGloss {
        switch await lookup(term: term, context: context) {
        case .gloss(let g): return g
        case .unavailable(let f): return .unavailable(for: term.trimmingCharacters(in: .whitespacesAndNewlines), failure: f)
        }
    }

    // MARK: - Sentence translation

    /// Translate a full sentence between English and French.
    static func translation(of text: String, from source: TranslationLanguage,
                            to target: TranslationLanguage) async -> TranslationOutcome {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return .unavailable(.serviceError) }

        let direction = "\(source.rawValue)-\(target.rawValue)"
        if let payload = await TranslationCache.cached(kind: "translate", term: clean, context: "", direction: direction),
           let cached = payload["translation"], !cached.isEmpty {
            return .translated(cached)
        }

        guard hasKey else { return .unavailable(.notConfigured) }
        guard let url = URL(string: endpoint) else { return .unavailable(.serviceError) }

        let system = "You are a professional \(source.englishName)→\(target.englishName) translator. Translate the user's text naturally and idiomatically into \(target.englishName). Reply with ONLY the translation — no quotes, no notes, no extra text."
        let request = makeRequest(url: url, system: system, user: clean, temperature: 0.3,
                                  timeout: Tuning.translateTimeoutSeconds)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                return .unavailable(.serviceError)
            }
            let decoded = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            guard let content = decoded.choices.first?.message.content else {
                return .unavailable(.serviceError)
            }
            let result = content.trimmingCharacters(in: CharacterSet(charactersIn: " \n\"'"))
            guard !result.isEmpty else { return .unavailable(.serviceError) }
            TranslationCache.store(kind: "translate", term: clean, context: "", direction: direction,
                                   payload: ["translation": result])
            return .translated(result)
        } catch {
            return .unavailable(NetworkErrors.failure(for: error))
        }
    }

    /// Legacy entry point: the translated text, or the learner-facing failure
    /// message. Callers that need to tell the two apart use `translation(of:from:to:)`.
    static func translate(_ text: String, from source: TranslationLanguage, to target: TranslationLanguage) async -> String {
        switch await translation(of: text, from: source, to: target) {
        case .translated(let t): return t
        case .unavailable(let f): return f.message
        }
    }

    // MARK: - Request / payload helpers

    private static func makeRequest(url: URL, system: String, user: String, temperature: Double,
                                    timeout: TimeInterval) -> URLRequest {
        let payload: [String: Any] = [
            "model": "openai/gpt-4o-mini",
            "messages": [
                ["role": "system", "content": system],
                ["role": "user", "content": user],
            ],
            "temperature": temperature,
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        return request
    }

    /// Lists are stored in the [String:String] cache as newline-joined strings.
    private static let listSeparator = "\n"

    private static func payloadFromGloss(_ gloss: WordGloss) -> [String: String] {
        [
            "translation": gloss.translation,
            "explanation": gloss.explanation,
            "example": gloss.example,
            "exampleTranslation": gloss.exampleTranslation,
            "partOfSpeech": gloss.partOfSpeech,
            "gender": gloss.gender,
            "article": gloss.article,
            "baseForm": gloss.baseForm,
            "baseFormNote": gloss.baseFormNote,
            "pronunciation": gloss.pronunciation,
            "register": gloss.register,
            "otherMeanings": gloss.otherMeanings.joined(separator: listSeparator),
            "relatedWords": gloss.relatedWords.joined(separator: listSeparator),
            "similarPhrases": gloss.similarPhrases.joined(separator: listSeparator),
        ]
    }

    private static func glossFromPayload(_ payload: [String: String], term: String) -> WordGloss? {
        let translation = (payload["translation"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !translation.isEmpty else { return nil }
        func list(_ key: String) -> [String] {
            (payload[key] ?? "").components(separatedBy: listSeparator)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        }
        return WordGloss(
            term: term,
            translation: translation,
            explanation: payload["explanation"] ?? "",
            example: payload["example"] ?? "",
            exampleTranslation: payload["exampleTranslation"] ?? "",
            partOfSpeech: payload["partOfSpeech"] ?? "",
            gender: payload["gender"] ?? "",
            article: payload["article"] ?? "",
            baseForm: payload["baseForm"] ?? "",
            baseFormNote: payload["baseFormNote"] ?? "",
            pronunciation: payload["pronunciation"] ?? "",
            register: payload["register"] ?? "",
            otherMeanings: list("otherMeanings"),
            relatedWords: list("relatedWords"),
            similarPhrases: list("similarPhrases")
        )
    }

    private static func parseGloss(_ raw: String, term: String) -> WordGloss? {
        // The model occasionally wraps JSON in prose or fences — extract the object.
        guard let start = raw.firstIndex(of: "{"),
              let end = raw.lastIndex(of: "}") else { return nil }
        let json = String(raw[start...end])
        guard let data = json.data(using: .utf8),
              let obj = try? JSONDecoder().decode(GlossDTO.self, from: data) else { return nil }
        let translation = obj.translation.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !translation.isEmpty else { return nil }
        func clean(_ value: String?) -> String {
            (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        func cleanList(_ values: [String]?) -> [String] {
            (values ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        }
        return WordGloss(
            term: term,
            translation: translation,
            explanation: clean(obj.explanation),
            example: clean(obj.example),
            exampleTranslation: clean(obj.exampleTranslation),
            partOfSpeech: clean(obj.partOfSpeech),
            gender: clean(obj.gender),
            article: clean(obj.article),
            baseForm: clean(obj.baseForm),
            baseFormNote: clean(obj.baseFormNote),
            pronunciation: clean(obj.pronunciation),
            register: clean(obj.register),
            otherMeanings: cleanList(obj.otherMeanings),
            relatedWords: cleanList(obj.relatedWords),
            similarPhrases: cleanList(obj.similarPhrases)
        )
    }
}

// MARK: - Classifying transport errors

/// Tells "you're offline" apart from "the service failed" for every network
/// surface, so the learner sees the right state and retry advice.
nonisolated enum NetworkErrors {
    static func isOffline(_ error: Error) -> Bool {
        guard let urlError = error as? URLError else { return false }
        switch urlError.code {
        case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost,
             .dataNotAllowed, .internationalRoamingOff, .dnsLookupFailed:
            return true
        default:
            return false
        }
    }

    static func failure(for error: Error) -> TranslationFailure {
        isOffline(error) ? .offline : .serviceError
    }
}

nonisolated enum TranslationLanguage: String {
    case english, french
    var englishName: String { self == .english ? "English" : "French" }
    var displayName: String { self == .english ? "English" : "French" }
    var bcp47: String { self == .english ? "en-US" : "fr-FR" }
    var opposite: TranslationLanguage { self == .english ? .french : .english }
}

nonisolated struct GlossDTO: Decodable {
    let translation: String
    let explanation: String
    let example: String
    let exampleTranslation: String
    let partOfSpeech: String?
    let gender: String?
    let article: String?
    let baseForm: String?
    let baseFormNote: String?
    let pronunciation: String?
    let register: String?
    let otherMeanings: [String]?
    let relatedWords: [String]?
    let similarPhrases: [String]?
}

nonisolated struct OpenRouterResponse: Decodable {
    struct Choice: Decodable { let message: Message }
    struct Message: Decodable { let content: String }
    let choices: [Choice]
}
