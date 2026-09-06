//
//  LessonQuestionViews.swift
//  FluentFrenchIOS
//
//  The answer areas per format: option rows (multiple choice / true-false /
//  probes), the typed field with keyboard focus and submit (C22), the
//  arrange-the-words bank, and the match round keyed by gap id (C4).
//

import SwiftUI

struct LessonQuestionBody: View {
    let model: LessonViewModel
    let question: LessonQuestion

    var body: some View {
        switch question.kind {
        case .multipleChoice:
            VStack(spacing: 10) {
                ForEach(Array(question.options.enumerated()), id: \.offset) { _, option in
                    LessonOptionRow(option: option, state: state(for: option), speaksFrench: question.isReversed) {
                        model.select(option)
                    }
                }
            }
        case .trueFalse:
            HStack(spacing: 12) {
                LessonOptionRow(option: "True", state: state(for: "True")) { model.select("True") }
                LessonOptionRow(option: "False", state: state(for: "False")) { model.select("False") }
            }
        case .fillBlank, .translation:
            LessonTypedAnswer(model: model, question: question)
        case .arrange:
            LessonArrangeArea(model: model, question: question)
        case .match:
            LessonMatchArea(model: model, question: question)
        }
    }

    private func state(for option: String) -> LessonOptionState {
        // The same tag-preserving comparison the session grades with, so exactly one
        // row is marked correct even when two options share a gloss ("the (…)").
        let isCorrect = AnswerGrader.optionMatches(option, question.correctAnswer)
        let isSelected = model.selectedOption == option
        if model.revealed {
            if isCorrect { return .correct }
            return isSelected ? .wrong : .idle
        }
        if isSelected { return .selected }
        // A stepped-down remedial shows the answer once before the pick (C6).
        return (question.showsAnswer && isCorrect) ? .hinted : .idle
    }
}

// MARK: - Option rows

enum LessonOptionState { case idle, selected, hinted, correct, wrong }

struct LessonOptionRow: View {
    let option: String
    let state: LessonOptionState
    /// Reversed multiple choice: the options are French, so each row can be heard.
    var speaksFrench: Bool = false
    let action: () -> Void

    private var background: Color {
        switch state {
        case .idle: return Theme.card
        case .selected: return Theme.primaryLight
        case .hinted: return Theme.secondaryLight
        case .correct: return Theme.successLight
        case .wrong: return Theme.errorLight
        }
    }

    private var stroke: Color {
        switch state {
        case .idle: return Theme.border
        case .selected: return Theme.primary
        case .hinted: return Theme.secondary
        case .correct: return Theme.success
        case .wrong: return Theme.error
        }
    }

    var body: some View {
        HStack(spacing: 8) {
            Button(action: action) {
                HStack {
                    Text(option).font(.body.weight(.medium)).foregroundStyle(Theme.text)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    switch state {
                    case .correct:
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.success).accessibilityHidden(true)
                    case .wrong:
                        Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.error).accessibilityHidden(true)
                    case .hinted:
                        Text("This one").font(.caption.weight(.bold)).foregroundStyle(Theme.secondary)
                    case .idle, .selected:
                        EmptyView()
                    }
                }
                .padding(Space.lg).background(background).clipShape(.rect(cornerRadius: Radius.card))
                .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(stroke, lineWidth: 1.5))
                .frame(minHeight: Theme.minimumHitTarget)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(state == .correct || state == .wrong)
            .accessibilityLabel(option)
            .accessibilityValue(accessibilityValue)
            .accessibilityAddTraits(state == .selected ? .isSelected : [])
            if speaksFrench {
                SpeakButton(text: option, size: 28)
            }
        }
    }

    private var accessibilityValue: String {
        switch state {
        case .idle: return ""
        case .selected: return "selected"
        case .hinted: return "shown as the answer"
        case .correct: return "correct answer"
        case .wrong: return "your answer, wrong"
        }
    }
}

// MARK: - Typed answers (C22)

struct LessonTypedAnswer: View {
    @Bindable var model: LessonViewModel
    let question: LessonQuestion
    @Environment(AppStore.self) private var store
    @FocusState private var typing: Bool

    private var stroke: Color {
        guard model.revealed else { return typing ? Theme.primary : Theme.border }
        return (model.feedback?.isCorrect ?? false) ? Theme.success : Theme.error
    }

