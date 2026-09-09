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
        // Still a fallback, not a free pass: an older row whose client clock is
        // behind ours is the one that gets overwritten. The rounding tolerance
        // (store-8-1) must not swallow a row that genuinely moved backwards.
        let olderWork = Remote(clientUpdatedAt: Self.at(29), serverUpdatedAt: Self.at(40))
        #expect(SnapshotReconciler.decide(local: local, remote: olderWork) == .pushLocal)
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

    // MARK: Row precision (store-7-2)

    @Test func aDeviceReadingBackItsOwnRowIsNotTreatedAsAnotherDevice() {
        // The row encodes `clientUpdatedAt` as ISO-8601 with no fractional seconds,
        // while the sync marker keeps the full-precision `Date` the snapshot
        // carried. Compared raw, the store-6-1 witness fired on the device's OWN
        // row after every single upload, and a clean device applied that row back
        // over itself — clearing the cached daily plan and re-rolling the day at
        // the end of every lesson (store-7-2). These are the exact values the
        // encoder/decoder round trip produces.
        let server = Self.at(20)
        let marker = Date(timeIntervalSince1970: 1_788_969_918.700_553_7)
        let row = Date(timeIntervalSince1970: 1_788_969_918)
        #expect(SnapshotReconciler.isSameClientClock(marker, row))

        let clean = Local(updatedAt: marker, lastSyncedUpdatedAt: marker, lastSyncedServerUpdatedAt: server)
        #expect(SnapshotReconciler.decide(local: clean, remote: Remote(clientUpdatedAt: row, serverUpdatedAt: server)) == .alreadyInSync,
                "our own row read back is not another device's write")

        let dirty = Local(updatedAt: marker.addingTimeInterval(30), lastSyncedUpdatedAt: marker,
                          lastSyncedServerUpdatedAt: server)
        #expect(SnapshotReconciler.decide(local: dirty, remote: Remote(clientUpdatedAt: row, serverUpdatedAt: server)) == .pushLocal,
                "new answers on top of our own row are uploaded, not thrown away")

        // A whole second apart is still someone else's write: the witness must
        // keep catching store-6-1.
        let theirs = Remote(clientUpdatedAt: marker.addingTimeInterval(1.5), serverUpdatedAt: server)
        #expect(!SnapshotReconciler.isSameClientClock(marker, theirs.clientUpdatedAt))
        #expect(SnapshotReconciler.decide(local: clean, remote: theirs) == .applyRemote)
    }

    // MARK: Marker precision (store-8-1)

    @Test func aMarkerThatCameBackFromDefaultsIsStillTheSameInstant() {
        // `CloudSync` writes a sync marker as `date.timeIntervalSince1970` and
        // reads it back with `Date(timeIntervalSince1970:)`. `Date` counts from
        // 2001, so that round trip is `(x + 978307200) - 978307200`, which is not
        // lossless: about half of today's timestamps come back ~1.2e-7 s away.
        // Compared with `==`, a device that had changed nothing read as dirty
        // (needless full re-uploads, and the "couldn't back up your progress"
        // warning on sign-out) and its own untouched row read as moved, which
        // re-rolls the day's plan (store-8-1).
        let live = Date(timeIntervalSinceReferenceDate: 787_654_321.123)
        let stored = Date(timeIntervalSince1970: live.timeIntervalSince1970)
        #expect(stored != live, "this is the value the UserDefaults round trip actually moves")
        #expect(SnapshotReconciler.isSameInstant(live, stored))
        #expect(!SnapshotReconciler.isSameInstant(live, live.addingTimeInterval(1)),
                "a real second of learner activity is never the same instant")

        // (a) A device that has changed nothing since it pushed is not dirty, so
        // sign-out does not warn about progress that is already in the account.
        let clean = Local(updatedAt: live, lastSyncedUpdatedAt: stored, lastSyncedServerUpdatedAt: stored)
        #expect(!clean.isDirty)
        #expect(SnapshotReconciler.isFullyBackedUp(hasPendingChange: false, local: clean))

        // (b) The server marker round-trips the same way; an untouched row must
        // still read as untouched, whichever way the rounding went.
        let remote = Remote(clientUpdatedAt: stored, serverUpdatedAt: live)
        #expect(SnapshotReconciler.decide(local: clean, remote: remote) == .alreadyInSync,
                "a clean device must not apply its own row back over itself")

        // (c) Real work on top of that same row still uploads.
        let dirty = Local(updatedAt: live.addingTimeInterval(45), lastSyncedUpdatedAt: stored,
                          lastSyncedServerUpdatedAt: stored)
        #expect(dirty.isDirty)
        #expect(SnapshotReconciler.decide(local: dirty, remote: remote) == .pushLocal)
    }

    // MARK: Read racing an upload (store-7-1)

    @Test func aReadThatRacedAnUploadIsAbandoned() {
        // The reconcile's SELECT went out while a lesson-end upload was still
        // encoding, so it holds the pre-lesson row while that upload's markers
        // already describe the row it wrote. Deciding on that pairing rolls the
        // finished lesson off the device, so the pass is abandoned instead.
        #expect(SnapshotReconciler.readRacedAnUpload(uploadsBeforeRead: 3, uploadsAfterRead: 4))
        #expect(!SnapshotReconciler.readRacedAnUpload(uploadsBeforeRead: 3, uploadsAfterRead: 3),
                "a quiet read decides normally")
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
