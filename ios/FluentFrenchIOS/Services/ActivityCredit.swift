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
    /// Minutes to credit for `activeSeconds` of LESSON time: nothing under
    /// `Tuning.minActivitySeconds`, otherwise the rounded minutes (at least 1),
    /// never more than `capMinutes`. A cap of 0 credits nothing. Activity surfaces,
    /// whose lifetime minutes open the higher modalities, use `credit(...)` instead
    /// (firstrun-11-4).
    static func minutes(activeSeconds: TimeInterval, capMinutes: Int) -> Int {
        guard activeSeconds >= Tuning.minActivitySeconds, capMinutes > 0 else { return 0 }
        let rounded = max(1, Int((activeSeconds / 60).rounded()))
        return min(rounded, capMinutes)
    }

    /// Whole minutes an activity session earns toward the plan AND the lifetime
    /// totals the unlock gate reads, plus the unspent seconds to carry into the
    /// modality's next session (firstrun-11-4). `minutes(activeSeconds:capMinutes:)`
    /// rounds a 20-second visit up to a whole minute, so fifteen glances at Read met
    /// the 15-minute bar that opens Listening and Speaking: activity time is floored
    /// instead, and the remainder carries, so the total credited never exceeds the
    /// foreground time actually spent. A glance under `Tuning.minActivitySeconds`
    /// still credits nothing and adds nothing to the carry; time past the cap is
    /// discarded with the carry.
    static func credit(activeSeconds: TimeInterval, carriedSeconds: TimeInterval,
                       capMinutes: Int) -> (minutes: Int, carrySeconds: TimeInterval) {
        let carried = max(0, carriedSeconds)
        guard activeSeconds >= Tuning.minActivitySeconds, capMinutes > 0 else { return (0, carried) }
        let total = activeSeconds + carried
        let whole = Int((total / 60).rounded(.down))
        guard whole < capMinutes else { return (capMinutes, 0) }
        return (whole, total - Double(whole) * 60)
    }

    /// The per-session ceiling for a plan target: target × `Tuning.activityCreditCapMultiplier`,
    /// rounded up so a small target still leaves room for one honest overrun.
    static func capMinutes(planTargetMinutes: Int) -> Int {
        guard planTargetMinutes > 0 else { return 0 }
        return Int((Double(planTargetMinutes) * Tuning.activityCreditCapMultiplier).rounded(.up))
    }
}
