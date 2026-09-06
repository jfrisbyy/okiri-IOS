//
//  ScenarioGuide.swift
//  FluentFrenchIOS
//
//  The survival-guide shape Scenarios asks the tutor for, and the tolerant
//  decoding that turns a raw model reply into one. The tutor is told to answer
//  with the guide's *content* only — it never sends the local `id` these rows
//  carry for SwiftUI identity, and it can drop a text field — so every type
//  here decodes what is present and defaults the rest. Synthesized `Decodable`
//  would instead throw `keyNotFound("id")` on the first phrase and leave the
//  surface stuck on its retry card.
//
//  Foundation only (no views, no networking) so the Linux harness compiles and
//  tests the parse; the request itself lives in `Services/ScenariosService.swift`.
//

import Foundation

/// One phrase in a guide: French, its English, and when to use it.
nonisolated struct ScenarioPhrase: Codable, Hashable, Identifiable {
    var id = UUID()
    var french: String
    var english: String
    var context: String

    private enum CodingKeys: String, CodingKey { case id, french, english, context }

    init(id: UUID = UUID(), french: String, english: String, context: String) {
        self.id = id
        self.french = french
        self.english = english
        self.context = context
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        french = try c.decodeIfPresent(String.self, forKey: .french) ?? ""
        english = try c.decodeIfPresent(String.self, forKey: .english) ?? ""
        context = try c.decodeIfPresent(String.self, forKey: .context) ?? ""
    }
}

/// A question the learner may be asked, with a usable answer.
nonisolated struct ScenarioQA: Codable, Hashable, Identifiable {
    var id = UUID()
    var question: String
    var questionEnglish: String
    var answer: String
    var answerEnglish: String

    private enum CodingKeys: String, CodingKey { case id, question, questionEnglish, answer, answerEnglish }

    init(id: UUID = UUID(), question: String, questionEnglish: String,
         answer: String, answerEnglish: String) {
        self.id = id
        self.question = question
        self.questionEnglish = questionEnglish
        self.answer = answer
        self.answerEnglish = answerEnglish
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        question = try c.decodeIfPresent(String.self, forKey: .question) ?? ""
        questionEnglish = try c.decodeIfPresent(String.self, forKey: .questionEnglish) ?? ""
        answer = try c.decodeIfPresent(String.self, forKey: .answer) ?? ""
        answerEnglish = try c.decodeIfPresent(String.self, forKey: .answerEnglish) ?? ""
    }
}

/// A practical, cultural or native-speaker tip.
nonisolated struct ScenarioTip: Codable, Hashable, Identifiable {
    var id = UUID()
    var tip: String
    var category: String   // "native" | "cultural" | "practical"

    private enum CodingKeys: String, CodingKey { case id, tip, category }

    init(id: UUID = UUID(), tip: String, category: String) {
        self.id = id
        self.tip = tip
        self.category = category
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        tip = try c.decodeIfPresent(String.self, forKey: .tip) ?? ""
        category = try c.decodeIfPresent(String.self, forKey: .category) ?? ""
    }
}

