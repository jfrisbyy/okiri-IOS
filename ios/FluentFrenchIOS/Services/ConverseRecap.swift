//
//  ConverseRecap.swift
//  FluentFrenchIOS
//
//  The conversation transcript model plus the pure logic behind the end-of-call
//  recap: parsing a tutor reply, collecting the tutor's corrections into a
//  "What to fix" list, deciding what (if anything) a recap line may save to the
//  deck, and the scenario lock rule. Foundation only so the Linux harness
//  compiles and tests it; `ConverseService` does the networking.
//

import Foundation

// MARK: - Transcript model

nonisolated struct ChatTurn: Identifiable, Hashable {
    enum Role { case tutor, user }
    let id = UUID()
    var role: Role
    var french: String
    var english: String
    /// A short, kind English note on what the tutor fixed in the learner's last
    /// message (tutor turns only; nil when nothing needed fixing).
    var correction: String?
    /// The learner's last message rewritten correctly (tutor turns only).
    var correctedFrench: String? = nil
    /// English for `correctedFrench`, when the tutor supplied one.
    var correctedEnglish: String? = nil
    /// Taxonomy concept the correction is about, when the tutor named one.
    var conceptId: String? = nil
}

nonisolated struct ConverseReply {
    var french: String
    var english: String
    /// Kind English note on what was fixed, nil when the learner's message was fine.
    var correction: String?
    var correctedFrench: String? = nil
    var correctedEnglish: String? = nil
    var conceptId: String? = nil

    var hasCorrection: Bool { correctedFrench != nil || correction != nil }
}

// MARK: - Reply parsing

/// Decodes the tutor's JSON reply. Tolerates the older one-field shape
/// (`correction` only) so a stale model prompt still yields a usable turn.
nonisolated enum ConverseReplyParser {
    static func parse(_ raw: String, concepts: [Concept] = []) -> ConverseReply? {
        guard let data = ModelJSON.objectData(in: raw),
              let dto = try? JSONDecoder().decode(ReplyDTO.self, from: data) else { return nil }
        let french = clean(dto.french)
        guard !french.isEmpty else { return nil }
        let note = clean(dto.correction)
        let corrected = clean(dto.correctedFrench)
        let correctedEnglish = clean(dto.correctedEnglish)
        let conceptId = ConceptIdFilter.valid([dto.conceptId ?? ""], in: concepts, limit: 1).first
        return ConverseReply(
            french: french,
            english: clean(dto.english),
            correction: note.isEmpty ? nil : note,
            correctedFrench: corrected.isEmpty ? nil : corrected,
            correctedEnglish: correctedEnglish.isEmpty ? nil : correctedEnglish,
            conceptId: conceptId
        )
    }

    private static func clean(_ s: String?) -> String {
        (s ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private struct ReplyDTO: Decodable {
        let french: String?
        let english: String?
        let correction: String?
        let correctedFrench: String?
        let correctedEnglish: String?
        let conceptId: String?
    }
}

// MARK: - Corrections ("What to fix")

/// One tutor correction paired with the learner line it fixes.
nonisolated struct ConverseCorrection: Identifiable, Hashable {
    /// The tutor turn's id (stable across recap renders).
    let id: UUID
    let originalFrench: String
    let correctedFrench: String
    /// The tutor's note, or empty when it only rewrote the line.
    let explanation: String
    /// English for the corrected line, when the tutor gave one.
    let englishTranslation: String?
    let conceptId: String?
}

/// What a recap line may save to the deck.
nonisolated enum RecapSaveCandidate: Hashable {
    /// A tutor line: saved as said.
    case tutorPhrase(french: String, english: String)
    /// A learner line the tutor corrected: the CORRECTION is saved, never the slip.
    case correction(ConverseCorrection)
}

nonisolated enum ConverseRecap {
    /// Every tutor correction in the transcript, each paired with the nearest
    /// preceding learner line. Corrections that do not change the line are dropped.
    static func corrections(in transcript: [ChatTurn]) -> [ConverseCorrection] {
        var result: [ConverseCorrection] = []
        for (index, turn) in transcript.enumerated() where turn.role == .tutor {
            guard let corrected = turn.correctedFrench?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !corrected.isEmpty,
                  let learner = transcript[..<index].last(where: { $0.role == .user }) else { continue }
            let original = learner.french.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !PhraseKey.same(original, corrected) else { continue }
            result.append(ConverseCorrection(
                id: turn.id,
                originalFrench: original,
                correctedFrench: corrected,
                explanation: turn.correction ?? "",
                englishTranslation: nonEmpty(turn.correctedEnglish),
                conceptId: turn.conceptId
            ))
        }
        return result
    }

    /// The save offer for one recap line. Tutor lines save as said; a learner
    /// line saves only the tutor's correction of it, and offers nothing when the
    /// tutor found nothing to fix.
    static func saveCandidate(for turn: ChatTurn, in transcript: [ChatTurn]) -> RecapSaveCandidate? {
        switch turn.role {
        case .tutor:
            let french = turn.french.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !french.isEmpty else { return nil }
            return .tutorPhrase(french: french, english: turn.english.trimmingCharacters(in: .whitespacesAndNewlines))
        case .user:
            guard let index = transcript.firstIndex(where: { $0.id == turn.id }),
                  let reply = transcript[(index + 1)...].first(where: { $0.role == .tutor }) else { return nil }
            return corrections(in: transcript).first(where: { $0.id == reply.id }).map { .correction($0) }
        }
    }

    /// Tutor notes with no rewritten line (older reply shape): still worth showing
    /// in the recap, but nothing can be saved from them.
    static func unsavableNotes(in transcript: [ChatTurn]) -> [String] {
        transcript.compactMap { turn in
            guard turn.role == .tutor, turn.correctedFrench == nil,
                  let note = nonEmpty(turn.correction) else { return nil }
            return note
        }
    }

    private static func nonEmpty(_ s: String?) -> String? {
        guard let s else { return nil }
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}

// MARK: - Scenario lock rule (E12)

nonisolated enum ConverseLockReason: Equatable {
    /// Speaking has not opened yet (readiness gate).
    case speakingNotReady
    /// The scenario is pitched above the learner's level.
    case aboveLevel(CEFRLevel)

    var message: String {
        switch self {
        case .speakingNotReady: return "Speaking unlocks as you build the basics."
        case .aboveLevel(let level): return "Unlocks at \(level.rawValue)."
        }
    }
}

nonisolated enum ConverseScenarioGate {
    /// A scenario is open only when Speaking is open AND the learner's level
    /// reaches the scenario's. Readiness is checked first so the copy explains
    /// the gate that actually applies.
    static func lockReason(required: CEFRLevel, learner: CEFRLevel, readiness: ModalityReadiness) -> ConverseLockReason? {
        guard readiness.isOpen else { return .speakingNotReady }
        guard required.order <= learner.order else { return .aboveLevel(required) }
        return nil
    }
}
