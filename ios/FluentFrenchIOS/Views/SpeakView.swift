//
//  SpeakView.swift
//  FluentFrenchIOS
//
//  Free, guided and written speaking practice. Recordings are capped by the
//  session length you pick (E16), transcribed, and sent for feedback; the
//  corrected and the natural phrasing land in your deck and the concepts the
//  feedback names become speaking evidence (E13). The microphone reports
//  exactly why it can't be used (permission / no speech key / no input
//  device) and every AI call has an explicit no-key / offline / error state.
//

import Foundation
import SwiftUI
import UIKit

struct SpeakView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The app leaving the foreground stops microphone capture (no background
    /// audio mode), so the recording has to stop with it (talkmedia-4-3).
    @Environment(\.scenePhase) private var scenePhase
    /// The header holds the largest text on the screen, so its height grows with
    /// the learner's text size instead of clipping the title and the stat row.
    @ScaledMetric(relativeTo: .largeTitle) private var headerHeight: CGFloat = 195
    @State private var mode: Mode = .free
    @State private var selectedDuration = Tuning.speakDefaultDurationMinutes
    @State private var categoryIndex = 0
    @State private var promptIndex = 0
    @State private var recorder = VoiceRecorder()
    @State private var spokenText = ""
    @State private var micNotice: String? = nil
    @State private var showSettingsAlert = false

    // Feedback (spoken or written)
    @State private var writeText = ""
    @State private var feedback: SpeakFeedback? = nil
    @State private var feedbackOutcome: AppStore.SpeakFeedbackOutcome? = nil
    @State private var feedbackLoading = false
    @State private var feedbackFailure: TalkServiceFailure? = nil
    @State private var lastRequest: (response: String, prompt: String)? = nil
    @State private var feedbackTask: Task<Void, Never>? = nil
    @FocusState private var writeFocused: Bool

    enum Mode { case free, guided, write }

    private var category: PromptCategory { SpeakingData.categories[categoryIndex] }
    private var prompt: SpeakingPrompt { category.prompts[min(promptIndex, category.prompts.count - 1)] }
    private var micState: MicAvailability { recorder.availability }
    private var feedbackAvailable: Bool { SpeakFeedbackService.hasKey }

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
        .onDisappear {
            NaturalVoice.shared.stop()
            recorder.cancel()
            feedbackTask?.cancel()
        }
        .onChange(of: recorder.stoppedAtCap) { _, stopped in
            if stopped { finishRecording() }
        }
        .onChange(of: recorder.interruptedSeconds) { _, seconds in
            handleInterruption(seconds)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { recorder.noteInterrupted() }
        }
        .onChange(of: mode) { _, _ in
            if recorder.isRecording { recorder.cancel() }
            NaturalVoice.shared.stop()
        }
        .alert(MicAvailability.permissionDenied.title, isPresented: $showSettingsAlert) {
            Button("Open Settings") { openSettings() }
            Button("Not now", role: .cancel) {}
        } message: {
            Text(MicAvailability.permissionDenied.message(typedAlternative: "use Write to get feedback on typed French"))
        }
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
    }

    // MARK: - Header (stats bound to the store — E16)

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [Color(hex: "334155"), Color(hex: "1E293B")], startPoint: .topLeading, endPoint: .bottomTrailing)
            Circle()
                .fill(RadialGradient(colors: [Color.white.opacity(0.10), Color.white.opacity(0.0)],
                                     center: .center, startRadius: 0, endRadius: 120))
                .frame(width: 220, height: 220).offset(x: 120, y: -20)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Speak").scaledSerifDisplay(34, weight: .bold).foregroundStyle(.white)
                    Text("Practice speaking and build fluency").font(.system(.callout)).foregroundStyle(.white.opacity(0.8))
                }
                HStack(spacing: 16) {
                    statChip("chart.line.uptrend.xyaxis", "\(store.totalMinutes(.speaking))", "total min")
                    Rectangle().fill(.white.opacity(0.25)).frame(width: 1, height: 20)
                    statChip("clock", "\(store.minutesThisWeek(.speaking))", "this week")
                    Rectangle().fill(.white.opacity(0.25)).frame(width: 1, height: 20)
                    statChip("text.book.closed", "\(store.visibleGaps.filter { $0.sourceType == .speech }.count)", "saved")
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Color.white.opacity(0.15)).clipShape(.rect(cornerRadius: 12))
            }
            .padding(.horizontal, 20).padding(.bottom, 18)
        }
        .frame(height: headerHeight)
        .clipped()
    }

    private func statChip(_ icon: String, _ value: String, _ label: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(.footnote)).foregroundStyle(.white).accessibilityHidden(true)
            Text(value).font(.system(.body, weight: .bold)).foregroundStyle(.white)
            Text(label).font(.system(.caption)).foregroundStyle(.white.opacity(0.8))
        }
        .accessibilityElement(children: .combine)
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
            withAnimation(Theme.motion(.spring(response: 0.3, dampingFraction: 0.8), reduceMotion: reduceMotion)) { mode = m }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(.footnote)).accessibilityHidden(true)
                Text(title).font(.system(.subheadline, weight: .semibold))
            }
            .foregroundStyle(active ? .white : Theme.text)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(active ? Theme.primary : .clear)
            .clipShape(.rect(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title) mode")
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    // MARK: - Write & get feedback

    private var writeSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Write & Get Feedback").scaledSerifDisplay(20, weight: .semibold).foregroundStyle(Theme.text)
                Text("Respond in French and get corrections, a fluency note, and a more natural phrasing.")
                    .font(.system(.subheadline)).foregroundStyle(Theme.textSecondary)
            }

            if !feedbackAvailable { unavailableCard(TalkServiceFailure.noKey) }

            // Prompt to respond to
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("RESPOND TO THIS").font(.system(.caption2, weight: .bold)).foregroundStyle(Theme.textSecondary).tracking(0.5)
                    Spacer()
                    Button {
                        Haptics.tap()
                        promptIndex = (promptIndex + 1) % category.prompts.count
                    } label: {
                        Label("New prompt", systemImage: "shuffle").font(.system(.caption, weight: .semibold)).foregroundStyle(category.color)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.plain)
                }
                Text(prompt.text).font(.system(.body, weight: .medium)).foregroundStyle(Theme.text).lineSpacing(2)
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(category.color.opacity(0.08)).clipShape(.rect(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(category.color.opacity(0.3), lineWidth: 1))

            // Text editor
            ZStack(alignment: .topLeading) {
                if writeText.isEmpty {
                    Text("Write your answer in French…")
                        .font(.system(.body)).foregroundStyle(Theme.textSecondary)
                        .padding(.horizontal, 14).padding(.vertical, 14)
                        .accessibilityHidden(true)
                }
                TextEditor(text: $writeText)
                    .font(.system(.body)).foregroundStyle(Theme.text)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 120)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .focused($writeFocused)
                    .autocorrectionDisabled()
                    .accessibilityLabel("Your answer in French")
            }
            .background(Theme.card).clipShape(.rect(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))

            Button {
                runFeedback(for: writeText, prompt: prompt.text)
            } label: {
                HStack(spacing: 10) {
                    if feedbackLoading { ProgressView().tint(.white).accessibilityHidden(true) }
                    else { Image(systemName: "sparkles").font(.system(.body)).accessibilityHidden(true) }
                    Text(feedbackLoading ? "Checking your French…" : "Get feedback").font(.system(.body, weight: .bold))
                }
                .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 15)
                .background(canGetFeedback ? Theme.primary : Theme.textMuted).clipShape(.rect(cornerRadius: 14))
            }
            .buttonStyle(.plain).disabled(!canGetFeedback)

            feedbackResults
        }
        .padding(20)
    }

    private var canGetFeedback: Bool {
        feedbackAvailable && !writeText.trimmingCharacters(in: .whitespaces).isEmpty && !feedbackLoading
    }

    // MARK: - Feedback flow (E13 / E26)

    /// Send a response for feedback. Bounded by `Tuning.speakFeedbackTimeout`;
    /// a failure is shown with its reason and a Retry.
    private func runFeedback(for response: String, prompt promptText: String) {
        let text = response.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !feedbackLoading else { return }
        // One attempt, one round: asking again for feedback on text that is
        // already graded on screen would book a second miss on the same card
        // (talkmedia-4-4). A retry after a failure still runs — no feedback is
        // showing then.
        if feedback != nil, let lastRequest, lastRequest.response == text, lastRequest.prompt == promptText { return }
        guard feedbackAvailable else { feedbackFailure = .noKey; return }
        Haptics.select()
        writeFocused = false
        feedbackLoading = true
        feedbackFailure = nil
        feedback = nil
        feedbackOutcome = nil
        lastRequest = (text, promptText)
        let level = store.learnerLevel
        let concepts = store.concepts
        feedbackTask?.cancel()
        feedbackTask = Task {
            let result = await SpeakFeedbackService.evaluate(response: text, prompt: promptText, level: level, concepts: concepts)
            // A cancelled request never leaves the button on "Checking your French…" (E26).
            guard !Task.isCancelled else { feedbackLoading = false; return }
            feedbackLoading = false
            switch result {
            case .success(let fb):
                Haptics.success()
                let outcome = store.recordSpeakFeedback(original: text, feedback: fb, promptText: promptText)
                withAnimation(Theme.motion(.spring(response: 0.4, dampingFraction: 0.85), reduceMotion: reduceMotion)) {
                    feedback = fb
                    feedbackOutcome = outcome
                }
                // The feedback call just succeeded, so the same service is reachable:
                // fill in any deck cards still waiting for a meaning (this round's
                // if the model gave none, or older offline captures).
                if !store.pendingTranslations.isEmpty {
                    await store.resolvePendingTranslations(using: TranslationService.lookup(term:context:))
                }
            case .failure(let failure):
                feedbackFailure = failure
            }
        }
    }

    private func retryFeedback() {
        guard let lastRequest else { return }
        runFeedback(for: lastRequest.response, prompt: lastRequest.prompt)
    }

    @ViewBuilder
    private var feedbackResults: some View {
        if let failure = feedbackFailure { failureCard(failure) }
        if let feedback { feedbackCard(feedback) }
        if let outcome = feedbackOutcome { outcomeCard(outcome) }
    }

    private func failureCard(_ failure: TalkServiceFailure) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: failure == .offline ? "wifi.slash" : "exclamationmark.triangle.fill")
                .font(.system(.subheadline)).foregroundStyle(Theme.error).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(failure.title).font(.system(.subheadline, weight: .bold)).foregroundStyle(Theme.text)
                Text(failure.message).font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if failure.isRetryable, lastRequest != nil {
                Button { Haptics.tap(); retryFeedback() } label: {
                    Text("Retry").font(.system(.footnote, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 14).frame(minHeight: 44)
                        .background(Theme.error).clipShape(.capsule)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.errorLight).clipShape(.rect(cornerRadius: 14))
    }

    /// The build has no AI key: say so once, plainly, instead of a dead button.
    private func unavailableCard(_ failure: TalkServiceFailure) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "bolt.slash.fill").font(.system(.subheadline)).foregroundStyle(Theme.warning).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text("Feedback isn't available in this build").font(.system(.subheadline, weight: .bold)).foregroundStyle(Theme.text)
                Text("AI feedback needs the tutor service, which isn't included here. You can still practice out loud and review your saved phrases.")
                    .font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.warningLight).clipShape(.rect(cornerRadius: 14))
    }

    /// What the feedback left behind: saved phrases and concept evidence (E13).
    private func outcomeCard(_ outcome: AppStore.SpeakFeedbackOutcome) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: outcome.tooLongToSave ? "text.alignleft"
                        : (outcome.savedCount > 0 ? "tray.and.arrow.down.fill" : "checkmark.circle"))
                    .font(.system(.footnote))
                    .foregroundStyle(outcome.tooLongToSave ? Theme.textSecondary : Theme.success)
                    .accessibilityHidden(true)
                Text(outcomeHeadline(outcome)).font(.system(.footnote, weight: .semibold)).foregroundStyle(Theme.text)
            }
            if !outcome.missedConceptIds.isEmpty || !outcome.strongConceptIds.isEmpty {
                FlowChips(items: outcome.missedConceptIds.compactMap { store.concept($0)?.name }.map { "Work on: \($0)" }
                          + outcome.strongConceptIds.compactMap { store.concept($0)?.name }.map { "Solid: \($0)" },
                          color: Theme.secondary)
            }
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.successLight).clipShape(.rect(cornerRadius: 12))
    }

    /// What the round left in the deck, in the learner's terms — including the
    /// two cases the deck's own rule creates: a correction too long to be a card,
    /// and one that was shortened to the part that changed (talkmedia-4-1).
    private func outcomeHeadline(_ outcome: AppStore.SpeakFeedbackOutcome) -> String {
        if outcome.repeatedSubmission { return "Same answer as last time — nothing recorded twice." }
        switch (outcome.savedCount, outcome.duplicateCount) {
        case (0, 0) where outcome.tooLongToSave:
            return "Too long to save as a card — a card holds a word or a short phrase, so read the correction above instead."
        case (0, 0): return "Nothing new to save — your line was already good."
        case (0, _): return "These phrases are already in your deck."
        case (1, _) where outcome.shortened: return "Saved the part we corrected as 1 phrase."
        case (1, _): return "Saved 1 phrase to your deck."
        default: return "Saved \(outcome.savedCount) phrases to your deck."
        }
    }

    // MARK: - Microphone (speech-to-text)

    private var currentPromptText: String {
        mode == .guided ? prompt.text : ""
    }

    private func toggleRecording() {
        if recorder.isRecording {
            Haptics.select()
            finishRecording()
            return
        }
        let state = micState
        guard state.isReady || state == .permissionDenied else {
            Haptics.tap()
            micNotice = state.message(typedAlternative: "use Write to get feedback on typed French")
            return
        }
        Haptics.tap()
        micNotice = nil
        spokenText = ""
        feedback = nil
        feedbackOutcome = nil
        feedbackFailure = nil
        NaturalVoice.shared.stop()
        let cap = mode == .free ? SpeakRecordingCap.seconds(forMinutes: selectedDuration) : Tuning.speakGuidedRecordingSeconds
        Task {
            let result = await recorder.start(maxSeconds: cap)
            if case .failure(let failure) = result {
                switch failure {
                case .unavailable(.permissionDenied): showSettingsAlert = true
                case .unavailable(let other): micNotice = other.message(typedAlternative: "use Write to get feedback on typed French")
                case .audioSessionFailed: micNotice = "The microphone couldn't start. Try again, or use Write."
                case .alreadyRecording: break
                }
            }
        }
    }

    /// Stop (or pick up the cap's stop), transcribe, and ask for feedback.
    private func finishRecording() {
        let promptText = currentPromptText
        Task {
            let outcome = await recorder.stopAndTranscribe(language: "fra")
            switch outcome {
            case .text(let text):
                withAnimation(Theme.motion(.spring(response: 0.4, dampingFraction: 0.85), reduceMotion: reduceMotion)) { spokenText = text }
                if feedbackAvailable {
                    runFeedback(for: text, prompt: promptText)
                } else {
                    feedbackFailure = .noKey
                }
            case .nothingHeard, .failed:
                micNotice = outcome.message
            }
        }
    }

    /// Something took the microphone mid-recording (a call, Siri, leaving the
    /// app). Say so, naming how much was captured, and only send that fragment
    /// for feedback when there is enough of it to grade — never silently treat a
    /// few seconds as the whole answer (talkmedia-4-3).
    private func handleInterruption(_ seconds: Int?) {
        guard let seconds else { return }
        micNotice = InterruptedRecording.notice(secondsCaptured: seconds)
        if InterruptedRecording.isWorthTranscribing(secondsCaptured: seconds) {
            finishRecording()
        } else {
            recorder.cancel()
        }
    }

    /// The microphone's state when it is not ready (E14): three distinct
    /// notices, with the Settings link only where Settings is the fix.
    @ViewBuilder
    private var micNoticeCard: some View {
        let state = micState
        if !state.isReady {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "mic.slash.fill").font(.system(.subheadline)).foregroundStyle(Theme.textMuted).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(state.title).font(.system(.subheadline, weight: .bold)).foregroundStyle(Theme.text)
                    Text(state.message(typedAlternative: "use Write to get feedback on typed French"))
                        .font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if state.canOpenSettings {
                        Button { Haptics.tap(); openSettings() } label: {
                            Text("Open Settings").font(.system(.footnote, weight: .bold)).foregroundStyle(Theme.primary)
                                .minimumHitTarget()
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: 14))
        } else if let micNotice {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "exclamationmark.circle").font(.system(.subheadline)).foregroundStyle(Theme.error).accessibilityHidden(true)
                Text(micNotice).font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.errorLight).clipShape(.rect(cornerRadius: 14))
        }
    }

    private var spokenResultSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            micNoticeCard
            if recorder.isTranscribing {
                HStack(spacing: 10) {
                    ProgressView().tint(Theme.primary).accessibilityHidden(true)
                    Text("Transcribing your speech…").font(.system(.subheadline)).foregroundStyle(Theme.textSecondary)
                }
                .accessibilityElement(children: .combine)
            }
            if !spokenText.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("YOU SAID").font(.system(.caption2, weight: .bold)).foregroundStyle(Theme.textSecondary).tracking(0.5)
                    Text(spokenText).font(.system(.body, weight: .medium)).foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: 14))
            }
            if feedbackLoading {
                HStack(spacing: 10) {
                    ProgressView().tint(Theme.primary).accessibilityHidden(true)
                    Text("Getting feedback…").font(.system(.subheadline)).foregroundStyle(Theme.textSecondary)
                }
                .accessibilityElement(children: .combine)
            }
            feedbackResults
        }
    }

    private func feedbackCard(_ f: SpeakFeedback) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("FEEDBACK").font(.system(.caption2, weight: .bold)).foregroundStyle(Theme.textSecondary).tracking(0.5)
                Spacer()
                HStack(spacing: 6) {
                    Image(systemName: "gauge.with.dots.needle.50percent").font(.system(.footnote)).foregroundStyle(scoreColor(f.score))
                        .accessibilityHidden(true)
                    Text("\(f.score)").font(.system(.callout, weight: .heavy)).foregroundStyle(scoreColor(f.score))
                    Text("fluency").font(.system(.caption)).foregroundStyle(Theme.textSecondary)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Fluency")
                .accessibilityValue("\(f.score) out of 100")
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
        .transition(reduceMotion
                    ? AnyTransition.opacity
                    : AnyTransition.move(edge: .bottom).combined(with: .opacity))
    }

    private func feedbackRow(_ icon: String, _ color: Color, _ label: String, _ text: String, speakable: Bool) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(.footnote)).foregroundStyle(color).accessibilityHidden(true)
                Text(label).font(.system(.caption, weight: .bold)).foregroundStyle(color)
                Spacer()
                if speakable {
                    Button { Haptics.tap(); NaturalVoice.shared.speak(text) } label: {
                        Image(systemName: "speaker.wave.2.fill").font(.system(.caption)).foregroundStyle(color)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Hear \(label.lowercased()) phrasing")
                }
            }
            Text(text).font(.system(.callout)).foregroundStyle(Theme.text).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(color.opacity(0.08)).clipShape(.rect(cornerRadius: 12))
    }

    private func scoreColor(_ score: Int) -> Color {
        if score >= Tuning.speakScoreStrongFloor { return Theme.success }
        if score >= Tuning.speakScoreFairFloor { return Theme.warning }
        return Theme.error
    }

    // MARK: - Free

    private var freeSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Session Length").scaledSerifDisplay(20, weight: .semibold).foregroundStyle(Theme.text)
                Text("Speak freely about anything — recording stops automatically at the length you pick.")
                    .font(.system(.subheadline)).foregroundStyle(Theme.textSecondary)
            }
            HStack(spacing: 10) {
                ForEach(SpeakingData.freeDurations, id: \.value) { d in
                    let active = selectedDuration == d.value
                    Button {
                        Haptics.tap(); selectedDuration = d.value
                    } label: {
                        VStack(spacing: 4) {
                            Text(d.label).font(.system(.headline, weight: .bold)).foregroundStyle(active ? Theme.primaryDark : Theme.text)
                            Text(d.description).font(.system(.caption2)).foregroundStyle(active ? Theme.primary : Theme.textSecondary).multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity, minHeight: 44).padding(.vertical, 14)
                        .background(active ? Theme.primaryLight : Theme.card)
                        .clipShape(.rect(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(active ? Theme.primary : Theme.border, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                    .disabled(recorder.isRecording)
                    .accessibilityLabel("\(d.label), \(d.description)")
                    .accessibilityAddTraits(active ? .isSelected : [])
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("Tips for Free Speech").font(.system(.subheadline, weight: .semibold)).foregroundStyle(Theme.text)
                ForEach(SpeakingData.tips, id: \.self) { tip in
                    HStack(spacing: 8) {
                        Circle().fill(Theme.primary).frame(width: 5, height: 5).accessibilityHidden(true)
                        Text(tip).font(.system(.subheadline)).foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: 14))

            if !feedbackAvailable { unavailableCard(.noKey) }
            spokenResultSection
        }
        .padding(20)
    }

    // MARK: - Guided

    private var guidedSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Choose a Category").scaledSerifDisplay(20, weight: .semibold).foregroundStyle(Theme.text)
                Text("Targeted prompts to expand your vocabulary").font(.system(.subheadline)).foregroundStyle(Theme.textSecondary)
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
                                Image(systemName: cat.icon).font(.system(.subheadline))
                                    .foregroundStyle(active ? .white : cat.color)
                                    .accessibilityHidden(true)
                                Text(cat.name).font(.system(.subheadline, weight: .semibold)).foregroundStyle(active ? .white : Theme.text)
                                Text(cat.cefr + "+").font(.system(.caption2, weight: .bold))
                                    .foregroundStyle(active ? .white : Theme.textSecondary)
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(active ? Color.white.opacity(0.25) : Theme.backgroundSecondary)
                                    .clipShape(.capsule)
                            }
                            .padding(.horizontal, 14).frame(minHeight: 44)
                            .background(active ? cat.color : Theme.card)
                            .clipShape(.rect(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(active ? .clear : Theme.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(active ? .isSelected : [])
                    }
                }
            }
            .contentMargins(.horizontal, 0, for: .scrollContent)
            .scrollIndicators(.hidden)

            promptCard
            promptNav
            if !feedbackAvailable { unavailableCard(.noKey) }
            spokenResultSection
        }
        .padding(20)
    }

    private var promptCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("\(promptIndex + 1) of \(category.prompts.count)").font(.system(.caption, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                Spacer()
                Text(prompt.challenge).font(.system(.caption, weight: .medium)).foregroundStyle(.white)
            }
            .padding(.horizontal, 14).padding(.vertical, 11)
            .background(category.color)

            VStack(alignment: .leading, spacing: 14) {
                Text(prompt.text).font(.system(.title3, weight: .semibold)).foregroundStyle(Theme.text).lineSpacing(3)
                VStack(alignment: .leading, spacing: 8) {
                    Text("KEY VOCABULARY").font(.system(.caption2, weight: .semibold)).foregroundStyle(Theme.textSecondary).tracking(0.5)
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
                if promptIndex > 0 { withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { promptIndex -= 1 } }
            } label: {
                Image(systemName: "chevron.left").font(.system(.title2, weight: .semibold))
                    .foregroundStyle(promptIndex == 0 ? Theme.textMuted : Theme.text)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain).disabled(promptIndex == 0)
            .accessibilityLabel("Previous prompt")
            Spacer()
            HStack(spacing: 6) {
                ForEach(0..<category.prompts.count, id: \.self) { i in
                    Circle().fill(i == promptIndex ? category.color : Theme.border).frame(width: 8, height: 8)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Prompt \(promptIndex + 1) of \(category.prompts.count)")
            Spacer()
            Button {
                Haptics.tap()
                if promptIndex < category.prompts.count - 1 { withAnimation(Theme.motion(.default, reduceMotion: reduceMotion)) { promptIndex += 1 } }
            } label: {
                Image(systemName: "chevron.right").font(.system(.title2, weight: .semibold))
                    .foregroundStyle(promptIndex == category.prompts.count - 1 ? Theme.textMuted : Theme.text)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain).disabled(promptIndex == category.prompts.count - 1)
            .accessibilityLabel("Next prompt")
        }
        .padding(.horizontal, 8).padding(.top, 4)
    }

    // MARK: - Start bar (real recording state, capped — E15 / E16)

    private var startBar: some View {
        let state = micState
        let recording = recorder.isRecording
        let busy = recorder.isTranscribing || feedbackLoading
        let usable = state.isReady || state == .permissionDenied
        let title: String
        if recording {
            title = "Listening… \(SpeakRecordingCap.countdown(secondsLeft: recorder.secondsLeft)) left · tap to stop"
        } else if busy {
            title = recorder.isTranscribing ? "Transcribing…" : "Getting feedback…"
        } else if !usable {
            title = state.title
        } else if state == .permissionDenied {
            title = "Allow microphone access"
        } else {
            title = mode == .free ? "Start Free Speech" : "Start with This Prompt"
        }
        return VStack(spacing: 0) {
            Button {
                toggleRecording()
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: recording ? "stop.fill" : (usable ? "mic.fill" : "mic.slash.fill")).font(.system(.body)).foregroundStyle(.white)
                        .frame(width: 32, height: 32).background(Color.white.opacity(0.2)).clipShape(.circle)
                        .accessibilityHidden(true)
                    Text(title)
                        .font(.system(.headline, weight: .semibold)).foregroundStyle(.white)
                        .lineLimit(2).minimumScaleFactor(0.8).multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, minHeight: 44).padding(.vertical, 8)
                .background(recording ? Theme.error : (!usable ? Theme.textMuted : (mode == .guided ? category.color : Theme.primary)))
                .clipShape(.rect(cornerRadius: Radius.card))
            }
            .buttonStyle(.plain)
            .disabled(!usable || busy)
            .pressable()
            .accessibilityHint(usable ? "" : state.message(typedAlternative: "use Write to get feedback on typed French"))
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
                Text(word).font(.system(.caption, weight: .medium)).italic()
                    .foregroundStyle(color)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(color.opacity(0.12)).clipShape(.rect(cornerRadius: 6))
            }
        }
    }
}
