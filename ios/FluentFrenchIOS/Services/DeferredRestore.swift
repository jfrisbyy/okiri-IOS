//
//  DeferredRestore.swift
//  FluentFrenchIOS
//
//  The one sync marker that has to outlive the process. When the learner leaves
//  the local-data recovery screen with "Continue on this device" (the account
//  was unreachable), the device record is knowingly incomplete: part of it could
//  not be read. CloudSync then runs every later pass as a recovery pass — the
//  account copy wins — until one actually reads the row.
//
//  That promise is worthless if it only lives in memory. The gutted record is on
//  disk and survives a relaunch; a normal save rewrites the unreadable blob with
//  whatever is now in memory, so on the next launch `load()` succeeds, nothing
//  looks wrong, and the ordinary reconcile rule cannot tell the gutted record
//  from a good one (SnapshotReconcilerTests /
//  `ordinaryReconcileRuleCannotTellAGuttedStoreFromAGoodOne`) — it reports
//  "already in sync", or pushes the gutted record over the account's real
//  snapshot the moment anything is answered. So the deferred restore is written
//  next to the sync markers and read back at launch (store-4-1).
//

import Foundation

/// Records, across launches, that this device still owes itself a restore from
/// the account before its own copy may be trusted or uploaded.
///
/// Scoped to the user id the deferral was made for: a *different* learner
/// signing in on this device starts from their own record, so the deferral must
/// not silently suppress their "couldn't reach your account" screen.
nonisolated struct DeferredRestoreMarker {
    /// Holds the user id a restore is still owed for; absent when none is.
    static let key = "ff.cloud.pendingRemoteRestore.v1"

    private let defaults: UserDefaults

    init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    /// The user id a restore is still owed for, nil when none is pending.
    var userId: String? {
        defaults.string(forKey: Self.key)
    }

    /// True when `uid` left the recovery screen without restoring and no pass
    /// has read the account row since.
    func isPending(for uid: String) -> Bool {
        userId == uid
    }

    /// Remember that `uid` continued on this device with an incomplete record.
    func set(userId uid: String) {
        defaults.set(uid, forKey: Self.key)
    }

    /// Called only where the debt is actually settled: a pass read the account
    /// (and applied it, or found the account empty), or the local record the
    /// deferral describes was wiped with a sign-out.
    func clear() {
        defaults.removeObject(forKey: Self.key)
    }
}