    private var placeholder: String {
        question.kind == .fillBlank ? "The missing word" : "Type it in French"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField(placeholder, text: $model.textAnswer)
                .font(.title3)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .submitLabel(.done)
                .focused($typing)
                .onSubmit {
                    if model.canSubmit { model.check(store: store) }
                }
                .disabled(model.revealed)
                .padding(Space.lg)
                .background(Theme.card)
                .clipShape(.rect(cornerRadius: Radius.card))
                .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(stroke, lineWidth: 1.5))
                .accessibilityLabel(question.kind == .fillBlank ? "Missing word" : "French translation")
            if let hint = question.hint, !hint.isEmpty, !model.revealed {
                Text(hint).font(.footnote).italic().foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .onAppear { typing = !model.revealed }
        .onChange(of: model.revealed) { _, revealed in
            if revealed { typing = false }
        }
    }
}

// MARK: - Arrange the words

struct LessonArrangeArea: View {
    let model: LessonViewModel
    let question: LessonQuestion

    private var stroke: Color {
        guard model.revealed else { return Theme.border }
        return (model.feedback?.isCorrect ?? false) ? Theme.success : Theme.error
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            FlowLayout(spacing: 8, lineSpacing: 8) {
                ForEach(Array(model.arranged.enumerated()), id: \.offset) { index, word in
                    Button {
                        model.removeArranged(at: index)
                    } label: {
                        LessonWordChip(word: word, filled: true)
                    }
                    .buttonStyle(.plain)
                    .disabled(model.revealed)
                    .accessibilityLabel(word)
                    .accessibilityHint("Removes the word from your sentence")
                }
            }
            .frame(maxWidth: .infinity, minHeight: 50, alignment: .topLeading)
            .padding(Space.md)
            .background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: Radius.card))
            .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(stroke, lineWidth: 1.5))
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Your sentence")
            .accessibilityValue(model.arranged.isEmpty ? "empty" : model.arranged.joined(separator: " "))

            FlowLayout(spacing: 8, lineSpacing: 8) {
                ForEach(Array(question.tokens.enumerated()), id: \.offset) { _, word in
                    let used = model.isTokenUsed(word)
                    Button {
                        model.appendToken(word)
                    } label: {
                        LessonWordChip(word: word, filled: false).opacity(used ? 0.3 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(used || model.revealed)
                    .accessibilityLabel(word)
                    .accessibilityHint("Adds the word to your sentence")
                }
            }
            if let hint = question.hint, !hint.isEmpty, !model.revealed {
                Text(hint).font(.footnote).italic().foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

struct LessonWordChip: View {
    let word: String
    let filled: Bool

    var body: some View {
        Text(word).font(.body.weight(.semibold))
            .foregroundStyle(filled ? .white : Theme.text)
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(filled ? Theme.primary : Theme.card).clipShape(.rect(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(filled ? .clear : Theme.border, lineWidth: 1))
            .frame(minHeight: Theme.minimumHitTarget)
            .contentShape(Rectangle())
    }
}

// MARK: - Match the pairs (C4)

struct LessonMatchArea: View {
    let model: LessonViewModel
    let question: LessonQuestion
    @Environment(AppStore.self) private var store

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 10) {
                ForEach(question.matchGaps) { gap in
                    let done = model.isMatched(gap.id)
                    let selected = model.matchSelectedLeft == gap.id
                    Button {
                        model.selectMatchLeft(gap.id)
                    } label: {
                        Text(gap.frenchWord).font(.subheadline.weight(.semibold))
                            .foregroundStyle(done ? .white : Theme.text)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity).frame(minHeight: Theme.minimumHitTarget).padding(.vertical, 6)
                            .background(done ? Theme.success : (selected ? Theme.primaryLight : Theme.card))
                            .clipShape(.rect(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(selected ? Theme.primary : Theme.border, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                    .disabled(done || model.revealed)
                    .accessibilityLabel(gap.frenchWord)
                    .accessibilityValue(done ? "matched" : (selected ? "selected" : ""))
                    .accessibilityAddTraits(selected ? .isSelected : [])
                    .accessibilityHint("Pick a French word, then its meaning on the right")
                }
            }
            VStack(spacing: 10) {
                ForEach(model.matchRights) { gap in
                    let done = model.isMatched(gap.id)
                    let wrong = model.matchWrongRight == gap.id
                    Button {
                        model.selectMatchRight(gap.id, store: store)
                    } label: {
                        Text(gap.englishTranslation).font(.subheadline.weight(.medium))
                            .foregroundStyle(done ? .white : Theme.text)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity).frame(minHeight: Theme.minimumHitTarget).padding(.vertical, 6)
                            .background(done ? Theme.success : (wrong ? Theme.errorLight : Theme.card))
                            .clipShape(.rect(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(wrong ? Theme.error : Theme.border, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                    .disabled(done || model.revealed)
                    .accessibilityLabel(gap.englishTranslation)
                    .accessibilityValue(done ? "matched" : (wrong ? "wrong pair" : ""))
                    .accessibilityHint("Pairs this meaning with the French word you picked")
                }
            }
        }
    }
}
