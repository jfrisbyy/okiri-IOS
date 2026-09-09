//
//  SnapshotReconciler.swift
//  FluentFrenchIOS
//
//  The pure "which side is newer?" rule behind CloudSync.reconcile. Foundation
//  only and view-free so the decision can be unit-tested without Supabase.
//
//  Rule (mirrored in backend/types.ts next to `ios_progress_snapshots`):
//    1. No cloud row at all      → push local (first sign-in migration). This is
//       the ONLY situation in which local state is uploaded without comparing.
//    2. Server `updated_at` on both sides is the primary tiebreak. The device
//       remembers the server `updated_at` of the row as of its last successful
//       sync (push or apply) plus the local `updatedAt` at that moment; local is
//       "dirty" when its `updatedAt` has moved since then.
//         - row unchanged on the server (same `updated_at`): dirty → push,
//           clean → already in sync.
//         - row changed on the server: clean → apply the cloud row; dirty →
//           genuine conflict, fall through to the client-clock rule.
//    3. Fallback (no server timestamp on one side, or conflict): compare the
//       snapshots' `clientUpdatedAt`; the cloud wins ties, and a device with no
//       local activity always takes the cloud row.
//

import Foundation

nonisolated enum SnapshotReconciler {

    /// What the device knows about its own copy.
    struct LocalState: Equatable, Sendable {
        /// Client clock of the last local mutation (`AppStore.localUpdatedAt`); nil = no local activity.
        var updatedAt: Date?
        /// `updatedAt` as of the last successful sync with the cloud row, nil = never synced.
        var lastSyncedUpdatedAt: Date?
        /// Server `updated_at` of the cloud row as of that same sync, nil = unknown.
        var lastSyncedServerUpdatedAt: Date?

        init(updatedAt: Date? = nil, lastSyncedUpdatedAt: Date? = nil, lastSyncedServerUpdatedAt: Date? = nil) {
            self.updatedAt = updatedAt
            self.lastSyncedUpdatedAt = lastSyncedUpdatedAt
            self.lastSyncedServerUpdatedAt = lastSyncedServerUpdatedAt
        }

        /// True when the device has mutated state since the last successful sync.
        /// Compared with `isSameInstant`, not `==`: both clocks travel through a
        /// `timeIntervalSince1970` round trip on their way to `UserDefaults`, which
        /// is not lossless (store-8-1).
        var isDirty: Bool {
            guard let updatedAt else { return false }
            guard let lastSyncedUpdatedAt else { return true }
            return !SnapshotReconciler.isSameInstant(updatedAt, lastSyncedUpdatedAt)
        }
    }

    /// What the cloud row says about itself.
    struct RemoteState: Equatable, Sendable {
        /// The snapshot's own `clientUpdatedAt` (client clock of the device that wrote it).
        var clientUpdatedAt: Date
        /// The row's server-side `updated_at`, nil when the column is empty/unparseable.
        var serverUpdatedAt: Date?

        init(clientUpdatedAt: Date, serverUpdatedAt: Date? = nil) {
            self.clientUpdatedAt = clientUpdatedAt
            self.serverUpdatedAt = serverUpdatedAt
        }
    }

    enum Decision: Equatable, Sendable {
        /// Replace local state with the cloud row.
        case applyRemote
        /// Upload local state over the cloud row (or into an empty account).
        case pushLocal
        /// Both sides already hold the same state; nothing to do.
        case alreadyInSync
    }

    /// Decide what reconcile should do. `remote == nil` means the account has no
    /// snapshot row yet (NOT a fetch failure — failures never reach this rule).
    static func decide(local: LocalState, remote: RemoteState?) -> Decision {
        guard let remote else { return .pushLocal }

        if let remoteServer = remote.serverUpdatedAt,
           let lastServer = local.lastSyncedServerUpdatedAt {
            // `isSameInstant`, not `==`: the remembered server timestamp came back
            // from `UserDefaults` through a lossy `timeIntervalSince1970` round
            // trip, so an untouched row compared unequal about half the time and
            // this device applied its own row over itself (store-8-1).
            let serverUnchanged = isSameInstant(remoteServer, lastServer)
            if serverUnchanged {
                // An unchanged server `updated_at` is NOT proof the row has not
                // moved. It only means that while the database trigger that
                // maintains the column is not applied, EVERY write leaves it
                // untouched — so a second device reads "unchanged", pushes, and
                // silently overwrites the first device's progress (store-6-1).
                //
                // The row carries an independent witness: the `clientUpdatedAt`
                // of whichever device wrote it. After any successful sync this
                // device's `lastSyncedUpdatedAt` equals that value (a push saves
                // the snapshot's own clock; an apply adopts the row's clock and
                // saves that). So if they now differ, another device owns the
                // row, whatever the server timestamp claims — and the correct
                // reading is the same as for a row that visibly moved. "Differ"
                // is measured at the row's own precision (`isSameClientClock`).
                if let lastSynced = local.lastSyncedUpdatedAt,
                   !isSameClientClock(remote.clientUpdatedAt, lastSynced) {
                    return local.isDirty ? byClientClock(local: local, remote: remote) : .applyRemote
                }
                return local.isDirty ? .pushLocal : .alreadyInSync
            }
            if remoteServer > lastServer {
                // The cloud row moved since this device last synced.
                if !local.isDirty { return .applyRemote }
                // Both sides moved: fall through to the client-clock tiebreak.
            }
        }

        return byClientClock(local: local, remote: remote)
    }

    /// True when two client clocks are the same clock as far as the cloud row can
    /// tell. The row carries `clientUpdatedAt` as ISO-8601 with NO fractional
    /// seconds (`CloudSync.encodeForUpload` uses `.iso8601`), while the sync marker
    /// keeps the in-memory `Date` at full precision. Comparing them raw therefore
    /// reported a difference after every single upload — the witness above read
    /// that as "another device owns this row", and a clean device applied its own
    /// row back over itself after every lesson, wiping the cached daily plan and
    /// re-rolling the day (store-7-2). Whole seconds is the precision the two
    /// values can actually agree on.
    static func isSameClientClock(_ a: Date, _ b: Date) -> Bool {
        a.timeIntervalSince1970.rounded(.down) == b.timeIntervalSince1970.rounded(.down)
    }

    /// True when two `Date`s name the same instant as far as the sync markers can
    /// tell. `CloudSync` persists a marker as `date.timeIntervalSince1970` and
    /// reads it back with `Date(timeIntervalSince1970:)`; `Date` counts from 2001,
    /// so that round trip is `(x + 978307200) - 978307200`, which loses about
    /// 1e-7 s on roughly half of today's timestamps. Compared with `==`, a device
    /// that had changed nothing read as dirty (a needless re-upload, and the
    /// "couldn't back up your progress" warning on sign-out), and an untouched
    /// cloud row read as moved — which makes a clean device apply its OWN row and
    /// re-roll the day's plan (store-8-1). `markerInstantTolerance` is far below
    /// the gap between two real learner actions, so a genuine change is never
    /// mistaken for the same instant.
    static func isSameInstant(_ a: Date, _ b: Date) -> Bool {
        abs(a.timeIntervalSinceReferenceDate - b.timeIntervalSinceReferenceDate) < Tuning.markerInstantTolerance
    }

    /// True when an upload finished while a reconcile's read of the row was still
    /// in flight, counted with `CloudSync`'s upload counter (before the read vs
    /// after it). The pass must then be abandoned rather than decided: its SELECT
    /// went out before that upload's UPSERT, so it holds the PRE-upload row, while
    /// the upload's sync markers — saved before the read returned — describe the
    /// POST-upload one. Together they read as "clean device, row owned by someone
    /// else", i.e. `.applyRemote`, which rolls the just-finished lesson off the
    /// device (store-7-1).
    static func readRacedAnUpload(uploadsBeforeRead: Int, uploadsAfterRead: Int) -> Bool {
        uploadsBeforeRead != uploadsAfterRead
    }

    /// True when this device's record is already the one in the cloud row: no
    /// upload is pending and nothing has been mutated since the last successful
    /// sync with that account. Sign-out uses it so a fully backed-up device is
    /// not refused (and the learner warned that unsynced progress will be lost)
    /// merely because it happens to be offline (store-3-2). Note that `local`
    /// carries no sync markers when they belong to a different account, which
    /// makes any local activity dirty — the safe answer.
    static func isFullyBackedUp(hasPendingChange: Bool, local: LocalState) -> Bool {
        !hasPendingChange && !local.isDirty
    }

    /// True when the record moved after the snapshot that was just uploaded was
    /// taken — an answer saved during the network round trip. That answer is not
    /// in the row the server now holds, so the device still owes an upload
    /// (store-5-2). `uploaded` is the snapshot's client clock; `current` is the
    /// store's clock read after the upload returned.
    static func recordMovedDuringUpload(uploaded: Date, current: Date?) -> Bool {
        guard let current else { return false }
        return current > uploaded
    }

    /// Client-clock fallback: newest activity wins, cloud wins ties, and a device
    /// with no local activity always takes the cloud row.
    static func byClientClock(local: LocalState, remote: RemoteState) -> Decision {
        guard let localUpdatedAt = local.updatedAt else { return .applyRemote }
        return remote.clientUpdatedAt >= localUpdatedAt ? .applyRemote : .pushLocal
    }
}

