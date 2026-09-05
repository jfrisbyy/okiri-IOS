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
