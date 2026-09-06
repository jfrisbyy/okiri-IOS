//
//  SnapshotReconcilerTests.swift
//  FluentFrenchIOSTests
//
//  The cloud reconcile rule: local state is only ever uploaded over nothing or
//  over a row it has already seen; server `updated_at` beats device clocks.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct SnapshotReconcilerTests {
    typealias Local = SnapshotReconciler.LocalState
    typealias Remote = SnapshotReconciler.RemoteState

    nonisolated static let t0 = Date(timeIntervalSince1970: 1_800_000_000)
    nonisolated static func at(_ seconds: TimeInterval) -> Date { t0.addingTimeInterval(seconds) }

    // MARK: No cloud row

    @Test func noCloudRowMigratesLocalUp() {
        #expect(SnapshotReconciler.decide(local: Local(updatedAt: Self.at(10)), remote: nil) == .pushLocal)
        #expect(SnapshotReconciler.decide(local: Local(), remote: nil) == .pushLocal, "even an empty device creates the row")
    }

    // MARK: Server-timestamp rule

    @Test func unchangedRowAndCleanDeviceIsAlreadyInSync() {
        let local = Local(updatedAt: Self.at(10), lastSyncedUpdatedAt: Self.at(10), lastSyncedServerUpdatedAt: Self.at(20))
        let remote = Remote(clientUpdatedAt: Self.at(10), serverUpdatedAt: Self.at(20))
        #expect(SnapshotReconciler.decide(local: local, remote: remote) == .alreadyInSync)
    }

    @Test func unchangedRowAndDirtyDevicePushes() {
        let local = Local(updatedAt: Self.at(30), lastSyncedUpdatedAt: Self.at(10), lastSyncedServerUpdatedAt: Self.at(20))
        // The cloud snapshot's client clock is deliberately AHEAD of the device: the
        // server timestamp proves the row has not moved, so the device's work wins.
        let remote = Remote(clientUpdatedAt: Self.at(1_000), serverUpdatedAt: Self.at(20))
        #expect(SnapshotReconciler.decide(local: local, remote: remote) == .pushLocal)
    }

    @Test func movedRowAndCleanDeviceAppliesRemote() {
        let local = Local(updatedAt: Self.at(10), lastSyncedUpdatedAt: Self.at(10), lastSyncedServerUpdatedAt: Self.at(20))
        // Another device wrote later on the server even though its clock is behind ours.
        let remote = Remote(clientUpdatedAt: Self.at(5), serverUpdatedAt: Self.at(40))
        #expect(SnapshotReconciler.decide(local: local, remote: remote) == .applyRemote)
    }

    @Test func movedRowAndDirtyDeviceFallsBackToClientClocks() {
        let local = Local(updatedAt: Self.at(30), lastSyncedUpdatedAt: Self.at(10), lastSyncedServerUpdatedAt: Self.at(20))
        let newerRemote = Remote(clientUpdatedAt: Self.at(35), serverUpdatedAt: Self.at(40))
        let olderRemote = Remote(clientUpdatedAt: Self.at(25), serverUpdatedAt: Self.at(40))
        #expect(SnapshotReconciler.decide(local: local, remote: newerRemote) == .applyRemote)
        #expect(SnapshotReconciler.decide(local: local, remote: olderRemote) == .pushLocal)
    }

    @Test func serverTimestampOlderThanRememberedFallsBackToClientClocks() {
        // A restored/rewritten row: the remembered server timestamp is no longer trustworthy.
        let local = Local(updatedAt: Self.at(30), lastSyncedUpdatedAt: Self.at(30), lastSyncedServerUpdatedAt: Self.at(50))
        let remote = Remote(clientUpdatedAt: Self.at(31), serverUpdatedAt: Self.at(40))
        #expect(SnapshotReconciler.decide(local: local, remote: remote) == .applyRemote)
    }

    // MARK: Client-clock fallback

    @Test func freshDeviceAlwaysTakesTheCloudRow() {
        let remote = Remote(clientUpdatedAt: .distantPast, serverUpdatedAt: nil)
        #expect(SnapshotReconciler.decide(local: Local(), remote: remote) == .applyRemote)
    }

    @Test func withoutServerTimestampsNewestClientClockWinsAndCloudWinsTies() {
        let local = Local(updatedAt: Self.at(10))
        #expect(SnapshotReconciler.decide(local: local, remote: Remote(clientUpdatedAt: Self.at(10))) == .applyRemote, "tie → cloud")
        #expect(SnapshotReconciler.decide(local: local, remote: Remote(clientUpdatedAt: Self.at(11))) == .applyRemote)
        #expect(SnapshotReconciler.decide(local: local, remote: Remote(clientUpdatedAt: Self.at(9))) == .pushLocal)
    }

    @Test func missingServerTimestampOnEitherSideUsesClientClocks() {
        let localNoServer = Local(updatedAt: Self.at(10), lastSyncedUpdatedAt: Self.at(10))
        #expect(SnapshotReconciler.decide(local: localNoServer, remote: Remote(clientUpdatedAt: Self.at(9), serverUpdatedAt: Self.at(20))) == .pushLocal)
        let localWithServer = Local(updatedAt: Self.at(10), lastSyncedUpdatedAt: Self.at(10), lastSyncedServerUpdatedAt: Self.at(20))
        #expect(SnapshotReconciler.decide(local: localWithServer, remote: Remote(clientUpdatedAt: Self.at(9), serverUpdatedAt: nil)) == .pushLocal)
    }

    @Test func dirtinessTracksTheLastSyncedLocalClock() {
        #expect(!Local().isDirty)
        #expect(Local(updatedAt: Self.at(1)).isDirty, "activity but never synced")
        #expect(!Local(updatedAt: Self.at(1), lastSyncedUpdatedAt: Self.at(1)).isDirty)
        #expect(Local(updatedAt: Self.at(2), lastSyncedUpdatedAt: Self.at(1)).isDirty)
    }

    // MARK: Sign-out safety (store-3-2)

    @Test func fullyBackedUpOnlyWhenNothingPendingAndNothingMovedSinceTheLastSync() {
        let synced = Local(updatedAt: Self.at(10), lastSyncedUpdatedAt: Self.at(10), lastSyncedServerUpdatedAt: Self.at(20))
        #expect(SnapshotReconciler.isFullyBackedUp(hasPendingChange: false, local: synced),
                "a device whose record has not moved since its last upload signs out cleanly offline")
        #expect(!SnapshotReconciler.isFullyBackedUp(hasPendingChange: true, local: synced),
                "a debounced upload still waiting means progress would be lost")

        let answeredSince = Local(updatedAt: Self.at(30), lastSyncedUpdatedAt: Self.at(10), lastSyncedServerUpdatedAt: Self.at(20))
        #expect(!SnapshotReconciler.isFullyBackedUp(hasPendingChange: false, local: answeredSince),
                "local activity after the last sync is unsynced progress even if nothing flagged it")

        // Markers from another account are dropped by CloudSync.localState, so any
        // local activity reads as dirty and the upload must be attempted.
        #expect(!SnapshotReconciler.isFullyBackedUp(hasPendingChange: false, local: Local(updatedAt: Self.at(1))))
        #expect(SnapshotReconciler.isFullyBackedUp(hasPendingChange: false, local: Local()),
                "a device with no activity at all has nothing to back up")
    }

    // MARK: Postgres timestamps

    @Test func parsesPostgrestTimestampVariants() throws {
        let expected = Date(timeIntervalSince1970: 1_800_000_000)
        let micro = try #require(PostgresTimestamp.parse("2027-01-15T08:00:00.123456+00:00"))
        #expect(abs(micro.timeIntervalSince(expected) - 0.123) < 0.001)
        let millis = try #require(PostgresTimestamp.parse("2027-01-15T08:00:00.5Z"))
        #expect(abs(millis.timeIntervalSince(expected) - 0.5) < 0.001)
        let plain = try #require(PostgresTimestamp.parse("2027-01-15T08:00:00+00:00"))
        #expect(plain == expected)
        let spaced = try #require(PostgresTimestamp.parse("2027-01-15 08:00:00.25+00"))
        #expect(abs(spaced.timeIntervalSince(expected) - 0.25) < 0.001)
        #expect(PostgresTimestamp.parse(nil) == nil)
        #expect(PostgresTimestamp.parse("") == nil)
        #expect(PostgresTimestamp.parse("not a date") == nil)
    }
}
