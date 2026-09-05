//
//  FluentFrenchIOSApp.swift
//  FluentFrenchIOS
//
//  Created by Rork on June 22, 2026.
//

import SwiftUI

@main
struct FluentFrenchIOSApp: App {
    @State private var auth = AuthManager()
    @State private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(auth)
                .environment(store)
        }
    }
}
