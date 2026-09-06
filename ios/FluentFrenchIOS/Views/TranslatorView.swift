//
//  TranslatorView.swift
//  FluentFrenchIOS
//
//  Two-way English↔French translator on the live translation service. Every
//  outcome is explicit — idle, translating (bounded by
//  `Tuning.translateTimeoutSeconds`), a translation, or a named failure with a
//  retry — and a build without a translation key says so up front (E26).
//

import SwiftUI

struct TranslatorView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 1 at the default text size — the round icon buttons grow with it so a
    /// scaled glyph never spills out of its circle.
    @ScaledMetric private var typeScale: CGFloat = 1

    /// The translator's explicit states.
    private enum Phase: Equatable {
        case idle
        case translating
        case translated(String)
        case failed(TranslationFailure)
    }

    @State private var source: TranslationLanguage = .english
    @State private var inputText: String = ""
    @State private var phase: Phase = .idle
    @State private var didCopy = false
    @FocusState private var inputFocused: Bool

    private var target: TranslationLanguage { source.opposite }
    private var isTranslating: Bool { phase == .translating }
    private var outputText: String? {
        if case .translated(let t) = phase { return t }
        return nil
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 16) {
                    if !TranslationService.hasKey { LookupUnavailableView(failure: .notConfigured, accent: Theme.secondary) }
                    languageSelector
                    inputCard
                    translateButton
                    switch phase {
                    case .idle, .translating:
                        EmptyView()
                    case .translated(let text):
                        outputCard(text)
                    case .failed(let failure):
                        LookupUnavailableView(failure: failure, accent: Theme.secondary, onRetry: { Task { await translate() } })
                    }
                }
                .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 48)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
    }

    private var header: some View {
        ResourceHeader(
            gradient: Theme.tealGradient,
            title: "Translator",
            subtitle: "English ↔ French",
            onBack: { dismiss() }
        )
    }

    private var languageSelector: some View {
        HStack(spacing: 12) {
            languageBox(source.displayName)
            Button {
                Haptics.tap()
                withAnimation(Theme.motion(.spring(response: 0.35, dampingFraction: 0.8), reduceMotion: reduceMotion)) {
                    source = source.opposite
                    // Swapping direction carries the translation back into the input.
                    if let outputText {
                        inputText = outputText
                    }
                    phase = .idle
                }
            } label: {
                Image(systemName: "arrow.left.arrow.right")
                    .scaledFont(17, weight: .semibold).foregroundStyle(Theme.secondary)
                    .frame(width: Theme.minimumHitTarget * typeScale, height: Theme.minimumHitTarget * typeScale)
                    .background(Theme.secondaryLight).clipShape(.circle)
                    .overlay(Circle().stroke(Theme.secondary.opacity(0.15), lineWidth: 0.5))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Swap languages")
            .accessibilityValue("\(source.displayName) to \(target.displayName)")
            .accessibilityHint("Translates in the other direction")
            languageBox(target.displayName)
        }
    }

    private func languageBox(_ name: String) -> some View {
        Text(name)
            .font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
            .frame(maxWidth: .infinity).padding(.vertical, 14)
            .background(Theme.card)
            .clipShape(.rect(cornerRadius: Radius.chip))
            .overlay(RoundedRectangle(cornerRadius: Radius.chip).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
            .softLift(radius: 10, y: 3, strength: 0.7)
    }

    private var inputCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(source.displayName).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                Spacer()
                if !inputText.isEmpty {
                    Button { NaturalVoice.shared.speak(inputText, fallbackLanguage: source.bcp47) } label: {
                        Image(systemName: "speaker.wave.2.fill").scaledFont(14).foregroundStyle(Theme.secondary)
                            .frame(width: 30 * Theme.chromeScale(typeScale), height: 30 * Theme.chromeScale(typeScale))
                            .background(Theme.secondaryLight).clipShape(.circle)
                            .minimumHitTarget()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Listen to your text")
                    .accessibilityHint("Reads what you typed aloud")
                }
            }

            ZStack(alignment: .topLeading) {
                if inputText.isEmpty {
                    Text("Type in \(source.displayName)…")
                        .font(.body).foregroundStyle(Theme.textSecondary)
                        .padding(.top, 8).padding(.leading, 4)
                        .accessibilityHidden(true)
                }
                TextEditor(text: $inputText)
                    .font(.body).foregroundStyle(Theme.text)
                    .frame(minHeight: 110)
                    .scrollContentBackground(.hidden)
                    .focused($inputFocused)
                    .accessibilityLabel("Text to translate")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 180, alignment: .top)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift()
    }

    private var canTranslate: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isTranslating
    }

    private var translateButton: some View {
        Button {
            Haptics.select()
            inputFocused = false
            Task { await translate() }
        } label: {
            ZStack {
                if isTranslating {
                    HStack(spacing: 8) {
                        ProgressView().tint(.white)
                        Text("Translating…").font(.body.weight(.semibold)).foregroundStyle(.white)
                    }
                } else {
                    Text("Translate").font(.body.weight(.semibold)).foregroundStyle(.white)
                }
            }
            .frame(maxWidth: .infinity).frame(minHeight: 52)
            .background(Theme.secondary)
            .clipShape(.rect(cornerRadius: Radius.chip))
            .softLift(radius: 12, y: 5, strength: 0.8)
        }
        .buttonStyle(.plain)
        .disabled(!canTranslate)
        .opacity(canTranslate || isTranslating ? 1 : 0.5)
        .accessibilityLabel(isTranslating ? "Translating" : "Translate")
    }

    private func outputCard(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(target.displayName).font(.footnote.weight(.semibold)).foregroundStyle(Theme.secondary)
                    .tracking(0.3).textCase(.uppercase)
                Spacer()
                HStack(spacing: 8) {
                    Button { NaturalVoice.shared.speak(text, fallbackLanguage: target.bcp47) } label: {
                        Image(systemName: "speaker.wave.2.fill").scaledFont(14).foregroundStyle(Theme.secondary)
                            .frame(width: 30 * Theme.chromeScale(typeScale), height: 30 * Theme.chromeScale(typeScale))
                            .background(Theme.secondaryLight).clipShape(.circle)
                            .minimumHitTarget()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Listen to the translation")
                    .accessibilityHint("Reads the translation aloud")
                    Button {
                        UIPasteboard.general.string = text
                        Haptics.success()
                        withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { didCopy = true }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                            withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { didCopy = false }
                        }
                    } label: {
                        Image(systemName: didCopy ? "checkmark" : "doc.on.doc").scaledFont(14).foregroundStyle(Theme.secondary)
                            .frame(width: 30 * Theme.chromeScale(typeScale), height: 30 * Theme.chromeScale(typeScale))
                            .background(Theme.secondaryLight).clipShape(.circle)
                            .minimumHitTarget()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(didCopy ? "Copied" : "Copy the translation")
                }
            }
            Text(text).font(.title3.weight(.medium)).foregroundStyle(Theme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
                .accessibilityLabel("\(target.displayName) translation")
                .accessibilityValue(text)
        }
        .padding(18)
        .background(Theme.secondaryLight.opacity(0.6))
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.secondary.opacity(0.2), lineWidth: 1))
        .transition(reduceMotion ? AnyTransition.opacity : .opacity.combined(with: .move(edge: .bottom)))
    }

    private func translate() async {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isTranslating else { return }
        phase = .translating
        let outcome = await TranslationService.translation(of: text, from: source, to: target)
        withAnimation(Theme.motion(.spring(response: 0.4, dampingFraction: 0.85), reduceMotion: reduceMotion)) {
            switch outcome {
            case .translated(let result): phase = .translated(result)
            case .unavailable(let failure): phase = .failed(failure)
            }
        }
    }
}
