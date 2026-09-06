//
//  LessonPracticeStage.swift
//  FluentFrenchIOS
//
//  One question at a time: the practice bar (progress, hearts, streak, XP),
//  the prompt with its speak button (C20), the answer area, the per-format
//  feedback (C10), the B11 release note, and the Check / Show me / Continue bar.
//

import SwiftUI

struct LessonPracticeStage: View {
    let model: LessonViewModel
    let onClose: () -> Void
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(spacing: 0) {
            LessonPracticeBar(model: model, onClose: onClose)
            if let question = model.current {
                ScrollView {
                    VStack(alignment: .leading, spacing: Space.xl) {
                        header(question)
                        LessonQuestionBody(model: model, question: question)
                        if model.revealed, let feedback = model.feedback {
                            LessonFeedbackBox(feedback: feedback)
                        }
                        if let note = model.releaseNote {
                            LessonReleaseNote(text: note)
                        }
                    }
                    .padding(Space.xl)
                    .id(question.id) // slide each question in fresh
                    .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                            removal: .move(edge: .leading).combined(with: .opacity)))
                }
                .scrollDismissesKeyboard(.interactively)
                LessonBottomBar(model: model, question: question)
            } else {
                Spacer()
                ProgressView().tint(Theme.primary)
                Spacer()
            }
        }
    }

    @ViewBuilder
    private func header(_ q: LessonQuestion) -> some View {
        HStack(spacing: 8) {
            Pill(text: q.gap.category.label, color: q.gap.category.color)
            if q.isRemedial { Pill(text: "Try again", color: Theme.warning) }
            if q.isProbe { Pill(text: "Blind-spot check", color: Theme.purple) }
            if q.isCheckIn { Pill(text: "Check-in", color: Theme.secondary) }
            if q.isCapstone { Pill(text: "Capstone", color: Theme.secondary, filled: true) }
            Spacer()
            if store.optionCount >= 5 && q.kind == .multipleChoice && !q.isProbe {
                Pill(text: "Tuned to your level", color: Theme.secondary)
            }
        }

        HStack(alignment: .top, spacing: 10) {
            Text(q.prompt)
                .font(.title2.weight(.bold)).foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            if let spoken = LessonSpeech.spokenPrompt(for: q) {
                SpeakButton(text: spoken, size: 32)
            }
        }

        if let reason = model.reasons[q.gap.id] {
            LessonReasonLine(text: reason)
        }

        if q.kind == .trueFalse || q.kind == .translation {
            // The statement: French inside a true/false claim (speakable above), or the
            // English to translate — never read in a French voice (C20).
            Text(q.statement)
                .font(.title3).foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
                .padding(Space.lg).frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card).clipShape(.rect(cornerRadius: Radius.card)).softLift(strength: 0.6)
        }
    }
}

// MARK: - Practice bar

struct LessonPracticeBar: View {
    let model: LessonViewModel
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                LessonCloseButton(action: onClose)
                LessonProgressBar(progress: model.session.progress)
                if let hearts = model.hearts {
                    LessonHeartsView(hearts: hearts, maximum: Tuning.lessonHearts)
                } else {
                    Text("No hearts").font(.caption.weight(.semibold)).foregroundStyle(Theme.textMuted)
                }
            }
            HStack(spacing: 10) {
                LessonStatChip(icon: "flame.fill", color: Theme.primary, value: "\(model.session.combo)", label: "streak", pop: model.comboPop)
                LessonStatChip(icon: "star.fill", color: Theme.warning, value: "\(model.session.xp)", label: "XP")
                Spacer()
                Text(trailingLabel)
                    .font(.caption.weight(.semibold)).foregroundStyle(Theme.textMuted)
            }
        }
        .padding(.horizontal, Space.xl).padding(.top, 10).padding(.bottom, 6)
    }

    private var trailingLabel: String {
        let total = model.session.schedule.count
        if model.isCapstone {
            return "\(min(total, model.session.position + 1)) of \(total)"
        }
        let practicable = model.gaps.filter { !$0.isProbe }.count
        return "\(model.session.masteredGapIds.count)/\(practicable) mastered"
    }
}

// MARK: - Feedback (C10)

struct LessonFeedbackBox: View {
    let feedback: LessonFeedback

    private var color: Color {
        switch feedback.tone {
        case .correct: return Theme.success
        case .close: return Theme.warning
        case .incorrect, .revealed: return Theme.error
        }
    }

    private var background: Color {
        switch feedback.tone {
        case .correct: return Theme.successLight
        case .close: return Theme.warningLight
        case .incorrect, .revealed: return Theme.errorLight
        }
    }

    private var icon: String {
        switch feedback.tone {
        case .correct: return "checkmark.circle.fill"
        case .close: return "exclamationmark.circle.fill"
        case .incorrect: return "xmark.circle.fill"
        case .revealed: return "eye.fill"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: icon).font(.body).foregroundStyle(color).accessibilityHidden(true)
                Text(feedback.title)
                    .font(.subheadline.weight(.semibold)).foregroundStyle(color)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                if let speech = feedback.speech {
                    SpeakButton(text: speech, size: 28)
                }
            }
            if let detail = feedback.detail, !detail.isEmpty {
                Text(detail).font(.subheadline).italic().foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !feedback.alternatives.isEmpty {
                Text("Also accepted: \(feedback.alternatives.joined(separator: ", "))")
                    .font(.caption).foregroundStyle(Theme.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg)
        .background(background)
        .clipShape(.rect(cornerRadius: Radius.card))
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

/// B11: "Nice — you've got <concept>, moving on."
struct LessonReleaseNote: View {
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "arrow.right.circle.fill").font(.body).foregroundStyle(Theme.secondary)
                .accessibilityHidden(true)
            Text(text).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.secondaryLight).clipShape(.rect(cornerRadius: Radius.card))
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

// MARK: - Bottom bar

struct LessonBottomBar: View {
    let model: LessonViewModel
    let question: LessonQuestion
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(spacing: 8) {
            LessonPrimaryButton(title: model.primaryButtonTitle, enabled: model.revealed || model.canSubmit) {
                if model.revealed {
                    model.advance(store: store)
                } else {
                    model.check(store: store)
                }
            }
            if model.canReveal {
                Button {
                    Haptics.select()
                    model.reveal(store: store)
                } label: {
                    Text("Show me · \(model.revealsLeft) left")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity).frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Show me the answer, \(model.revealsLeft) left")
                .accessibilityHint("Counts as a miss")
            }
        }
        .padding(Space.xl)
        .background(Theme.background)
    }
}
