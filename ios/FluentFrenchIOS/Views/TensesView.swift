//
//  TensesView.swift
//  FluentFrenchIOS
//
//  French verb-tense reference: pick a tense, read when to use it, and browse
//  full conjugation tables for common verbs with a listen button.
//

import SwiftUI

struct TensesView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTense: String = "Present"

    private var currentTense: FrenchTense? {
        TensesData.tenses.first { $0.name == selectedTense }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            tenseChips
            ScrollView {
                VStack(spacing: 16) {
                    if let currentTense { infoCard(currentTense) }
                    ForEach(TensesData.verbs) { verb in
                        verbCard(verb)
                    }
                }
                .padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 44)
            }
            .scrollIndicators(.hidden)
        }
        .background(Theme.background)
        .ignoresSafeArea(edges: .top)
    }

    private var header: some View {
        ResourceHeader(
            gradient: Theme.indigoGradient,
            title: "Verb Tenses",
            subtitle: "Conjugate with confidence",
            onBack: { dismiss() }
        )
    }

    private var tenseChips: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(TensesData.tenses) { tense in
                    let active = tense.name == selectedTense
                    Button { Haptics.tap(); withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { selectedTense = tense.name } } label: {
                        Text(tense.name).font(.system(size: 13, weight: .medium))
                            .foregroundStyle(active ? .white : Theme.text)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(active ? Theme.indigo : Theme.card)
                            .clipShape(.capsule)
                            .overlay(Capsule().stroke(active ? Color.clear : Theme.border.opacity(0.7), lineWidth: 0.5))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .contentMargins(.horizontal, 16, for: .scrollContent)
        .scrollIndicators(.hidden)
        .padding(.top, 14)
    }

    private func infoCard(_ tense: FrenchTense) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(tense.frenchName).font(.serifDisplay(22, weight: .bold)).foregroundStyle(Theme.indigo)
                Text(tense.detail).font(.system(size: 15)).foregroundStyle(Theme.text)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text("WHEN TO USE").font(.system(size: 10, weight: .bold)).foregroundStyle(Theme.textMuted).tracking(0.8)
                Text(tense.usage).font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
            }
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "text.quote").font(.system(size: 13)).foregroundStyle(Theme.indigo.opacity(0.7))
                Text(tense.example).font(.system(size: 14, weight: .medium)).italic().foregroundStyle(Theme.text)
                Spacer(minLength: 4)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.indigo.opacity(0.06))
            .clipShape(.rect(cornerRadius: Radius.chip))
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.indigo.opacity(0.15), lineWidth: 0.5))
        .softLift(radius: 14, y: 5, strength: 0.85)
    }

    private func verbCard(_ verb: FrenchVerb) -> some View {
        let conj = verb.tenses[selectedTense]
        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(verb.infinitive).font(.serifDisplay(19, weight: .bold)).foregroundStyle(Theme.text)
                    Text(verb.meaning).font(.system(size: 13)).foregroundStyle(Theme.textMuted)
                }
                Spacer()
                Pill(text: "-\(verb.group)", color: Theme.indigo)
            }
            if let conj {
                VStack(spacing: 0) {
                    ForEach(Array(conj.forms().enumerated()), id: \.offset) { i, item in
                        HStack {
                            Text(item.pronoun).font(.system(size: 14)).foregroundStyle(Theme.textMuted)
                                .frame(width: 92, alignment: .leading)
                            Text(item.form).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text)
                            Spacer()
                            Button { NaturalVoice.shared.speak(verbPhrase(pronoun: item.pronoun, form: item.form)) } label: {
                                Image(systemName: "speaker.wave.2.fill").font(.system(size: 12)).foregroundStyle(Theme.indigo)
                                    .frame(width: 28, height: 28).background(Theme.indigo.opacity(0.1)).clipShape(.circle)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 9)
                        if i < conj.forms().count - 1 {
                            Rectangle().fill(Theme.borderLight).frame(height: 1)
                        }
                    }
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift(radius: 14, y: 5, strength: 0.85)
    }

    /// Build a natural spoken phrase, picking the first pronoun variant.
    private func verbPhrase(pronoun: String, form: String) -> String {
        let p = pronoun.split(separator: "/").first.map(String.init) ?? pronoun
        return "\(p) \(form)"
    }
}
