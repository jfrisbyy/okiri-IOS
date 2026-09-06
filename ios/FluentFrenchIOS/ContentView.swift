//
//  ContentView.swift
//  FluentFrenchIOS
//
//  Auth gate + cloud-sync coordinator. Nothing opens until the learner is signed
//  in; once they are, their progress is reconciled with the cloud BEFORE any
//  screen that reads it (RootView, onboarding) appears, and continuously backed
//  up as they use the app. Also owns the app lifecycle hooks: flush + upload on
//  background, reconcile again on foreground.
//

import SwiftUI

struct ContentView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(AppStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @State private var cloud = CloudSync()
    /// Tracks whether a session was live, so we only act on a real sign-out —
    /// never on the first-launch (pre-login) screen, which must keep any existing
    /// on-device progress for the migration upload.
    @State private var hadUser = false
    /// The session ended on its own (revoked or expired refresh token). The local
    /// record is kept untouched and the learner is asked to sign back in.
    @State private var sessionEnded = false

    var body: some View {
        Group {
            if auth.isLoading {
                LaunchLoadingView()
            } else if let user = auth.user {
                signedIn(user)
            } else if sessionEnded {
                SessionEndedView { sessionEnded = false }
            } else {
                WelcomeView()
            }
        }
        .environment(cloud)
        .task(id: auth.user?.id) {
            await reconcileForCurrentUser()
        }
        .onAppear {
            auth.beforeSignOut = { [cloud, store] in
                store.flush()
                return await cloud.pushForSignOut(store: store)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            handleScenePhase(phase)
        }
        .onChange(of: store.isLessonInProgress) { _, inLesson in
            // A reconcile skipped because a lesson was running happens now.
            if !inLesson { reconcileOnForegroundIfDue() }
        }
    }

    /// Signed-in gate: corrupt local data → recovery; reconcile not finished
    /// for this user → loading; account unreachable with nothing local → retry
    /// screen; otherwise the app.
    @ViewBuilder
    private func signedIn(_ user: AuthManager.AppUser) -> some View {
        if store.loadError != nil {
            LocalDataRecoveryView(
                restore: { discardUnreadableCopy in
                    await cloud.restoreFromAccount(
                        store: store,
                        userId: user.id,
                        discardUnreadableCopy: discardUnreadableCopy
                    )
                },
                continueLocally: {
                    await cloud.continueWithLocalCopy(store: store, userId: user.id)
                }
            )
        } else if cloud.isReconciling || cloud.reconciledUserId != user.id {
            LaunchLoadingView()
        } else if cloud.needsAccountBeforeContinuing {
            AccountUnreachableView(message: syncFailureMessage) {
                await cloud.reconcile(store: store, userId: user.id, initial: true)
            }
        } else {
            RootView()
                .safeAreaInset(edge: .top, spacing: 0) {
                    // A low-stakes blob (preferences / practice history) could not
                    // be read: the app runs on defaults for it and says so, rather
                    // than blocking the learner behind a cloud restore (store-1-5).
                    if let notice = store.loadNoticeMessage {
                        LoadNoticeBanner(message: notice) { store.acknowledgeLoadNotices() }
                    }
                }
        }
    }

    private var syncFailureMessage: String {
        if case .failed(let message) = cloud.syncState { return message }
        return "Couldn't reach your account."
    }

    // MARK: - Sign-in / sign-out

    private func reconcileForCurrentUser() async {
        if let uid = auth.user?.id {
            hadUser = true
            sessionEnded = false
            // A different learner on this device starts from a clean record; the
            // same learner keeps everything that has not been uploaded yet.
            store.beginSession(userId: uid)
            store.cloud = cloud
            // Uploads stay disabled until the reconcile has applied or pushed:
            // `cloud.setUser` is effectively called by the reconcile on success.
            await cloud.reconcile(store: store, userId: uid, initial: true)
        } else {
            // Pre-login on a cold launch is NOT a sign-out: the saved session is
            // still restoring (`auth.isLoading`), and clearing the sync markers
            // here would disable the server-timestamp reconcile rule for the whole
            // launch (store-1-1). Only a session that actually ended gets here.
            guard !auth.isLoading, hadUser else { return }
            hadUser = false
            store.cloud = nil
            if auth.didSignOutExplicitly {
                cloud.setUser(nil)
                store.clearForSignOut()
            } else {
                // The session ended on its own. Wiping here would destroy every
                // answer since the last successful upload, so the record — and the
                // sync markers that describe it — stay put (store-1-2).
                cloud.setUser(nil, keepMarkers: true)
                sessionEnded = true
            }
        }
    }

    // MARK: - Lifecycle

    private func handleScenePhase(_ phase: ScenePhase) {
        switch phase {
        case .background, .inactive:
            store.flush()
            if auth.user != nil {
                Task { await cloud.flushPending(store: store) }
            }
        case .active:
            reconcileOnForegroundIfDue()
        @unknown default:
            break
        }
    }

    /// Foreground reconcile, unless a lesson is running: applying a remote snapshot
    /// mid-lesson replaces `gaps`/`concepts` underneath it, so the answers already
    /// recorded are lost and every later answer no-ops against an unknown gap id
    /// (store-1-3). It runs as soon as the lesson closes instead.
    private func reconcileOnForegroundIfDue() {
        guard !store.isLessonInProgress,
              let uid = auth.user?.id,
              store.loadError == nil,
              cloud.shouldReconcileOnForeground(userId: uid) else { return }
        Task { await cloud.reconcile(store: store, userId: uid, initial: false) }
    }
}

/// Brief branded loading state shown while the saved session restores on launch
/// and while the account snapshot is being reconciled after sign-in.
struct LaunchLoadingView: View {
    /// The launch mark grows with the learner's text size so the glyph never
    /// outgrows the circle it sits in.
    @ScaledMetric(relativeTo: .largeTitle) private var markScale: CGFloat = 1
    /// Clamped at `Theme.maxChromeScale` so the mark cannot swallow the screen.
    private var mark: CGFloat { Theme.chromeScale(markScale) }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 18) {
                ZStack {
                    Circle().fill(Theme.primaryGradient)
                        .frame(width: 76 * mark, height: 76 * mark)
                    Image(systemName: "sparkles")
                        .scaledFont(32, weight: .semibold)
                        .foregroundStyle(.white)
                }
                ProgressView().tint(Theme.primary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading your progress")
    }
}

/// Shown when the learner's on-device record could not be read. The first two
/// choices restore it from the account backup — the unreadable device copy is
/// never compared with or pushed over the cloud row (CloudSync
/// `restoreFromAccount` bypasses the newer-side rule); they differ only in
/// whether the unreadable copy is discarded or kept on the device for support.
/// Both need the network, so the screen also offers two offline escapes — carry
/// on with what was readable, or sign out — and is never a dead end (store-1-6).
struct LocalDataRecoveryView: View {
    @Environment(CloudSync.self) private var cloud
    @Environment(AuthManager.self) private var auth
    /// Restore from the account; the argument says whether to discard the
    /// preserved unreadable copy. Returns true once the store has left its
    /// recovery state.
    let restore: (_ discardUnreadableCopy: Bool) async -> Bool
    /// Leave the recovery state without a restore: keep using the device with
    /// whatever was readable, uploads disabled until the account copy can be read.
    let continueLocally: () async -> Void
    @State private var isRestoring = false
    @State private var isContinuing = false
    @State private var lastAttemptFailed = false

    var body: some View {
        StatusScreen(
            icon: "exclamationmark.triangle.fill",
            tint: Theme.warning,
            title: "We couldn't read the progress saved on this device",
            message: "Your account backup is unaffected. Restore from it now — discarding the unreadable copy, or keeping it on this device for support. If you can't get online, you can carry on here instead and the backup will take over as soon as it's reachable."
        ) {
            if lastAttemptFailed {
                Text(failureMessage)
                    .scaledFont(14)
                    .foregroundStyle(Theme.error)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 4)
            }

            Button {
                attempt(discardUnreadableCopy: true)
            } label: {
                HStack(spacing: 8) {
                    if isRestoring { ProgressView().tint(.white) }
                    Text("Restore from my account")
                }
                .scaledFont(16, weight: .semibold)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 52)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.primary)
            .disabled(isBusy)
            .accessibilityHint("Replaces the unreadable copy on this device with your account backup")

            Button {
                attempt(discardUnreadableCopy: false)
            } label: {
                Text("Restore, but keep the unreadable copy")
                    .scaledFont(15, weight: .medium)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: Theme.minimumHitTarget)
            }
            .buttonStyle(.bordered)
            .tint(Theme.textSecondary)
            .disabled(isBusy)
            .accessibilityHint("Restores from your account and keeps the unreadable copy on this device for support")

            Button {
                continueOnDevice()
            } label: {
                HStack(spacing: 8) {
                    if isContinuing { ProgressView().tint(Theme.textSecondary) }
                    Text("Continue on this device")
                }
                .scaledFont(15, weight: .medium)
                .frame(maxWidth: .infinity)
                .frame(minHeight: Theme.minimumHitTarget)
            }
            .buttonStyle(.bordered)
            .tint(Theme.textSecondary)
            .disabled(isBusy)
            .accessibilityHint("Carries on with the part that was readable. Nothing is uploaded, and your account backup replaces this copy as soon as it can be reached.")

            Button("Sign out") {
                Task { try? await auth.signOut(force: true) }
            }
            .scaledFont(15, weight: .medium)
            .foregroundStyle(Theme.textSecondary)
            .frame(minHeight: Theme.minimumHitTarget)
            .disabled(isBusy)
        }
    }

    private var isBusy: Bool { isRestoring || isContinuing }

    private var failureMessage: String {
        if case .failed(let message) = cloud.syncState { return message }
        return "Couldn't reach your account. Try again."
    }

    private func attempt(discardUnreadableCopy: Bool) {
        guard !isBusy else { return }
        isRestoring = true
        lastAttemptFailed = false
        Task {
            let restored = await restore(discardUnreadableCopy)
            lastAttemptFailed = !restored
            isRestoring = false
        }
    }

    private func continueOnDevice() {
        guard !isBusy else { return }
        isContinuing = true
        lastAttemptFailed = false
        Task {
            await continueLocally()
            isContinuing = false
        }
    }
}

