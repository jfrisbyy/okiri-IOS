//
//  SupabaseManager.swift
//  FluentFrenchIOS
//
//  Single shared Supabase client. The project is on native Supabase Auth
//  (auth.uid()), shared with the companion app's identity model. The client
//  owns and persists the session (Keychain) across launches.
//

import Foundation
import Supabase

enum SupabaseManager {
    /// The one and only Supabase client for the app.
    static let client: SupabaseClient = {
        let url = URL(string: Config.EXPO_PUBLIC_SUPABASE_URL)
            ?? URL(string: "https://placeholder.supabase.co")!
        return SupabaseClient(
            supabaseURL: url,
            supabaseKey: Config.EXPO_PUBLIC_SUPABASE_ANON_KEY
        )
    }()

    /// Custom URL scheme used as the OAuth redirect target for the Google web
    /// flow. ASWebAuthenticationSession intercepts this scheme directly, so it
    /// needs no Info.plist registration. The owner must add
    /// `okiri://auth-callback` to the Supabase redirect allow-list.
    static let oauthRedirectURL = URL(string: "okiri://auth-callback")!
}
