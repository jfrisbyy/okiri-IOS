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
    /// Tracks whether a user was signed in, so we only wipe local state on a real
    /// sign-out — never on the first-launch (pre-login) screen, which must keep
    /// any existing on-device progress for the migration upload.
    @State private var hadUser = false

    var body: some View {
        Group {
            if auth.isLoading {
                LaunchLoadingView()
            } else if let user = auth.user {
                signedIn(user)
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
    }

    /// Signed-in gate: corrupt local data → recovery; reconcile not finished
    /// for this user → loading; account unreachable with nothing local → retry
    /// screen; otherwise the app.
    @ViewBuilder
    private func signedIn(_ user: AuthManager.AppUser) -> some View {
        if store.loadError != nil {
            LocalDataRecoveryView { discardUnreadableCopy in
                await cloud.restoreFromAccount(
                    store: store,
                    userId: user.id,
                    discardUnreadableCopy: discardUnreadableCopy
                )
            }
        } else if cloud.isReconciling || cloud.reconciledUserId != user.id {
            LaunchLoadingView()
        } else if cloud.needsAccountBeforeContinuing {
            AccountUnreachableView(message: syncFailureMessage) {
                await cloud.reconcile(store: store, userId: user.id, initial: true)
            }
        } else {
            RootView()
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
            store.cloud = cloud
            // Uploads stay disabled until the reconcile has applied or pushed:
            // `cloud.setUser` is effectively called by the reconcile on success.
            await cloud.reconcile(store: store, userId: uid, initial: true)
        } else {
            cloud.setUser(nil)
            store.cloud = nil
            if hadUser {
                hadUser = false
                store.clearForSignOut()
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
            guard let uid = auth.user?.id, store.loadError == nil,
                  cloud.shouldReconcileOnForeground(userId: uid) else { return }
            Task { await cloud.reconcile(store: store, userId: uid, initial: false) }
        @unknown default:
            break
        }
    }
}

/// Brief branded loading state shown while the saved session restores on launch
/// and while the account snapshot is being reconciled after sign-in.
struct LaunchLoadingView: View {
    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 18) {
                ZStack {
                    Circle().fill(Theme.primaryGradient).frame(width: 76, height: 76)
                    Image(systemName: "sparkles")
                        .font(.system(size: 32, weight: .semibold))
                        .foregroundStyle(.white)
                }
                ProgressView().tint(Theme.primary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading your progress")
    }
}

/// Shown when the on-device progress could not be read. Either choice restores
/// the learner's progress from the account backup — the unreadable device copy
/// is never compared with or pushed over the cloud row (CloudSync
/// `restoreFromAccount` bypasses the newer-side rule). The choice is only
/// whether the unreadable copy is discarded or kept on the device for support.
/// The screen stays up until a restore attempt succeeds.
struct LocalDataRecoveryView: View {
    @Environment(CloudSync.self) private var cloud
    /// Restore from the account; the argument says whether to discard the
    /// preserved unreadable copy. Returns true once the store has left its
    /// recovery state.
    let restore: (_ discardUnreadableCopy: Bool) async -> Bool
    @State private var isRestoring = false
    @State private var lastAttemptFailed = false

    var body: some View {
        StatusScreen(
            icon: "exclamationmark.triangle.fill",
            tint: Theme.warning,
            title: "We couldn't read the progress saved on this device",
            message: "Your account backup is unaffected, and your progress will be restored from it. You can discard the unreadable copy, or keep it on this device for support."
        ) {
            if lastAttemptFailed {
                Text(failureMessage)
                    .font(.system(size: 14))
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
                .font(.system(size: 16, weight: .semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 52)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.primary)
            .disabled(isRestoring)

            Button {
                attempt(discardUnreadableCopy: false)
            } label: {
                Text("Restore, but keep the unreadable copy")
                    .font(.system(size: 15, weight: .medium))
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
            }
            .buttonStyle(.bordered)
            .tint(Theme.textSecondary)
            .disabled(isRestoring)
        }
    }

    private var failureMessage: String {
        if case .failed(let message) = cloud.syncState { return message }
        return "Couldn't reach your account. Try again."
    }

    private func attempt(discardUnreadableCopy: Bool) {
        guard !isRestoring else { return }
        isRestoring = true
        lastAttemptFailed = false
        Task {
            let restored = await restore(discardUnreadableCopy)
            lastAttemptFailed = !restored
            isRestoring = false
        }
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
                .font(.system(size: 16, weight: .semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 52)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.primary)
            .disabled(isRetrying)

            Button("Sign out") {
                Task { try? await auth.signOut(force: true) }
            }
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(Theme.textSecondary)
            .frame(height: 44)
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
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(tint)
                    .accessibilityHidden(true)
                Text(title)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)
                    .padding(.top, 18)
                Text(message)
                    .font(.system(size: 15))
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