/// The session ended without the learner asking for it (an expired or revoked
/// refresh token). Everything on the device is kept exactly as it was — signing
/// back in with the same account resumes it — so this is a prompt, not a wipe.
struct SessionEndedView: View {
    /// Dismiss to the sign-in screen.
    let onContinue: () -> Void

    var body: some View {
        StatusScreen(
            icon: "person.crop.circle.badge.exclamationmark",
            tint: Theme.warning,
            title: "Your session ended",
            message: "Sign back in to keep your progress backed up. Everything on this device is still here, and syncing resumes as soon as you're signed in."
        ) {
            Button {
                onContinue()
            } label: {
                Text("Sign back in")
                    .scaledFont(16, weight: .semibold)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 52)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.primary)
        }
    }
}

/// Non-blocking notice for a low-stakes blob that could not be read (plan
/// preferences, practice history). The learner keeps working; the message says
/// what started over.
struct LoadNoticeBanner: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(Theme.warning)
                .accessibilityHidden(true)
            Text(message)
                .scaledFont(13)
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark")
                    .scaledFont(13, weight: .semibold)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(minWidth: Theme.minimumHitTarget, minHeight: Theme.minimumHitTarget)
            }
            .accessibilityLabel("Dismiss notice")
        }
        .padding(.leading, 14)
        .padding(.vertical, 10)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.warning.opacity(0.4), lineWidth: 1)
        )
        .padding(.horizontal, 16)
        .shadow(color: .black.opacity(0.08), radius: 8, y: 2)
    }
}

