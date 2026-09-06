//
//  LessonComponents.swift
//  FluentFrenchIOS
//
//  Small pieces shared by the lesson stages: buttons, the hearts row, the
//  progress bar, the mastery flash, the missed-items list and highlighted
//  example text. Relative fonts and accessibility labels throughout (C21).
//

import SwiftUI

/// Display typography for the lesson, scaled with Dynamic Type.
enum LessonFont {
    static var hero: Font { .system(.largeTitle, design: .serif, weight: .bold) }
    static var display: Font { .system(.title, design: .serif, weight: .bold) }
    static var title: Font { .system(.title2, design: .serif, weight: .bold) }
}

// MARK: - Buttons

struct LessonPrimaryButton: View {
    let title: String
    var enabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(enabled ? Theme.primary : Theme.textMuted)
                .clipShape(.rect(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .frame(minHeight: Theme.minimumHitTarget)
    }
}

struct LessonSecondaryButton: View {
    let title: String
    var systemImage: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage).font(.subheadline.weight(.semibold))
                }
                Text(title).font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(Theme.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .frame(minHeight: Theme.minimumHitTarget)
            .background(Theme.primaryLight)
            .clipShape(.rect(cornerRadius: 12))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct LessonCloseButton: View {
    let action: () -> Void
    /// The circular chrome grows with the type ratio so the glyph stays inside
    /// it, stopping at the 44 pt hit target: past that the disc only eats the
    /// row it shares with the progress bar.
    @ScaledMetric(relativeTo: .body) private var typeScale: CGFloat = 1
    private var disc: CGFloat { min(32 * Theme.chromeScale(typeScale), Theme.minimumHitTarget) }

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.textSecondary)
                .frame(width: disc, height: disc)
                .background(Theme.card)
                .clipShape(.circle)
                .softLift(strength: 0.5)
                .minimumHitTarget()
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Close lesson")
        .accessibilityHint("Leaves this lesson")
    }
}

// MARK: - Practice chrome

struct LessonHeartsView: View {
    let hearts: Int
    let maximum: Int

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<max(maximum, hearts), id: \.self) { index in
                Image(systemName: index < hearts ? "heart.fill" : "heart")
                    .font(.footnote)
                    .foregroundStyle(index < hearts ? Theme.error : Theme.textMuted)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Hearts")
        .accessibilityValue("\(hearts) of \(maximum)")
    }
}

struct LessonProgressBar: View {
    let progress: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.border).frame(height: 10)
                Capsule().fill(Theme.primaryGradient)
                    .frame(width: max(10, geo.size.width * min(1, max(0, progress))), height: 10)
                    .reducedMotionAnimation(.spring(response: 0.5, dampingFraction: 0.8), value: progress)
            }
        }
        .frame(height: 10)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Lesson progress")
        .accessibilityValue("\(Int((min(1, max(0, progress)) * 100).rounded())) percent")
    }
}

struct LessonStatChip: View {
    let icon: String
    let color: Color
    let value: String
    let label: String
    var pop: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.caption).foregroundStyle(color).accessibilityHidden(true)
            Text(value).font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
            Text(label).font(.caption2).foregroundStyle(Theme.textSecondary)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(color.opacity(0.1)).clipShape(.capsule)
        .scaleEffect(pop && !reduceMotion ? 1.25 : 1)
        .reducedMotionAnimation(.spring(response: 0.3, dampingFraction: 0.5), value: pop)
        .accessibilityElement(children: .combine)
    }
}

struct LessonFlashOverlay: View {
    let title: String
    let subtitle: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack {
            Spacer()
            HStack(spacing: 10) {
                Image(systemName: "checkmark.seal.fill").font(.title2).foregroundStyle(.white).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(.headline).foregroundStyle(.white)
                    Text(subtitle).font(.footnote.weight(.medium)).foregroundStyle(.white.opacity(0.9))
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 14)
            .background(Theme.success).clipShape(.capsule).softLift(radius: 16, y: 8, strength: 2)
            Spacer().frame(height: 120)
        }
        .transition(flashTransition)
        .allowsHitTesting(false)
        .accessibilityElement(children: .combine)
    }

    /// Reduce Motion drops the scale pop; the flash still fades in and out.
    private var flashTransition: AnyTransition {
        if reduceMotion { return .opacity }
        return .scale(scale: 0.6).combined(with: .opacity)
    }
}

/// The "why you're seeing this" line under a prompt or on a skill card.
struct LessonReasonLine: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "lightbulb.fill").font(.caption2).foregroundStyle(Theme.warning).accessibilityHidden(true)
            Text(text).font(.caption.weight(.medium)).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Text

/// An example sentence with the gap's blank form emphasised — the same
/// word-boundary rule the fill-blank prompt uses (C2).
struct LessonHighlightedText: View {
    let sentence: String
    let gap: GapItem

    private var highlighted: Text {
        guard let range = AnswerGrader.highlightRange(in: sentence, for: gap) else { return Text(sentence) }
        return Text(sentence[..<range.lowerBound])
            + Text(sentence[range]).fontWeight(.heavy).foregroundStyle(Theme.primary)
            + Text(sentence[range.upperBound...])
    }

    var body: some View {
        highlighted
            .font(.body.weight(.medium))
            .italic()
            .foregroundStyle(Theme.text)
            .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: - Missed items (C26)

struct LessonMissedList: View {
    let items: [LessonMissedItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(items) { item in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "xmark.circle.fill").font(.subheadline).foregroundStyle(Theme.error)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.gap.frenchWord).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                        Text(item.correctAnswer).font(.footnote).foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    // Combined on the text only: combining the whole row would
                    // swallow the Listen button and make it untappable.
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("\(item.gap.frenchWord): \(item.correctAnswer)")
                    Spacer(minLength: 0)
                    SpeakButton(text: item.gap.frenchWord, size: 26)
                }
            }
        }
    }
}
