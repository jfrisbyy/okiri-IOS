//
//  Readiness.swift
//  FluentFrenchIOS
//
//  The content-readiness gate. Gap learning only produces signal ABOVE a coverage
//  threshold: below it, every word is a gap and capture stops measuring weaknesses.
//  So each activity ("modality") is gated PER MODALITY into one of three states —
//  locked, foundation-only, or unlocked — based on the learner's base-concept
//  coverage (a proxy for lexical coverage) plus demonstrated in-app performance.
//
//  Reading is the most forgiving entry (self-paced, re-readable) and unlocks first.
//  Listening / watching / speaking are real-time, so they unlock at higher bars and
//  only once the learner actually performs — never predicted from the text test.
//

import Foundation

nonisolated enum ModalityReadiness: String, Codable, Hashable {
    case locked        // not ready — shown as "unlocks as you build the basics"
    case foundation    // bridging — close to ready, scaffolded content only
    case unlocked      // ready for authentic content

    var isOpen: Bool { self == .unlocked }
}

/// Coverage thresholds for the readiness gate. NOT FINAL — these only reveal
/// themselves once the loop runs on a real learner, so they live here, clearly
/// labeled for live tuning, like the other engine configs.
nonisolated struct ReadinessConfig {
    /// Base-concept coverage at which Reading unlocks for authentic content.
    var readingUnlock: Double = 0.5
    /// Coverage at which Reading enters the scaffolded "bridge" (foundation) state.
    var readingBridge: Double = 0.3
    /// Coverage at which higher modalities open outright (a strong knower skips ahead).
    var higherUnlock: Double = 0.85
    /// Demonstrated reading minutes that open higher modalities once Reading is unlocked.
    var higherDemonstratedMinutes: Int = 15

    static let tuning = ReadinessConfig()
}

// MARK: - Learner-facing gate copy (D1)

/// The ONE place the unlock conditions are worded. Every entry point that finds a
/// modality locked (Explore card, headline, resource, plan row, section cover)
/// renders the string this returns — never its own guess at the rule. Numbers
/// come from `ReadinessConfig`, so the copy can never drift from the gate.
nonisolated enum ReadinessCopy {
    /// What the gate says about a modality that is not open, given the learner's
    /// current readings. Nil when the modality is unlocked (nothing to explain).
    /// `readingMinutes` is lifetime demonstrated reading, so a higher modality can
    /// show real progress toward its bar ("8 of 15 min of Reading so far").
    static func unlockCondition(for modality: LearningModality,
                                readiness: ModalityReadiness,
                                readingReadiness: ModalityReadiness,
                                readingMinutes: Int,
                                governorActive: Bool,
                                config: ReadinessConfig = .tuning) -> String? {
        switch modality {
        case .reading:
            switch readiness {
            case .unlocked:
                return nil
            case .foundation:
                // The governor can hold reading in the bridge (AppStore.readiness):
                // the surface stays open, so say why authentic pieces are waiting
                // rather than repeating the coverage bridge note.
                return governorActive ? governorBridgeCondition : bridgeCondition
            case .locked:
                return governorActive ? governorCondition(for: modality) : "Unlocks as you build the basics — keep going with your Foundation lessons."
            }
        default:
            guard readiness != .unlocked else { return nil }
            guard readingReadiness == .unlocked else {
                return "Unlocks after Reading — build the basics first."
            }
            if governorActive { return governorCondition(for: modality) }
            let bar = config.higherDemonstratedMinutes
            let done = min(max(0, readingMinutes), bar)
            if done > 0 {
                return "\(done) of \(bar) min of Reading so far — \(bar - done) more unlocks \(modality.label)."
            }
            return "\(bar) min of Reading unlocks \(modality.label)."
        }
    }

    /// The governor holds a gate that coverage alone would open (Pass 3 F6).
    static func governorCondition(for modality: LearningModality) -> String {
        "Consolidating your base before opening \(modality.label.lowercased())."
    }

    /// The plan's unlock item headline: "15 min of Reading unlocks Listening & Speaking".
    static func unlockHeadline(for modalities: [LearningModality], config: ReadinessConfig = .tuning) -> String {
        "\(config.higherDemonstratedMinutes) min of Reading unlocks \(names(of: modalities))"
    }

    /// The governor variant of the unlock headline.
    static func governorHeadline(for modalities: [LearningModality]) -> String {
        "Consolidating your base before opening \(names(of: modalities).lowercased())."
    }

    /// The governor rationale once everything the learner chose is already open:
    /// the frontier is closed, so the day leans on review (Pass 3 F6).
    static let governorConsolidating = "Consolidating your base — today's lessons lean on review."

    /// Progress toward the demonstrated-minutes bar: "8 of 15 min of Reading".
    static func minutesProgress(done: Int, bar: Int) -> String {
        "\(min(max(0, done), bar)) of \(bar) min of Reading"
    }

    /// Short badge text for a locked entry point.
    static let lockedLabel = "Locked"

    /// "Listening", "Listening & Speaking", "Listening, Speaking & Watching".
    static func names(of modalities: [LearningModality]) -> String {
        let labels = modalities.map { $0.label }
        switch labels.count {
        case 0: return "more activities"
        case 1: return labels[0]
        default: return labels.dropLast().joined(separator: ", ") + " & " + labels[labels.count - 1]
        }
    }

    /// Reading in the bridge state (D5): open, but only short, level-capped pieces.
    static let bridgeCondition = "Almost there — short pieces at your level for now."
    /// Reading held in the bridge by the retention governor (Pass 3 F6): the surface
    /// the learner already had stays open, authentic pieces wait for the base to hold.
    static let governorBridgeCondition = "Consolidating your base — short pieces at your level for now."
    /// The stat line an open-in-bridge Read card shows.
    static let bridgeStat = "Short pieces at your level"
}
