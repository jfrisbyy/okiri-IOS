//
//  AuthManager.swift
//  FluentFrenchIOS
//
//  Observable auth state on top of native Supabase Auth. Supports native
//  Sign in with Apple (ID token) and Google (ASWebAuthenticationSession OAuth).
//  Sessions persist across launches via the Supabase client's own storage.
//

import SwiftUI
import AuthenticationServices
import Supabase

@MainActor
@Observable
final class AuthManager {
    /// The signed-in learner, or nil when signed out.
    var user: AppUser?
    /// True until the initial session restore completes (launch loading state).
    var isLoading = true
    /// True while a sign-in round-trip is in flight.
    var isSigningIn = false
    var showError = false
    var errorMessage = ""

    /// Invoked right before the session is torn down on sign-out so a coordinator
    /// can flush any pending cloud upload while the session is still valid.
    var beforeSignOut: (() async -> Void)?

    private let client = SupabaseManager.client

    struct AppUser: Equatable {
        let id: String
        let email: String?
        let name: String?
        let avatarURL: String?
    }

    init() {
        // Lives for the app's lifetime; AuthManager is a long-lived app-level state.
        Task { [weak self] in
            guard let self else { return }
            for await change in self.client.auth.authStateChanges {
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

    func signOut() async {
        await beforeSignOut?()
        do {
            try await client.auth.signOut()
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
