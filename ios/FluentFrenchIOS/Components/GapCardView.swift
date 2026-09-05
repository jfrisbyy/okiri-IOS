//
//  GapCardView.swift
//  FluentFrenchIOS
//
//  Expandable gap card with the FSRS "Memory" detail, mirroring the Expo
//  deck card + MemoryCard component.
//

import SwiftUI

struct GapCardView: View {
    let gap: GapItem
    @State private var expanded = false

    private var streakColor: Color {
        gap.consecutiveCorrect >= 3 ? Theme.success : (gap.consecutiveCorrect >= 1 ? Theme.warning : Theme.border)
    }

    private var urgency: (text: String, color: Color)? {
        let now = Date()
        if gap.nextReviewAt < now.addingTimeInterval(-86_400) {
            let days = Int(now.timeIntervalSince(gap.nextReviewAt) / 86_400)
            return ("\(max(1, days))d overdue", Theme.error)
        } else if gap.nextReviewAt <= now {
            return ("Due now", Theme.warning)
        }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() } } label: {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 10) {
                        Circle().fill(gap.category.color).frame(width: 8, height: 8)
                        Text(gap.frenchWord).font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.primary)
                        Spacer()
                        SpeakButton(text: gap.frenchWord)
                        Image(systemName: expanded ? "chevron.up" : "chevron.down").font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                    }
                    Text(gap.englishTranslation).font(.system(size: 14)).foregroundStyle(Theme.text).padding(.leading, 18)

                    HStack(alignment: .top, spacing: 8) {
                        Text(gap.exampleSentence)
                            .font(.system(size: 13)).italic().foregroundStyle(Theme.textSecondary)
                            .lineLimit(expanded ? nil : 2)
                        Spacer()
                        Image(systemName: "speaker.wave.2").font(.system(size: 12)).foregroundStyle(Theme.textMuted)
                    }
                    .padding(10)
                    .background(Theme.background)
                    .clipShape(.rect(cornerRadius: 8))

                    HStack {
                        HStack(spacing: 4) {
                            Image(systemName: gap.sourceType.systemImage).font(.system(size: 11)).foregroundStyle(Theme.textMuted)
                            Text(gap.sourceType.label).font(.system(size: 11)).foregroundStyle(Theme.textMuted)
                        }
                        if let urgency {
                            HStack(spacing: 4) {
                                Circle().fill(urgency.color).frame(width: 5, height: 5)
                                Text(urgency.text).font(.system(size: 10, weight: .semibold)).foregroundStyle(urgency.color)
                            }
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(urgency.color.opacity(0.12)).clipShape(.rect(cornerRadius: 6))
                        }
                        Spacer()
                        ThinProgressBar(progress: Double(gap.consecutiveCorrect) / 5, tint: streakColor)
                        Text("\(gap.consecutiveCorrect)/5").font(.system(size: 11, weight: .semibold)).foregroundStyle(streakColor)
                    }
                }
            }
            .buttonStyle(.plain)

            if expanded {
                VStack(alignment: .leading, spacing: 10) {
                    if !gap.exampleTranslation.isEmpty {
                        infoBox(label: "Translation", text: gap.exampleTranslation)
                    }
                    if !gap.explanation.isEmpty {
                        infoBox(label: "Explanation", text: gap.explanation)
                    }
                    memoryCard
                    if let ctx = gap.originalContext {
                        infoBox(label: "Seen in the wild", text: "“\(ctx.sentence)”", tint: Theme.accentLight)
                    }
                }
                .padding(.top, 10)
            }
        }
        .cardStyle(padding: 14)
    }

    private func infoBox(label: String, text: String, tint: Color = Theme.background) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased()).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.textMuted).tracking(0.3)
            Text(text).font(.system(size: 13)).foregroundStyle(Theme.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(tint)
        .clipShape(.rect(cornerRadius: 8))
    }

    private var memoryCard: some View {
        let r = Int((gap.retrievability * 100).rounded())
        let stability = gap.fsrs?.stability ?? 1
        return VStack(alignment: .leading, spacing: 8) {
            Text("MEMORY").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.secondary).tracking(0.3)
            HStack(spacing: 16) {
                memoryStat("\(r)%", "recall now")
                memoryStat(String(format: "%.1fd", stability), "stability")
                memoryStat(relativeDue(gap.nextReviewAt), "next review")
            }
            ForgettingCurve(stability: stability, retrievability: gap.retrievability)
                .frame(height: 42)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Theme.secondaryLight)
        .clipShape(.rect(cornerRadius: 8))
    }

    private func memoryStat(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
            Text(label).font(.system(size: 10)).foregroundStyle(Theme.textMuted)
        }
    }

    private func relativeDue(_ date: Date) -> String {
        let days = date.timeIntervalSinceNow / 86_400
        if days < -0.5 { return "overdue" }
        if days < 0.5 { return "today" }
        if days < 1.5 { return "tomorrow" }
        return "in \(Int(days.rounded()))d"
    }
}

/// Tiny power forgetting-curve sparkline.
struct ForgettingCurve: View {
    let stability: Double
    let retrievability: Double

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            Path { path in
                let steps = 40
                for i in 0...steps {
                    let t = Double(i) / Double(steps)
                    let days = t * max(2, stability * 3)
                    let base = 1 + FSRS.factor * (days / max(0.1, stability))
                    let r = pow(base, FSRS.decay)
                    let x = w * t
                    let y = h * (1 - r)
                    if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
                    else { path.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(Theme.secondary, style: StrokeStyle(lineWidth: 2, lineCap: .round))
        }
    }
}
