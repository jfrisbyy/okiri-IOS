//
//  EngineMetrics.swift
//  FluentFrenchIOS
//
//  Instrumentation for Pass 3 (assessment gap 7): the per-day calibration proxies
//  the app CAN measure about its own engine — frontier size, learning / mastered /
//  provisional counts, the check-in pass rate and miss count (the ghost-mastery
//  proxy), whether the retention governor is active, stalled concepts, days since
//  the learner started, whether reading has unlocked, and lessons done today.
//
//  `AppStore.metricsSnapshot(now:)` computes one; `completeLesson` appends it to
//  the store's capped `MetricsLog` (`Tuning.metricsLogCapacity`). A DEBUG
//  diagnostics screen renders the log; nothing here is learner-facing.
//

import Foundation

nonisolated struct EngineMetrics: Codable, Hashable {
    /// When the snapshot was taken.
    var at: Date
    /// Lessons completed so far (the store's session index).
    var sessionIndex: Int
    /// Never-observed concepts whose prerequisites are all mastered.
    var frontierSize: Int
    var learningCount: Int
    var masteredCount: Int
    /// Mastered concepts whose mastery came from a placement seed and is unverified.
    var provisionalCount: Int
    /// Pass rate over the governor's rolling check-in window; nil with no check-ins yet.
    var checkInPassRate: Double?
    /// Check-ins in the rolling window.
    var checkInCount: Int
    /// Check-in misses in the rolling window — the ghost-mastery proxy.
    var checkInMisses: Int
    var governorActive: Bool
    /// Concepts that have been the target of `Tuning.stallAttempts` lessons with no state change.
    var stalledConceptIds: [String]
    /// Whole days since the learner's record started (placement or first lesson); 0 before that.
    var daysSinceStart: Int
    var readingUnlocked: Bool
    var lessonsToday: Int

    var stalls: Int { stalledConceptIds.count }
    var observedCount: Int { learningCount + masteredCount }
}

/// A capped, in-order log of metric snapshots (one per completed lesson).
nonisolated struct MetricsLog: Codable, Hashable {
    private(set) var entries: [EngineMetrics] = []
    /// Oldest entries are dropped once this many are kept.
    var capacity: Int = Tuning.metricsLogCapacity

    var last: EngineMetrics? { entries.last }
    var count: Int { entries.count }
    var isEmpty: Bool { entries.isEmpty }

    mutating func record(_ metrics: EngineMetrics) {
        entries.append(metrics)
        if capacity > 0, entries.count > capacity {
            entries.removeFirst(entries.count - capacity)
        }
    }

    mutating func clear() {
        entries.removeAll()
    }

    enum CodingKeys: String, CodingKey {
        case entries, capacity
    }

    init(entries: [EngineMetrics] = [], capacity: Int = Tuning.metricsLogCapacity) {
        self.entries = entries
        self.capacity = capacity
    }

    /// A persisted log decodes element-by-element so one bad entry never drops the rest.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let wrapped = try c.decodeIfPresent([FailableDecodable<EngineMetrics>].self, forKey: .entries) ?? []
        entries = wrapped.compactMap { $0.value }
        capacity = try c.decodeIfPresent(Int.self, forKey: .capacity) ?? Tuning.metricsLogCapacity
    }
}
