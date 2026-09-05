//
//  DiagnosticsView.swift
//  FluentFrenchIOS
//
//  DEBUG-only engine diagnostics (Package B14): the per-lesson `EngineMetrics`
//  log the store keeps (`AppStore.diagnosticsMetrics`), newest first — day and
//  session, frontier / learning / mastered / provisional counts, the check-in
//  pass rate and misses (the ghost-mastery proxy), governor state, stalls and
//  whether reading is unlocked. Reached from the Profile debug section. Nothing
//  here is learner-facing and none of it ships in a release build.
//

#if DEBUG
import SwiftUI

struct DiagnosticsView: View {
    @Environment(AppStore.self) private var store

    /// Newest snapshot first.
    private var entries: [EngineMetrics] {
        Array(store.diagnosticsMetrics.reversed())
    }

    var body: some View {
        List {
            if entries.isEmpty {
                Text("No lessons completed yet — a snapshot is logged at the end of every lesson.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.textMuted)
            } else {
                Section {
                    ForEach(Array(entries.enumerated()), id: \.offset) { _, metrics in
                        DiagnosticsRow(metrics: metrics)
                    }
                } header: {
                    Text("\(entries.count) snapshot\(entries.count == 1 ? "" : "s") · capacity \(Tuning.metricsLogCapacity)")
                }
            }
        }
        .navigationTitle("Engine diagnostics")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct DiagnosticsRow: View {
    let metrics: EngineMetrics

    private var passRate: String {
        guard let rate = metrics.checkInPassRate else { return "—" }
        return "\(Int((rate * 100).rounded()))%"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Day \(metrics.daysSinceStart) · session \(metrics.sessionIndex)")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.text)
                Spacer()
                Text(metrics.at, format: .dateTime.month().day().hour().minute())
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textMuted)
            }
            Text("Frontier \(metrics.frontierSize) · learning \(metrics.learningCount) · mastered \(metrics.masteredCount) · provisional \(metrics.provisionalCount)")
            Text("Check-ins \(metrics.checkInCount) · misses \(metrics.checkInMisses) · pass rate \(passRate)")
            Text("Governor \(metrics.governorActive ? "ON" : "off") · stalls \(metrics.stalls) · reading \(metrics.readingUnlocked ? "unlocked" : "locked") · lessons today \(metrics.lessonsToday)")
            if !metrics.stalledConceptIds.isEmpty {
                Text("Stalled: \(metrics.stalledConceptIds.joined(separator: ", "))")
                    .foregroundStyle(Theme.error)
            }
        }
        .font(.system(size: 13))
        .foregroundStyle(Theme.text)
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}
#endif
