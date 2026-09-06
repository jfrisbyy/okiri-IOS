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
    /// What one round of feedback should leave in the deck, and what the learner
    /// has to be told about it.
    struct Plan: Equatable {
        var specs: [SpeakGapSpec] = []
        /// True when the corrected line was too long to be a card and only the
        /// part it changed was kept — those cards carry no meaning of their own
        /// (the model's English described the whole line), so they wait for a lookup.
        var shortened = false
        /// True when there WAS a correction but nothing in it was card-sized:
        /// the feedback is still on screen to read, but the deck gets nothing.
        var tooLongToSave = false
    }

    /// The corrected line is a gap when it differs from what the learner said;
    /// the natural phrasing is a gap when it differs from both. Nothing is planned
    /// when the learner's own words come back unchanged — that would save the
    /// learner's French as if it were a correction. A correction longer than a
    /// card (a whole free-speech monologue, say) is reduced by `CorrectionCard` to
    /// the part it changed, and dropped when even that will not fit: the deck can
    /// only ask about a word or a short phrase (talkmedia-4-1).
    static func plan(original: String, feedback: SpeakFeedback) -> Plan {
        let learner = original.trimmingCharacters(in: .whitespacesAndNewlines)
        let corrected = feedback.corrected.trimmingCharacters(in: .whitespacesAndNewlines)
        let natural = feedback.natural.trimmingCharacters(in: .whitespacesAndNewlines)
        let correctedEnglish = feedback.correctedEnglish.trimmingCharacters(in: .whitespacesAndNewlines)
        // The natural phrasing says the same thing, so the corrected line's
        // English is a faithful meaning for it when the model gave none of its own.
        let naturalEnglish = feedback.naturalEnglish.trimmingCharacters(in: .whitespacesAndNewlines)
        let concept = feedback.mistakeConceptIds.first
        var plan = Plan()
        if !corrected.isEmpty, !PhraseKey.same(corrected, learner) {
            let card = CorrectionCard.from(original: learner, corrected: corrected)
            plan.shortened = card.shortened
            plan.tooLongToSave = card.isEmpty
            let note = feedback.note.isEmpty ? "Corrected from your speaking practice." : feedback.note
            for phrase in card.phrases {
                plan.specs.append(SpeakGapSpec(kind: .corrected, french: phrase,
                                               english: card.shortened ? "" : correctedEnglish,
                                               originalFrench: learner, explanation: note, conceptId: concept))
            }
        }
        // A rephrasing is only ever saved whole: a fragment of it is not the
        // phrase the model called natural, and the English it came with would no
        // longer be its meaning.
        if !natural.isEmpty, !PhraseKey.same(natural, learner), !PhraseKey.same(natural, corrected),
           CaptureBuilder.isAcceptableHeadword(natural),
           !plan.specs.contains(where: { PhraseKey.same($0.french, natural) }) {
            plan.specs.append(SpeakGapSpec(kind: .natural, french: natural,
                                           english: naturalEnglish.isEmpty ? correctedEnglish : naturalEnglish,
                                           originalFrench: learner, explanation: "A more natural way to say it.",
                                           conceptId: concept))
        }
        return plan
    }

    static func specs(original: String, feedback: SpeakFeedback) -> [SpeakGapSpec] {
        plan(original: original, feedback: feedback).specs
    }
}
