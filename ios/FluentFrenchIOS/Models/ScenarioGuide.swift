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
