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
        // Genuinely unchanged: the server timestamp has not moved AND the row still
        // carries the client clock this device synced with, so it is still our row
        // and our newer work belongs on top of it.
        let local = Local(updatedAt: Self.at(30), lastSyncedUpdatedAt: Self.at(10), lastSyncedServerUpdatedAt: Self.at(20))
        let remote = Remote(clientUpdatedAt: Self.at(10), serverUpdatedAt: Self.at(20))
        #expect(SnapshotReconciler.decide(local: local, remote: remote) == .pushLocal)
    }

    @Test func anotherDevicesWriteIsNotOverwrittenWhenTheServerTimestampNeverMoves() {
        // store-6-1. While the trigger that maintains `updated_at` is not applied,
        // every write leaves the column untouched, so "unchanged" is what a second
        // device ALWAYS reads. Taking that as proof the row has not moved made this
        // device push straight over the other device's progress. The row's own
        // `clientUpdatedAt` is the witness that catches it: after any successful
        // sync it equals `lastSyncedUpdatedAt`, so a different value means someone
        // else wrote the row.
        let server = Self.at(20)

        // Clean device, another device's row: adopt it rather than clobber it.
        let clean = Local(updatedAt: Self.at(10), lastSyncedUpdatedAt: Self.at(10), lastSyncedServerUpdatedAt: server)
        let theirs = Remote(clientUpdatedAt: Self.at(900), serverUpdatedAt: server)
        #expect(SnapshotReconciler.decide(local: clean, remote: theirs) == .applyRemote,
                "a clean device must never overwrite work another device wrote")

        // Both sides moved: a genuine conflict, resolved on the client clocks.
        let dirty = Local(updatedAt: Self.at(30), lastSyncedUpdatedAt: Self.at(10), lastSyncedServerUpdatedAt: server)
        #expect(SnapshotReconciler.decide(local: dirty, remote: theirs) == .applyRemote,
                "their clock is newer, so their row wins the tiebreak")
        let older = Remote(clientUpdatedAt: Self.at(12), serverUpdatedAt: server)
        #expect(SnapshotReconciler.decide(local: dirty, remote: older) == .pushLocal,
                "our clock is newer, so our work wins the tiebreak")
    }

    @Test func aDeviceThatHasNeverSyncedCannotUseTheClientClockWitness() {
        // With no `lastSyncedUpdatedAt` there is nothing to compare the row's clock
        // against, so the decision must fall through to the existing rules rather
        // than guess. A device with no local activity still takes the cloud row.
        let local = Local(updatedAt: nil, lastSyncedUpdatedAt: nil, lastSyncedServerUpdatedAt: Self.at(20))
        let remote = Remote(clientUpdatedAt: Self.at(900), serverUpdatedAt: Self.at(20))
        #expect(SnapshotReconciler.decide(local: local, remote: remote) == .alreadyInSync)
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

    // MARK: Change during an upload (store-5-2)

    @Test func anAnswerSavedDuringTheUploadStaysPending() {
        // The snapshot goes out at t=10; the round trip lands at t=13 with an
        // answer saved at t=12 that the row does not contain.
        #expect(SnapshotReconciler.recordMovedDuringUpload(uploaded: Self.at(10), current: Self.at(12)),
                "an answer saved mid-upload is not in the row that was just written")
        #expect(!SnapshotReconciler.recordMovedDuringUpload(uploaded: Self.at(10), current: Self.at(10)),
                "the snapshot that was uploaded is backed up")
        #expect(!SnapshotReconciler.recordMovedDuringUpload(uploaded: Self.at(10), current: Self.at(9)),
                "an older clock is never an unsynced change")
        #expect(!SnapshotReconciler.recordMovedDuringUpload(uploaded: Self.at(10), current: nil),
                "a device with no local activity owes nothing")
    }

    // MARK: Deferred restore (store-4-1)

    /// "Continue on this device" hands the ordinary reconcile rule a record it
    /// cannot judge (see `ordinaryReconcileRuleCannotTellAGuttedStoreFromAGoodOne`
    /// in StoreTests). The only thing that stops the gutted record from winning is
    /// the deferred-restore marker, so it has to be on disk, not in a field that a
    /// relaunch drops.
    @Test func deferredRestoreSurvivesARelaunch() {
        let scratch = ScratchDefaults()
        let marker = DeferredRestoreMarker(defaults: scratch.defaults)
        #expect(marker.userId == nil)
        #expect(!marker.isPending(for: "learner-1"))

        marker.set(userId: "learner-1")

        // A brand-new CloudSync on the next launch builds a brand-new marker over
        // the same defaults: the debt is still recorded.
        let afterRelaunch = DeferredRestoreMarker(defaults: scratch.defaults)
        #expect(afterRelaunch.isPending(for: "learner-1"))
        #expect(afterRelaunch.userId == "learner-1")
    }

    /// Scoped to the account that deferred: another learner signing in on this
    /// device must still get the honest "couldn't reach your account" screen
    /// rather than inheriting someone else's recovery state.
    @Test func deferredRestoreIsScopedToTheAccountThatDeferredIt() {
        let scratch = ScratchDefaults()
        let marker = DeferredRestoreMarker(defaults: scratch.defaults)
        marker.set(userId: "learner-1")
        #expect(marker.isPending(for: "learner-1"))
        #expect(!marker.isPending(for: "learner-2"))
    }

    /// Cleared only where the debt is settled — a pass that actually read the
    /// account row, or a sign-out that wipes the record the marker describes.
    @Test func clearingTheDeferredRestoreForgetsIt() {
        let scratch = ScratchDefaults()
        let marker = DeferredRestoreMarker(defaults: scratch.defaults)
        marker.set(userId: "learner-1")
        marker.clear()
        #expect(!marker.isPending(for: "learner-1"))
        #expect(DeferredRestoreMarker(defaults: scratch.defaults).userId == nil,
                "and it stays forgotten across a relaunch")
    }

    /// The marker lives beside the sync markers CloudSync already writes, and its
    /// key is part of the on-disk contract: renaming it silently re-opens
    /// store-4-1 for anyone mid-recovery when they update the app.
    @Test func deferredRestoreKeyIsStable() {
        #expect(DeferredRestoreMarker.key == "ff.cloud.pendingRemoteRestore.v1")
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
