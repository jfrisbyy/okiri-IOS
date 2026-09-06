//
//  AssessmentView.swift
//  FluentFrenchIOS
//
//  The adaptive placement check — the front door that routes each new learner. It
//  draws frequency-banded recognition items, adapts up/down by answer, stops early
//  once confident (or bottoms out for a true beginner), and estimates vocab and
//  grammar separately. The results screen shows both scores and where the learner
//  is headed: straight to content, or Foundation first. Re-runnable from Profile.
//

import SwiftUI

struct AssessmentView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    /// True on first launch (starts the record from zero); false when re-taking
    /// ("Recalibrate": the result blends with existing evidence, D8).
    let isFirstRun: Bool

    private enum Stage { case intro, quiz, results }

    @State private var stage: Stage = .intro
    /// Replaced with a content-backed bank in `beginQuiz` (the store is not
    /// available to a property initializer).
    @State private var engine = PlacementEngine(bank: [])
    @State private var current: AssessmentQuestion? = nil
    @State private var selected: String? = nil
    @State private var revealed = false
    @State private var result: PlacementResult? = nil

    private static let indigo = LinearGradient(
        colors: [Color(hex: "6366F1"), Color(hex: "4338CA")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    private static let accent = Color(hex: "4F46E5")

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            switch stage {
            case .intro: introStage
            case .quiz: quizStage
            case .results: resultsStage
            }
        }
    }

    // MARK: Intro

    private var introStage: some View {
        VStack(spacing: Space.lg) {
            if !isFirstRun { topClose }
            Spacer()
            ZStack {
                Circle().fill(Self.indigo).frame(width: 104, height: 104).softLift(radius: 20, y: 10, strength: 2)
                Image(systemName: "graduationcap.fill").font(.system(size: 44)).foregroundStyle(.white)
            }
            Text(isFirstRun ? "Welcome ! Let's find your level" : "Recalibrate your level")
                .font(.serifDisplay(28, weight: .bold)).foregroundStyle(Theme.text).multilineTextAlignment(.center)
            Text(isFirstRun
                 ? "A few quick questions that adapt to you. We'll set your starting point and only teach what you don't already know."
                 : "A short retake to update your level. It adds to what you've already shown — it never lowers what you've earned.")
                .font(.callout).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
                .padding(.horizontal, 8)
            VStack(spacing: 10) {
                infoRow("dial.medium.fill", "Adapts as you answer — \(engineMin) to \(engineMax) questions")
                infoRow("textformat.abc", "Estimates vocabulary & grammar separately")
                if isFirstRun {
                    infoRow("signpost.right.fill", "Routes you to the right starting point")
                } else {
                    infoRow("arrow.triangle.merge", "Blends with your evidence: skills you've mastered stay mastered")
                    infoRow("plus.circle", "Anything you miss becomes something to teach — nothing is wiped")
                }
            }
            .padding(Space.lg)
            .frame(maxWidth: .infinity)
            .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift()
            Spacer()
            primaryButton("Start") { beginQuiz() }
            if isFirstRun {
                Button { declareBeginner() } label: {
                    Text("I'm a complete beginner")
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(Self.accent)
                }
            }
        }
        .padding(Space.xl)
    }

    private func infoRow(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 18)).foregroundStyle(Self.accent).frame(width: 28)
                .accessibilityHidden(true)
            Text(text).font(.callout).foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
    }

    /// The staircase's bounds, read from the engine (never hard-coded in copy — D17).
    private var engineMin: Int { engine.minItems }
    private var engineMax: Int { engine.maxItems }

    // MARK: Quiz

    @ViewBuilder
    private var quizStage: some View {
        if let q = current {
            VStack(spacing: 0) {
                quizBar
                ScrollView {
                    VStack(alignment: .leading, spacing: Space.xl) {
                        HStack(spacing: 8) {
                            Pill(text: bandLabel(q.band), color: Self.accent)
                            Pill(text: q.category.label, color: q.category.color)
                            Spacer()
                        }
                        Text(q.prompt).font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.text)
                            .fixedSize(horizontal: false, vertical: true)
                        VStack(spacing: 10) {
                            ForEach(q.options, id: \.self) { option in optionRow(option, q: q) }
                        }
                        if revealed { explanation(q) }
                    }
                    .padding(Space.xl)
                    .id(q.id)
                    .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                            removal: .move(edge: .leading).combined(with: .opacity)))
                }
                bottomBar(q)
            }
        } else {
            ProgressView().tint(Self.accent)
        }
    }

    private var quizBar: some View {
        HStack(spacing: 12) {
            if !isFirstRun {
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.textMuted)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Close")
            }
            // The adaptive test has no fixed length: the bar fills toward the engine's
            // maximum as evidence accumulates, with a tick at its minimum (D17).
            GeometryReader { geo in
                let fraction = min(1, Double(engine.asked.count) / Double(max(engineMax, 1)))
                let minFraction = Double(engineMin) / Double(max(engineMax, 1))
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border).frame(height: 10)
                    Capsule().fill(Self.indigo)
                        .frame(width: max(10, geo.size.width * fraction), height: 10)
                        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: engine.asked.count)
                    Rectangle().fill(Theme.card.opacity(0.9))
                        .frame(width: 2, height: 10)
                        .offset(x: geo.size.width * minFraction)
                }
                .frame(height: 10)
            }
            .frame(height: 10)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Placement progress")
            .accessibilityValue("Question \(questionNumber) of at most \(engineMax); at least \(engineMin)")
            Text("Q\(questionNumber)").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textMuted)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, Space.xl).padding(.top, 16).padding(.bottom, 8)
    }

    /// The question number shown on the bar (the one on screen until it is checked).
    private var questionNumber: Int { engine.asked.count + (revealed ? 0 : 1) }

    private func bandLabel(_ band: Int) -> String {
        switch band {
        case 1: return "Common"
        case 2: return "Frequent"
        case 3: return "Intermediate"
        default: return "Advanced"
        }
    }

    private func optionRow(_ option: String, q: AssessmentQuestion) -> some View {
        let isSelected = selected == option
        let isCorrect = option == q.correctAnswer
        let bg: Color = {
            guard revealed else { return isSelected ? Self.accent.opacity(0.12) : Theme.card }
            if isCorrect { return Theme.successLight }
            if isSelected { return Theme.errorLight }
            return Theme.card
        }()
        let stroke: Color = {
            guard revealed else { return isSelected ? Self.accent : Theme.border }
            if isCorrect { return Theme.success }
            if isSelected { return Theme.error }
            return Theme.border
        }()
        return Button {
            guard !revealed else { return }
            Haptics.tap(); selected = option
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
        .accessibilityLabel(option)
        .accessibilityValue(revealed ? (isCorrect ? "Correct answer" : (isSelected ? "Your answer, incorrect" : "")) : (isSelected ? "Selected" : ""))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func explanation(_ q: AssessmentQuestion) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: selected == q.correctAnswer ? "checkmark.circle.fill" : "info.circle.fill")
                    .foregroundStyle(selected == q.correctAnswer ? Theme.success : Self.accent)
                Text(selected == q.correctAnswer ? "Correct !" : "Answer: \(q.correctAnswer)")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(selected == q.correctAnswer ? Theme.success : Theme.text)
            }
            if !q.explanation.isEmpty {
                Text(q.explanation).font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg)
        .background(selected == q.correctAnswer ? Theme.successLight : Self.accent.opacity(0.08))
        .clipShape(.rect(cornerRadius: Radius.card))
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private func bottomBar(_ q: AssessmentQuestion) -> some View {
        let title = revealed ? "Continue" : "Check"
        return primaryButton(title, enabled: selected != nil) {
            if revealed { advance() } else { check(q) }
        }
        .padding(Space.xl)
    }

    // MARK: Results

    @ViewBuilder
    private var resultsStage: some View {
        if let result {
            ScrollView {
                VStack(spacing: Space.lg) {
                    Spacer().frame(height: 30)
                    ZStack {
                        Circle().fill(Self.indigo).frame(width: 130, height: 130).softLift(radius: 20, y: 10, strength: 2)
                        VStack(spacing: 0) {
                            Text(result.estimatedLevel.rawValue).font(.system(size: 40, weight: .heavy)).foregroundStyle(.white)
                            Text("placed at").font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.85))
                        }
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Placed at \(result.estimatedLevel.rawValue)")
                    Text(headline(result)).font(.serifDisplay(26, weight: .bold)).foregroundStyle(Theme.text)
                        .multilineTextAlignment(.center)
                    Text(blurb(result)).font(.system(size: 15)).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)

                    scoreCard(result)
                    routeCard(result)

                    primaryButton(result.isTrueBeginner ? "Start building the basics" : "Start learning") { finish(result) }
                }
                .padding(Space.xl)
            }
        } else {
            ProgressView().tint(Self.accent)
        }
    }

    /// The two separate estimates — vocabulary coverage and grammar control.
    private func scoreCard(_ result: PlacementResult) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("YOUR PROFILE").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.textMuted).tracking(0.5)
            scoreRow("textformat", "Vocabulary", result.vocabBand, Self.accent)
            scoreRow("curlybraces", "Grammar", result.grammarBand, Theme.secondary)
            HStack(spacing: 12) {
                Image(systemName: "checkmark.seal.fill").foregroundStyle(Theme.success).frame(width: 28)
                Text("Answered correctly").font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
                Spacer()
                Text("\(result.correctCount)/\(max(result.askedCount, 1))")
                    .font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
            }
        }
        .padding(Space.lg).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift()
    }

    private func scoreRow(_ icon: String, _ label: String, _ band: Int, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Image(systemName: icon).font(.system(size: 14)).foregroundStyle(tint).frame(width: 22)
                Text(label).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                Spacer()
                Text(bandStrength(band)).font(.system(size: 12, weight: .semibold)).foregroundStyle(tint)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border).frame(height: 8)
                    Capsule().fill(tint)
                        .frame(width: geo.size.width * CGFloat(Double(band) / 4.0), height: 8)
                }
            }
            .frame(height: 8)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(label) strength")
            .accessibilityValue(bandStrength(band))
        }
    }

    private func bandStrength(_ band: Int) -> String {
        switch band {
        case 0: return "Just starting"
        case 1: return "Basics"
        case 2: return "Building"
        case 3: return "Solid"
        default: return "Strong"
        }
    }

    /// Where the learner is headed — straight to content or Foundation first.
    private func routeCard(_ result: PlacementResult) -> some View {
        let foundation = result.isTrueBeginner || store.willEnterFoundation(after: result)
        return HStack(spacing: 14) {
            Image(systemName: foundation ? "building.columns.fill" : "book.fill")
                .font(.system(size: 20)).foregroundStyle(.white)
                .frame(width: 46, height: 46)
                .background(foundation ? Theme.secondary : Theme.success)
                .clipShape(.rect(cornerRadius: 13))
            VStack(alignment: .leading, spacing: 3) {
                Text(foundation ? "Starting with Foundation" : "Straight to reading")
                    .font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                Text(foundation
                     ? "We'll build the core basics first, then unlock real content as you go."
                     : "You're ready for real articles. More activities open as you practice.")
                    .font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(Space.lg).frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
    }

    private func headline(_ result: PlacementResult) -> String {
        if result.isTrueBeginner { return "Starting fresh" }
        switch result.estimatedLevel {
        case .A1: return "Just getting started"
        case .A2: return "Building your basics"
        case .B1: return "Solid intermediate"
        default: return "Advanced learner"
        }
    }

    private func blurb(_ result: PlacementResult) -> String {
        if result.isTrueBeginner {
            return "No worries — we'll guide you from the very first words and build up step by step."
        }
        if !isFirstRun {
            return "Blended with what you'd already shown: nothing you've earned was lowered, and what you slipped on joins your gaps."
        }
        if result.vocabBand > result.grammarBand + 1 {
            return "Your vocabulary is ahead of your grammar — we'll shore up the rules as you go."
        }
        if result.grammarBand > result.vocabBand + 1 {
            return "Your grammar is ahead of your vocabulary — we'll grow your word bank quickly."
        }
        return "A balanced foundation. We'll target exactly the spots you slipped on."
    }

    // MARK: Logic

    private func beginQuiz() {
        Haptics.select()
        // The bank is the content probes (three real items per concept, D6/B9);
        // hand-written items only fill in where content is missing.
        engine = PlacementEngine(bank: AssessmentService.placementBank(concepts: store.concepts, probes: store.probeContent))
        result = nil
        loadNext()
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { stage = .quiz }
    }

    private func declareBeginner() {
        Haptics.select()
        engine.declareBeginner()
        let r = engine.result()
        result = r
        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { stage = .results }
    }

    private func loadNext() {
        selected = nil
        revealed = false
        current = engine.next()
    }

    private func check(_ q: AssessmentQuestion) {
        guard let selected else { return }
        let correct = selected == q.correctAnswer
        engine.record(q, correct: correct)
        if correct { Haptics.success() }
        else { UINotificationFeedbackGenerator().notificationOccurred(.error) }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { revealed = true }
    }

    private func advance() {
        if let nextQ = engine.next() {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                current = nextQ
                selected = nil
                revealed = false
            }
        } else {
            result = engine.result()
            withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { stage = .results }
        }
    }

    private func finish(_ result: PlacementResult) {
        Haptics.success()
        store.applyPlacement(result, isFirstRun: isFirstRun)
        dismiss()
    }

    // MARK: Shared bits

    private var topClose: some View {
        HStack {
            Spacer()
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.textMuted)
                    .frame(width: 32, height: 32).background(Theme.card).clipShape(.circle).softLift(strength: 0.5)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Close")
        }
    }

    private func primaryButton(_ title: String, enabled: Bool = true, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 16)
                .background(enabled ? Self.accent : Theme.textMuted)
                .clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}
