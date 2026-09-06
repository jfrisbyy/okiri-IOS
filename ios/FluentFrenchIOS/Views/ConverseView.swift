//
//  ConverseView.swift
//  FluentFrenchIOS
//
//  A live conversation with an AI French tutor. Pick a scenario (locked until
//  Speaking is open and the scenario is at your level), then start a call: type
//  or speak your lines, hear the tutor, reveal translations, ask for a hint.
//  The end-of-call recap lists every correction the tutor made ("What to fix"),
//  saved to the deck as the corrected line — never the learner's slip — and
//  lets you keep any tutor phrase.
//
//  The surface refuses to open a call it cannot hold: no AI key and no network
//  are explicit states with honest copy, and the microphone reports exactly
//  why it cannot be used (permission / no speech key / no input device).
//

import Foundation
import SwiftUI
import UIKit

struct ConverseView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var active: ConverseScenario? = nil
    @State private var reachability = NetworkReachability.shared
    /// The header holds the largest text on the screen, so its height grows with
    /// the learner's text size instead of clipping the title.
    @ScaledMetric(relativeTo: .largeTitle) private var headerHeight: CGFloat = 175

    private static let rose = Color(hex: "E11D48")
    private static let roseGradient = LinearGradient(
        colors: [Color(hex: "F43F5E"), Color(hex: "BE123C")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )

    /// The engine's one notion of level (theta → CEFR), not a local gap-count rule.
    private var userLevel: CEFRLevel { store.learnerLevel }
    private var speakingReadiness: ModalityReadiness { store.readiness(for: .speaking) }

    /// Why no call can start right now (E11), independent of the scenario.
    private var serviceFailure: TalkServiceFailure? {
        if !ConverseService.hasKey { return .noKey }
        if !reachability.isReachable { return .offline }
        return nil
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let failure = serviceFailure {
                        serviceBanner(failure)
                    } else if !speakingReadiness.isOpen {
                        readinessBanner
                    }
                    Text("CHOOSE A SCENARIO").font(.system(.caption, weight: .semibold))
                        .foregroundStyle(Theme.textSecondary).tracking(0.5)
                    LazyVStack(spacing: 12) {
                        ForEach(ConverseScenario.all) { scenario in
                            scenarioCard(scenario)
                        }
                    }
                }
                .padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 48)
            }
            .scrollIndicators(.hidden)
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
        .task { reachability.start() }
        .fullScreenCover(item: $active) { scenario in
            ConverseCallView(scenario: scenario, accent: Self.rose, gradient: Self.roseGradient)
                .environment(store)
        }
    }

    private var header: some View {
        ZStack(alignment: .bottomLeading) {
            Self.roseGradient
            Circle()
                .fill(RadialGradient(colors: [.white.opacity(0.18), .clear], center: .center, startRadius: 0, endRadius: 150))
                .frame(width: 240, height: 240).offset(x: 130, y: -30)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text("Converse").scaledSerifDisplay(34, weight: .bold).foregroundStyle(.white)
                Text("Speak with your AI French tutor").font(.system(.callout)).foregroundStyle(.white.opacity(0.85))
            }
            .padding(.horizontal, 20).padding(.bottom, 18)
        }
        .frame(height: headerHeight)
        .clipped()
    }

    // MARK: Availability states (E11 / E26)

    private func serviceBanner(_ failure: TalkServiceFailure) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: failure == .offline ? "wifi.slash" : "exclamationmark.triangle.fill")
                    .font(.system(.footnote)).foregroundStyle(Theme.warning)
                    .accessibilityHidden(true)
                Text(failure.title).font(.system(.subheadline, weight: .bold)).foregroundStyle(Theme.text)
            }
            Text(failure == .noKey
                 ? "Live conversation needs the AI tutor, which isn't included in this build. Your saved phrases and lessons still work."
                 : "A call needs a connection to reach the tutor. \(failure.message)")
                .font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if failure.isRetryable {
                Button {
                    Haptics.tap()
                    reachability.refresh()
                } label: {
                    Text("Try again").font(.system(.footnote, weight: .semibold)).foregroundStyle(Theme.warning)
                        .minimumHitTarget()
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.warningLight).clipShape(.rect(cornerRadius: Radius.card))
    }

    private var readinessBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "lock.fill").font(.system(.footnote)).foregroundStyle(Theme.textMuted)
                .accessibilityHidden(true)
            Text(ConverseLockReason.speakingNotReady.message)
                .font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: Radius.card))
    }

    // MARK: Scenario cards (E12)

    private func scenarioCard(_ scenario: ConverseScenario) -> some View {
        let lockReason = ConverseScenarioGate.lockReason(required: scenario.requiredLevel, learner: userLevel, readiness: speakingReadiness)
        let unavailable = serviceFailure != nil
        let locked = lockReason != nil || unavailable
        return Button {
            guard !locked else { Haptics.tap(); return }
            Haptics.select()
            active = scenario
        } label: {
            HStack(spacing: 14) {
                Text(scenario.emoji).font(.system(.title)).minimumScaleFactor(0.6)
                    .frame(width: 54, height: 54)
                    .background(Self.rose.opacity(0.1)).clipShape(.rect(cornerRadius: 14))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(scenario.title).font(.system(.body, weight: .semibold)).foregroundStyle(Theme.text)
                        Pill(text: scenario.requiredLevel.rawValue, color: locked ? Theme.textMuted : Self.rose)
                    }
                    Text(scenario.description).font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2).multilineTextAlignment(.leading)
                    if let lockReason, !unavailable {
                        Text(lockReason.message).font(.system(.caption2, weight: .semibold)).foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: locked ? "lock.fill" : "phone.fill")
                    .font(.system(.body)).foregroundStyle(locked ? Theme.textMuted : Self.rose)
                    .frame(width: 44, height: 44)
                    .background((locked ? Theme.textMuted : Self.rose).opacity(0.12)).clipShape(.circle)
                    .accessibilityHidden(true)
            }
            .padding(14)
            .background(Theme.card)
            .clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
            .softLift()
            .opacity(locked ? 0.7 : 1)
        }
        .buttonStyle(.plain)
        .pressable()
        .accessibilityLabel(locked ? "\(scenario.title), locked" : "\(scenario.title), start call")
        .accessibilityHint(lockReason?.message ?? scenario.description)
    }
}

