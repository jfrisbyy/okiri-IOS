//
//  ScenariosView.swift
//  FluentFrenchIOS
//
//  Quick-reference survival guides for real-life situations in France. Type a
//  situation or tap a quick-pick, get a tailored guide (phrases / Q&A / tips),
//  hear phrases aloud, translate & add custom phrases, and save guides.
//

import SwiftUI

struct ScenariosView: View {
    @Environment(\.dismiss) private var dismiss

    private enum Tab: String, CaseIterable { case phrases = "Phrases", qa = "Q & A", tips = "Tips" }

    @State private var query = ""
    @State private var isGenerating = false
    @State private var guide: ScenarioGuide? = nil
    @State private var currentQuery = ""
    @State private var activeTab: Tab = .phrases
    @State private var saved: [SavedScenario] = []
    @State private var customPhrases: [ScenarioPhrase] = []
    @State private var errorText: String? = nil
    @State private var playingId: String? = nil

    // Mini translator
    @State private var translatorOpen = false
    @State private var translateInput = ""
    @State private var translateResult: ScenarioPhrase? = nil
    @State private var isTranslating = false

    @FocusState private var inputFocused: Bool

    private struct QuickPick: Identifiable {
        let id = UUID(); let label: String; let icon: String; let color: Color
    }
    private let quickPicks: [QuickPick] = [
        .init(label: "Restaurant", icon: "cup.and.saucer.fill", color: Color(hex: "D97706")),
        .init(label: "Shopping", icon: "bag.fill", color: Color(hex: "059669")),
        .init(label: "Train Station", icon: "tram.fill", color: Color(hex: "2563EB")),
        .init(label: "Hotel", icon: "bed.double.fill", color: Color(hex: "7C3AED")),
        .init(label: "Doctor", icon: "stethoscope", color: Color(hex: "DC2626")),
        .init(label: "Phone Call", icon: "phone.fill", color: Color(hex: "0891B2")),
        .init(label: "Directions", icon: "map.fill", color: Color(hex: "EA580C")),
        .init(label: "Meeting People", icon: "person.2.fill", color: Color(hex: "DB2777")),
    ]

