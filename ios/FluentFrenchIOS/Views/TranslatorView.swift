//
//  TranslatorView.swift
//  FluentFrenchIOS
//
//  Two-way English↔French translator powered by the live AI translation
//  service. Type or (on device) speak, hear results read aloud, and copy.
//

import SwiftUI

struct TranslatorView: View {
    @Environment(\.dismiss) private var dismiss

    enum Mode: String, CaseIterable { case type = "Type", listen = "Listen" }

    @State private var mode: Mode = .type
    @State private var source: TranslationLanguage = .english
    @State private var inputText: String = ""
    @State private var outputText: String = ""
    @State private var isTranslating = false
    @State private var didCopy = false
    @FocusState private var inputFocused: Bool

    private var target: TranslationLanguage { source.opposite }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 16) {
                    modeSelector
                    languageSelector
                    inputCard
                    translateButton
                    if !outputText.isEmpty { outputCard }
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
            subtitle: "Instant English ↔ French",
            onBack: { dismiss() }
        )
    }

    private var modeSelector: some View {
        HStack(spacing: 4) {
            ForEach(Mode.allCases, id: \.self) { m in
                Button { Haptics.tap(); withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { mode = m } } label: {
                    HStack(spacing: 8) {
                        Image(systemName: m == .type ? "keyboard" : "headphones").font(.system(size: 15))
                        Text(m.rawValue).font(.system(size: 14, weight: .semibold))
                    }
                    .foregroundStyle(mode == m ? .white : Theme.textSecondary)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(mode == m ? Theme.secondary : Color.clear)
                    .clipShape(.rect(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.chip))
        .overlay(RoundedRectangle(cornerRadius: Radius.chip).stroke(Theme.border, lineWidth: 0.5))
    }

    private var languageSelector: some View {
        HStack(spacing: 12) {
            languageBox(source.displayName)
            Button {
                Haptics.tap()
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    source = source.opposite
                    let oldInput = inputText
                    inputText = outputText
                    outputText = oldInput
                }
            } label: {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.secondary)
                    .frame(width: 44, height: 44)
                    .background(Theme.secondaryLight).clipShape(.circle)
                    .overlay(Circle().stroke(Theme.secondary.opacity(0.15), lineWidth: 0.5))
            }
            .buttonStyle(.plain)
            languageBox(target.displayName)
        }
    }

    private func languageBox(_ name: String) -> some View {
        Text(name)
            .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
            .frame(maxWidth: .infinity).padding(.vertical, 14)
            .background(Theme.card)
            .clipShape(.rect(cornerRadius: Radius.chip))
            .overlay(RoundedRectangle(cornerRadius: Radius.chip).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
            .softLift(radius: 10, y: 3, strength: 0.7)
    }

    private var inputCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(source.displayName).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.textSecondary)
                Spacer()
                if !inputText.isEmpty {
                    Button { NaturalVoice.shared.speak(inputText, fallbackLanguage: source.bcp47) } label: {
                        Image(systemName: "speaker.wave.2.fill").font(.system(size: 14)).foregroundStyle(Theme.secondary)
                            .frame(width: 30, height: 30).background(Theme.secondaryLight).clipShape(.circle)
                    }
                    .buttonStyle(.plain)
                }
            }

            if mode == .type {
                ZStack(alignment: .topLeading) {
                    if inputText.isEmpty {
                        Text("Type in \(source.displayName)…")
                            .font(.system(size: 16)).foregroundStyle(Theme.textMuted)
                            .padding(.top, 8).padding(.leading, 4)
                    }
                    TextEditor(text: $inputText)
                        .font(.system(size: 16)).foregroundStyle(Theme.text)
                        .frame(minHeight: 110)
                        .scrollContentBackground(.hidden)
                        .focused($inputFocused)
                }
            } else {
                listenPlaceholder
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 180, alignment: .top)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift()
    }

    private var listenPlaceholder: some View {
        VStack(spacing: 14) {
            Image(systemName: "mic.fill").font(.system(size: 30)).foregroundStyle(.white)
                .frame(width: 80, height: 80).background(Theme.secondary).clipShape(.circle)
            Text("Install this app on your device via the Rork App to speak.")
                .font(.system(size: 14)).foregroundStyle(Theme.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
    }

    private var translateButton: some View {
        Button {
            Haptics.select()
            inputFocused = false
            Task { await translate() }
        } label: {
            ZStack {
                if isTranslating {
                    ProgressView().tint(.white)
                } else {
                    Text("Translate").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                }
            }
            .frame(maxWidth: .infinity).padding(.vertical, 16)
            .background(Theme.secondary)
            .clipShape(.rect(cornerRadius: Radius.chip))
            .softLift(radius: 12, y: 5, strength: 0.8)
        }
        .buttonStyle(.plain)
        .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isTranslating)
        .opacity(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.5 : 1)
    }

    private var outputCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(target.displayName).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.secondary)
                    .tracking(0.3).textCase(.uppercase)
                Spacer()
                HStack(spacing: 8) {
                    Button { NaturalVoice.shared.speak(outputText, fallbackLanguage: target.bcp47) } label: {
                        Image(systemName: "speaker.wave.2.fill").font(.system(size: 14)).foregroundStyle(Theme.secondary)
                            .frame(width: 30, height: 30).background(Theme.secondaryLight).clipShape(.circle)
                    }
                    .buttonStyle(.plain)
                    Button {
                        UIPasteboard.general.string = outputText
                        Haptics.success()
                        withAnimation { didCopy = true }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { withAnimation { didCopy = false } }
                    } label: {
                        Image(systemName: didCopy ? "checkmark" : "doc.on.doc").font(.system(size: 14)).foregroundStyle(Theme.secondary)
                            .frame(width: 30, height: 30).background(Theme.secondaryLight).clipShape(.circle)
                    }
                    .buttonStyle(.plain)
                }
            }
            Text(outputText).font(.system(size: 19, weight: .medium)).foregroundStyle(Theme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(18)
        .background(Theme.secondaryLight.opacity(0.6))
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.secondary.opacity(0.2), lineWidth: 1))
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }

    private func translate() async {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isTranslating = true
        let result = await TranslationService.translate(text, from: source, to: target)
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
            outputText = result
            isTranslating = false
        }
    }
}
