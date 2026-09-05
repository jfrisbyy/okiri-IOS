//
//  SpeakView.swift
//  FluentFrenchIOS
//
//  Free & Guided speaking practice, mirroring the Expo Speak screen: slate
//  gradient header with stats, a mode toggle, duration options / category +
//  prompt carousel, and a sticky Start button. The mic shows the on-device
//  notice since the cloud simulator has no microphone.
//

import SwiftUI

struct SpeakView: View {
    @Environment(AppStore.self) private var store
    @State private var mode: Mode = .free
    @State private var selectedDuration = 2
    @State private var categoryIndex = 0
    @State private var promptIndex = 0
    @State private var recording = false
    @State private var recorder = VoiceRecorder()
    @State private var spokenText = ""

    // Write & get feedback
    @State private var writeText = ""
    @State private var feedback: SpeakFeedback? = nil
    @State private var feedbackLoading = false
    @State private var feedbackError = false
    @FocusState private var writeFocused: Bool

    enum Mode { case free, guided, write }

    private var category: PromptCategory { SpeakingData.categories[categoryIndex] }
    private var prompt: SpeakingPrompt { category.prompts[min(promptIndex, category.prompts.count - 1)] }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                modeToggle
                ScrollView {
                    switch mode {
                    case .free: freeSection
                    case .guided: guidedSection
                    case .write: writeSection
                    }
                }
                .scrollIndicators(.hidden)
                if mode != .write { startBar }
            }
            .background(Theme.background)
            .ignoresSafeArea(edges: .top)
            .navigationBarHidden(true)
        }
    }

    // MARK: - Header

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [Color(hex: "334155"), Color(hex: "1E293B")], startPoint: .topLeading, endPoint: .bottomTrailing)
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.white.opacity(0.10), Color.white.opacity(0.0)],
                        center: .center, startRadius: 0, endRadius: 120
                    )
                )
                .frame(width: 220, height: 220).offset(x: 120, y: -20)
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Speak").font(.serifDisplay(34, weight: .bold)).foregroundStyle(.white)
                    Text("Practice speaking and build fluency").font(.system(size: 15)).foregroundStyle(.white.opacity(0.8))
                }
                HStack(spacing: 16) {
                    statChip("chart.line.uptrend.xyaxis", "0", "total min")
                    Rectangle().fill(.white.opacity(0.25)).frame(width: 1, height: 20)
                    statChip("clock", "0", "this week")
                    Rectangle().fill(.white.opacity(0.25)).frame(width: 1, height: 20)
                    HStack(spacing: 6) {
                        Image(systemName: "clock.arrow.circlepath").font(.system(size: 13)).foregroundStyle(.white)
                        Text("History").font(.system(size: 12, weight: .medium)).foregroundStyle(.white.opacity(0.9))
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Color.white.opacity(0.15)).clipShape(.rect(cornerRadius: 12))
            }
            .padding(.horizontal, 20).padding(.bottom, 18)
        }
        .frame(height: 195)
        .clipped()
    }

    private func statChip(_ icon: String, _ value: String, _ label: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 13)).foregroundStyle(.white)
            Text(value).font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
            Text(label).font(.system(size: 12)).foregroundStyle(.white.opacity(0.8))
        }
    }

    private var modeToggle: some View {
        HStack(spacing: 4) {
            toggleButton("Free", .free, "mic.fill")
            toggleButton("Guided", .guided, "lightbulb.fill")
            toggleButton("Write", .write, "pencil.line")
        }
        .padding(4)
        .background(Theme.backgroundSecondary)
        .clipShape(.rect(cornerRadius: 12))
        .padding(.horizontal, 20).padding(.top, 16)
    }

    private func toggleButton(_ title: String, _ m: Mode, _ icon: String) -> some View {
        let active = mode == m
        return Button {
            Haptics.tap()
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { mode = m }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 13))
                Text(title).font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(active ? .white : Theme.text)
            .frame(maxWidth: .infinity).padding(.vertical, 11)
            .background(active ? Theme.primary : .clear)
            .clipShape(.rect(cornerRadius: 9))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Write & get feedback

    private var writeSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Write & Get Feedback").font(.serifDisplay(20, weight: .semibold)).foregroundStyle(Theme.text)
                Text("Respond in French and get instant AI corrections, a fluency note, and a more natural phrasing.")
                    .font(.system(size: 14)).foregroundStyle(Theme.textMuted)
            }

            // Prompt to respond to
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("RESPOND TO THIS").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted).tracking(0.5)
                    Spacer()
                    Button {
                        Haptics.tap()
                        promptIndex = (promptIndex + 1) % category.prompts.count
                    } label: {
                        Label("New prompt", systemImage: "shuffle").font(.system(size: 12, weight: .semibold)).foregroundStyle(category.color)
                    }
                    .buttonStyle(.plain)
                }
                Text(prompt.text).font(.system(size: 16, weight: .medium)).foregroundStyle(Theme.text).lineSpacing(2)
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(category.color.opacity(0.08)).clipShape(.rect(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(category.color.opacity(0.3), lineWidth: 1))

            // Text editor
            ZStack(alignment: .topLeading) {
                if writeText.isEmpty {
                    Text("Écris ta réponse en français…")
                        .font(.system(size: 16)).foregroundStyle(Theme.textMuted)
                        .padding(.horizontal, 14).padding(.vertical, 14)
                }
                TextEditor(text: $writeText)
                    .font(.system(size: 16)).foregroundStyle(Theme.text)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 120)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .focused($writeFocused)
                    .autocorrectionDisabled()
            }
            .background(Theme.card).clipShape(.rect(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))

            Button {
                getFeedback()
            } label: {
                HStack(spacing: 10) {
                    if feedbackLoading { ProgressView().tint(.white) }
                    else { Image(systemName: "sparkles").font(.system(size: 16)) }
                    Text(feedbackLoading ? "Analyzing…" : "Get feedback").font(.system(size: 16, weight: .bold))
                }
                .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 15)
                .background(canGetFeedback ? Theme.primary : Theme.textMuted).clipShape(.rect(cornerRadius: 14))
            }
            .buttonStyle(.plain).disabled(!canGetFeedback)

            if feedbackError {
                Text("Couldn't get feedback right now. Please try again.")
                    .font(.system(size: 13)).foregroundStyle(Theme.error)
            }
            if let feedback { feedbackCard(feedback) }
        }
        .padding(20)
    }

    private var canGetFeedback: Bool {
        !writeText.trimmingCharacters(in: .whitespaces).isEmpty && !feedbackLoading
    }

    private func getFeedback() {
        runFeedback(for: writeText, prompt: prompt.text)
    }

    private func runFeedback(for response: String, prompt promptText: String) {
        let text = response.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !feedbackLoading else { return }
        Haptics.select()
        writeFocused = false
        feedbackLoading = true
        feedbackError = false
        feedback = nil
        let level = store.assessedLevel
        Task {
            let result = await SpeakFeedbackService.evaluate(response: text, prompt: promptText, level: level)
            feedbackLoading = false
            if let result {
                Haptics.success()
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { feedback = result }
            } else {
                feedbackError = true
            }
        }
    }

    // MARK: - Microphone (speech-to-text)

    private func toggleRecording() {
        if recorder.isRecording {
            Haptics.select()
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { recording = false }
            let promptText = mode == .guided ? prompt.text : "Tu parles librement de ce que tu veux."
            Task {
                let text = await recorder.stopAndTranscribe(language: "fra")
                if let text, !text.isEmpty {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { spokenText = text }
                    runFeedback(for: text, prompt: promptText)
                }
            }
            return
        }
        guard recorder.micAvailable else {
            // Cloud preview has no microphone — keep the existing visual toggle.
            Haptics.tap()
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { recording.toggle() }
            return
        }
        Haptics.tap()
        spokenText = ""
        feedback = nil
        Task {
            let started = await recorder.start()
            if started { withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { recording = true } }
        }
    }

    private var spokenResultSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            if recorder.isTranscribing {
                HStack(spacing: 10) {
                    ProgressView().tint(Theme.primary)
                    Text("Transcribing your speech…").font(.system(size: 14)).foregroundStyle(Theme.textMuted)
                }
            }
            if !spokenText.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("YOU SAID").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted).tracking(0.5)
                    Text(spokenText).font(.system(size: 16, weight: .medium)).foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: 14))
            }
            if feedbackError {
                Text("Couldn't get feedback right now. Please try again.")
                    .font(.system(size: 13)).foregroundStyle(Theme.error)
            }
            if let feedback { feedbackCard(feedback) }
        }
    }

    private func feedbackCard(_ f: SpeakFeedback) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("FEEDBACK").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted).tracking(0.5)
                Spacer()
                HStack(spacing: 6) {
                    Image(systemName: "gauge.with.dots.needle.50percent").font(.system(size: 13)).foregroundStyle(scoreColor(f.score))
                    Text("\(f.score)").font(.system(size: 15, weight: .heavy)).foregroundStyle(scoreColor(f.score))
                    Text("fluency").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                }
            }
            feedbackRow("checkmark.circle.fill", Theme.success, "Corrected", f.corrected, speakable: true)
            if !f.natural.isEmpty {
                feedbackRow("sparkles", Theme.secondary, "More natural", f.natural, speakable: true)
            }
            if !f.note.isEmpty {
                feedbackRow("lightbulb.fill", Theme.warning, "Tip", f.note, speakable: false)
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private func feedbackRow(_ icon: String, _ color: Color, _ label: String, _ text: String, speakable: Bool) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 13)).foregroundStyle(color)
                Text(label).font(.system(size: 12, weight: .bold)).foregroundStyle(color)
                Spacer()
                if speakable {
                    Button { Haptics.tap(); NaturalVoice.shared.speak(text) } label: {
                        Image(systemName: "speaker.wave.2.fill").font(.system(size: 12)).foregroundStyle(color)
                    }.buttonStyle(.plain)
                }
            }
            Text(text).font(.system(size: 15)).foregroundStyle(Theme.text).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(color.opacity(0.08)).clipShape(.rect(cornerRadius: 12))
    }

    private func scoreColor(_ score: Int) -> Color {
        if score >= 75 { return Theme.success }
        if score >= 50 { return Theme.warning }
        return Theme.error
    }

    // MARK: - Free

    private var freeSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Session Length").font(.serifDisplay(20, weight: .semibold)).foregroundStyle(Theme.text)
                Text("Speak freely about anything — your day, thoughts, or stories").font(.system(size: 14)).foregroundStyle(Theme.textMuted)
            }
            HStack(spacing: 10) {
                ForEach(SpeakingData.freeDurations, id: \.value) { d in
                    let active = selectedDuration == d.value
                    Button {
                        Haptics.tap(); selectedDuration = d.value
                    } label: {
                        VStack(spacing: 4) {
                            Text(d.label).font(.system(size: 17, weight: .bold)).foregroundStyle(active ? Theme.primaryDark : Theme.text)
                            Text(d.description).font(.system(size: 10)).foregroundStyle(active ? Theme.primary : Theme.textMuted).multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(active ? Theme.primaryLight : Theme.card)
                        .clipShape(.rect(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(active ? Theme.primary : Theme.border, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("Tips for Free Speech").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text)
                ForEach(SpeakingData.tips, id: \.self) { tip in
                    HStack(spacing: 8) {
                        Circle().fill(Theme.primary).frame(width: 5, height: 5)
                        Text(tip).font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: 14))

            if !recorder.micAvailable {
                CameraNotice(text: "Install this app on your device via the Rork App to use the microphone for live speech feedback.")
            }
            spokenResultSection
        }
        .padding(20)
    }

    // MARK: - Guided

    private var guidedSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Choose a Category").font(.serifDisplay(20, weight: .semibold)).foregroundStyle(Theme.text)
                Text("Targeted prompts to expand your vocabulary").font(.system(size: 14)).foregroundStyle(Theme.textMuted)
            }

            ScrollView(.horizontal) {
                HStack(spacing: 10) {
                    ForEach(Array(SpeakingData.categories.enumerated()), id: \.element.id) { idx, cat in
                        let active = categoryIndex == idx
                        Button {
                            Haptics.tap()
                            categoryIndex = idx; promptIndex = 0
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: cat.icon).font(.system(size: 14))
                                    .foregroundStyle(active ? .white : cat.color)
                                Text(cat.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(active ? .white : Theme.text)
                                Text(cat.cefr + "+").font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(active ? .white : Theme.textMuted)
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(active ? Color.white.opacity(0.25) : Theme.backgroundSecondary)
                                    .clipShape(.capsule)
                            }
                            .padding(.horizontal, 14).padding(.vertical, 10)
                            .background(active ? cat.color : Theme.card)
                            .clipShape(.rect(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? .clear : Theme.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .contentMargins(.horizontal, 0, for: .scrollContent)
            .scrollIndicators(.hidden)

            promptCard
            promptNav
            if !recorder.micAvailable {
                CameraNotice(text: "Install this app on your device via the Rork App to use the microphone for live speech feedback.")
            }
            spokenResultSection
        }
        .padding(20)
    }

    private var promptCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("\(promptIndex + 1) of \(category.prompts.count)").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                Spacer()
                Text(prompt.challenge).font(.system(size: 12, weight: .medium)).foregroundStyle(.white)
            }
            .padding(.horizontal, 14).padding(.vertical, 11)
            .background(category.color)

            VStack(alignment: .leading, spacing: 14) {
                Text(prompt.text).font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.text).lineSpacing(3)
                VStack(alignment: .leading, spacing: 8) {
                    Text("KEY VOCABULARY").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textMuted).tracking(0.5)
                    FlowChips(items: prompt.vocabularyFocus, color: category.color)
                }
            }
            .padding(14)
        }
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(category.color, lineWidth: 2))
    }

    private var promptNav: some View {
        HStack {
            Button {
                Haptics.tap()
                if promptIndex > 0 { withAnimation { promptIndex -= 1 } }
            } label: {
                Image(systemName: "chevron.left").font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(promptIndex == 0 ? Theme.textMuted : Theme.text)
            }
            .buttonStyle(.plain).disabled(promptIndex == 0)
            Spacer()
            HStack(spacing: 6) {
                ForEach(0..<category.prompts.count, id: \.self) { i in
                    Circle().fill(i == promptIndex ? category.color : Theme.border).frame(width: 8, height: 8)
                }
            }
            Spacer()
            Button {
                Haptics.tap()
                if promptIndex < category.prompts.count - 1 { withAnimation { promptIndex += 1 } }
            } label: {
                Image(systemName: "chevron.right").font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(promptIndex == category.prompts.count - 1 ? Theme.textMuted : Theme.text)
            }
            .buttonStyle(.plain).disabled(promptIndex == category.prompts.count - 1)
        }
        .padding(.horizontal, 8).padding(.top, 4)
    }

    // MARK: - Start bar

    private var startBar: some View {
        VStack(spacing: 0) {
            Button {
                toggleRecording()
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: recording ? "stop.fill" : "mic.fill").font(.system(size: 18)).foregroundStyle(.white)
                        .frame(width: 32, height: 32).background(Color.white.opacity(0.2)).clipShape(.circle)
                        .scaleEffect(recording ? 1.12 : 1)
                        .animation(recording ? .easeInOut(duration: 0.7).repeatForever(autoreverses: true) : .default, value: recording)
                    Text(recording ? "Listening… tap to stop" : (mode == .free ? "Start Free Speech" : "Start with This Prompt"))
                        .font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 16)
                .background(recording ? Theme.error : (mode == .guided ? category.color : Theme.primary))
                .clipShape(.rect(cornerRadius: Radius.card))
            }
            .buttonStyle(.plain)
            .pressable()
        }
        .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 20)
        .background(Theme.background)
        .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 1) }
    }
}

/// Simple wrapping chips row for vocabulary tags.
struct FlowChips: View {
    let items: [String]
    var color: Color = Theme.primary
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 72), spacing: 8, alignment: .leading)], alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { word in
                Text(word).font(.system(size: 12, weight: .medium)).italic()
                    .foregroundStyle(color)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(color.opacity(0.12)).clipShape(.rect(cornerRadius: 6))
            }
        }
    }
}
