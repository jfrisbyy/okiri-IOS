//
//  LessonView.swift
//  FluentFrenchIOS
//
//  A multi-stage, game-like practice flow: intro → teaching → practice →
//  completion. Questions span six formats (MC, fill-blank, true/false,
//  translation, arrange-the-words, match-the-pairs), each word must be
//  answered correctly a few times to be "mastered", and the session tracks
//  hearts, a combo streak with XP multiplier, and XP. FSRS reviews + errors
//  are recorded on the way, and the learner's IRT ability updates live.
//

import SwiftUI

// MARK: - Question model

struct LessonQuestion: Identifiable {
    enum Kind: CaseIterable { case multipleChoice, fillBlank, trueFalse, translation, arrange, match }
    let id = UUID()
    let gap: GapItem
    let kind: Kind
    var prompt: String
    var correctAnswer: String
    var options: [String] = []
    var statement: String = ""
    var hint: String?
    var tokens: [String] = []          // arrange: shuffled word bank
    var correctOrder: [String] = []    // arrange: target order
    var matchGaps: [GapItem] = []      // match: the pairs to connect
    var isRemedial: Bool = false
}

// MARK: - Question generator

@MainActor
struct LessonGenerator {
    let allGaps: [GapItem]
    let optionCount: Int

    func question(for gap: GapItem, kind: LessonQuestion.Kind, remedial: Bool = false) -> LessonQuestion {
        switch kind {
        case .multipleChoice:
            var options = smartDistractors(for: gap, count: optionCount - 1) + [gap.englishTranslation]
            options.shuffle()
            return LessonQuestion(gap: gap, kind: .multipleChoice,
                prompt: "What does “\(gap.frenchWord)” mean?",
                correctAnswer: gap.englishTranslation, options: options,
                hint: gap.explanation.isEmpty ? nil : gap.explanation, isRemedial: remedial)
        case .fillBlank:
            return LessonQuestion(gap: gap, kind: .fillBlank,
                prompt: blankOut(gap.frenchWord, in: gap.exampleSentence),
                correctAnswer: gap.frenchWord,
                hint: gap.exampleTranslation.isEmpty ? nil : gap.exampleTranslation, isRemedial: remedial)
        case .trueFalse:
            let makeTrue = (gap.reviewCount % 2 == 0)
            let shown = makeTrue ? gap.englishTranslation : (smartDistractors(for: gap, count: 1).first ?? "something else")
            return LessonQuestion(gap: gap, kind: .trueFalse,
                prompt: "True or false?", correctAnswer: makeTrue ? "True" : "False",
                statement: "“\(gap.frenchWord)” means “\(shown)”.", isRemedial: remedial)
        case .translation:
            return LessonQuestion(gap: gap, kind: .translation,
                prompt: "Translate to French:", correctAnswer: gap.frenchWord,
                statement: gap.englishTranslation, hint: "Mind the accents.", isRemedial: remedial)
        case .arrange:
            let target = sentenceTokens(gap.exampleSentence.isEmpty ? gap.frenchWord : gap.exampleSentence)
            // Fall back to MC if the sentence is too short to arrange.
            guard target.count >= 3 && target.count <= 9 else {
                return question(for: gap, kind: .multipleChoice, remedial: remedial)
            }
            var bank = target
            repeat { bank.shuffle() } while bank == target && target.count > 1
            return LessonQuestion(gap: gap, kind: .arrange,
                prompt: "Tap the words in order:", correctAnswer: target.joined(separator: " "),
                hint: gap.exampleTranslation.isEmpty ? nil : gap.exampleTranslation,
                tokens: bank, correctOrder: target, isRemedial: remedial)
        case .match:
            return LessonQuestion(gap: gap, kind: .match,
                prompt: "Match each word to its meaning",
                correctAnswer: "", matchGaps: [gap], isRemedial: remedial)
        }
    }

    func matchQuestion(for gaps: [GapItem]) -> LessonQuestion {
        LessonQuestion(gap: gaps[0], kind: .match,
            prompt: "Match each word to its meaning",
            correctAnswer: "", matchGaps: gaps)
    }

    private func smartDistractors(for gap: GapItem, count: Int) -> [String] {
        let same = allGaps.filter { $0.id != gap.id && $0.category == gap.category }.map { $0.englishTranslation }
        let other = allGaps.filter { $0.id != gap.id && $0.category != gap.category }.map { $0.englishTranslation }
        let fallback = ["hello", "thank you", "house", "to go", "water", "day", "small", "red", "to speak", "always"]
        var pool = same.shuffled() + other.shuffled() + fallback
        pool.removeAll { $0.caseInsensitiveCompare(gap.englishTranslation) == .orderedSame }
        var seen = Set<String>()
        return Array(pool.filter { seen.insert($0.lowercased()).inserted }.prefix(count))
    }

