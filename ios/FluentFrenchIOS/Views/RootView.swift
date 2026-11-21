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
//  UX-06) — never during the Foundation, where they change nothing.
//

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
        .onChange(of: store.shouldAskPreferences, initial: true) { _, ask in
            if ask { showPreferences = true }
        }
    }
}

#Preview {
    RootView()
        .environment(AppStore())
}