// MARK: - Scenario model

nonisolated struct ConverseScenario: Identifiable, Hashable {
    let id: String
    let title: String
    let titleFrench: String
    let description: String
    let emoji: String
    let requiredLevel: CEFRLevel
    let greetingFrench: String
    let greetingEnglish: String
    let starterPhraseFrench: String
    let starterPhraseEnglish: String

    static let all: [ConverseScenario] = [
        .init(id: "cafe", title: "At a Café", titleFrench: "Au café",
              description: "Order drinks, pastries, and chat with the barista about your day.",
              emoji: "☕", requiredLevel: .A1,
              greetingFrench: "Bonjour ! Bienvenue. Qu'est-ce que je vous sers aujourd'hui ?",
              greetingEnglish: "Hello! Welcome. What can I get you today?",
              starterPhraseFrench: "Je voudrais un café, s'il vous plaît.",
              starterPhraseEnglish: "I would like a coffee, please."),
        .init(id: "directions", title: "Asking for Directions", titleFrench: "Demander son chemin",
              description: "Navigate a French city by asking locals how to get to landmarks.",
              emoji: "🗺️", requiredLevel: .A1,
              greetingFrench: "Bonjour ! Vous avez l'air perdu. Je peux vous aider ?",
              greetingEnglish: "Hello! You look lost. Can I help you?",
              starterPhraseFrench: "Excusez-moi, où se trouve la gare ?",
              starterPhraseEnglish: "Excuse me, where is the train station?"),
        .init(id: "restaurant", title: "Ordering at a Restaurant", titleFrench: "Commander au restaurant",
              description: "Read the menu, ask for recommendations, and handle the bill.",
              emoji: "🍽️", requiredLevel: .A1,
              greetingFrench: "Bonsoir et bienvenue ! Avez-vous choisi votre table ?",
              greetingEnglish: "Good evening and welcome! Have you chosen your table?",
              starterPhraseFrench: "Qu'est-ce que vous me recommandez ?",
              starterPhraseEnglish: "What do you recommend?"),
        .init(id: "making-friends", title: "Making Friends", titleFrench: "Se faire des amis",
              description: "Strike up a conversation at a party and make plans to hang out.",
              emoji: "🤝", requiredLevel: .A2,
              greetingFrench: "Salut ! On ne s'est jamais rencontrés, non ? Moi c'est Julien.",
              greetingEnglish: "Hi! We've never met, right? I'm Julien.",
              starterPhraseFrench: "Enchanté ! Qu'est-ce que tu fais dans la vie ?",
              starterPhraseEnglish: "Nice to meet you! What do you do for a living?"),
        .init(id: "doctor", title: "At the Doctor", titleFrench: "Chez le médecin",
              description: "Describe symptoms and understand the doctor's advice.",
              emoji: "🩺", requiredLevel: .A2,
              greetingFrench: "Bonjour, installez-vous. Qu'est-ce qui vous amène aujourd'hui ?",
              greetingEnglish: "Hello, have a seat. What brings you in today?",
              starterPhraseFrench: "J'ai mal à la gorge depuis trois jours.",
              starterPhraseEnglish: "I've had a sore throat for three days."),
        .init(id: "shopping", title: "Shopping for Clothes", titleFrench: "Acheter des vêtements",
              description: "Ask about sizes, colors, and try things on at a boutique.",
              emoji: "👗", requiredLevel: .A2,
              greetingFrench: "Bonjour ! Je peux vous aider à trouver quelque chose ?",
              greetingEnglish: "Hello! Can I help you find something?",
              starterPhraseFrench: "Est-ce que vous avez ceci en taille M ?",
              starterPhraseEnglish: "Do you have this in size medium?"),
        .init(id: "job-interview", title: "Job Interview", titleFrench: "Entretien d'embauche",
              description: "Answer common interview questions and present your experience.",
              emoji: "💼", requiredLevel: .B1,
              greetingFrench: "Bonjour, merci d'être venu. Parlez-moi un peu de vous.",
              greetingEnglish: "Hello, thank you for coming. Tell me a little about yourself.",
              starterPhraseFrench: "J'ai plusieurs années d'expérience dans ce domaine.",
              starterPhraseEnglish: "I have several years of experience in this field."),
        .init(id: "free", title: "Free Conversation", titleFrench: "Conversation libre",
              description: "Talk about anything you want — the tutor adapts to your topic.",
              emoji: "💬", requiredLevel: .A1,
              greetingFrench: "Salut ! De quoi as-tu envie de parler aujourd'hui ?",
              greetingEnglish: "Hi! What would you like to talk about today?",
              starterPhraseFrench: "J'aimerais parler de mes projets pour le week-end.",
              starterPhraseEnglish: "I'd like to talk about my plans for the weekend."),
    ]
}