    private func blankOut(_ word: String, in sentence: String) -> String {
        if !sentence.isEmpty, sentence.range(of: word, options: .caseInsensitive) != nil {
            return sentence.replacingOccurrences(of: word, with: "_____", options: .caseInsensitive)
        }
        return "_____ — fill in the missing word"
    }

    private func sentenceTokens(_ s: String) -> [String] {
        s.split(whereSeparator: { $0 == " " || $0 == "\n" })
            .map { $0.trimmingCharacters(in: CharacterSet(charactersIn: " ")) }
            .filter { !$0.isEmpty }
    }
}

// MARK: - Lesson View

struct LessonView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let gaps: [GapItem]
    /// When a lesson was assembled by the concept-selection engine, this carries
    /// the target concept, per-item reasons and the "why this lesson" headline.
    var assembled: AssembledLesson? = nil
    /// A periodic milestone quiz: skips teaching, applies extra mastery weight,
    /// and shows a "what held / what slipped" summary.
    var isCapstone: Bool = false

    private var conceptWeight: Double { isCapstone ? Tuning.capstoneWeight : 1 }

    enum Stage { case intro, teaching, generating, practice, complete }

    private let masteryTarget = 2
    private let startingHearts = 5

    @State private var stage: Stage = .intro
    @State private var schedule: [LessonQuestion] = []
    @State private var position = 0

    // Per-question UI state
    @State private var selectedOption: String? = nil
    @State private var textAnswer = ""
    @State private var arranged: [String] = []
    @State private var matchedGapIds: Set<String> = []
    @State private var matchSelectedLeft: String? = nil
    @State private var matchWrongRight: String? = nil
    @State private var revealed = false
    @State private var wasCorrect = false

    // Session game state
    @State private var hearts = 5
    @State private var xp = 0
    @State private var combo = 0
    @State private var bestCombo = 0
    @State private var correctByGap: [String: Int] = [:]
    @State private var masteredGapIds: Set<String> = []
    @State private var answeredCount = 0
    @State private var correctCount = 0
    @State private var masteryFlash: String? = nil
    @State private var comboPop = false
    @State private var thetaBefore: Double = 0
    @State private var unlockedConcepts: [String] = []
    @State private var conceptExplanations: [String: String] = [:]

    private var generator: LessonGenerator { LessonGenerator(allGaps: store.gaps, optionCount: store.optionCount) }

    private var lessonLevel: CEFRLevel {
        gaps.compactMap { $0.cefrLevel }.max(by: { $0.order < $1.order }) ?? .A2
    }
    private var current: LessonQuestion? { schedule.indices.contains(position) ? schedule[position] : nil }
    private var masteryProgress: Double { gaps.isEmpty ? 0 : Double(masteredGapIds.count) / Double(gaps.count) }

    // Previous best (for the "beat your best" challenge)
    private let bestAccuracyKey = "ff.lesson.bestAccuracy"
    private let bestStreakKey = "ff.lesson.bestStreak"
    private var prevBestAccuracy: Int { UserDefaults.standard.integer(forKey: bestAccuracyKey) }
    private var prevBestStreak: Int { UserDefaults.standard.integer(forKey: bestStreakKey) }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            switch stage {
            case .intro: introStage
            case .teaching: teachingStage
            case .generating: generatingStage
            case .practice:
                if let q = current { practiceStage(q) } else { ProgressView().tint(Theme.primary) }
            case .complete: completeStage
            }

            if let flash = masteryFlash { masteryOverlay(flash) }
        }
        .onAppear { if thetaBefore == 0 { thetaBefore = store.abilityTheta } }
    }

    // MARK: - Intro

    private var introStage: some View {
        VStack(spacing: Space.xl) {
            topClose
            Spacer()
            VStack(spacing: Space.lg) {
                ZStack {
                    Circle().fill(Theme.primaryGradient).frame(width: 96, height: 96).softLift(radius: 18, y: 8, strength: 2)
                    Image(systemName: "graduationcap.fill").font(.system(size: 40)).foregroundStyle(.white)
                }
                Text("Ready to practice?").font(.serifDisplay(28, weight: .bold)).foregroundStyle(Theme.text)
                Text("\(gaps.count) word\(gaps.count == 1 ? "" : "s") · master each by answering it right \(masteryTarget)×")
                    .font(.system(size: 15)).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)

                if let headline = assembled?.headline {
                    HStack(spacing: 8) {
                        Image(systemName: "sparkles").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.secondary)
                        Text(headline).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.text)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                    }
                    .padding(Space.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.secondaryLight).clipShape(.rect(cornerRadius: Radius.card))
                }

                let cats = Set(gaps.map { $0.category })
                FlowLayout(spacing: 8, lineSpacing: 8) {
                    ForEach(Array(cats), id: \.self) { cat in
                        Pill(text: cat.label, color: cat.color, filled: true)
                    }
                }

                VStack(spacing: 8) {
                    ForEach(gaps.prefix(4)) { gap in
                        HStack(spacing: 10) {
                            Circle().fill(gap.category.color.opacity(0.15)).frame(width: 34, height: 34)
                                .overlay { Text(String(gap.frenchWord.prefix(1)).uppercased()).font(.system(size: 15, weight: .bold)).foregroundStyle(gap.category.color) }
                            VStack(alignment: .leading, spacing: 1) {
                                Text(gap.frenchWord).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                                Text(gap.englishTranslation).font(.system(size: 12)).foregroundStyle(Theme.textMuted).lineLimit(1)
                            }
                            Spacer()
                        }
                    }
                    if gaps.count > 4 {
                        Text("+ \(gaps.count - 4) more").font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.textMuted)
                    }
                }
                .padding(Space.lg)
                .frame(maxWidth: .infinity)
                .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift()

                if prevBestAccuracy > 0 {
                    HStack(spacing: 12) {
                        Image(systemName: "trophy.fill").font(.system(size: 20)).foregroundStyle(Theme.warning)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Beat your best").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
                            Text("\(prevBestAccuracy)% accuracy · \(prevBestStreak) best streak").font(.system(size: 12)).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                    }
                    .padding(Space.lg)
                    .frame(maxWidth: .infinity)
                    .background(Theme.warningLight).clipShape(.rect(cornerRadius: Radius.card))
                }
            }
            Spacer()
            primaryButton(gaps.isEmpty ? "Nothing to practice" : (isCapstone ? "Begin capstone" : "Start")) {
                guard !gaps.isEmpty else { dismiss(); return }
                Haptics.select()
                if isCapstone {
                    startSchedule()   // pure test — no teaching stage
                } else {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { stage = .teaching }
                }
            }
        }
        .padding(Space.xl)
    }

    // MARK: - Teaching

    private var teachingStage: some View {
        VStack(spacing: Space.lg) {
            topClose
            Text("Learn before you practice").font(.serifDisplay(22, weight: .bold)).foregroundStyle(Theme.text)
            TabView {
                ForEach(assembled?.conceptBlocks ?? []) { block in conceptCard(block) }
                ForEach(gaps.prefix(6)) { gap in teachingCard(gap) }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            primaryButton("Start practice") {
                Haptics.select()
                startSchedule()
            }
        }
        .padding(Space.xl)
        .task { await loadConceptExplanations() }
    }

    /// A framed "skill card": concept name, plain explanation, one real worked
    /// example with the key part emphasised, and the "why you're seeing this" line.
    private func conceptCard(_ block: ConceptBlock) -> some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            HStack(spacing: 8) {
                Pill(text: "Skill", color: Theme.secondary, filled: true)
                Pill(text: block.concept.category.label, color: block.concept.category.color)
                Pill(text: block.concept.cefrLevel.rawValue, color: Theme.textMuted)
                Spacer()
            }
            Text(block.concept.name)
                .font(.serifDisplay(26, weight: .bold)).foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)

            Text(conceptExplanations[block.concept.id] ?? block.explanation)
                .font(.system(size: 16)).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if let ex = block.example {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text("Example").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.secondary)
                        let speech = ex.exampleSentence.isEmpty ? ex.frenchWord : ex.exampleSentence
                        SpeakButton(text: speech, size: 28)
                    }
                    if ex.exampleSentence.isEmpty {
                        Text(ex.frenchWord).font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.primary)
                        Text(ex.englishTranslation).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                    } else {
                        highlightedExample(ex.exampleSentence, key: ex.frenchWord)
                        if !ex.exampleTranslation.isEmpty {
                            Text(ex.exampleTranslation).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Space.lg).background(Theme.secondaryLight).clipShape(.rect(cornerRadius: Radius.card))
            }

            if let reason = block.reason {
                HStack(spacing: 6) {
                    Image(systemName: "lightbulb.fill").font(.system(size: 11)).foregroundStyle(Theme.warning)
                    Text(reason).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer()
        }
        .padding(Space.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.hero)).softLift()
        .padding(.bottom, 36)
        .padding(.horizontal, 2)
    }

    /// Render an example sentence with the target word emphasised.
    private func highlightedExample(_ sentence: String, key: String) -> Text {
        guard !key.isEmpty, let range = sentence.range(of: key, options: .caseInsensitive) else {
            return Text(sentence).font(.system(size: 16, weight: .medium)).italic().foregroundStyle(Theme.text)
        }
        let before = String(sentence[sentence.startIndex..<range.lowerBound])
        let match = String(sentence[range])
        let after = String(sentence[range.upperBound...])
        return Text(before).font(.system(size: 16, weight: .medium)).italic().foregroundStyle(Theme.text)
            + Text(match).font(.system(size: 16, weight: .heavy)).italic().foregroundStyle(Theme.primary)
            + Text(after).font(.system(size: 16, weight: .medium)).italic().foregroundStyle(Theme.text)
    }

    /// Fill in plain-language explanations for any skill card whose stored
    /// description is too thin, using the existing AI path (best-effort).
    private func loadConceptExplanations() async {
        guard LessonService.hasKey, let blocks = assembled?.conceptBlocks else { return }
        for block in blocks where block.explanation.count < 40 && conceptExplanations[block.concept.id] == nil {
            if let text = await LessonService.explainConcept(
                name: block.concept.name,
                category: block.concept.category.label,
                level: block.concept.cefrLevel) {
                conceptExplanations[block.concept.id] = text
            }
        }
    }

    // MARK: - Generating

    private var generatingStage: some View {
        VStack(spacing: Space.lg) {
            Spacer()
            ZStack {
                Circle().fill(Theme.primaryGradient).frame(width: 92, height: 92).softLift(radius: 18, y: 8, strength: 2)
                Image(systemName: "sparkles").font(.system(size: 36)).foregroundStyle(.white)
                    .symbolEffect(.variableColor.iterative, options: .repeating)
            }
            Text("Crafting your lesson…").font(.serifDisplay(24, weight: .bold)).foregroundStyle(Theme.text)
            Text("Building fresh questions tuned to your \(gaps.count) word\(gaps.count == 1 ? "" : "s") at level \(lessonLevel.rawValue).")
                .font(.system(size: 15)).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
            ProgressView().tint(Theme.primary).padding(.top, 4)
            Spacer()
        }
        .padding(Space.xl)
    }

    private func teachingCard(_ gap: GapItem) -> some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            HStack {
                Pill(text: gap.category.label, color: gap.category.color, filled: true)
                if let cefr = gap.cefrLevel { Pill(text: cefr.rawValue, color: Theme.textMuted) }
                Spacer()
            }
            HStack(spacing: 12) {
                Text(gap.frenchWord).font(.serifDisplay(32, weight: .bold)).foregroundStyle(Theme.primary)
                SpeakButton(text: gap.frenchWord, size: 42)
            }
            if let pron = gap.pronunciation, !pron.isEmpty {
                Text(pron).font(.system(size: 15)).italic().foregroundStyle(Theme.textMuted)
            }
            let grammarTags: [String] = [gap.partOfSpeech, gap.gender, gap.article, gap.register]
                .compactMap { $0 }.filter { !$0.isEmpty }
            if !grammarTags.isEmpty {
                FlowLayout(spacing: 6, lineSpacing: 6) {
                    ForEach(grammarTags, id: \.self) { tag in
                        GrammarChip(text: tag, accent: Theme.primary)
                    }
                }
            }
            if let base = gap.baseForm, !base.isEmpty {
                HStack(spacing: 5) {
                    Text("Base form:").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.textMuted)
                    Text(base).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.text)
                }
            }
            Text(gap.englishTranslation).font(.system(size: 20, weight: .semibold)).foregroundStyle(Theme.text)
            if !gap.explanation.isEmpty {
                Text(gap.explanation).font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !gap.exampleSentence.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text("Example").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.secondary)
                        SpeakButton(text: gap.exampleSentence, size: 28)
                    }
                    Text(gap.exampleSentence).font(.system(size: 16, weight: .medium)).italic().foregroundStyle(Theme.text)
                    if !gap.exampleTranslation.isEmpty {
                        Text(gap.exampleTranslation).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Space.lg).background(Theme.secondaryLight).clipShape(.rect(cornerRadius: Radius.card))
            }
            if let related = gap.relatedWords, !related.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("RELATED WORDS").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted)
                    FlowLayout(spacing: 6, lineSpacing: 6) {
                        ForEach(related, id: \.self) { word in
                            Text(word)
                                .font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.primary)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(Theme.primary.opacity(0.10), in: Capsule())
                        }
                    }
                }
            }
            Spacer()
        }
        .padding(Space.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.hero)).softLift()
        .padding(.bottom, 36)
        .padding(.horizontal, 2)
    }

    // MARK: - Practice

    private func practiceStage(_ q: LessonQuestion) -> some View {
        VStack(spacing: 0) {
            practiceBar
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xl) {
                    HStack(spacing: 8) {
                        Pill(text: q.gap.category.label, color: q.gap.category.color)
                        if q.isRemedial { Pill(text: "Try again", color: Theme.warning) }
                        Spacer()
                        if store.optionCount >= 5 && q.kind == .multipleChoice {
                            Pill(text: "Tuned to your level", color: Theme.secondary)
                        }
                    }
                    Text(q.prompt).font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)

                    if let reason = assembled?.reasons[q.gap.id] {
                        HStack(spacing: 6) {
                            Image(systemName: "lightbulb.fill").font(.system(size: 11)).foregroundStyle(Theme.warning)
                            Text(reason).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    if q.kind == .trueFalse || q.kind == .translation {
                        HStack(spacing: 8) {
                            Text(q.statement).font(.system(size: 18)).foregroundStyle(Theme.text)
                            if q.kind == .translation { SpeakButton(text: q.gap.englishTranslation) }
                        }
                        .padding(Space.lg).frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift(strength: 0.6)
                    }

                    answerArea(q)

                    if revealed && q.kind != .match {
                        explanationBox(q)
                    }
                }
                .padding(Space.xl)
                .id(q.id) // slide each question in fresh
                .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                        removal: .move(edge: .leading).combined(with: .opacity)))
            }
            bottomBar(q)
        }
    }

    private var practiceBar: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.textMuted)
                }
                ZStack(alignment: .leading) {
                    GeometryReader { geo in
                        Capsule().fill(Theme.border).frame(height: 10)
                        Capsule().fill(Theme.primaryGradient)
                            .frame(width: max(10, geo.size.width * masteryProgress), height: 10)
                            .animation(.spring(response: 0.5, dampingFraction: 0.8), value: masteryProgress)
                    }
                    .frame(height: 10)
                }
                // hearts
                HStack(spacing: 2) {
                    Image(systemName: "heart.fill").font(.system(size: 13)).foregroundStyle(Theme.error)
                    Text("\(max(0, hearts))").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
                }
            }
            HStack(spacing: 10) {
                statChip("flame.fill", Theme.primary, "\(combo)", "streak", pop: comboPop)
                statChip("star.fill", Theme.warning, "\(xp)", "XP", pop: false)
                Spacer()
                Text("\(masteredGapIds.count)/\(gaps.count) mastered")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(.horizontal, Space.xl).padding(.top, 10).padding(.bottom, 6)
    }

    private func statChip(_ icon: String, _ color: Color, _ value: String, _ label: String, pop: Bool) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.system(size: 12)).foregroundStyle(color)
            Text(value).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
            Text(label).font(.system(size: 11)).foregroundStyle(Theme.textMuted)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(color.opacity(0.1)).clipShape(.capsule)
        .scaleEffect(pop ? 1.25 : 1)
        .animation(.spring(response: 0.3, dampingFraction: 0.5), value: pop)
    }

    // MARK: Answer areas

    @ViewBuilder
    private func answerArea(_ q: LessonQuestion) -> some View {
        switch q.kind {
        case .multipleChoice:
            VStack(spacing: 10) { ForEach(q.options, id: \.self) { optionRow($0, q: q) } }
        case .trueFalse:
            HStack(spacing: 12) { optionRow("True", q: q); optionRow("False", q: q) }
        case .fillBlank, .translation:
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    TextField("Type your answer", text: $textAnswer)
                        .font(.system(size: 18)).autocorrectionDisabled().textInputAutocapitalization(.never)
                        .disabled(revealed)
                    if q.kind == .fillBlank { SpeakButton(text: q.gap.exampleSentence) }
                }
                .padding(Space.lg).background(Theme.card).clipShape(.rect(cornerRadius: Radius.card))
                .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(
                    revealed ? (wasCorrect ? Theme.success : Theme.error) : Theme.border, lineWidth: 1.5))
            }
        case .arrange:
            arrangeArea(q)
        case .match:
            matchArea(q)
        }
    }

    private func optionRow(_ option: String, q: LessonQuestion) -> some View {
        let isSelected = selectedOption == option
        let isCorrect = option == q.correctAnswer
        let bg: Color = {
            guard revealed else { return isSelected ? Theme.primaryLight : Theme.card }
            if isCorrect { return Theme.successLight }
            if isSelected { return Theme.errorLight }
            return Theme.card
        }()
        let stroke: Color = {
            guard revealed else { return isSelected ? Theme.primary : Theme.border }
            if isCorrect { return Theme.success }
            if isSelected { return Theme.error }
            return Theme.border
        }()
        return Button {
            guard !revealed else { return }
            Haptics.tap()
            selectedOption = option
        } label: {
            HStack {
                Text(option).font(.system(size: 16, weight: .medium)).foregroundStyle(Theme.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if revealed && isCorrect { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.success) }
                else if revealed && isSelected { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.error) }
            }
            .padding(Space.lg).background(bg).clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(stroke, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }

    private func arrangeArea(_ q: LessonQuestion) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            // Assembled answer
            FlowLayout(spacing: 8, lineSpacing: 8) {
                ForEach(Array(arranged.enumerated()), id: \.offset) { _, word in
                    Button {
                        guard !revealed else { return }
                        Haptics.tap()
                        if let i = arranged.firstIndex(of: word) { arranged.remove(at: i) }
                    } label: { chip(word, filled: true) }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 50, alignment: .topLeading)
            .padding(Space.md)
            .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(
                revealed ? (wasCorrect ? Theme.success : Theme.error) : Theme.border, lineWidth: 1.5))

            // Word bank
            FlowLayout(spacing: 8, lineSpacing: 8) {
                ForEach(Array(q.tokens.enumerated()), id: \.offset) { _, word in
                    let used = usedCount(word, in: arranged) >= q.tokens.filter { $0 == word }.count
                    Button {
                        guard !revealed, !used else { return }
                        Haptics.tap()
                        arranged.append(word)
                    } label: { chip(word, filled: false).opacity(used ? 0.3 : 1) }
                    .buttonStyle(.plain).disabled(used)
                }
            }
        }
    }

    private func usedCount(_ word: String, in arr: [String]) -> Int { arr.filter { $0 == word }.count }

    private func chip(_ word: String, filled: Bool) -> some View {
        Text(word).font(.system(size: 16, weight: .semibold))
            .foregroundStyle(filled ? .white : Theme.text)
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(filled ? Theme.primary : Theme.card).clipShape(.rect(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(filled ? .clear : Theme.border, lineWidth: 1))
    }

    private func matchArea(_ q: LessonQuestion) -> some View {
        let lefts = q.matchGaps
        let rights = q.matchGaps.map { $0.englishTranslation }.shuffled()
        return HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 10) {
                ForEach(lefts) { gap in
                    let done = matchedGapIds.contains(gap.id)
                    let sel = matchSelectedLeft == gap.id
                    Button {
                        guard !done else { return }
                        Haptics.tap()
                        matchSelectedLeft = gap.id
                    } label: {
                        Text(gap.frenchWord).font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(done ? .white : Theme.text)
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(done ? Theme.success : (sel ? Theme.primaryLight : Theme.card))
                            .clipShape(.rect(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(sel ? Theme.primary : Theme.border, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                }
            }
            VStack(spacing: 10) {
                ForEach(rights, id: \.self) { eng in
                    let ownerDone = lefts.first { $0.englishTranslation == eng }.map { matchedGapIds.contains($0.id) } ?? false
                    let wrong = matchWrongRight == eng
                    Button {
                        guard !ownerDone else { return }
                        selectRight(eng, q: q)
                    } label: {
                        Text(eng).font(.system(size: 15, weight: .medium))
                            .foregroundStyle(ownerDone ? .white : Theme.text)
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(ownerDone ? Theme.success : (wrong ? Theme.errorLight : Theme.card))
                            .clipShape(.rect(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(wrong ? Theme.error : Theme.border, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func selectRight(_ eng: String, q: LessonQuestion) {
        guard let leftId = matchSelectedLeft,
              let gap = q.matchGaps.first(where: { $0.id == leftId }) else { return }
        if gap.englishTranslation == eng {
            Haptics.success()
            matchedGapIds.insert(gap.id)
            matchSelectedLeft = nil
            store.recordReview(gapId: gap.id, correct: true, conceptWeight: conceptWeight)
            if matchedGapIds.count == q.matchGaps.count {
                // whole match round done
                wasCorrect = true
                revealed = true
                registerCombo(correct: true)
            }
        } else {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            withAnimation { matchWrongRight = eng }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { matchWrongRight = nil }
        }
    }

    private func explanationBox(_ q: LessonQuestion) -> some View {
        let text = (q.hint?.isEmpty == false ? q.hint! : q.gap.exampleSentence)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: wasCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(wasCorrect ? Theme.success : Theme.error)
                Text(wasCorrect ? comboPraise() : "Answer: \(q.correctAnswer)")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(wasCorrect ? Theme.success : Theme.error)
            }
            if !text.isEmpty {
                Text(text).font(.system(size: 14)).italic().foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg)
        .background(wasCorrect ? Theme.successLight : Theme.errorLight)
        .clipShape(.rect(cornerRadius: Radius.card))
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private func comboPraise() -> String {
        if combo >= 5 { return "On fire! ×2 XP" }
        if combo >= 3 { return "Great streak! ×1.5 XP" }
        return "Correct !"
    }

    private func bottomBar(_ q: LessonQuestion) -> some View {
        let isLast = position + 1 >= schedule.count
        return VStack(spacing: 8) {
            primaryButton(
                title: revealed ? (isLast ? "Finish" : "Continue") : (q.kind == .match ? "Match all to continue" : "Check"),
                enabled: canSubmit(q)
            ) {
                if revealed { advance() } else { check(q) }
            }
        }
        .padding(Space.xl)
        .background(Theme.background)
    }

    private func canSubmit(_ q: LessonQuestion) -> Bool {
        if revealed { return true }
        switch q.kind {
        case .multipleChoice, .trueFalse: return selectedOption != nil
        case .fillBlank, .translation: return !textAnswer.trimmingCharacters(in: .whitespaces).isEmpty
        case .arrange: return arranged.count == q.correctOrder.count
        case .match: return false // advances automatically when all matched
        }
    }

    // MARK: - Checking & scoring

    private func check(_ q: LessonQuestion) {
        let correct: Bool
        switch q.kind {
        case .multipleChoice, .trueFalse: correct = normalize(selectedOption ?? "") == normalize(q.correctAnswer)
        case .fillBlank, .translation: correct = normalize(textAnswer) == normalize(q.correctAnswer)
        case .arrange: correct = arranged == q.correctOrder
        case .match: return
        }
        wasCorrect = correct
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { revealed = true }
        answeredCount += 1

        if correct {
            correctCount += 1
            store.recordReview(gapId: q.gap.id, correct: true, conceptWeight: conceptWeight)
            advanceMastery(for: q.gap)
            registerCombo(correct: true)
        } else {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            store.recordReview(gapId: q.gap.id, correct: false, conceptWeight: conceptWeight)
            store.recordError(gap: q.gap, userAnswer: givenAnswer(q), correctAnswer: q.correctAnswer)
            combo = 0
            hearts -= 1
            // requeue a remedial copy of this gap near the end
            if !masteredGapIds.contains(q.gap.id) {
                schedule.append(generator.question(for: q.gap, kind: alternateKind(from: q.kind), remedial: true))
            }
        }
    }

    private func registerCombo(correct: Bool) {
        guard correct else { return }
        combo += 1
        bestCombo = max(bestCombo, combo)
        let mult = combo >= 5 ? 2.0 : (combo >= 3 ? 1.5 : 1.0)
        xp += Int(10 * mult)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        comboPop = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) { comboPop = false }
    }

    private func advanceMastery(for gap: GapItem) {
        let n = (correctByGap[gap.id] ?? 0) + 1
        correctByGap[gap.id] = n
        if n >= masteryTarget && !masteredGapIds.contains(gap.id) {
            masteredGapIds.insert(gap.id)
            withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) { masteryFlash = gap.frenchWord }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
                withAnimation { if masteryFlash == gap.frenchWord { masteryFlash = nil } }
            }
        }
    }

    private func givenAnswer(_ q: LessonQuestion) -> String {
        switch q.kind {
        case .multipleChoice, .trueFalse: return selectedOption ?? ""
        case .fillBlank, .translation: return textAnswer
        case .arrange: return arranged.joined(separator: " ")
        case .match: return ""
        }
    }

    private func alternateKind(from kind: LessonQuestion.Kind) -> LessonQuestion.Kind {
        kind == .multipleChoice ? .fillBlank : .multipleChoice
    }

    private func normalize(_ s: String) -> String {
        s.folding(options: .diacriticInsensitive, locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func advance() {
        if position + 1 >= schedule.count {
            finishLesson()
        } else {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                position += 1
                resetQuestionState()
            }
        }
    }

    private func resetQuestionState() {
        selectedOption = nil
        textAnswer = ""
        arranged = []
        matchedGapIds = []
        matchSelectedLeft = nil
        matchWrongRight = nil
        revealed = false
        wasCorrect = false
    }

    private func finishLesson() {
        let total = max(1, answeredCount)
        let pct = Int(Double(correctCount) / Double(total) * 100)
        if pct > prevBestAccuracy { UserDefaults.standard.set(pct, forKey: bestAccuracyKey) }
        if bestCombo > prevBestStreak { UserDefaults.standard.set(bestCombo, forKey: bestStreakKey) }

        // Post-lesson bookkeeping: advance the session counter, mark the target
        // concept as recently taught, then recompute frontier unlocks.
        store.sessionIndex += 1
        if let target = assembled?.targetConcept,
           let idx = store.concepts.firstIndex(where: { $0.id == target.id }) {
            store.concepts[idx].lastTaughtSession = store.sessionIndex
        }
        // Capstone resets the cadence counter; normal lessons advance it.
        if isCapstone {
            store.lessonsSinceCapstone = 0
        } else {
            store.lessonsSinceCapstone += 1
        }
        store.clearUnlockFlags()
        unlockedConcepts = store.expandFrontier()
        store.save()

        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { stage = .complete }
    }

    // MARK: - Schedule building

    /// Try AI-generated questions first, then fall back to the local generator.
    private func startSchedule() {
        guard schedule.isEmpty else {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { stage = .practice }
            return
        }
        guard LessonService.hasKey else {
            buildLocalSchedule()
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { stage = .practice }
            return
        }
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { stage = .generating }
        let snapshot = gaps
        let level = lessonLevel
        let optionCount = store.optionCount
        Task {
            let ai = await LessonService.generate(gaps: snapshot, level: level, optionCount: optionCount)
            applyAIQuestions(ai)
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { stage = .practice }
        }
    }

    private func applyAIQuestions(_ ai: [LessonQuestion]?) {
        guard let ai, ai.count >= gaps.count else { buildLocalSchedule(); return }
        var built = ai.shuffled()
        // Add a match-pairs interstitial when there are enough words.
        if gaps.count >= 3 {
            let group = Array(gaps.shuffled().prefix(min(4, gaps.count)))
            let insertAt = min(built.count, max(1, built.count / 2))
            built.insert(generator.matchQuestion(for: group), at: insertAt)
        }
        schedule = built
        hearts = startingHearts
        resetQuestionState()
    }

    private func buildLocalSchedule() {
        guard schedule.isEmpty else { return }
        let formats: [LessonQuestion.Kind] = [.multipleChoice, .fillBlank, .trueFalse, .translation, .arrange]
        var built: [LessonQuestion] = []
        // masteryTarget questions per gap, varied format, no adjacent same-gap
        for round in 0..<masteryTarget {
            var roundQs: [LessonQuestion] = []
            for (i, gap) in gaps.enumerated() {
                let kind = formats[(i + round) % formats.count]
                roundQs.append(generator.question(for: gap, kind: kind))
            }
            roundQs.shuffle()
            built.append(contentsOf: roundQs)
        }
        // Insert a match-pairs interstitial if there are enough words
        if gaps.count >= 3 {
            let group = Array(gaps.shuffled().prefix(min(4, gaps.count)))
            let insertAt = min(built.count, max(1, built.count / 2))
            built.insert(generator.matchQuestion(for: group), at: insertAt)
        }
        schedule = built
        hearts = startingHearts
        resetQuestionState()
    }

    // MARK: - Completion

    private var completeStage: some View {
        let total = max(1, answeredCount)
        let pct = Int(Double(correctCount) / Double(total) * 100)
        let thetaDelta = store.abilityTheta - thetaBefore
        let beatBest = pct >= prevBestAccuracy && prevBestAccuracy > 0
        return VStack(spacing: Space.xl) {
            Spacer()
            ZStack {
                Circle().fill(Theme.primaryGradient).frame(width: 130, height: 130).softLift(radius: 20, y: 10, strength: 2)
                VStack(spacing: 0) {
                    Text("\(pct)%").font(.system(size: 38, weight: .heavy)).foregroundStyle(.white)
                    Text("\(correctCount)/\(total)").font(.system(size: 14, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                }
            }
            Text(isCapstone ? "Capstone complete" : (pct >= 80 ? "Excellent !" : pct >= 50 ? "Bien joué !" : "Keep going!"))
                .font(.serifDisplay(28, weight: .bold)).foregroundStyle(Theme.text)
            if isCapstone {
                HStack(spacing: 10) {
                    capstoneTally("checkmark.circle.fill", Theme.success, "\(correctCount)", "held")
                    capstoneTally("xmark.circle.fill", Theme.error, "\(total - correctCount)", "slipped")
                }
            }
            if beatBest {
                Label("New personal best!", systemImage: "trophy.fill")
                    .font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.warning)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(Theme.warningLight).clipShape(.capsule)
            }
            VStack(spacing: 10) {
                summaryRow("checkmark.seal.fill", Theme.success, "Words mastered", "\(masteredGapIds.count)")
                summaryRow("star.fill", Theme.warning, "XP earned", "+\(xp)")
                summaryRow("flame.fill", Theme.primary, "Best streak", "\(bestCombo)")
                summaryRow("chart.line.uptrend.xyaxis", Theme.secondary, "Ability change",
                           "\(thetaDelta >= 0 ? "+" : "")\(String(format: "%.2f", thetaDelta))")
            }
            if !unlockedConcepts.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("New skills unlocked", systemImage: "lock.open.fill")
                        .font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.success)
                    ForEach(unlockedConcepts, id: \.self) { name in
                        Text("• \(name)").font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Space.lg).background(Theme.successLight).clipShape(.rect(cornerRadius: Radius.card))
            }
            Spacer()
            primaryButton("Done") { dismiss() }
        }
        .padding(Space.xl)
    }

    private func capstoneTally(_ icon: String, _ color: Color, _ value: String, _ label: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 18)).foregroundStyle(color)
            VStack(alignment: .leading, spacing: 0) {
                Text(value).font(.system(size: 18, weight: .heavy)).foregroundStyle(Theme.text)
                Text(label).font(.system(size: 11)).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(color.opacity(0.1)).clipShape(.rect(cornerRadius: 12))
    }

    private func summaryRow(_ icon: String, _ color: Color, _ label: String, _ value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(color).frame(width: 28)
            Text(label).font(.system(size: 15)).foregroundStyle(Theme.textSecondary)
            Spacer()
            Text(value).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.text)
        }
        .padding(Space.lg).background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift(strength: 0.6)
    }

    // MARK: - Shared bits

    private var topClose: some View {
        HStack {
            Spacer()
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.textMuted)
                    .frame(width: 32, height: 32).background(Theme.card).clipShape(.circle).softLift(strength: 0.5)
            }
        }
    }

    private func primaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        primaryButton(title: title, enabled: true, action: action)
    }

    private func primaryButton(title: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 16)
                .background(enabled ? Theme.primary : Theme.textMuted)
                .clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    // MARK: - Mastery overlay

    private func masteryOverlay(_ word: String) -> some View {
        VStack {
            Spacer()
            HStack(spacing: 10) {
                Image(systemName: "checkmark.seal.fill").font(.system(size: 22)).foregroundStyle(.white)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Mastered!").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                    Text(word).font(.system(size: 13, weight: .medium)).foregroundStyle(.white.opacity(0.9))
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 14)
            .background(Theme.success).clipShape(.capsule).softLift(radius: 16, y: 8, strength: 2)
            Spacer().frame(height: 120)
        }
        .transition(.scale(scale: 0.6).combined(with: .opacity))
        .allowsHitTesting(false)
    }
}