/// Shown when the sign-in reconcile could not read the account and the device
/// has no progress of its own: there is nothing safe to show, so the only
/// ways forward are to retry or sign out.
struct AccountUnreachableView: View {
    @Environment(AuthManager.self) private var auth
    let message: String
    let retry: () async -> Void
    @State private var isRetrying = false

    var body: some View {
        StatusScreen(
            icon: "icloud.slash",
            tint: Theme.error,
            title: "Couldn't load your progress",
            message: message
        ) {
            Button {
                guard !isRetrying else { return }
                isRetrying = true
                Task {
                    await retry()
                    isRetrying = false
                }
            } label: {
                HStack(spacing: 8) {
                    if isRetrying { ProgressView().tint(.white) }
                    Text("Try again")
                }
                .scaledFont(16, weight: .semibold)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 52)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.primary)
            .disabled(isRetrying)
            .accessibilityHint("Tries to load your progress from your account again")

            Button("Sign out") {
                Task { try? await auth.signOut(force: true) }
            }
            .scaledFont(15, weight: .medium)
            .foregroundStyle(Theme.textSecondary)
            .frame(minHeight: Theme.minimumHitTarget)
        }
    }
}

/// Shared layout for the full-screen status states above.
private struct StatusScreen<Actions: View>: View {
    let icon: String
    let tint: Color
    let title: String
    let message: String
    @ViewBuilder let actions: Actions

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                Spacer()
                Image(systemName: icon)
                    .scaledFont(44, weight: .semibold)
                    .foregroundStyle(tint)
                    .accessibilityHidden(true)
                Text(title)
                    .scaledFont(22, weight: .bold)
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)
                    .padding(.top, 18)
                    .accessibilityAddTraits(.isHeader)
                Text(message)
                    .scaledFont(15)
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 10)
                Spacer()
                VStack(spacing: 12) { actions }
            }
            .padding(.horizontal, 28)
            .padding(.bottom, 44)
        }
    }
}

#Preview {
    ContentView()
        .environment(AuthManager())
        .environment(AppStore())
}
