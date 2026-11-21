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
/// themselves once the loop runs on a real learner. The values live in
/// `Tuning` (firstrun-10-8); the struct exists so tests can override them.
nonisolated struct ReadinessConfig {
    /// Base-concept coverage at which Reading unlocks for authentic content.
    var readingUnlock: Double = Tuning.readingUnlockCoverage
    /// Coverage at which Reading enters the scaffolded "bridge" (foundation) state.
    var readingBridge: Double = Tuning.readingBridgeCoverage
    /// Coverage at which higher modalities open outright (a strong knower skips ahead).
    var higherUnlock: Double = Tuning.higherUnlockCoverage
    /// Demonstrated reading minutes that open higher modalities once Reading is unlocked.
    var higherDemonstratedMinutes: Int = Tuning.higherDemonstratedMinutes

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
    /// `readingHeldByGovernor` says WHY Reading is not open when it isn't: true when
    /// coverage alone would have unlocked it and only the retention governor is
    /// holding it in the bridge (`AppStore.isReadingHeldByGovernor`). The basics are
    /// built in that state, so the higher modalities must not be told to build them
    /// (firstrun-9-2).
    static func unlockCondition(for modality: LearningModality,
                                readiness: ModalityReadiness,
                                readingReadiness: ModalityReadiness,
                                readingMinutes: Int,
                                governorActive: Bool,
                                readingHeldByGovernor: Bool = false,
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
                // Reading is only ever `.locked` because coverage is below the
                // bridge — the governor holds it at `.foundation`, never lower
                // (AppStore.governorHeldVerdict). So the honest sentence here is
                // always the coverage one, even while the governor is active.
                return "Unlocks as you build the basics — keep going with your Foundation lessons."
            }
        default:
            guard readiness != .unlocked else { return nil }
            guard readingReadiness == .unlocked else {
                // Reading itself can be closed for two different reasons, and the
                // sentence has to name the right one: coverage still building, or
                // the governor holding a coverage bar the learner already cleared.
                // Telling a learner at 14 of 14 skills to "build the basics first"
                // is a dead end they cannot act on (firstrun-9-2).
                return readingHeldByGovernor ? governorCondition(for: modality)
                                             : "Unlocks after Reading — build the basics first."
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

    // The governor lines (UX-25) say what to DO, not "consolidating". They are
    // worded "review … BEFORE X opens", never "review … TO open X": the governor
    // holds a gate whenever check-in recall is low, including gates that coverage
    // or the Reading minutes also still hold (`unlockCondition` returns this line
    // for every higher modality while the governor is active), so lifting the
    // governor is always required and not always enough. "Today's lessons focus on
    // that" is what the governor does: the selector drops the frontier weight and
    // multiplies urgency (`ConceptSelector`, `Tuning.governorUrgencyMultiplier`).

    /// The governor holds a gate (Pass 3 F6): "Review what you've learned before
    /// Listening opens — today's lessons focus on that."
    static func governorCondition(for modality: LearningModality) -> String {
        "Review what you've learned before \(modality.label) opens — today's lessons focus on that."
    }

    /// Home's ONE "Next unlock" line for a Foundation learner (UX-07): every locked
    /// activity sits behind Reading, so Reading is the next unlock, with the gate's
    /// own progress (`AppStore.foundationProgress`). In the bridge the short pieces
    /// are already open, so what is next is the rest of Reading. When only the
    /// governor holds it (`AppStore.isReadingHeldByGovernor`: coverage has cleared
    /// the bar) the skills are done, the governor is the whole gate, and releasing
    /// it opens Reading live — the one case where "review … to open it" is true.
    static func nextUnlockLine(readingReadiness: ModalityReadiness, done: Int, target: Int,
                               readingHeldByGovernor: Bool) -> String? {
        let subject: String
        switch readingReadiness {
        case .unlocked: return nil
        case .locked: subject = "Reading"
        case .foundation: subject = "the rest of Reading"
        }
        if readingHeldByGovernor {
            return "Next unlock: \(subject) — review what you've learned to open it."
        }
        let target = max(1, target)
        let done = min(max(0, done), target)
        return "Next unlock: \(subject) — \(done) of \(target) skill\(target == 1 ? "" : "s")"
    }

    /// Home's ONE "Next unlock" line once Reading is open (UX-07 continued past
    /// Foundation): the still-locked activities all open on the same bar
    /// (`AppStore.baseReadiness`), demonstrated Reading minutes, so one line names
    /// them together with the minutes so far. With the governor active it holds them
    /// whatever the minutes say, so the line names the review — worded "before …
    /// open", like `governorCondition`, because the minutes may also still be due.
    static func nextUnlockLine(lockedAfterReading locked: [LearningModality], readingMinutes: Int,
                               governorActive: Bool, config: ReadinessConfig = .tuning) -> String? {
        let locked = locked.filter { $0 != .reading }
        guard !locked.isEmpty else { return nil }
        let subject = names(of: locked)
        if governorActive {
            return "Next unlock: \(subject) — review what you've learned before \(locked.count == 1 ? "it opens" : "they open")."
        }
        return "Next unlock: \(subject) — \(minutesProgress(done: readingMinutes, bar: config.higherDemonstratedMinutes))"
    }

    /// The plan's unlock item headline: "15 min of Reading unlocks Listening & Speaking".
    static func unlockHeadline(for modalities: [LearningModality], config: ReadinessConfig = .tuning) -> String {
        "\(config.higherDemonstratedMinutes) min of Reading unlocks \(names(of: modalities))"
    }

    /// The governor variant of the unlock headline: "Review what you've learned
    /// before Listening & Speaking open — today's lessons focus on that."
    static func governorHeadline(for modalities: [LearningModality]) -> String {
        let verb = modalities.count == 1 ? "opens" : "open"
        return "Review what you've learned before \(names(of: modalities)) \(verb) — today's lessons focus on that."
    }

    /// The governor rationale when it holds no gate the line could name — every
    /// chosen activity is open, or coverage (not the governor) keeps Reading shut
    /// (firstrun-10-6): the frontier is closed, so the day leans on review (Pass 3 F6).
    static let governorConsolidating = "Today's lessons focus on review — making sure what you've learned sticks."

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
    static let governorBridgeCondition = "Review what you've learned before the rest of Reading opens — short pieces at your level for now."
    /// The stat line an open-in-bridge Read card shows.
    static let bridgeStat = "Short pieces at your level"
}
