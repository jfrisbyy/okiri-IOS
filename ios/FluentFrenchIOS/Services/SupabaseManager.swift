//
//  SupabaseManager.swift
//  FluentFrenchIOS
//
//  Single shared Supabase client. The project is on native Supabase Auth
//  (auth.uid()), shared with the companion app's identity model. The client
//  owns and persists the session (Keychain) across launches.
//
//  A build whose Supabase URL / anon key were not injected is a
//  misconfiguration, not a runtime condition: no placeholder client is built,
//  `isConfigured` is false, a warning is logged, and the UI shows an explicit
//  "this build isn't configured for sign-in" state. Config.swift is checked in
//  with empty values (the build pipeline injects them), so a plain Debug
//  checkout must reach that state rather than trap; set FF_REQUIRE_SUPABASE=1
//  in the scheme to turn the warning into an assertion.
//

import Foundation
import Supabase

enum SupabaseManager {
    /// Thrown/reported when the build has no Supabase configuration.
    nonisolated struct ConfigurationError: Error, Sendable {}

    /// Learner-facing copy for the unconfigured state.
    static let configurationMessage = "This build isn't configured for sign-in."

    /// True when both the project URL and the anon key were injected at build time.
    static var isConfigured: Bool { client != nil }

    /// The one and only Supabase client for the app, or nil when unconfigured.
    static let client: SupabaseClient? = {
        let rawURL = Config.EXPO_PUBLIC_SUPABASE_URL.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = Config.EXPO_PUBLIC_SUPABASE_ANON_KEY.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawURL.isEmpty, !key.isEmpty, let url = URL(string: rawURL), url.host != nil else {
            // Previews and unit tests legitimately run without injected keys;
            // so does a plain Debug checkout, which must show the misconfigured
            // Welcome state instead of trapping at launch.
            let env = ProcessInfo.processInfo.environment
            let isPreviewOrTest = env["XCODE_RUNNING_FOR_PREVIEWS"] == "1" || env["XCTestConfigurationFilePath"] != nil
            if !isPreviewOrTest {
                let message = "Supabase is not configured: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are empty."
                if env["FF_REQUIRE_SUPABASE"] == "1" {
                    assertionFailure(message)
                } else {
                    print("[SupabaseManager] \(message)")
                }
            }
            return nil
        }
        return SupabaseClient(supabaseURL: url, supabaseKey: key, options: clientOptions)
    }()

    /// Options the client is built with. `emitLocalSessionAsInitialSession` makes
    /// the launch emit the session stored in the Keychain as it is, expired or not,
    /// and refresh it afterwards. The library's legacy default refreshes FIRST and,
    /// when that refresh cannot reach the network, emits NO session: an offline
    /// cold launch more than about an hour after the last refresh then showed the
    /// sign-in screen, and a learner whose whole record is on the device could not
    /// study until a network came back (store-10-1). A real revocation still
    /// arrives as `.signedOut` once the background refresh reaches the server.
    /// The option exists from supabase-swift 2.37.0 (absent from 2.36.0).
    static var clientOptions: SupabaseClientOptions {
        SupabaseClientOptions(auth: .init(emitLocalSessionAsInitialSession: true))
    }

    /// Custom URL scheme used as the OAuth redirect target for the Google web
    /// flow. ASWebAuthenticationSession intercepts this scheme directly, so it
    /// needs no Info.plist registration. The owner must add
    /// `okiri://auth-callback` to the Supabase redirect allow-list.
    static let oauthRedirectURL = URL(string: "okiri://auth-callback")!
}
