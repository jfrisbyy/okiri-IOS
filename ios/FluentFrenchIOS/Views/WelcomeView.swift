//
//  WelcomeView.swift
//  FluentFrenchIOS
//
//  The required front door: Apple + Google sign-in. Nothing else opens until the
//  learner is signed in, so all progress is tied to an account from the first tap.
//

import SwiftUI
import AuthenticationServices

struct WelcomeView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        @Bindable var auth = auth

        ZStack {
            backdrop

            VStack(spacing: 0) {
                Spacer()
                hero
                Spacer()
                buttons
                footnote
            }
            .padding(.horizontal, 28)
            .padding(.bottom, 44)

            if auth.isSigningIn {
                Color.black.opacity(0.25).ignoresSafeArea()
                ProgressView().controlSize(.large).tint(.white)
            }
        }
        .alert("Sign-in failed", isPresented: $auth.showError) {
            Button("Try again") {}
        } message: {
            Text(auth.errorMessage)
        }
    }

    // MARK: - Pieces

    private var backdrop: some View {
        LinearGradient(
            colors: [Theme.primary.opacity(0.16), Theme.background, Theme.background],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }

    private var hero: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle().fill(Theme.primaryGradient).frame(width: 96, height: 96)
                    .shadow(color: Theme.primary.opacity(0.35), radius: 18, y: 8)
                Image(systemName: "sparkles")
                    .font(.system(size: 42, weight: .semibold))
                    .foregroundStyle(.white)
            }
            VStack(spacing: 10) {
                Text("Okiri")
                    .font(.serifDisplay(40, weight: .bold))
                    .foregroundStyle(Theme.text)
                Text("Your progress, saved and synced everywhere.")
                    .font(.system(size: 17))
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 300)
            }
        }
    }

    @ViewBuilder
    private var buttons: some View {
        if let configurationError = auth.configurationError {
            misconfigured(configurationError)
        } else {
            signInButtons
        }
    }

    /// The build has no Supabase URL / key: say so plainly instead of offering
    /// sign-in buttons that can only fail.
    private func misconfigured(_ message: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Theme.warning)
                .accessibilityHidden(true)
            Text(message)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
            Text("Sign-in keys weren't included in this build. If you're testing, install a release build; if you're developing, set the Supabase URL and anon key.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(18)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Theme.border, lineWidth: 1)
        )
    }

    private var signInButtons: some View {
        VStack(spacing: 14) {
            SignInWithAppleButton(.continue) { request in
                request.requestedScopes = [.email, .fullName]
            } onCompletion: { result in
                handleApple(result)
            }
            .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
            .frame(height: 54)
            .clipShape(.rect(cornerRadius: 16))
            .disabled(auth.isSigningIn)

            Button {
                Task { await auth.signInWithGoogle() }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "globe")
                        .font(.system(size: 18, weight: .semibold))
                    Text("Continue with Google")
                        .font(.system(size: 17, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .foregroundStyle(Theme.text)
                .background(Theme.card)
                .clipShape(.rect(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(Theme.border, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .disabled(auth.isSigningIn)
        }
    }

    private var footnote: some View {
        Text("By continuing you agree to keep your learning progress backed up to your account.")
            .font(.system(size: 12))
            .foregroundStyle(Theme.textMuted)
            .multilineTextAlignment(.center)
            .padding(.top, 18)
            .frame(maxWidth: 320)
    }

    // MARK: - Apple completion

    private func handleApple(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure:
            // Cancellation or system error — silently allow retry.
            return
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8)
            else { return }
            let fullName = credential.fullName?.formatted()
            Task { await auth.signInWithApple(idToken: idToken, fullName: fullName) }
        }
    }
}