/// Parses the `timestamptz` strings PostgREST returns for `updated_at`
/// (e.g. "2026-09-05T12:34:56.123456+00:00"). Foundation's ISO 8601 formatter
/// only accepts millisecond fractions, so the fraction is normalised first.
nonisolated enum PostgresTimestamp {
    static func parse(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]

        // PostgREST may emit a space separator and omit the "T"; normalise it.
        var text = raw.replacingOccurrences(of: " ", with: "T")
        // A bare "+00" zone (no minutes) is legal in Postgres but not ISO 8601.
        if text.contains("T"),
           let zone = text.range(of: #"[+-]\d{2}$"#, options: .regularExpression) {
            text = String(text[..<zone.lowerBound]) + text[zone] + ":00"
        }

        if let date = plain.date(from: text) { return date }
        if let date = withFraction.date(from: text) { return date }

        // Trim or pad the fraction to exactly three digits.
        guard let dot = text.firstIndex(of: "."),
              let zoneStart = text[dot...].firstIndex(where: { $0 == "Z" || $0 == "+" || $0 == "-" })
        else { return nil }
        var fraction = String(text[text.index(after: dot)..<zoneStart])
        if fraction.count > 3 { fraction = String(fraction.prefix(3)) }
        while fraction.count < 3 { fraction += "0" }
        let normalised = String(text[..<dot]) + "." + fraction + String(text[zoneStart...])
        return withFraction.date(from: normalised)
    }
}