    private var isCurrentSaved: Bool { saved.contains { $0.query == currentQuery } }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 18) {
                    if isGenerating {
                        loadingCard
                    } else if let guide {
                        resultView(guide)
                    } else {
                        searchView
                    }
                }
                .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 48)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
        .onAppear { saved = ScenarioStore.load() }
    }

    private var header: some View {
        ResourceHeader(
            gradient: Theme.tealGradient,
            title: "Scenarios",
            subtitle: "Quick help for real-life situations",
            onBack: { dismiss() }
        )
    }

    // MARK: - Search view

    private var searchView: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").font(.system(size: 16)).foregroundStyle(Theme.textMuted)
                    TextField("Describe your situation…", text: $query)
                        .font(.system(size: 15)).foregroundStyle(Theme.text)
                        .focused($inputFocused)
                        .submitLabel(.search)
                        .onSubmit { generate(query) }
                }
                .padding(.horizontal, 14).padding(.vertical, 14)
                .background(Theme.card)
                .clipShape(.rect(cornerRadius: Radius.chip))
                .overlay(RoundedRectangle(cornerRadius: Radius.chip).stroke(Theme.border, lineWidth: 0.5))

                Button {
                    generate(query)
                } label: {
                    Image(systemName: "sparkles").font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 50, height: 50)
                        .background(Theme.secondary).clipShape(.rect(cornerRadius: Radius.chip))
                        .softLift(radius: 10, y: 4, strength: 0.7)
                }
                .buttonStyle(.plain)
                .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty)
                .opacity(query.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
            }

            VStack(alignment: .leading, spacing: 12) {
                Text("QUICK SCENARIOS").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textSecondary).tracking(0.5)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                    ForEach(quickPicks) { pick in
                        Button {
                            Haptics.select()
                            query = pick.label
                            generate(pick.label)
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: pick.icon).font(.system(size: 15)).foregroundStyle(pick.color)
                                    .frame(width: 30, height: 30).background(pick.color.opacity(0.12)).clipShape(.rect(cornerRadius: 8))
                                Text(pick.label).font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.text)
                                    .lineLimit(1)
                                Spacer(minLength: 0)
                            }
                            .padding(8)
                            .background(Theme.card)
                            .clipShape(.rect(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
                        }
                        .buttonStyle(.plain)
                        .pressable()
                    }
                }
            }

            if let errorText {
                VStack(spacing: 10) {
                    Text(errorText).font(.system(size: 14)).foregroundStyle(Theme.error).multilineTextAlignment(.center)
                    Button { generate(currentQuery.isEmpty ? query : currentQuery) } label: {
                        Text("Retry").font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                            .padding(.horizontal, 20).padding(.vertical, 8)
                            .background(Theme.error).clipShape(.capsule)
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity)
                .padding(18).background(Theme.errorLight).clipShape(.rect(cornerRadius: Radius.card))
            }

            if !saved.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label("Saved Scenarios", systemImage: "clock.fill")
                            .font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text)
                        Spacer()
                        Text("\(saved.count)").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textMuted)
                    }
                    ForEach(saved) { item in
                        Button { openSaved(item) } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.guide.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text).lineLimit(1)
                                    Text(item.guide.titleFrench).font(.system(size: 12)).foregroundStyle(Theme.textMuted).lineLimit(1)
                                }
                                Spacer()
                                Button {
                                    deleteSaved(item)
                                } label: {
                                    Image(systemName: "trash").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                                        .frame(width: 30, height: 30)
                                }
                                .buttonStyle(.plain)
                                Image(systemName: "chevron.right").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                            }
                            .padding(14)
                            .background(Theme.card)
                            .clipShape(.rect(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var loadingCard: some View {
        VStack(spacing: 12) {
            ProgressView().tint(Theme.secondary).scaleEffect(1.4)
            Text("Building your guide…").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text).padding(.top, 6)
            Text("Preparing phrases, tips & answers").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 48)
        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.hero)).softLift()
        .padding(.top, 40)
    }

    // MARK: - Result view

    @ViewBuilder
    private func resultView(_ guide: ScenarioGuide) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(guide.title).font(.serifDisplay(24, weight: .bold)).foregroundStyle(Theme.text)
                    Text(guide.titleFrench).font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.secondary)
                }
                Spacer()
                Button {
                    toggleSave(guide)
                } label: {
                    Image(systemName: isCurrentSaved ? "bookmark.fill" : "bookmark")
                        .font(.system(size: 18)).foregroundStyle(isCurrentSaved ? Theme.secondary : Theme.textSecondary)
                        .frame(width: 42, height: 42)
                        .background(isCurrentSaved ? Theme.secondaryLight : Theme.backgroundSecondary)
                        .clipShape(.rect(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }

            Text(guide.summary).font(.system(size: 14)).foregroundStyle(Theme.textSecondary).lineSpacing(3)

            tabBar

            switch activeTab {
            case .phrases: phrasesTab(guide)
            case .qa: qaTab(guide)
            case .tips: tipsTab(guide)
            }

            translatorBlock

            Button {
                Haptics.tap()
                withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { resetToSearch() }
            } label: {
                Label("New Scenario", systemImage: "magnifyingglass")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.secondary)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(Theme.secondaryLight).clipShape(.rect(cornerRadius: Radius.chip))
            }
            .buttonStyle(.plain)
        }
    }

    private var tabBar: some View {
        HStack(spacing: 4) {
            ForEach(Tab.allCases, id: \.self) { tab in
                let active = activeTab == tab
                Button {
                    Haptics.tap()
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { activeTab = tab }
                } label: {
                    Text(tab.rawValue).font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(active ? Theme.secondary : Theme.textMuted)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(active ? Theme.card : .clear)
                        .clipShape(.rect(cornerRadius: 9))
                        .softLift(radius: active ? 6 : 0, y: active ? 2 : 0, strength: active ? 0.7 : 0)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Theme.backgroundSecondary)
        .clipShape(.rect(cornerRadius: Radius.chip))
    }

    private func phrasesTab(_ guide: ScenarioGuide) -> some View {
        VStack(spacing: 8) {
            ForEach(Array(guide.keyPhrases.enumerated()), id: \.element.id) { i, phrase in
                phraseCard(phrase, index: i + 1, accent: Theme.secondary, bg: Theme.card)
            }
            if !customPhrases.isEmpty {
                dividerLabel("Your Phrases", icon: "plus", color: Theme.primary)
                ForEach(customPhrases) { phrase in
                    phraseCard(phrase, index: nil, accent: Theme.primary, bg: Color(hex: "FFF8F3"))
                }
            }
            if !guide.nativeExpressions.isEmpty {
                dividerLabel("Sound Like a Native", icon: "sparkles", color: Color(hex: "D97706"))
                ForEach(guide.nativeExpressions) { expr in
                    phraseCard(expr, index: nil, accent: Color(hex: "D97706"), bg: Color(hex: "FFFBEB"))
                }
            }
        }
    }

    private func phraseCard(_ phrase: ScenarioPhrase, index: Int?, accent: Color, bg: Color) -> some View {
        let pid = "phrase-\(phrase.id)"
        return Button {
            play(phrase.french, id: pid)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8).fill(accent.opacity(0.14)).frame(width: 28, height: 28)
                    if let index { Text("\(index)").font(.system(size: 12, weight: .bold)).foregroundStyle(accent) }
                    else { Image(systemName: "sparkle").font(.system(size: 11)).foregroundStyle(accent) }
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(phrase.french).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                    Text(phrase.english).font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                    if !phrase.context.isEmpty {
                        HStack(alignment: .top, spacing: 6) {
                            Circle().fill(accent).frame(width: 4, height: 4).padding(.top, 6)
                            Text(phrase.context).font(.system(size: 12)).italic().foregroundStyle(Theme.textMuted)
                        }
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "speaker.wave.2.fill").font(.system(size: 13))
                    .foregroundStyle(playingId == pid ? accent : Theme.textMuted)
                    .frame(width: 30, height: 30)
                    .background(playingId == pid ? accent.opacity(0.14) : Theme.backgroundSecondary)
                    .clipShape(.circle)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(bg)
            .clipShape(.rect(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(accent.opacity(0.18), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .pressable()
    }

    private func qaTab(_ guide: ScenarioGuide) -> some View {
        VStack(spacing: 10) {
            Text("Tap any phrase to hear it spoken").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
            ForEach(Array(guide.questionsAndAnswers.enumerated()), id: \.element.id) { i, qa in
                VStack(spacing: 0) {
                    qaSection(badge: "They ask", badgeColor: Theme.error, french: qa.question, english: qa.questionEnglish, id: "qaq-\(qa.id)")
                    Rectangle().fill(Theme.border).frame(height: 0.5)
                    qaSection(badge: "You say", badgeColor: Theme.success, french: qa.answer, english: qa.answerEnglish, id: "qaa-\(qa.id)")
                }
                .background(Theme.card)
                .clipShape(.rect(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
            }
        }
    }

    private func qaSection(badge: String, badgeColor: Color, french: String, english: String, id: String) -> some View {
        Button {
            play(french, id: id)
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(badge).font(.system(size: 10, weight: .bold)).foregroundStyle(badgeColor)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(badgeColor.opacity(0.12)).clipShape(.capsule)
                    Spacer()
                    Image(systemName: "speaker.wave.2.fill").font(.system(size: 11))
                        .foregroundStyle(playingId == id ? badgeColor : Theme.textMuted)
                }
                Text(french).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                Text(english).font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
    }

    private func tipsTab(_ guide: ScenarioGuide) -> some View {
        VStack(spacing: 10) {
            ForEach(guide.tips) { tip in
                let style = tipStyle(tip.category)
                VStack(alignment: .leading, spacing: 8) {
                    Text(style.label).font(.system(size: 10, weight: .bold)).foregroundStyle(style.color)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(style.color.opacity(0.12)).clipShape(.capsule)
                    Text(tip.tip).font(.system(size: 14)).foregroundStyle(Theme.text).lineSpacing(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(Theme.card)
                .clipShape(.rect(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
            }
        }
    }

    private func tipStyle(_ category: String) -> (label: String, color: Color) {
        switch category {
        case "native": return ("Language", Color(hex: "2563EB"))
        case "cultural": return ("Culture", Color(hex: "EA580C"))
        case "practical": return ("Practical", Theme.success)
        default: return (category.capitalized, Theme.textMuted)
        }
    }

    private func dividerLabel(_ text: String, icon: String, color: Color) -> some View {
        HStack(spacing: 10) {
            Rectangle().fill(color.opacity(0.3)).frame(height: 1)
            HStack(spacing: 5) {
                Image(systemName: icon).font(.system(size: 11)).foregroundStyle(color)
                Text(text).font(.system(size: 11, weight: .semibold)).foregroundStyle(color)
            }
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(color.opacity(0.12)).clipShape(.capsule)
            Rectangle().fill(color.opacity(0.3)).frame(height: 1)
        }
        .padding(.vertical, 6)
    }

    // MARK: - Mini translator

    @ViewBuilder
    private var translatorBlock: some View {
        if translatorOpen {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("Quick Translator", systemImage: "character.bubble").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.secondary)
                    Spacer()
                    Button {
                        withAnimation { translatorOpen = false; translateInput = ""; translateResult = nil }
                    } label: {
                        Image(systemName: "xmark").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                    }
                    .buttonStyle(.plain)
                }
                HStack(spacing: 10) {
                    TextField("Type in English…", text: $translateInput)
                        .font(.system(size: 15)).foregroundStyle(Theme.text)
                        .padding(.horizontal, 12).padding(.vertical, 12)
                        .background(Theme.background)
                        .clipShape(.rect(cornerRadius: Radius.chip))
                        .overlay(RoundedRectangle(cornerRadius: Radius.chip).stroke(Theme.border, lineWidth: 0.5))
                        .submitLabel(.go)
                        .onSubmit { Task { await runTranslate() } }
                    Button {
                        Task { await runTranslate() }
                    } label: {
                        ZStack {
                            if isTranslating { ProgressView().tint(.white) }
                            else { Image(systemName: "character.bubble").font(.system(size: 15)).foregroundStyle(.white) }
                        }
                        .frame(width: 46, height: 46).background(Theme.secondary).clipShape(.rect(cornerRadius: Radius.chip))
                    }
                    .buttonStyle(.plain)
                    .disabled(translateInput.trimmingCharacters(in: .whitespaces).isEmpty || isTranslating)
                    .opacity(translateInput.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
                }
                if let translateResult {
                    HStack(alignment: .top, spacing: 10) {
                        Button {
                            play(translateResult.french, id: "translate-result")
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(translateResult.french).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                                Text(translateResult.english).font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                                HStack(spacing: 4) {
                                    Image(systemName: "speaker.wave.2.fill").font(.system(size: 10))
                                    Text("Tap to hear").font(.system(size: 11))
                                }
                                .foregroundStyle(playingId == "translate-result" ? Theme.secondary : Theme.textMuted)
                                .padding(.top, 2)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                        Button {
                            addTranslatedPhrase()
                        } label: {
                            Label("Add", systemImage: "plus").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
                                .padding(.horizontal, 12).padding(.vertical, 8)
                                .background(Theme.primary).clipShape(.capsule)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(12)
                    .background(Theme.secondaryLight.opacity(0.5))
                    .clipShape(.rect(cornerRadius: 12))
                }
            }
            .padding(16)
            .background(Theme.card)
            .clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.secondary.opacity(0.2), lineWidth: 1))
        } else {
            Button {
                Haptics.tap()
                withAnimation { translatorOpen = true }
            } label: {
                Label("Translate & Add Phrase", systemImage: "character.bubble")
                    .font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.secondary)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(Theme.card).clipShape(.rect(cornerRadius: Radius.chip))
                    .overlay(RoundedRectangle(cornerRadius: Radius.chip).stroke(Theme.secondary.opacity(0.3), lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Actions

    private func generate(_ q: String) {
        let clean = q.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        Haptics.select()
        inputFocused = false
        currentQuery = clean
        errorText = nil
        customPhrases = []
        translatorOpen = false
        translateInput = ""
        translateResult = nil
        withAnimation { isGenerating = true; guide = nil }
        Task {
            let result = await ScenariosService.generate(for: clean)
            await MainActor.run {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                    isGenerating = false
                    if let result {
                        guide = result
                        activeTab = .phrases
                        Haptics.success()
                    } else {
                        errorText = "Failed to generate scenario. Please try again."
                    }
                }
            }
        }
    }

    private func runTranslate() async {
        let text = translateInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isTranslating = true
        let french = await TranslationService.translate(text, from: .english, to: .french)
        withAnimation {
            translateResult = ScenarioPhrase(french: french, english: text, context: "Added from translator")
            isTranslating = false
        }
    }

    private func addTranslatedPhrase() {
        guard let translateResult else { return }
        Haptics.success()
        customPhrases.append(translateResult)
        withAnimation {
            translateInput = ""
            self.translateResult = nil
        }
    }

    private func play(_ text: String, id: String) {
        Haptics.tap()
        if playingId == id {
            playingId = nil
            NaturalVoice.shared.stop()
            return
        }
        playingId = id
        NaturalVoice.shared.speak(text)
    }

    private func toggleSave(_ guide: ScenarioGuide) {
        if let existing = saved.firstIndex(where: { $0.query == currentQuery }) {
            saved.remove(at: existing)
            Haptics.tap()
        } else {
            var merged = guide
            merged.keyPhrases.append(contentsOf: customPhrases)
            saved.insert(SavedScenario(id: UUID().uuidString, query: currentQuery, guide: merged, savedAt: Date()), at: 0)
            Haptics.success()
        }
        ScenarioStore.save(saved)
    }

    private func deleteSaved(_ item: SavedScenario) {
        Haptics.tap()
        saved.removeAll { $0.id == item.id }
        ScenarioStore.save(saved)
    }

    private func openSaved(_ item: SavedScenario) {
        Haptics.select()
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
            guide = item.guide
            currentQuery = item.query
            activeTab = .phrases
            customPhrases = []
        }
    }

    private func resetToSearch() {
        guide = nil
        query = ""
        currentQuery = ""
        customPhrases = []
        translatorOpen = false
        translateInput = ""
        translateResult = nil
        errorText = nil
    }
}