// MARK: - Call screen

private struct ConverseCallView: View {
    let scenario: ConverseScenario
    let accent: Color
    let gradient: LinearGradient

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The call header carries the scenario title, so it grows with the text size.
    @ScaledMetric(relativeTo: .body) private var chatHeaderHeight: CGFloat = 112

    /// The engine's one notion of level (theta → CEFR), not a local gap-count rule.
    private var userLevel: CEFRLevel { store.learnerLevel }

    @State private var elapsed = 0
    @State private var ended = false
    @State private var transcript: [ChatTurn] = []
    @State private var revealed: Set<UUID> = []
    @State private var draft = ""
    @State private var tutorThinking = false
    @State private var hintLoading = false
    @State private var hintNotice: String? = nil
    /// A tutor suggestion held back because the learner had already typed
    /// something: it is offered with an explicit "Use this" instead of silently
    /// replacing their French (talkmedia-2-2).
    @State private var hintSuggestion: String? = nil
    @State private var turnFailure: TalkServiceFailure? = nil
    @State private var micNotice: String? = nil
    /// Note shown when a dictation was added to a reply the learner had typed
    /// (talkmedia-3-3) — informational, not a microphone failure.
    @State private var dictationNotice: String? = nil
    @State private var showSettingsAlert = false
    @State private var savedTutorIds: Set<UUID> = []
    @State private var savedCorrectionIds: Set<UUID> = []
    @State private var duplicateCorrectionIds: Set<UUID> = []
    @State private var recapRecorded = false
    @State private var timer: Timer? = nil
    @State private var replyTask: Task<Void, Never>? = nil
    @State private var recorder = VoiceRecorder()
    @FocusState private var inputFocused: Bool

