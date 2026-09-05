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
        var isDirty: Bool {
            guard let updatedAt else { return false }
            guard let lastSyncedUpdatedAt else { return true }
            return updatedAt != lastSyncedUpdatedAt
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
           let lastServer = local.lastSyncedServerUpdatedAt,
           remoteServer >= lastServer {
            if remoteServer == lastServer {
                return local.isDirty ? .pushLocal : .alreadyInSync
            }
            // The cloud row moved since this device last synced.
            if !local.isDirty { return .applyRemote }
            // Both sides moved: fall through to the client-clock tiebreak.
        }

        return byClientClock(local: local, remote: remote)
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
