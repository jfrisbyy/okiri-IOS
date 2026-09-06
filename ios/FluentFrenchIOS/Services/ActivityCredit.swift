//
//  ActivityCredit.swift
//  FluentFrenchIOS
//
//  Activity-minute crediting for the daily plan (D9). Time in an activity surface
//  only counts while the app is in the foreground, and one session can never
//  earn more than the plan asked for times `Tuning.activityCreditCapMultiplier`.
//  Pure value types: the view feeds in scene-phase transitions and a clock, and
//  the store records what this decides.
//

import Foundation

/// A stopwatch for one open activity surface. It runs only between `resume` and
/// `pause` calls, so the view maps `scenePhase == .active` to `resume` and
/// anything else to `pause`; backgrounded time never accumulates.
nonisolated struct ActivitySession: Hashable {
    /// The plan modality the surface credits (nil for surfaces with no activity, e.g. the deck).
    let modality: LearningModality?
    /// Foreground seconds folded in by previous `pause` calls.
    private(set) var accumulatedSeconds: TimeInterval = 0
    /// When the current foreground run started; nil while paused.
    private(set) var activeSince: Date?

    /// A session that starts running immediately unless `inForeground` is false.
    init(modality: LearningModality?, startedAt: Date, inForeground: Bool = true) {
        self.modality = modality
        self.activeSince = inForeground ? startedAt : nil
    }

    var isRunning: Bool { activeSince != nil }

    /// Stop the clock (scene left `.active`). Idempotent.
    mutating func pause(at now: Date) {
        guard let since = activeSince else { return }
        accumulatedSeconds += max(0, now.timeIntervalSince(since))
        activeSince = nil
    }

    /// Start the clock again (scene became `.active`). Idempotent.
    mutating func resume(at now: Date) {
        guard activeSince == nil else { return }
        activeSince = now
    }

    /// Foreground seconds so far, including the run still in progress.
    func activeSeconds(at now: Date) -> TimeInterval {
        var total = accumulatedSeconds
        if let since = activeSince { total += max(0, now.timeIntervalSince(since)) }
        return total
    }
}

nonisolated enum ActivityCredit {
    /// Minutes to credit for `activeSeconds` of foreground time: nothing under
    /// `Tuning.minActivitySeconds`, otherwise the rounded minutes (at least 1),
    /// never more than `capMinutes`. A cap of 0 credits nothing.
    static func minutes(activeSeconds: TimeInterval, capMinutes: Int) -> Int {
        guard activeSeconds >= Tuning.minActivitySeconds, capMinutes > 0 else { return 0 }
        let rounded = max(1, Int((activeSeconds / 60).rounded()))
        return min(rounded, capMinutes)
    }

    /// The per-session ceiling for a plan target: target × `Tuning.activityCreditCapMultiplier`,
    /// rounded up so a small target still leaves room for one honest overrun.
    static func capMinutes(planTargetMinutes: Int) -> Int {
        guard planTargetMinutes > 0 else { return 0 }
        return Int((Double(planTargetMinutes) * Tuning.activityCreditCapMultiplier).rounded(.up))
    }
}
