//
//  IdiomsView.swift
//  FluentFrenchIOS
//
//  Searchable, filterable French idiom library — bundled offline content.
//

import SwiftUI

struct IdiomsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 1 at the default text size; the square emoji tile grows with it so the
    /// scaled emoji keeps its padding.
    @ScaledMetric private var typeScale: CGFloat = 1
    @State private var selectedCategory: IdiomCategory? = nil
    @State private var query: String = ""
    @State private var expandedID: String? = nil
    /// The idiom being saved to the deck (E25) — presented in the shared capture card.
    @State private var captureDraft: CaptureDraft? = nil

    private var filtered: [FrenchIdiom] {
        let base = selectedCategory.map { cat in IdiomData.all.filter { $0.category == cat } } ?? IdiomData.all
        return IdiomData.search(query, in: base)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            searchBar
            categoryChips
            list
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
        .sheet(item: $captureDraft) { draft in
            CaptureSheet(draft: draft, accent: accent)
        }
    }

    /// What saving an idiom stores: the expression, its meaning, the literal
    /// reading as the explanation and the example — filed under the idioms
    /// concept at its level, through the store's one capture path.
    private func draft(for idiom: FrenchIdiom) -> CaptureDraft {
        CaptureDraft(
            frenchWord: idiom.french,
            englishTranslation: idiom.meaning,
            explanation: "Literally: \(idiom.literal)",
            exampleSentence: idiom.example,
            exampleTranslation: idiom.exampleTranslation,
            sourceType: .reading,
            sourceTab: "idioms",
            sourceLevel: .B1,
            category: .phrasing,
            partOfSpeech: "idiom",
            conceptId: "idioms"
        )
    }

    private var header: some View {
        ResourceHeader(
            gradient: LinearGradient(colors: [Color(hex: "6D28D9"), Color(hex: "8B5CF6")],
                                     startPoint: .topLeading, endPoint: .bottomTrailing),
            title: "French Idioms",
            subtitle: "\(IdiomData.all.count) expressions to master",
            onBack: { dismiss() }
        )
    }

    private var accent: Color { Color(hex: "7C3AED") }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").scaledFont(15).foregroundStyle(Theme.textSecondary)
                .accessibilityHidden(true)
            TextField("Search idioms…", text: $query)
                .scaledFont(15).foregroundStyle(Theme.text)
                .autocorrectionDisabled()
                .accessibilityLabel("Search idioms")
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill").scaledFont(15).foregroundStyle(Theme.textSecondary)
                        .minimumHitTarget()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.chip))
        .overlay(RoundedRectangle(cornerRadius: Radius.chip).stroke(Theme.border.opacity(0.6), lineWidth: 0.5))
        .softLift(radius: 8, y: 2, strength: 0.6)
        .padding(.horizontal, 18).padding(.top, 16)
    }

    private var categoryChips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                chip(label: "All", emoji: nil, active: selectedCategory == nil) { selectedCategory = nil }
                ForEach(IdiomCategory.allCases) { cat in
                    chip(label: cat.label, emoji: cat.emoji, active: selectedCategory == cat) {
                        selectedCategory = (selectedCategory == cat) ? nil : cat
                    }
                }
            }
        }
        .contentMargins(.horizontal, 16, for: .scrollContent)
        .scrollIndicators(.hidden)
        .padding(.top, 12)
    }

    private func chip(label: String, emoji: String?, active: Bool, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            withAnimation(Theme.motion(.spring(response: 0.3, dampingFraction: 0.8), reduceMotion: reduceMotion)) { action() }
        } label: {
            HStack(spacing: 6) {
                if let emoji { Text(emoji).scaledFont(13).accessibilityHidden(true) }
                Text(label).scaledFont(13, weight: .medium)
            }
            .foregroundStyle(active ? .white : Theme.text)
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(active ? accent : Theme.card)
            .clipShape(.capsule)
            .overlay(Capsule().stroke(active ? Color.clear : Theme.border.opacity(0.7), lineWidth: 0.5))
            // The chip keeps its drawn size; only the tappable area grows to 44 pt.
            .minimumHitTarget()
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityHint("Filters the idioms by theme")
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                Text("\(filtered.count) idiom\(filtered.count == 1 ? "" : "s")")
                    .scaledFont(13).foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                ForEach(filtered) { idiom in
                    idiomCard(idiom)
                }
                .reducedMotionAnimation(.spring(response: 0.35, dampingFraction: 0.85), value: expandedID)

                if filtered.isEmpty {
                    VStack(spacing: 8) {
                        Text("No idioms found").scaledFont(17, weight: .semibold).foregroundStyle(Theme.text)
                        Text("Try a different search term").scaledFont(14).foregroundStyle(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 60)
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 44)
        }
        .scrollIndicators(.hidden)
    }

    private func idiomCard(_ idiom: FrenchIdiom) -> some View {
        let expanded = expandedID == idiom.id
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                Haptics.tap()
                withAnimation(Theme.motion(.spring(response: 0.35, dampingFraction: 0.82), reduceMotion: reduceMotion)) {
                    expandedID = expanded ? nil : idiom.id
                }
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    Text(idiom.category.emoji).scaledFont(22)
                        .frame(width: Theme.minimumHitTarget * typeScale, height: Theme.minimumHitTarget * typeScale)
                        .background(accent.opacity(0.1)).clipShape(.rect(cornerRadius: 12))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(idiom.french).scaledFont(16, weight: .semibold).foregroundStyle(Theme.text)
                            .multilineTextAlignment(.leading)
                        Text(idiom.meaning).scaledFont(14).foregroundStyle(Theme.textSecondary)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .scaledFont(14, weight: .semibold).foregroundStyle(Theme.textSecondary)
                        .accessibilityHidden(true)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(idiom.french), \(idiom.meaning)")
            .accessibilityHint(expanded ? "Collapses the details" : "Shows the literal meaning and an example")

            if expanded {
                VStack(alignment: .leading, spacing: 14) {
                    Divider().background(Theme.borderLight)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("LITERAL").scaledFont(10, weight: .bold).foregroundStyle(accent).tracking(0.8)
                        Text(idiom.literal).scaledFont(15).italic().foregroundStyle(Theme.text)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("EXAMPLE").scaledFont(10, weight: .bold).foregroundStyle(accent).tracking(0.8)
                        HStack(alignment: .top, spacing: 8) {
                            Text(idiom.example).scaledFont(15, weight: .medium).foregroundStyle(accent)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 4)
                            SpeakButton(text: idiom.example, size: 30)
                        }
                        Text(idiom.exampleTranslation).scaledFont(14).foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.backgroundSecondary)
                    .clipShape(.rect(cornerRadius: Radius.chip))
                    saveRow(for: idiom)
                }
                .padding(.top, 14)
                .transition(reduceMotion ? AnyTransition.opacity : .opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(18)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(expanded ? accent.opacity(0.4) : Theme.border.opacity(0.5), lineWidth: expanded ? 1 : 0.5))
        .softLift(radius: expanded ? 18 : 12, y: expanded ? 8 : 4, strength: 0.8)
    }

    /// Save-to-deck affordance (E25): opens the shared capture card, or shows
    /// that the idiom is already in the deck.
    private func saveRow(for idiom: FrenchIdiom) -> some View {
        let saved = store.hasGap(forWord: idiom.french)
        return Button {
            guard !saved else { return }
            Haptics.tap()
            captureDraft = draft(for: idiom)
        } label: {
            Label(saved ? "In your deck" : "Save to my deck",
                  systemImage: saved ? "checkmark.circle.fill" : "plus.circle.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(saved ? Theme.success : accent)
                .frame(maxWidth: .infinity).frame(minHeight: Theme.minimumHitTarget)
                .background(saved ? Theme.successLight : accent.opacity(0.1))
                .clipShape(.rect(cornerRadius: Radius.chip))
        }
        .buttonStyle(.plain)
        .disabled(saved)
        .accessibilityLabel(saved ? "Already in your deck" : "Save to my deck")
        .accessibilityHint(saved ? "" : "Adds this idiom to your practice deck")
    }
}
