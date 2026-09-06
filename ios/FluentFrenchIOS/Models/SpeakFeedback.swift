//
//  SpeakFeedback.swift
//  FluentFrenchIOS
//
//  Feedback on one spoken or written French response, the parser that reads it
//  from the model's JSON (validating every concept id it names against the
//  taxonomy), and the plan for what it should leave behind: the corrected and
//  the natural phrasing as deck gaps (E13). Foundation only — harness-compiled.
//

import Foundation

nonisolated struct SpeakFeedback: Hashable {
    var corrected: String
    var note: String
    var natural: String
    /// 0–100 fluency estimate.
    var score: Int
    /// English for the corrected line, so its deck card has a meaning from the
    /// start ("" when the model omitted it — the gap then waits for a translation).
    var correctedEnglish: String = ""
    /// English for the natural phrasing (same rule).
    var naturalEnglish: String = ""
    /// Taxonomy concepts the response got wrong (validated ids, capped).
    var mistakeConceptIds: [String] = []
    /// Taxonomy concepts the response used well (validated ids, capped).
    var strongConceptIds: [String] = []
}

/// Parses the feedback JSON. Concept ids are kept only when they exist in the
/// given taxonomy, so evidence can never land on an invented concept.
nonisolated enum SpeakFeedbackParser {
    static func parse(_ raw: String, concepts: [Concept], maxConcepts: Int = Tuning.speakFeedbackMaxConcepts) -> SpeakFeedback? {
        guard let data = ModelJSON.objectData(in: raw),
              let dto = try? JSONDecoder().decode(DTO.self, from: data) else { return nil }
        let corrected = clean(dto.corrected)
        guard !corrected.isEmpty else { return nil }
        let score = Int((dto.score ?? 0).rounded())
        let mistakes = ConceptIdFilter.valid(dto.mistakeConcepts ?? [], in: concepts, limit: maxConcepts)
        let strong = ConceptIdFilter.valid(dto.strongConcepts ?? [], in: concepts, limit: maxConcepts)
            .filter { !mistakes.contains($0) }   // a concept is not both wrong and strong in one line
        return SpeakFeedback(
            corrected: corrected,
            note: clean(dto.note),
            natural: clean(dto.natural),
            score: max(0, min(100, score)),
            correctedEnglish: clean(dto.correctedEnglish),
            naturalEnglish: clean(dto.naturalEnglish),
            mistakeConceptIds: mistakes,
            strongConceptIds: strong
        )
    }

    private static func clean(_ s: String?) -> String {
        (s ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private struct DTO: Decodable {
        let corrected: String?
        let note: String?
        let natural: String?
        let correctedEnglish: String?
        let naturalEnglish: String?
        let score: Double?
        let mistakeConcepts: [String]?
        let strongConcepts: [String]?
    }
}

/// One gap the feedback should leave in the deck.
nonisolated struct SpeakGapSpec: Hashable {
    enum Kind: Hashable { case corrected, natural }
    let kind: Kind
    let french: String
    /// The meaning the feedback supplied; "" when it gave none (the gap is then
    /// saved with `needsTranslation` and filled in by the next successful lookup).
    let english: String
    /// The learner's own line, kept as the gap's original context.
    let originalFrench: String
    let explanation: String
    let conceptId: String?
}

nonisolated enum SpeakGapPlan {
    /// The corrected line is a gap when it differs from what the learner said;
    /// the natural phrasing is a gap when it differs from both. Nothing is planned
    /// when the learner's own words come back unchanged — that would save the
    /// learner's French as if it were a correction.
    static func specs(original: String, feedback: SpeakFeedback) -> [SpeakGapSpec] {
        let learner = original.trimmingCharacters(in: .whitespacesAndNewlines)
        let corrected = feedback.corrected.trimmingCharacters(in: .whitespacesAndNewlines)
        let natural = feedback.natural.trimmingCharacters(in: .whitespacesAndNewlines)
        let correctedEnglish = feedback.correctedEnglish.trimmingCharacters(in: .whitespacesAndNewlines)
        // The natural phrasing says the same thing, so the corrected line's
        // English is a faithful meaning for it when the model gave none of its own.
        let naturalEnglish = feedback.naturalEnglish.trimmingCharacters(in: .whitespacesAndNewlines)
        let concept = feedback.mistakeConceptIds.first
        var specs: [SpeakGapSpec] = []
        if !corrected.isEmpty, !PhraseKey.same(corrected, learner) {
            let note = feedback.note.isEmpty ? "Corrected from your speaking practice." : feedback.note
            specs.append(SpeakGapSpec(kind: .corrected, french: corrected, english: correctedEnglish,
                                      originalFrench: learner, explanation: note, conceptId: concept))
        }
        if !natural.isEmpty, !PhraseKey.same(natural, learner), !PhraseKey.same(natural, corrected) {
            specs.append(SpeakGapSpec(kind: .natural, french: natural,
                                      english: naturalEnglish.isEmpty ? correctedEnglish : naturalEnglish,
                                      originalFrench: learner, explanation: "A more natural way to say it.",
                                      conceptId: concept))
        }
        return specs
    }
}
