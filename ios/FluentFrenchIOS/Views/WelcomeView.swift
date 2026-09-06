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
    /// The hero mark grows with the learner's text size so the glyph stays
    /// proportionate to the circle behind it.
    @ScaledMetric(relativeTo: .largeTitle) private var markScale: CGFloat = 1
    /// Sign-in buttons keep the same height as each other as text grows.
    @ScaledMetric(relativeTo: .body) private var buttonScale: CGFloat = 1
    /// Clamped at `Theme.maxChromeScale`: unclamped, the two sign-in buttons would
    /// take a third of the screen at the largest accessibility text sizes.
    private var mark: CGFloat { Theme.chromeScale(markScale) }
    private var buttonHeight: CGFloat { 54 * Theme.chromeScale(buttonScale) }

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
                    .accessibilityLabel("Signing in")
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
                Circle().fill(Theme.primaryGradient)
                    .frame(width: 96 * mark, height: 96 * mark)
                    .shadow(color: Theme.primary.opacity(0.35), radius: 18, y: 8)
                Image(systemName: "sparkles")
                    .scaledFont(42, weight: .semibold)
                    .foregroundStyle(.white)
            }
            .accessibilityHidden(true)
            VStack(spacing: 10) {
                Text("Okiri")
                    .scaledSerifDisplay(40, weight: .bold)
                    .foregroundStyle(Theme.text)
                Text("Your progress, saved and synced everywhere.")
                    .scaledFont(17)
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
                .scaledFont(22, weight: .semibold)
                .foregroundStyle(Theme.warning)
                .accessibilityHidden(true)
            Text(message)
                .scaledFont(16, weight: .semibold)
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
            // Developer note: the missing values are the Supabase project URL
            // and anon key; the learner-facing copy stays vendor-neutral.
            Text("Sign-in isn't set up in this build. If you're testing, install a release build; if you're developing, add the account service URL and key.")
                .scaledFont(13)
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
        .accessibilityElement(children: .combine)
    }

    private var signInButtons: some View {
        VStack(spacing: 14) {
            SignInWithAppleButton(.continue) { request in
                request.requestedScopes = [.email, .fullName]
            } onCompletion: { result in
                handleApple(result)
            }
            .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
            .frame(height: buttonHeight)
            .clipShape(.rect(cornerRadius: 16))
            .disabled(auth.isSigningIn)

            Button {
                Task { await auth.signInWithGoogle() }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "globe")
                        .scaledFont(18, weight: .semibold)
                        .accessibilityHidden(true)
                    Text("Continue with Google")
                        .scaledFont(17, weight: .semibold)
                }
                .frame(maxWidth: .infinity)
                .frame(minHeight: buttonHeight)
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
            .scaledFont(12)
            .foregroundStyle(Theme.textSecondary)
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
