//
//  RootView.swift
//  FluentFrenchIOS
//
//  The home screen is the persistent base of the app — there is no bottom tab
//  bar. Navigation flows through the signature sliding card carousel on Home.
//  On first launch the short placement assessment that finds the learner's real
//  level and seeds their gaps IS the root screen (UX-14): Home is not drawn
//  underneath it, so it never flashes "Not placed" before the placement rises,
//  and finishing the placement swaps Home in once.
//
//  The onboarding decision is only made once the account snapshot has been
//  reconciled (`AppStore.showsFirstRunPlacement`), so a learner who already
//  placed on another device is never asked to place again. The daily-practice
//  preferences are asked once, when Reading opens (`AppStore.shouldAskPreferences`,
//  UX-06) — never during the Foundation, where they change nothing, and never on
//  top of a sheet or cover Home already has up.
//

import Foundation
import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(CloudSync.self) private var cloud: CloudSync?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Latched once the placement is on screen, so a foreground reconcile that
    /// starts mid-placement never swaps Home in under the learner.
    @State private var placementShown = false
    @State private var showPreferences = false

    private var showsPlacement: Bool {
        store.showsFirstRunPlacement(reconciling: cloud?.isReconciling == true,
                                     alreadyShowing: placementShown)
    }

    var body: some View {
        Group {
            if showsPlacement {
                // Finishing applies the placement (`hasCompletedAssessment`), which
                // is what swaps Home in; the view's own dismiss is a no-op here.
                AssessmentView(isFirstRun: true)
                    .transition(.opacity)
            } else {
                HomeView()
                    .transition(.opacity)
            }
        }
        .animation(Theme.motion(.easeInOut, reduceMotion: reduceMotion), value: showsPlacement)
        .fullScreenCover(isPresented: $showPreferences) {
            PreferencesView(isOnboarding: true)
                .environment(store)
                .interactiveDismissDisabled()
        }
        .onChange(of: showsPlacement, initial: true) { _, showing in
            if showing { placementShown = true }
        }
        // The store holds the ask while a lesson or any of Home's own sheets and
        // covers is up (`AppStore.shouldAskPreferences`); once it turns true the
        // cover still waits out the closing presentation's animation, and checks
        // again, so it never collides with one (UX-06).
        .task(id: store.shouldAskPreferences) {
            guard store.shouldAskPreferences, !showPreferences else { return }
            try? await Task.sleep(for: .seconds(Tuning.preferencesPresentDelay))
            guard !Task.isCancelled, store.shouldAskPreferences else { return }
            showPreferences = true
        }
    }
}

#Preview {
    RootView()
        .environment(AppStore())
}
