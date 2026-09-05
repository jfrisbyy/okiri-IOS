//
//  RootView.swift
//  FluentFrenchIOS
//
//  The home screen is the persistent base of the app — there is no bottom tab
//  bar. Navigation flows through the signature sliding card carousel on Home.
//  On first launch we present a short placement assessment that finds the
//  learner's real level and seeds their gaps.
//
//  The onboarding decision is only made once the account snapshot has been
//  reconciled (ContentView gates on `CloudSync.isReconciling`), so a learner
//  who already placed on another device is never asked to place again.
//

import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(CloudSync.self) private var cloud: CloudSync?
    @State private var showAssessment = false
    @State private var showPreferences = false

    var body: some View {
        HomeView()
            .fullScreenCover(isPresented: $showAssessment, onDismiss: presentPreferencesIfNeeded) {
                AssessmentView(isFirstRun: true)
                    .environment(store)
                    .interactiveDismissDisabled()
            }
            .fullScreenCover(isPresented: $showPreferences) {
                PreferencesView(isOnboarding: true)
                    .environment(store)
                    .interactiveDismissDisabled()
            }
            .onAppear(perform: decideOnboarding)
            .onChange(of: cloud?.isReconciling ?? false) { _, reconciling in
                if !reconciling { decideOnboarding() }
            }
            .onChange(of: store.hasCompletedAssessment) { _, completed in
                // A reconciled snapshot that already placed the learner wins
                // over a pending first-run assessment.
                if completed, showAssessment { showAssessment = false }
            }
    }

    /// Present the first-run placement only when the reconciled store says the
    /// learner has never placed. Never decides while a reconcile is in flight.
    private func decideOnboarding() {
        if cloud?.isReconciling == true { return }
        if store.loadError != nil { return }
        if !store.hasCompletedAssessment {
            if !showAssessment { showAssessment = true }
        } else {
            presentPreferencesIfNeeded()
        }
    }

    /// After the placement check, collect the daily-plan "floor" once.
    private func presentPreferencesIfNeeded() {
        if !store.hasSetPreferences {
            showPreferences = true
        }
    }
}

#Preview {
    RootView()
        .environment(AppStore())
}
