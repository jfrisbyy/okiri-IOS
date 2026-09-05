//
//  ContentView.swift
//  FluentFrenchIOS
//
//  Auth gate + cloud-sync coordinator. Nothing opens until the learner is signed
//  in; once they are, their progress is reconciled with the cloud (newest wins)
//  and continuously backed up as they use the app.
//

import SwiftUI

struct ContentView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(AppStore.self) private var store
    @State private var cloud = CloudSync()
    /// Tracks whether a user was signed in, so we only wipe local state on a real
    /// sign-out — never on the first-launch (pre-login) screen, which must keep
    /// any existing on-device progress for the migration upload.
    @State private var hadUser = false

    var body: some View {
        Group {
            if auth.isLoading {
                LaunchLoadingView()
            } else if auth.user == nil {
                WelcomeView()
            } else {
                RootView()
            }
        }
        .task(id: auth.user?.id) {
            await reconcileForCurrentUser()
        }
        .onAppear {
            auth.beforeSignOut = { [cloud, store] in
                await cloud.flushPending(store: store)
            }
        }
    }

    private func reconcileForCurrentUser() async {
        if let uid = auth.user?.id {
            hadUser = true
            store.cloud = cloud
            cloud.setUser(uid)
            await cloud.reconcile(store: store, userId: uid)
        } else {
            cloud.setUser(nil)
            store.cloud = nil
            if hadUser {
                hadUser = false
                store.clearForSignOut()
            }
        }
    }
}

/// Brief branded loading state shown while the saved session restores on launch.
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
    }
}

#Preview {
    ContentView()
        .environment(AuthManager())
        .environment(AppStore())
}
