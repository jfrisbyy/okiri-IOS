//
//  LaunchBudgetTests.swift
//  FluentFrenchIOSTests
//
//  UX-09 — a cold launch is not blocked on the network. A learner whose record is
//  on the device enters once `Tuning.launchReconcileBudget` has passed while the
//  sign-in reconcile finishes in the background; its result is still applied
//  under the foreground guards (lesson in progress, newer local work, a fetch
//  error is never "no row"). A learner with nothing on the device keeps waiting
//  and, past `Tuning.launchOfflineOfferDelay`, is offered "Continue offline".
//

import Foundation
import Testing
@testable import FluentFrenchIOS

/// Holds every read of the account row open until the test releases it.
@MainActor
final class HeldFetch {
    private var waiting: CheckedContinuation<RemoteFetch, Never>?
    private(set) var reads = 0

    func install(on cloud: CloudSync) {
        cloud.fetchOverride = { [self] _ in
            reads += 1
            return await withCheckedContinuation { waiting = $0 }
        }
    }

    var isHolding: Bool { waiting != nil }

    func release(_ result: RemoteFetch) {
        waiting?.resume(returning: result)
        waiting = nil
    }
}

@MainActor
struct LaunchBudgetTests {
    /// The suite runs alongside hundreds of other main-actor tests, so nothing
    /// here asserts on wall-clock timing: the timer is switched off and the wait
    /// is stepped with `launchCheckpoint`, exactly as the timer steps it. One test
    /// runs the real timer with short timings and only checks that it eventually
    /// opens the gate.
    private let budget: TimeInterval = 1
    private let offerDelay: TimeInterval = 2

