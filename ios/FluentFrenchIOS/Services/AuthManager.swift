//
//  AuthManager.swift
//  FluentFrenchIOS
//
//  Observable auth state on top of native Supabase Auth. Supports native
//  Sign in with Apple (ID token) and Google (ASWebAuthenticationSession OAuth).
//  Sessions persist across launches via the Supabase client's own storage.
//
//  Sign-out is guarded: the coordinator's `beforeSignOut` hook must confirm the
//  learner's progress reached the cloud, otherwise `signOut()` throws
//  `SignOutBlocked` and nothing is torn down until the learner explicitly
//  forces it.
//

import Foundation
import SwiftUI
import AuthenticationServices
import Supabase

/// Sign-out was refused because the final progress upload did not succeed.
nonisolated struct SignOutBlocked: Error, Sendable {}

@MainActor
@Observable
final class AuthManager {
    /// The signed-in learner, or nil when signed out.
    var user: AppUser?
    /// True until the initial session restore completes (launch loading state).
    var isLoading = true
    /// True while a sign-in round-trip is in flight.
    var isSigningIn = false
    /// True while a sign-out (including its backup upload) is in flight.
    var isSigningOut = false
    var showError = false
    var errorMessage = ""
    /// Non-nil when the build has no Supabase configuration; sign-in is impossible.
    let configurationError: String?

    /// Invoked right before the session is torn down on sign-out so the
    /// coordinator can flush local state and upload it while the session is
    /// still valid. Return false when the upload failed; sign-out then throws
    /// `SignOutBlocked` unless forced.
    var beforeSignOut: (@MainActor () async -> Bool)?

    private let client: SupabaseClient?

    struct AppUser: Equatable {
        let id: String
        let email: String?
        let name: String?
        let avatarURL: String?
    }

    init() {
        client = SupabaseManager.client
        configurationError = SupabaseManager.isConfigured ? nil : SupabaseManager.configurationMessage
        guard let client else {
            isLoading = false
            return
        }
        // Lives for the app's lifetime; AuthManager is a long-lived app-level state.
        Task { [weak self] in
            for await change in client.auth.authStateChanges {
                guard let self else { return }
                await self.handle(event: change.event, session: change.session)
            }
        }
    }

    // MARK: - Auth state

    private func handle(event: AuthChangeEvent, session: Session?) {
        switch event {
        case .initialSession, .signedIn, .tokenRefreshed, .userUpdated:
            if let session {
                user = Self.mapUser(session.user)
            } else {
                user = nil
            }
        case .signedOut:
            user = nil
        default:
            break
        }
        isLoading = false
    }

    private static func mapUser(_ supaUser: Supabase.User) -> AppUser {
        let meta = supaUser.userMetadata
        let name = meta["full_name"]?.stringValue
            ?? meta["name"]?.stringValue
            ?? meta["given_name"]?.stringValue
        let avatar = meta["avatar_url"]?.stringValue ?? meta["picture"]?.stringValue
        return AppUser(
            id: supaUser.id.uuidString,
            email: supaUser.email,
            name: name,
            avatarURL: avatar
        )
    }

    // MARK: - Sign in with Apple (native)

    /// Complete a native Sign in with Apple using the credential the system
    /// returned. `fullName` is only present on the very first authorization.
    func signInWithApple(idToken: String, fullName: String?) async {
        guard let client else { setError(SupabaseManager.configurationMessage); return }
        isSigningIn = true
        defer { isSigningIn = false }
        do {
            try await client.auth.signInWithIdToken(
                credentials: .init(provider: .apple, idToken: idToken)
            )
            if let fullName, !fullName.isEmpty {
                _ = try? await client.auth.update(
                    user: UserAttributes(data: ["full_name": .string(fullName)])
                )
            }
        } catch {
            setError(error.localizedDescription)
        }
    }

    // MARK: - Sign in with Google (OAuth web flow)

    func signInWithGoogle() async {
        guard let client else { setError(SupabaseManager.configurationMessage); return }
        isSigningIn = true
        defer { isSigningIn = false }
        do {
            try await client.auth.signInWithOAuth(
                provider: .google,
                redirectTo: SupabaseManager.oauthRedirectURL
            )
        } catch {
            if isCancellation(error) { return }
            setError(error.localizedDescription)
        }
    }

    // MARK: - Sign out

    /// Back up progress, then end the session. Throws `SignOutBlocked` when the
    /// backup did not succeed and `force` is false; the session is left intact
    /// so the learner can retry or explicitly sign out anyway.
    func signOut(force: Bool = false) async throws {
        isSigningOut = true
        defer { isSigningOut = false }

        let backedUp = await beforeSignOut?() ?? true
        if !backedUp && !force {
            throw SignOutBlocked()
        }
        do {
            try await client?.auth.signOut()
        } catch {
            // Local sign-out still proceeds via the auth state change.
        }
        user = nil
    }

    // MARK: - Helpers

    private func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if let asError = error as? ASWebAuthenticationSessionError,
           asError.code == .canceledLogin {
            return true
        }
        let ns = error as NSError
        return ns.domain == ASWebAuthenticationSessionError.errorDomain
            && ns.code == ASWebAuthenticationSessionError.canceledLogin.rawValue
    }

    private func setError(_ message: String) {
        errorMessage = message
        showError = true
    }
}