    var body: some View {
        ZStack {
            if ended { reviewView } else { chatView }
        }
        .background(Theme.background)
        .onAppear { startCall() }
        .onDisappear { teardown() }
        .onChange(of: recorder.stoppedAtCap) { _, stopped in
            if stopped { finishListening() }
        }
        .alert(MicAvailability.permissionDenied.title, isPresented: $showSettingsAlert) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
            }
            Button("Not now", role: .cancel) {}
        } message: {
            Text(MicAvailability.permissionDenied.message(typedAlternative: "type your reply here"))
        }
    }

    // MARK: Chat

    private var chatView: some View {
        VStack(spacing: 0) {
            chatHeader
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(transcript) { turn in
                            bubble(turn).id(turn.id)
                        }
                        if tutorThinking { typingIndicator.id("typing") }
                    }
                    .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 8)
                }
                .scrollIndicators(.hidden)
                .onChange(of: transcript.count) { _, _ in scrollToEnd(proxy) }
                .onChange(of: tutorThinking) { _, _ in scrollToEnd(proxy) }
            }
            inputBar
        }
        .ignoresSafeArea(edges: .top)
    }

    private var chatHeader: some View {
        ZStack(alignment: .bottom) {
            gradient
            HStack(spacing: 12) {
                // Leaving is the same exit as ending the call (E10): the recap is
                // shown and every tutor correction is saved — unless the learner
                // never said anything, when there is nothing to recap.
                Button { Haptics.tap(); leaveCall() } label: {
                    Image(systemName: "chevron.down").font(.system(.subheadline, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(.white.opacity(0.18), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Leave conversation")
                Text(scenario.emoji).font(.system(.title2)).minimumScaleFactor(0.6)
                    .frame(width: 44, height: 44).background(.white.opacity(0.18)).clipShape(.circle)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(scenario.titleFrench).font(.system(.body, weight: .bold)).foregroundStyle(.white)
                    Text(tutorThinking ? "Tutor is replying…" : "Your tutor · \(timeString)")
                        .font(.system(.caption)).foregroundStyle(.white.opacity(0.85))
                }
                Spacer()
                Button { Haptics.select(); endCall() } label: {
                    Image(systemName: "phone.down.fill").font(.system(.subheadline, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(Color(hex: "DC2626")).clipShape(.circle)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("End call and see recap")
            }
            .padding(.horizontal, 16).padding(.bottom, 14)
        }
        .frame(height: chatHeaderHeight)
        .clipped()
    }

    private func bubble(_ turn: ChatTurn) -> some View {
        let isTutor = turn.role == .tutor
        let isRevealed = revealed.contains(turn.id)
        return HStack {
            if !isTutor { Spacer(minLength: 40) }
            VStack(alignment: .leading, spacing: 6) {
                Text(turn.french).font(.system(.body, weight: .medium))
                    .foregroundStyle(isTutor ? Theme.text : .white)
                if isRevealed, !turn.english.isEmpty {
                    Text(turn.english).font(.system(.footnote))
                        .foregroundStyle(isTutor ? Theme.textSecondary : .white.opacity(0.85))
                }
                HStack(spacing: 14) {
                    Button {
                        Haptics.tap()
                        NaturalVoice.shared.speak(turn.french, voice: isTutor ? .female : .male)
                    } label: {
                        Image(systemName: "speaker.wave.2.fill").font(.system(.caption))
                            .foregroundStyle(isTutor ? accent : .white.opacity(0.9))
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Hear this line")
                    if !turn.english.isEmpty {
                        Button {
                            Haptics.tap()
                            if isRevealed { revealed.remove(turn.id) } else { revealed.insert(turn.id) }
                        } label: {
                            Text(isRevealed ? "Hide" : "Translate").font(.system(.caption2, weight: .semibold))
                                .foregroundStyle(isTutor ? accent : .white.opacity(0.9))
                                .minimumHitTarget()
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(isRevealed ? "Hide the English translation" : "Show the English translation")
                    }
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 6)
            .background(isTutor ? Theme.card : accent)
            .clipShape(.rect(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(isTutor ? Theme.border.opacity(0.6) : .clear, lineWidth: 0.5))
            if isTutor { Spacer(minLength: 40) }
        }
        .transition(reduceMotion
                    ? AnyTransition.opacity
                    : AnyTransition.move(edge: isTutor ? .leading : .trailing).combined(with: .opacity))
    }

    private var typingIndicator: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3) { i in
                    Circle().fill(Theme.textMuted).frame(width: 7, height: 7)
                        .opacity(0.4)
                        .reducedMotionAnimation(.easeInOut(duration: 0.6).repeatForever().delay(Double(i) * 0.18), value: tutorThinking)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background(Theme.card).clipShape(.rect(cornerRadius: 18))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Tutor is replying")
            Spacer(minLength: 40)
        }
    }

    // MARK: Input bar

    private var micState: MicAvailability { recorder.availability }

    private var inputBar: some View {
        VStack(spacing: 8) {
            if let failure = turnFailure { turnFailureBanner(failure) }
            if let correction = lastCorrection { correctionBanner(correction) }
            hintRow
            if let micNotice { noticeRow(icon: "mic.slash", text: micNotice, color: Theme.error) }
            if let dictationNotice { noticeRow(icon: "text.append", text: dictationNotice, color: accent) }

            HStack(spacing: 10) {
                Button { Haptics.tap(); requestHint() } label: {
                    Image(systemName: hintLoading ? "hourglass" : "lightbulb.fill").font(.system(.body))
                        .foregroundStyle(accent).frame(width: 44, height: 44)
                        .background(accent.opacity(0.12)).clipShape(.circle)
                }
                .buttonStyle(.plain).disabled(hintLoading || tutorThinking)
                .accessibilityLabel(hintLoading ? "Fetching a hint" : "Suggest what to say")

                TextField("Reply in French…", text: $draft, axis: .vertical)
                    .font(.system(.body)).lineLimit(1...4)
                    .focused($inputFocused)
                    .submitLabel(.send)
                    .onSubmit(send)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: 22))
                    .accessibilityLabel("Your reply in French")

                if micState.isReady {
                    Button { toggleListening() } label: {
                        Image(systemName: recorder.isTranscribing ? "hourglass" : (recorder.isRecording ? "stop.fill" : "mic.fill"))
                            .font(.system(.body, weight: .bold)).foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(recorder.isRecording ? Color(hex: "DC2626") : accent).clipShape(.circle)
                    }
                    .buttonStyle(.plain).disabled(recorder.isTranscribing || tutorThinking)
                    .accessibilityLabel(recorder.isRecording ? "Stop recording" : (recorder.isTranscribing ? "Transcribing" : "Speak your reply"))
                }

                Button { send() } label: {
                    Image(systemName: "arrow.up").font(.system(.body, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(canSend ? accent : Theme.textMuted).clipShape(.circle)
                }
                .buttonStyle(.plain).disabled(!canSend)
                .accessibilityLabel("Send reply")
            }

            micStatusRow
        }
        .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 14)
        .background(Theme.card)
        .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 0.5) }
    }

    /// One honest line about the microphone (E14): the countdown while
    /// recording, otherwise why voice input is unavailable — with the Settings
    /// link when that is the fix.
    @ViewBuilder
    private var micStatusRow: some View {
        if recorder.isRecording {
            HStack(spacing: 6) {
                Image(systemName: "waveform").font(.system(.caption2)).foregroundStyle(Theme.error)
                    .accessibilityHidden(true)
                Text("Listening… \(SpeakRecordingCap.countdown(secondsLeft: recorder.secondsLeft)) left, tap stop when done")
                    .font(.system(.caption2, weight: .medium)).foregroundStyle(Theme.textSecondary)
            }
        } else if recorder.isTranscribing {
            HStack(spacing: 6) {
                ProgressView().controlSize(.mini).accessibilityHidden(true)
                Text("Transcribing what you said…").font(.system(.caption2)).foregroundStyle(Theme.textSecondary)
            }
        } else if !micState.isReady {
            HStack(spacing: 6) {
                Image(systemName: "mic.slash.fill").font(.system(.caption2)).foregroundStyle(Theme.textMuted)
                    .accessibilityHidden(true)
                Text(micState.message(typedAlternative: "type your reply"))
                    .font(.system(.caption2)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if micState.canOpenSettings {
                    Button {
                        Haptics.tap()
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    } label: {
                        Text("Open Settings").font(.system(.caption2, weight: .bold)).foregroundStyle(accent)
                            .minimumHitTarget()
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func correctionBanner(_ turn: ChatTurn) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "checkmark.bubble.fill").font(.system(.footnote)).foregroundStyle(Theme.warning)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    if let corrected = turn.correctedFrench {
                        Text(corrected).font(.system(.footnote, weight: .semibold)).foregroundStyle(Theme.text)
                    }
                    if let note = turn.correction {
                        Text(note).font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(Theme.warningLight).clipShape(.rect(cornerRadius: 12))
    }

    private func turnFailureBanner(_ failure: TalkServiceFailure) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: failure == .offline ? "wifi.slash" : "exclamationmark.triangle.fill")
                .font(.system(.footnote)).foregroundStyle(Theme.error)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(failure.title).font(.system(.footnote, weight: .bold)).foregroundStyle(Theme.text)
                Text(failure.message).font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if failure.isRetryable {
                Button { Haptics.tap(); retryTurn() } label: {
                    Text("Retry").font(.system(.footnote, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 12).frame(minHeight: 44)
                        .background(Theme.error).clipShape(.capsule)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(Theme.errorLight).clipShape(.rect(cornerRadius: 12))
    }

    /// The hint line: the tutor's note, and — when the learner already had a
    /// reply in progress — the suggested line with "Use this" / "Keep mine".
    /// Nothing here ever overwrites the draft on its own (talkmedia-2-2).
    @ViewBuilder
    private var hintRow: some View {
        if hintNotice != nil || hintSuggestion != nil {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "lightbulb").font(.system(.footnote)).foregroundStyle(Theme.warning)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 3) {
                        if let hintNotice {
                            Text(hintNotice).font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        if let hintSuggestion {
                            Text(hintSuggestion).font(.system(.footnote, weight: .semibold)).foregroundStyle(Theme.text)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                if let suggestion = hintSuggestion {
                    HStack(spacing: 12) {
                        Button { Haptics.tap(); useSuggestion(suggestion) } label: {
                            Text("Use this").font(.system(.footnote, weight: .bold)).foregroundStyle(.white)
                                .padding(.horizontal, 12).frame(minHeight: 44)
                                .background(Theme.warning).clipShape(.capsule)
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint("Replaces what you have typed with the suggested line")
                        Button { Haptics.tap(); dismissHint() } label: {
                            Text("Keep mine").font(.system(.footnote, weight: .semibold)).foregroundStyle(Theme.textSecondary)
                                .minimumHitTarget()
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint("Dismisses the suggestion and keeps your reply")
                    }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 9)
            .background(Theme.warning.opacity(0.08)).clipShape(.rect(cornerRadius: 12))
        }
    }

    private func noticeRow(icon: String, text: String, color: Color) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: icon).font(.system(.footnote)).foregroundStyle(color)
                .accessibilityHidden(true)
            Text(text).font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(color.opacity(0.08)).clipShape(.rect(cornerRadius: 12))
    }

    private var canSend: Bool { !draft.trimmingCharacters(in: .whitespaces).isEmpty && !tutorThinking }

    /// The latest tutor turn that fixed something (shown until the next reply).
    private var lastCorrection: ChatTurn? {
        guard let turn = transcript.last(where: { $0.role == .tutor }),
              turn.correctedFrench != nil || turn.correction != nil else { return nil }
        return turn
    }

    private func scrollToEnd(_ proxy: ScrollViewProxy) {
        withAnimation(Theme.motion(.easeOut(duration: 0.25), reduceMotion: reduceMotion)) {
            if tutorThinking { proxy.scrollTo("typing", anchor: .bottom) }
            else if let last = transcript.last { proxy.scrollTo(last.id, anchor: .bottom) }
        }
    }

    // MARK: Actions

    private func startCall() {
        let greeting = ChatTurn(role: .tutor, french: scenario.greetingFrench, english: scenario.greetingEnglish, correction: nil)
        transcript = [greeting]
        NaturalVoice.shared.speak(scenario.greetingFrench)
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            Task { @MainActor in elapsed += 1 }
        }
    }

    /// Stop everything that is running. Also records the recap, so a call that
    /// is swiped away (onDisappear) keeps its corrections; `recordRecap` runs once.
    private func teardown() {
        timer?.invalidate()
        timer = nil
        replyTask?.cancel()
        replyTask = nil
        tutorThinking = false
        NaturalVoice.shared.stop()
        recorder.cancel()
        recordRecap()
    }

    private func toggleListening() {
        if recorder.isRecording {
            Haptics.select()
            finishListening()
            return
        }
        Haptics.tap()
        micNotice = nil
        dictationNotice = nil
        NaturalVoice.shared.stop()
        Task {
            let result = await recorder.start(maxSeconds: Tuning.converseRecordingSeconds)
            if case .failure(let failure) = result {
                switch failure {
                case .unavailable(.permissionDenied): showSettingsAlert = true
                case .unavailable(let state): micNotice = state.message(typedAlternative: "type your reply")
                case .audioSessionFailed: micNotice = "The microphone couldn't start. Try again, or type your reply."
                case .alreadyRecording: break
                }
            }
        }
    }

    /// Stop the recording (or pick up one the cap stopped) and use what was heard.
    /// A reply the learner had already typed is never thrown away: speech is
    /// appended to it and left for them to send (talkmedia-3-3).
    private func finishListening() {
        Task {
            let outcome = await recorder.stopAndTranscribe(language: "fra")
            switch outcome {
            case .text(let text):
                let merge = DictationMerge.apply(heard: text, toDraft: draft)
                switch merge {
                case .send(let spoken):
                    draft = spoken
                    send()
                case .appended(let merged):
                    draft = merged
                    dictationNotice = merge.notice
                    inputFocused = true
                case .nothing:
                    micNotice = TranscriptionOutcome.nothingHeard.message
                }
            case .nothingHeard, .failed:
                micNotice = outcome.message
            }
        }
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !tutorThinking else { return }
        Haptics.tap()
        draft = ""
        hintNotice = nil
        hintSuggestion = nil
        micNotice = nil
        dictationNotice = nil
        turnFailure = nil
        inputFocused = false
        withAnimation(Theme.motion(.spring(response: 0.35, dampingFraction: 0.85), reduceMotion: reduceMotion)) {
            transcript.append(ChatTurn(role: .user, french: text, english: "", correction: nil))
        }
        respond()
    }

    /// Ask the tutor for the next turn. A failure is shown as a banner with
    /// Retry — never faked as a tutor line. The request itself is bounded by
    /// `Tuning.converseReplyTimeout`.
    private func respond() {
        guard !tutorThinking else { return }
        tutorThinking = true
        turnFailure = nil
        let history = transcript
        let level = userLevel
        let concepts = store.concepts
        replyTask?.cancel()
        replyTask = Task {
            let result = await ConverseService.reply(scenario: scenario, level: level, history: history, concepts: concepts)
            // A cancelled request never leaves the mic disabled behind "Tutor is replying…" (E26).
            guard !Task.isCancelled else { tutorThinking = false; return }
            tutorThinking = false
            switch result {
            case .success(let reply):
                let turn = ChatTurn(role: .tutor, french: reply.french, english: reply.english, correction: reply.correction,
                                    correctedFrench: reply.correctedFrench, correctedEnglish: reply.correctedEnglish,
                                    conceptId: reply.conceptId)
                withAnimation(Theme.motion(.spring(response: 0.35, dampingFraction: 0.85), reduceMotion: reduceMotion)) { transcript.append(turn) }
                NaturalVoice.shared.speak(turn.french)
            case .failure(let failure):
                turnFailure = failure
            }
        }
    }

    private func retryTurn() {
        guard transcript.last?.role == .user else { turnFailure = nil; return }
        respond()
    }

    /// A hint from the tutor, or — honestly labelled — the scenario's starter
    /// phrase when the tutor can't be reached (E11).
    private func requestHint() {
        guard !hintLoading, !tutorThinking else { return }
        hintNotice = nil
        hintSuggestion = nil
        guard ConverseService.hasKey else {
            offer(suggestion: scenario.starterPhraseFrench,
                  notice: "Hints from the tutor aren't available in this build — here's a starter phrase for this scene instead.")
            return
        }
        hintLoading = true
        let history = transcript
        let level = userLevel
        Task {
            let result = await ConverseService.hint(scenario: scenario, level: level, history: history)
            hintLoading = false
            switch result {
            case .success(let hint):
                offer(suggestion: hint.french, notice: nil)
            case .failure(let failure):
                offer(suggestion: scenario.starterPhraseFrench,
                      notice: "\(failure.message) Here's a starter phrase for this scene instead.")
            }
        }
    }

    /// Put a suggestion in front of the learner without ever destroying the reply
    /// they were writing (talkmedia-2-2): an empty box is filled straight away, a
    /// box with typed French keeps it and gets "Use this" in the hint row.
    private func offer(suggestion text: String, notice: String?) {
        let suggestion = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !suggestion.isEmpty else {
            hintNotice = notice
            return
        }
        if draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            draft = suggestion
            hintNotice = notice
            inputFocused = true
        } else {
            hintSuggestion = suggestion
            hintNotice = notice ?? "One way to say it — your reply is untouched."
        }
    }

    /// "Use this": the learner asked for the suggestion, so it replaces the draft.
    private func useSuggestion(_ text: String) {
        draft = text
        hintSuggestion = nil
        hintNotice = nil
        inputFocused = true
    }

    /// "Keep mine": drop the suggestion, leave the draft alone.
    private func dismissHint() {
        hintSuggestion = nil
        hintNotice = nil
    }

    private func endCall() {
        teardown()
        recordRecap()
        withAnimation(Theme.motion(.spring(response: 0.45, dampingFraction: 0.85), reduceMotion: reduceMotion)) { ended = true }
    }

    /// The header chevron: a call the learner took part in ends like the End
    /// button (recap + corrections saved); one they never spoke in just closes.
    private func leaveCall() {
        if userExchanges == 0 {
            teardown()
            dismiss()
        } else {
            endCall()
        }
    }

    /// Save every tutor correction through the store once (E10): the corrected
    /// line becomes a deck gap carrying the slip as evidence. Then, since the
    /// tutor was reachable, fill in any deck cards still waiting for a meaning.
    private func recordRecap() {
        guard !recapRecorded else { return }
        recapRecorded = true
        let corrections = ConverseRecap.corrections(in: transcript)
        if !corrections.isEmpty {
            let alreadyThere = Set(corrections.filter { store.hasGap(forWord: $0.correctedFrench) }.map(\.id))
            let saved = store.recordConverseCorrections(corrections)
            savedCorrectionIds = Set(saved.keys).subtracting(alreadyThere)
            duplicateCorrectionIds = alreadyThere
        }
        // Corrections and tutor phrases saved without English wait for a meaning;
        // the call proved the service reachable, so fill them in now. The store
        // outlives this view, so the work finishes even after dismissal.
        if ConverseService.hasKey, !store.pendingTranslations.isEmpty {
            let store = store
            Task { await store.resolvePendingTranslations(using: TranslationService.lookup(term:context:)) }
        }
    }

    private var timeString: String { String(format: "%02d:%02d", elapsed / 60, elapsed % 60) }

    // MARK: Recap

    private var corrections: [ConverseCorrection] { ConverseRecap.corrections(in: transcript) }
    private var unsavableNotes: [String] { ConverseRecap.unsavableNotes(in: transcript) }
    private var userExchanges: Int { transcript.filter { $0.role == .user }.count }

    private var reviewView: some View {
        ScrollView {
            VStack(spacing: 18) {
                VStack(spacing: 10) {
                    Image(systemName: "checkmark.seal.fill").font(.system(.largeTitle)).foregroundStyle(accent)
                        .accessibilityHidden(true)
                    Text("Conversation Recap").scaledSerifDisplay(26, weight: .bold).foregroundStyle(Theme.text)
                    Text(scenario.title).font(.system(.callout)).foregroundStyle(Theme.textSecondary)
                }
                .padding(.top, 64)

                HStack(spacing: 12) {
                    recapStat(value: timeString, label: "Duration")
                    recapStat(value: "\(userExchanges)", label: "Your lines")
                    recapStat(value: "\(corrections.count)", label: "To fix")
                }

                whatToFixSection

                VStack(alignment: .leading, spacing: 10) {
                    Text("TRANSCRIPT").font(.system(.caption2, weight: .bold)).foregroundStyle(Theme.textSecondary).tracking(0.5)
                    ForEach(transcript) { turn in
                        recapLine(turn)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card))
                .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))

                Button { Haptics.tap(); dismiss() } label: {
                    Text("Done").font(.system(.body, weight: .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 16)
                        .background(accent).clipShape(.rect(cornerRadius: Radius.chip))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20).padding(.bottom, 40)
        }
    }

    /// Every correction the tutor made, paired with the slip it fixes (E10).
    private var whatToFixSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("WHAT TO FIX").font(.system(.caption2, weight: .bold)).foregroundStyle(Theme.textSecondary).tracking(0.5)
            if corrections.isEmpty && unsavableNotes.isEmpty {
                Text(userExchanges == 0
                     ? "You didn't say anything this time — next call, try the starter phrase."
                     : "No corrections — the tutor had nothing to fix. Nice work.")
                    .font(.system(.subheadline)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ForEach(corrections) { correction in
                correctionCard(correction)
            }
            ForEach(Array(unsavableNotes.enumerated()), id: \.offset) { _, note in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "lightbulb.fill").font(.system(.footnote)).foregroundStyle(Theme.warning)
                        .accessibilityHidden(true)
                    Text(note).font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
    }

    private func correctionCard(_ correction: ConverseCorrection) -> some View {
        let saved = savedCorrectionIds.contains(correction.id)
        let duplicate = duplicateCorrectionIds.contains(correction.id)
        return VStack(alignment: .leading, spacing: 6) {
            Text(correction.originalFrench).font(.system(.footnote)).foregroundStyle(Theme.textSecondary).strikethrough()
                .accessibilityLabel("You said: \(correction.originalFrench)")
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "arrow.turn.down.right").font(.system(.caption)).foregroundStyle(Theme.success)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(correction.correctedFrench).font(.system(.subheadline, weight: .semibold)).foregroundStyle(Theme.text)
                        .accessibilityLabel("Corrected: \(correction.correctedFrench)")
                    if let english = correction.englishTranslation {
                        Text(english).font(.system(.caption)).foregroundStyle(Theme.textSecondary)
                    }
                    if !correction.explanation.isEmpty {
                        Text(correction.explanation).font(.system(.footnote)).foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
                Button { Haptics.tap(); NaturalVoice.shared.speak(correction.correctedFrench) } label: {
                    Image(systemName: "speaker.wave.2.fill").font(.system(.caption)).foregroundStyle(accent)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Hear the corrected line")
            }
            HStack(spacing: 8) {
                if let name = store.concept(correction.conceptId)?.name {
                    Pill(text: name, color: accent)
                }
                Spacer(minLength: 0)
                Label(saved ? "Saved to your deck" : (duplicate ? "Already in your deck" : "Nothing to save"),
                      systemImage: saved || duplicate ? "checkmark.circle.fill" : "circle.dashed")
                    .font(.system(.caption2, weight: .semibold))
                    .foregroundStyle(saved || duplicate ? Theme.success : Theme.textSecondary)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: 12))
    }

    private func recapStat(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.system(.title3, weight: .bold)).foregroundStyle(accent)
            Text(label).font(.system(.caption2)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 14)
        .background(accent.opacity(0.1)).clipShape(.rect(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }

    /// A transcript line. Tutor lines can be saved as said; a learner line
    /// shows whether its correction was saved and never offers to save the
    /// learner's own French (E9).
    private func recapLine(_ turn: ChatTurn) -> some View {
        let isTutor = turn.role == .tutor
        let candidate = ConverseRecap.saveCandidate(for: turn, in: transcript)
        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(isTutor ? "TUTOR" : "YOU").font(.system(.caption2, weight: .bold))
                    .foregroundStyle(isTutor ? accent : Theme.secondary)
                Spacer()
                switch candidate {
                case .some(.tutorPhrase(let french, let english)):
                    let saved = savedTutorIds.contains(turn.id) || store.hasGap(forWord: french)
                    Button { savePhrase(turn, french: french, english: english) } label: {
                        Image(systemName: saved ? "checkmark.circle.fill" : "plus.circle")
                            .font(.system(.body)).foregroundStyle(saved ? Theme.success : Theme.textMuted)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain).disabled(saved)
                    .accessibilityLabel(saved ? "Saved to your deck" : "Save this phrase to your deck")
                case .some(.correction(let correction)):
                    let kept = savedCorrectionIds.contains(correction.id) || duplicateCorrectionIds.contains(correction.id)
                    Label(kept ? "Correction saved" : "Corrected above", systemImage: kept ? "checkmark.circle.fill" : "arrow.turn.down.right")
                        .font(.system(.caption2, weight: .semibold))
                        .foregroundStyle(kept ? Theme.success : Theme.textSecondary)
                case .none:
                    EmptyView()
                }
            }
            Text(turn.french).font(.system(.subheadline, weight: .medium)).foregroundStyle(Theme.text)
            if !turn.english.isEmpty {
                Text(turn.english).font(.system(.caption)).foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 6)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border.opacity(0.4)).frame(height: 0.5) }
    }

    private func savePhrase(_ turn: ChatTurn, french: String, english: String) {
        guard !savedTutorIds.contains(turn.id) else { return }
        guard store.captureConversePhrase(french: french, english: english, scenarioTitle: scenario.title) else {
            savedTutorIds.insert(turn.id)
            return
        }
        Haptics.success()
        savedTutorIds.insert(turn.id)
    }
}
