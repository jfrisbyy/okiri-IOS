//
//  RootView.swift
//  FluentFrenchIOS
//
//  The home screen is the persistent base of the app — there is no bottom tab
//  bar. Navigation flows through the signature sliding card carousel on Home.
//  On first launch we present a short placement assessment that finds the
//  learner's real level and seeds their gaps.
//

import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store
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
            .onAppear {
                if !store.hasCompletedAssessment {
                    showAssessment = true
                } else {
                    presentPreferencesIfNeeded()
                }
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