/// The whole guide for one situation.
nonisolated struct ScenarioGuide: Codable, Hashable {
    var title: String
    var titleFrench: String
    var summary: String
    var keyPhrases: [ScenarioPhrase]
    var questionsAndAnswers: [ScenarioQA]
    var tips: [ScenarioTip]
    var nativeExpressions: [ScenarioPhrase]

    private enum CodingKeys: String, CodingKey {
        case title, titleFrench, summary, keyPhrases, questionsAndAnswers, tips, nativeExpressions
    }

    init(title: String, titleFrench: String, summary: String,
         keyPhrases: [ScenarioPhrase], questionsAndAnswers: [ScenarioQA],
         tips: [ScenarioTip], nativeExpressions: [ScenarioPhrase]) {
        self.title = title
        self.titleFrench = titleFrench
        self.summary = summary
        self.keyPhrases = keyPhrases
        self.questionsAndAnswers = questionsAndAnswers
        self.tips = tips
        self.nativeExpressions = nativeExpressions
    }

    /// A section the tutor left out is an empty section, not a failed guide —
    /// `parse` still refuses a reply with no key phrases at all.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        titleFrench = try c.decodeIfPresent(String.self, forKey: .titleFrench) ?? ""
        summary = try c.decodeIfPresent(String.self, forKey: .summary) ?? ""
        keyPhrases = try c.decodeIfPresent([ScenarioPhrase].self, forKey: .keyPhrases) ?? []
        questionsAndAnswers = try c.decodeIfPresent([ScenarioQA].self, forKey: .questionsAndAnswers) ?? []
        tips = try c.decodeIfPresent([ScenarioTip].self, forKey: .tips) ?? []
        nativeExpressions = try c.decodeIfPresent([ScenarioPhrase].self, forKey: .nativeExpressions) ?? []
    }

    /// Read a guide out of a raw model reply (fenced or chatty text included).
    /// Nil when there is no JSON object, it will not decode, or it carries no
    /// phrases to teach — the three cases the surface reports as a bad reply.
    static func parse(_ raw: String) -> ScenarioGuide? {
        guard let data = ModelJSON.objectData(in: raw),
              let guide = try? JSONDecoder().decode(ScenarioGuide.self, from: data),
              !guide.keyPhrases.isEmpty else { return nil }
        return guide
    }
}

// MARK: - Saved guides

/// A guide the learner kept, with the situation they searched for.
nonisolated struct SavedScenario: Codable, Hashable, Identifiable {
    var id: String
    var query: String
    var guide: ScenarioGuide
    var savedAt: Date
}

/// The saved-guides list as a value. Bookmarking is keyed on the guide that is
/// on screen — its `SavedScenario.id` — never on the words the learner typed:
/// asking for "Restaurant" twice builds two different guides, so keying on the
/// query made a fresh guide read as already saved and the bookmark delete the
/// one actually kept (talkmedia-5-3).
nonisolated enum ScenarioLibrary {
    /// True when `id` names a guide still in the list.
    static func contains(_ id: String?, in saved: [SavedScenario]) -> Bool {
        guard let id else { return false }
        return saved.contains { $0.id == id }
    }

    /// Keep the guide on screen (plus any phrases the learner added through the
    /// translator) at the top of the list. A guide kept earlier for the same
    /// situation is REPLACED, so "Saved Scenarios" never shows two rows with the
    /// same name and the newer guide is the one that opens. Returns the new list
    /// and the id the surface should treat as "the saved guide on screen".
    static func save(_ guide: ScenarioGuide, query: String, customPhrases: [ScenarioPhrase] = [],
                     into saved: [SavedScenario], id: String = UUID().uuidString,
                     now: Date = Date()) -> (saved: [SavedScenario], id: String) {
        var merged = guide
        merged.keyPhrases.append(contentsOf: customPhrases)
        var result = saved.filter { !sameSituation($0.query, query) }
        result.insert(SavedScenario(id: id, query: query, guide: merged, savedAt: now), at: 0)
        return (result, id)
    }

    /// Drop one kept guide by id.
    static func remove(_ id: String, from saved: [SavedScenario]) -> [SavedScenario] {
        saved.filter { $0.id != id }
    }

    /// Add a phrase to a kept guide, so a phrase translated while a saved guide
    /// is open is still there when it is reopened.
    static func appendPhrase(_ phrase: ScenarioPhrase, toGuideWith id: String,
                             in saved: [SavedScenario]) -> [SavedScenario] {
        guard let index = saved.firstIndex(where: { $0.id == id }) else { return saved }
        var result = saved
        result[index].guide.keyPhrases.append(phrase)
        return result
    }

    /// Two searches for the same situation, ignoring case and surrounding space.
    static func sameSituation(_ a: String, _ b: String) -> Bool {
        a.trimmingCharacters(in: .whitespacesAndNewlines)
            .caseInsensitiveCompare(b.trimmingCharacters(in: .whitespacesAndNewlines)) == .orderedSame
    }
}
