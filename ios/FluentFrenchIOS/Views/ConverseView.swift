//
//  ConverseView.swift
//  FluentFrenchIOS
//
//  A live, spoken conversation with an AI French tutor. Pick a scenario (locked
//  above your level), then start a call. The live microphone isn't available in
//  the on-screen preview, so the call screen shows the on-device notice while
//  still previewing the tutor's spoken greeting, captions, and an end-of-call
//  review with save-to-deck.
//

import SwiftUI

struct ConverseView: View {
    @Environment(AppStore.self) private var store
    @State private var active: ConverseScenario? = nil

    private static let rose = Color(hex: "E11D48")
    private static let roseGradient = LinearGradient(
        colors: [Color(hex: "F43F5E"), Color(hex: "BE123C")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )

    /// The engine's one notion of level (theta → CEFR), not a local gap-count rule.
    private var userLevel: CEFRLevel { store.learnerLevel }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("CHOOSE A SCENARIO").font(.system(size: 12, weight: .semibold))
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
            VStack(alignment: .leading, spacing: 4) {
                Text("Converse").font(.serifDisplay(34, weight: .bold)).foregroundStyle(.white)
                Text("Speak with your AI French tutor").font(.system(size: 15)).foregroundStyle(.white.opacity(0.85))
            }
            .padding(.horizontal, 20).padding(.bottom, 18)
        }
        .frame(height: 175)
        .clipped()
    }

    private func scenarioCard(_ scenario: ConverseScenario) -> some View {
        let locked = scenario.requiredLevel.order > userLevel.order
        return Button {
            guard !locked else { Haptics.tap(); return }
            Haptics.select()
            active = scenario
        } label: {
            HStack(spacing: 14) {
                Text(scenario.emoji).font(.system(size: 28))
                    .frame(width: 54, height: 54)
                    .background(Self.rose.opacity(0.1)).clipShape(.rect(cornerRadius: 14))
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(scenario.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text)
                        Pill(text: scenario.requiredLevel.rawValue, color: locked ? Theme.textMuted : Self.rose)
                    }
                    Text(scenario.description).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                        .lineLimit(2).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Image(systemName: locked ? "lock.fill" : "phone.fill")
                    .font(.system(size: 18)).foregroundStyle(locked ? Theme.textMuted : Self.rose)
                    .frame(width: 40, height: 40)
                    .background((locked ? Theme.textMuted : Self.rose).opacity(0.12)).clipShape(.circle)
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

extension CEFRLevel {
    var order: Int { Self.allCases.firstIndex(of: self) ?? 0 }
}

// MARK: - Call screen

private struct ConverseCallView: View {
    let scenario: ConverseScenario
    let accent: Color
    let gradient: LinearGradient

    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store

    /// The engine's one notion of level (theta → CEFR), not a local gap-count rule.
    private var userLevel: CEFRLevel { store.learnerLevel }

    @State private var elapsed = 0
    @State private var ended = false
    @State private var transcript: [ChatTurn] = []
    @State private var revealed: Set<UUID> = []
    @State private var draft = ""
    @State private var tutorThinking = false
    @State private var hintLoading = false
    @State private var savedIds: Set<UUID> = []
    @State private var timer: Timer? = nil
    @State private var recorder = VoiceRecorder()
    @FocusState private var inputFocused: Bool

    var body: some View {
        ZStack {
            if ended { reviewView } else { chatView }
        }
        .background(Theme.background)
        .onAppear { startCall() }
        .onDisappear { timer?.invalidate(); NaturalVoice.shared.stop(); recorder.cancel() }
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
                Button { Haptics.tap(); NaturalVoice.shared.stop(); dismiss() } label: {
                    Image(systemName: "chevron.down").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 34, height: 34).background(.white.opacity(0.18), in: Circle())
                }
                .buttonStyle(.plain)
                Text(scenario.emoji).font(.system(size: 26))
                    .frame(width: 44, height: 44).background(.white.opacity(0.18)).clipShape(.circle)
                VStack(alignment: .leading, spacing: 1) {
                    Text(scenario.titleFrench).font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                    Text(tutorThinking ? "en train d'écrire…" : "Votre tuteur · \(timeString)")
                        .font(.system(size: 12)).foregroundStyle(.white.opacity(0.85))
                }
                Spacer()
                Button { Haptics.select(); endCall() } label: {
                    Image(systemName: "phone.down.fill").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 38, height: 38).background(Color(hex: "DC2626")).clipShape(.circle)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16).padding(.bottom, 14)
        }
        .frame(height: 112)
        .clipped()
    }

    private func bubble(_ turn: ChatTurn) -> some View {
        let isTutor = turn.role == .tutor
        let isRevealed = revealed.contains(turn.id)
        return HStack {
            if !isTutor { Spacer(minLength: 40) }
            VStack(alignment: .leading, spacing: 6) {
                Text(turn.french).font(.system(size: 16, weight: .medium))
                    .foregroundStyle(isTutor ? Theme.text : .white)
                if isRevealed, !turn.english.isEmpty {
                    Text(turn.english).font(.system(size: 13))
                        .foregroundStyle(isTutor ? Theme.textMuted : .white.opacity(0.85))
                }
                HStack(spacing: 14) {
                    Button {
                        Haptics.tap()
                        if isTutor { NaturalVoice.shared.speak(turn.french) } else { NaturalVoice.shared.speak(turn.french, voice: .male) }
                    } label: {
                        Image(systemName: "speaker.wave.2.fill").font(.system(size: 12))
                            .foregroundStyle(isTutor ? accent : .white.opacity(0.9))
                    }.buttonStyle(.plain)
                    Button {
                        Haptics.tap()
                        if isRevealed { revealed.remove(turn.id) } else { revealed.insert(turn.id) }
                    } label: {
                        Text(isRevealed ? "Hide" : "Translate").font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(isTutor ? accent : .white.opacity(0.9))
                    }.buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 11)
            .background(isTutor ? Theme.card : accent)
            .clipShape(.rect(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(isTutor ? Theme.border.opacity(0.6) : .clear, lineWidth: 0.5))
            if isTutor { Spacer(minLength: 40) }
        }
        .transition(.move(edge: isTutor ? .leading : .trailing).combined(with: .opacity))
    }

    private var typingIndicator: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3) { i in
                    Circle().fill(Theme.textMuted).frame(width: 7, height: 7)
                        .opacity(0.4)
                        .scaleEffect(1)
                        .animation(.easeInOut(duration: 0.6).repeatForever().delay(Double(i) * 0.18), value: tutorThinking)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background(Theme.card).clipShape(.rect(cornerRadius: 18))
            Spacer(minLength: 40)
        }
    }

    private var inputBar: some View {
        VStack(spacing: 8) {
            if let correction = lastCorrection {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.bubble.fill").font(.system(size: 13)).foregroundStyle(Theme.warning)
                    Text(correction).font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 12).padding(.vertical, 9)
                .background(Theme.warningLight).clipShape(.rect(cornerRadius: 12))
            }
            HStack(spacing: 10) {
                Button {
                    Haptics.tap(); requestHint()
                } label: {
                    Image(systemName: hintLoading ? "hourglass" : "lightbulb.fill").font(.system(size: 16))
                        .foregroundStyle(accent).frame(width: 42, height: 42)
                        .background(accent.opacity(0.12)).clipShape(.circle)
                }
                .buttonStyle(.plain).disabled(hintLoading || tutorThinking)

                HStack(spacing: 8) {
                    TextField("Réponds en français…", text: $draft, axis: .vertical)
                        .font(.system(size: 16)).lineLimit(1...4)
                        .focused($inputFocused)
                        .submitLabel(.send)
                        .onSubmit(send)
                    if !ConverseService.hasKey {
                        Image(systemName: "wifi.slash").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                    }
                }
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: 22))

                if recorder.micAvailable {
                    Button { toggleListening() } label: {
                        Image(systemName: recorder.isTranscribing ? "hourglass" : (recorder.isRecording ? "stop.fill" : "mic.fill"))
                            .font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                            .frame(width: 42, height: 42)
                            .background(recorder.isRecording ? Color(hex: "DC2626") : accent).clipShape(.circle)
                            .scaleEffect(recorder.isRecording ? 1.08 : 1)
                            .animation(recorder.isRecording ? .easeInOut(duration: 0.7).repeatForever(autoreverses: true) : .default, value: recorder.isRecording)
                    }
                    .buttonStyle(.plain).disabled(recorder.isTranscribing || tutorThinking)
                } else {
                    Button { send() } label: {
                        Image(systemName: "arrow.up").font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                            .frame(width: 42, height: 42)
                            .background(canSend ? accent : Theme.textMuted).clipShape(.circle)
                    }
                    .buttonStyle(.plain).disabled(!canSend)
                }
            }
            if recorder.micAvailable {
                Button { send() } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "paperplane.fill").font(.system(size: 10))
                        Text(recorder.isRecording ? "Listening… tap stop when done" : "Speak or type, then send")
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundStyle(canSend ? accent : Theme.textMuted)
                }
                .buttonStyle(.plain).disabled(!canSend)
            } else {
                HStack(spacing: 6) {
                    Image(systemName: "mic.slash.fill").font(.system(size: 10)).foregroundStyle(Theme.textMuted)
                    Text("Install via the Rork App on your device to speak out loud.")
                        .font(.system(size: 10)).foregroundStyle(Theme.textMuted)
                }
            }
        }
        .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 14)
        .background(Theme.card)
        .overlay(alignment: .top) { Rectangle().fill(Theme.border).frame(height: 0.5) }
    }

    private var canSend: Bool { !draft.trimmingCharacters(in: .whitespaces).isEmpty && !tutorThinking }

    private var lastCorrection: String? {
        transcript.last(where: { $0.role == .tutor })?.correction
    }

    private func scrollToEnd(_ proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.25)) {
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

    private func toggleListening() {
        if recorder.isRecording {
            Haptics.select()
            Task {
                let text = await recorder.stopAndTranscribe(language: "fra")
                if let text, !text.isEmpty {
                    draft = text
                    send()
                }
            }
            return
        }
        Haptics.tap()
        NaturalVoice.shared.stop()
        Task { await recorder.start() }
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !tutorThinking else { return }
        Haptics.tap()
        draft = ""
        inputFocused = false
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            transcript.append(ChatTurn(role: .user, french: text, english: "", correction: nil))
        }
        respond()
    }

    private func respond() {
        tutorThinking = true
        let history = transcript
        Task {
            let reply = await ConverseService.reply(scenario: scenario, level: userLevel, history: history)
            tutorThinking = false
            let turn: ChatTurn
            if let reply {
                turn = ChatTurn(role: .tutor, french: reply.french, english: reply.english, correction: reply.correction)
            } else {
                turn = ChatTurn(role: .tutor, french: "Désolé, je n'ai pas pu répondre. On réessaie ?",
                                english: "Sorry, I couldn't reply. Shall we try again?", correction: nil)
            }
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { transcript.append(turn) }
            NaturalVoice.shared.speak(turn.french)
        }
    }

    private func requestHint() {
        guard !hintLoading, !tutorThinking else { return }
        hintLoading = true
        let history = transcript
        Task {
            let hint = await ConverseService.hint(scenario: scenario, level: userLevel, history: history)
            hintLoading = false
            if let hint {
                draft = hint.french
                inputFocused = true
            } else {
                draft = scenario.starterPhraseFrench
                inputFocused = true
            }
        }
    }

    private func endCall() {
        timer?.invalidate()
        NaturalVoice.shared.stop()
        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { ended = true }
    }

    private var timeString: String { String(format: "%02d:%02d", elapsed / 60, elapsed % 60) }

    // MARK: Recap

    private var reviewView: some View {
        ScrollView {
            VStack(spacing: 18) {
                VStack(spacing: 10) {
                    Image(systemName: "checkmark.seal.fill").font(.system(size: 44)).foregroundStyle(accent)
                    Text("Conversation Recap").font(.serifDisplay(26, weight: .bold)).foregroundStyle(Theme.text)
                    Text(scenario.title).font(.system(size: 15)).foregroundStyle(Theme.textSecondary)
                }
                .padding(.top, 64)

                HStack(spacing: 12) {
                    recapStat(value: timeString, label: "Duration")
                    recapStat(value: "\(userExchanges)", label: "Your lines")
                    recapStat(value: userLevel.rawValue, label: "Level")
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("TRANSCRIPT").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted).tracking(0.5)
                    ForEach(transcript) { turn in
                        recapLine(turn)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card))
                .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))

                Button { Haptics.tap(); endedDismiss() } label: {
                    Text("Done").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 16)
                        .background(accent).clipShape(.rect(cornerRadius: Radius.chip))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20).padding(.bottom, 40)
        }
    }

    private var userExchanges: Int { transcript.filter { $0.role == .user }.count }

    private func endedDismiss() { dismiss() }

    private func recapStat(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.system(size: 20, weight: .bold)).foregroundStyle(accent)
            Text(label).font(.system(size: 11)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 14)
        .background(accent.opacity(0.1)).clipShape(.rect(cornerRadius: 14))
    }

    private func recapLine(_ turn: ChatTurn) -> some View {
        let isTutor = turn.role == .tutor
        let saved = savedIds.contains(turn.id)
        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(isTutor ? "TUTOR" : "YOU").font(.system(size: 10, weight: .bold))
                    .foregroundStyle(isTutor ? accent : Theme.secondary)
                Spacer()
                Button {
                    savePhrase(turn)
                } label: {
                    Image(systemName: saved ? "checkmark.circle.fill" : "plus.circle")
                        .font(.system(size: 16)).foregroundStyle(saved ? Theme.success : Theme.textMuted)
                }
                .buttonStyle(.plain).disabled(saved)
            }
            Text(turn.french).font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.text)
            if !turn.english.isEmpty {
                Text(turn.english).font(.system(size: 12)).foregroundStyle(Theme.textMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 6)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border.opacity(0.4)).frame(height: 0.5) }
    }

    private func savePhrase(_ turn: ChatTurn) {
        guard !savedIds.contains(turn.id) else { return }
        Haptics.success()
        let now = Date()
        let gap = GapItem(
            id: UUID().uuidString,
            frenchWord: turn.french,
            englishTranslation: turn.english.isEmpty ? "(tap to translate later)" : turn.english,
            explanation: "Phrase from your “\(scenario.title)” conversation.",
            exampleSentence: turn.french,
            exampleTranslation: turn.english,
            pronunciation: nil,
            sourceType: .speech,
            category: .phrasing,
            difficulty: .okay,
            reviewCount: 0,
            consecutiveCorrect: 0,
            lastReviewedAt: nil,
            nextReviewAt: now,
            masteredAt: nil,
            createdAt: now,
            cefrLevel: userLevel,
            easeFactor: 2.5,
            currentInterval: 0,
            irtDifficulty: 0,
            fsrs: nil,
            originalContext: OriginalContext(sentence: turn.french, translation: turn.english, sourceTab: "converse", capturedAt: now, reExposureCount: 0),
            confusionLinks: []
        )
        store.addGap(gap)
        savedIds.insert(turn.id)
    }
}