    private func waitUntil(_ condition: () -> Bool) async {
        // A generous ceiling, not a timing assertion: Swift Testing runs suites in
        // parallel, and the 60-day HeadlessDriver simulations hold the main actor for
        // about two minutes on the 82-concept curriculum. A 60-second ceiling let
        // that starvation fail these waits (and then hang on the never-released
        // fetch). The ceiling only exists so a genuine hang still ends the test.
        let deadline = ContinuousClock.now.advanced(by: .seconds(600))
        while !condition(), ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(10))
        }
    }

    /// Start the launch pass and wait until its read is on the wire.
    private func startLaunch(_ cloud: CloudSync, _ store: AppStore, _ fetch: HeldFetch) async -> Task<Void, Never> {
        let task = Task { await cloud.reconcileAtLaunch(store: store, userId: "user-1") }
        await waitUntil { fetch.isHolding }
        return task
    }

    private func budgetRunsOut(_ cloud: CloudSync, _ store: AppStore) {
        cloud.launchCheckpoint(store: store, userId: "user-1", elapsed: budget)
    }

    private func offerDelayPasses(_ cloud: CloudSync, _ store: AppStore) {
        cloud.launchCheckpoint(store: store, userId: "user-1", elapsed: offerDelay)
    }

    private func makeCloud(_ scratch: ScratchDefaults) -> (CloudSync, HeldFetch, UploadRecorder) {
        let cloud = CloudSync(defaults: scratch.defaults)
        cloud.launchReconcileBudget = budget
        cloud.launchOfflineOfferDelay = offerDelay
        cloud.runsLaunchTimer = false
        let fetch = HeldFetch()
        fetch.install(on: cloud)
        let uploads = UploadRecorder()
        uploads.install(on: cloud)
        return (cloud, fetch, uploads)
    }

    /// A device that already holds `user-1`'s record.
    private func storeWithARecord(_ scratch: ScratchDefaults) -> AppStore {
        let store = AppStore(persistence: scratch.defaults)
        store.beginSession(userId: "user-1")
        store.gaps = [EngineFixtures.gap("local", concept: nil)]
        store.save()
        return store
    }

    /// The account row: another device's record, written at `at`.
    private func remoteRow(gapId: String, at: Date) -> RemoteFetch {
        let other = AppStore(persistence: nil)
        other.gaps = [EngineFixtures.gap(gapId, concept: nil)]
        other.localUpdatedAt = at
        return .snapshot(other.makeSnapshot(), serverUpdatedAt: at)
    }

    // MARK: The timing rule

    @Test func tuningOffersOfflineOnlyAfterTheBudget() {
        #expect(Tuning.launchReconcileBudget > 0)
        #expect(Tuning.launchOfflineOfferDelay > Tuning.launchReconcileBudget)
    }

    @Test func aLocalRecordEntersOnceTheBudgetRunsOut() {
        let budget = Tuning.launchReconcileBudget
        #expect(LaunchBudget.step(elapsed: 0, hasUsableLocalRecord: true) == .keepWaiting)
        #expect(LaunchBudget.step(elapsed: budget - 0.1, hasUsableLocalRecord: true) == .keepWaiting)
        #expect(LaunchBudget.step(elapsed: budget, hasUsableLocalRecord: true) == .enterWithLocalRecord)
        #expect(LaunchBudget.step(elapsed: Tuning.launchOfflineOfferDelay, hasUsableLocalRecord: true)
                == .enterWithLocalRecord)
    }

    @Test func nothingOnTheDeviceWaitsThenOffersOffline() {
        #expect(LaunchBudget.step(elapsed: Tuning.launchReconcileBudget, hasUsableLocalRecord: false)
                == .keepWaiting, "there is nothing to show")
        #expect(LaunchBudget.step(elapsed: Tuning.launchOfflineOfferDelay - 0.1, hasUsableLocalRecord: false)
                == .keepWaiting)
        #expect(LaunchBudget.step(elapsed: Tuning.launchOfflineOfferDelay, hasUsableLocalRecord: false)
                == .offerOfflineContinue)
    }

    @Test func aUsableRecordIsExactlyWhatAFailedReadWouldLetIn() {
        let scratch = ScratchDefaults()
        let cloud = CloudSync(defaults: scratch.defaults)
        let empty = AppStore(persistence: scratch.defaults)
        #expect(cloud.canContinueWithoutAccount(store: empty, userId: "user-1") == false)

        DeferredRestoreMarker(defaults: scratch.defaults).set(userId: "user-1")
        #expect(cloud.canContinueWithoutAccount(store: empty, userId: "user-1"),
                "the learner already chose to carry on with this device (store-1-6)")
        #expect(cloud.canContinueWithoutAccount(store: empty, userId: "user-2") == false)

        let other = ScratchDefaults()
        #expect(CloudSync(defaults: other.defaults)
            .canContinueWithoutAccount(store: storeWithARecord(other), userId: "user-1"))
    }

    // MARK: A record on the device

    @Test func aLocalRecordEntersWhileTheReadFinishesInTheBackground() async {
        let scratch = ScratchDefaults()
        let store = storeWithARecord(scratch)
        let (cloud, fetch, uploads) = makeCloud(scratch)
        #expect(cloud.launchGate(for: "user-1") == .loading)

        let launch = await startLaunch(cloud, store, fetch)
        #expect(cloud.launchGate(for: "user-1") == .loading, "inside the budget the launch still waits")
        budgetRunsOut(cloud, store)
        #expect(cloud.launchGate(for: "user-1") == .ready, "the budget ran out with the read still open")
        #expect(fetch.isHolding)
        #expect(cloud.isReconciling == false, "onboarding is decided on the local record")
        #expect(cloud.userId == nil, "uploads stay off until the row has been read")

        // Nothing changed here since; the row moved on another device.
        let lastLocal = store.localUpdatedAt!
        fetch.release(remoteRow(gapId: "remote", at: lastLocal.addingTimeInterval(60)))
        await launch.value
        #expect(store.gaps.map(\.id) == ["remote"], "a newer row still reaches the device")
        #expect(cloud.userId == "user-1", "the finished pass enables uploads")
        #expect(cloud.launchGate(for: "user-1") == .ready)
        #expect(uploads.count == 0)
    }

    @Test func aCheckpointAfterTheReadFinishedDoesNothing() async {
        let scratch = ScratchDefaults()
        let store = storeWithARecord(scratch)
        let (cloud, fetch, _) = makeCloud(scratch)
        let launch = await startLaunch(cloud, store, fetch)
        fetch.release(.none)
        await launch.value
        #expect(cloud.launchGate(for: "user-1") == .ready)
        // A checkpoint that fires after the pass finished changes nothing.
        offerDelayPasses(cloud, store)
        #expect(cloud.offersOfflineContinue == false)
        #expect(cloud.userId == "user-1")
    }

    @Test func newerLocalWorkIsNotOverwrittenByTheBackgroundResult() async {
        let scratch = ScratchDefaults()
        let store = storeWithARecord(scratch)
        let (cloud, fetch, uploads) = makeCloud(scratch)
        let launch = await startLaunch(cloud, store, fetch)
        budgetRunsOut(cloud, store)
        #expect(cloud.launchGate(for: "user-1") == .ready)

        // The row was written before the learner's answer on this device.
        let rowWrittenAt = Date().addingTimeInterval(-60)
        store.gaps.append(EngineFixtures.gap("answered-after-entering", concept: nil))
        store.save()
        fetch.release(remoteRow(gapId: "remote", at: rowWrittenAt))
        await launch.value
        #expect(store.gaps.map(\.id) == ["local", "answered-after-entering"])
        #expect(uploads.count == 1, "the newer device record is pushed instead")
        #expect(cloud.userId == "user-1")
    }

    @Test func aLessonOpenedMeanwhileDefersTheBackgroundResult() async {
        let scratch = ScratchDefaults()
        let store = storeWithARecord(scratch)
        let (cloud, fetch, uploads) = makeCloud(scratch)
        let launch = await startLaunch(cloud, store, fetch)
        budgetRunsOut(cloud, store)
        #expect(cloud.launchGate(for: "user-1") == .ready)

        store.beginLesson()
        fetch.release(remoteRow(gapId: "remote", at: store.localUpdatedAt!.addingTimeInterval(60)))
        await launch.value
        #expect(store.gaps.map(\.id) == ["local"], "nothing is swapped out under the open lesson (store-1-3)")
        #expect(cloud.userId == nil, "the row was not settled, so uploads stay off")
        #expect(uploads.count == 0)
        #expect(cloud.launchGate(for: "user-1") == .ready, "the learner stays in the app")
        if case .failed = cloud.syncState { Issue.record("a deferred pass is not a failure") }

        // Closing the lesson is what ContentView reruns it on.
        store.endLesson()
        #expect(cloud.shouldReconcileOnForeground(userId: "user-1"))
        let rerun = Task { await cloud.reconcile(store: store, userId: "user-1", initial: false) }
        await waitUntil { fetch.isHolding }
        fetch.release(remoteRow(gapId: "remote", at: store.localUpdatedAt!.addingTimeInterval(60)))
        await rerun.value
        #expect(store.gaps.map(\.id) == ["remote"])
        #expect(cloud.userId == "user-1")
    }

    @Test func aFailedReadAfterEnteringIsNeverTreatedAsNoRow() async {
        let scratch = ScratchDefaults()
        let store = storeWithARecord(scratch)
        let (cloud, fetch, uploads) = makeCloud(scratch)
        let launch = await startLaunch(cloud, store, fetch)
        budgetRunsOut(cloud, store)
        #expect(cloud.launchGate(for: "user-1") == .ready)
        // Not retryable, so the pass reports at once.
        fetch.release(.failed(SnapshotUndecodable(underlying: "test")))
        await launch.value
        #expect(uploads.count == 0, "nothing is pushed over an account that could not be read")
        #expect(cloud.userId == nil)
        #expect(cloud.launchGate(for: "user-1") == .ready, "the learner keeps their record")
        #expect(store.gaps.map(\.id) == ["local"])
    }

    @Test func theRealTimerOpensTheGate() async {
        let scratch = ScratchDefaults()
        let store = storeWithARecord(scratch)
        let (cloud, fetch, _) = makeCloud(scratch)
        cloud.launchReconcileBudget = 0.05
        cloud.launchOfflineOfferDelay = 0.1
        cloud.runsLaunchTimer = true
        let launch = await startLaunch(cloud, store, fetch)
        await waitUntil { cloud.launchGate(for: "user-1") == .ready }
        #expect(cloud.launchGate(for: "user-1") == .ready)
        #expect(fetch.isHolding, "the read is still open in the background")
        fetch.release(.none)
        await launch.value
        #expect(cloud.userId == "user-1")
    }

    // MARK: Nothing on the device

    @Test func nothingOnTheDeviceWaitsThenOffersToContinueOffline() async {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        store.beginSession(userId: "user-1")
        let (cloud, fetch, _) = makeCloud(scratch)
        let launch = await startLaunch(cloud, store, fetch)
        budgetRunsOut(cloud, store)
        #expect(cloud.launchGate(for: "user-1") == .loading, "past the budget, still nothing to show")
        offerDelayPasses(cloud, store)
        #expect(cloud.launchGate(for: "user-1") == .stillSyncing)

        cloud.continueOfflineAtLaunch(store: store, userId: "user-1")
        #expect(cloud.launchGate(for: "user-1") == .ready)
        #expect(cloud.offersOfflineContinue == false)

        // The learner starts placing offline: a fresh record, newer than the row.
        store.gaps = [EngineFixtures.gap("offline", concept: nil)]
        store.save()
        fetch.release(remoteRow(gapId: "account", at: Date().addingTimeInterval(-3600)))
        await launch.value
        #expect(store.gaps.map(\.id) == ["account"],
                "the account's real record wins over what was done offline; never pushed over it")
        #expect(DeferredRestoreMarker(defaults: scratch.defaults).isPending(for: "user-1") == false,
                "the row was read, so nothing is owed any more")
        #expect(cloud.userId == "user-1")
    }

    @Test func aNewLearnerWhoContinuedOfflineUploadsIntoTheEmptyAccount() async {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        store.beginSession(userId: "user-1")
        let (cloud, fetch, uploads) = makeCloud(scratch)
        let launch = await startLaunch(cloud, store, fetch)
        offerDelayPasses(cloud, store)
        #expect(cloud.launchGate(for: "user-1") == .stillSyncing)
        cloud.continueOfflineAtLaunch(store: store, userId: "user-1")
        store.gaps = [EngineFixtures.gap("offline", concept: nil)]
        store.save()
        fetch.release(.none)
        await launch.value
        #expect(store.gaps.map(\.id) == ["offline"])
        #expect(uploads.count == 1)
        #expect(cloud.userId == "user-1")
    }

    @Test func continuingOfflineThenFailingTheReadKeepsTheLearnerIn() async {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        store.beginSession(userId: "user-1")
        let (cloud, fetch, uploads) = makeCloud(scratch)
        let launch = await startLaunch(cloud, store, fetch)
        offerDelayPasses(cloud, store)
        #expect(cloud.launchGate(for: "user-1") == .stillSyncing)
        cloud.continueOfflineAtLaunch(store: store, userId: "user-1")
        fetch.release(.failed(SnapshotUndecodable(underlying: "test")))
        await launch.value
        #expect(cloud.launchGate(for: "user-1") == .ready)
        #expect(uploads.count == 0)
        #expect(DeferredRestoreMarker(defaults: scratch.defaults).isPending(for: "user-1"),
                "the next pass that reads the row still applies the account copy")
    }

    @Test func withoutContinuingOfflineAFailedReadStillBlocks() async {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        store.beginSession(userId: "user-1")
        let (cloud, fetch, _) = makeCloud(scratch)
        let launch = await startLaunch(cloud, store, fetch)
        offerDelayPasses(cloud, store)
        #expect(cloud.launchGate(for: "user-1") == .stillSyncing)
        fetch.release(.failed(SnapshotUndecodable(underlying: "test")))
        await launch.value
        #expect(cloud.launchGate(for: "user-1") == .accountUnreachable)
        #expect(cloud.offersOfflineContinue == false, "the offer ends with the wait")
    }

    @Test func signingOutEndsTheLaunchWait() async {
        let scratch = ScratchDefaults()
        let store = AppStore(persistence: scratch.defaults)
        store.beginSession(userId: "user-1")
        let (cloud, fetch, _) = makeCloud(scratch)
        let launch = await startLaunch(cloud, store, fetch)
        offerDelayPasses(cloud, store)
        #expect(cloud.launchGate(for: "user-1") == .stillSyncing)
        cloud.setUser(nil)
        #expect(cloud.offersOfflineContinue == false)
        cloud.continueOfflineAtLaunch(store: store, userId: "user-1")
        #expect(DeferredRestoreMarker(defaults: scratch.defaults).isPending(for: "user-1") == false,
                "a stale button press does nothing")
        fetch.release(.none)
        await launch.value
        #expect(cloud.userId == nil)
    }
}
