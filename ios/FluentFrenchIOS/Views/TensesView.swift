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
    @Environment(AppStore.self) private var store
    @State private var selectedTense: String = "Present"
    /// The paradigm being saved to the deck (E25).
    @State private var captureDraft: CaptureDraft? = nil

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
        .sheet(item: $captureDraft) { draft in
            CaptureSheet(draft: draft, accent: Theme.indigo)
        }
    }

    /// The headword a saved paradigm is filed under ("être — Imparfait"), so the
    /// same verb can be saved in several tenses without colliding.
    private func headword(_ verb: FrenchVerb, _ tense: FrenchTense) -> String {
        "\(verb.infinitive) — \(tense.frenchName)"
    }

    /// What saving a conjugation table stores: the verb in this tense, its
    /// meaning, the six forms as the explanation and the first-person form as the
    /// example — filed under the matching grammar concept when the taxonomy has one.
    /// A paradigm is a recognition-only card (`isTestable: false`): the lesson
    /// shows it as multiple choice and never asks the learner to type, blank or
    /// arrange the "être — Imparfait" headword (E25).
    private func draft(for verb: FrenchVerb, in tense: FrenchTense) -> CaptureDraft? {
        guard let conj = verb.tenses[tense.name] else { return nil }
        let forms = conj.forms().map { "\(verbPhrase(pronoun: $0.pronoun, form: $0.form))" }.joined(separator: ", ")
        return CaptureDraft(
            frenchWord: headword(verb, tense),
            englishTranslation: "\(verb.meaning) — \(tense.name.lowercased())",
            explanation: "\(tense.detail). \(forms)",
            exampleSentence: verbPhrase(pronoun: "je", form: conj.je),
            exampleTranslation: "",
            sourceType: .reading,
            sourceTab: "tenses",
            sourceLevel: Self.level(for: tense),
            category: .grammar,
            partOfSpeech: "verb",
            conceptId: Self.conceptId(for: tense, verb: verb),
            isTestable: false
        )
    }

    /// The taxonomy concept a tense/verb pair is evidence of (nil when none fits).
    private static func conceptId(for tense: FrenchTense, verb: FrenchVerb) -> String? {
        switch tense.name {
        case "Present": return verb.group == "er" ? "present-er-verbs" : (verb.group == "irregular" ? "present-irregular" : nil)
        case "Passé Composé": return verb.tenses[tense.name]?.je.hasPrefix("suis") == true ? "passe-compose-etre" : "passe-compose-avoir"
        case "Imparfait": return "imparfait"
        case "Subjonctif": return "subjunctive-intro"
        default: return nil
        }
    }

    private static func level(for tense: FrenchTense) -> CEFRLevel {
        switch tense.name {
        case "Present": return .A1
        case "Passé Composé": return .A2
        default: return .B1
        }
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
                            .padding(.horizontal, 14).frame(minHeight: 44)
                            .background(active ? Theme.indigo : Theme.card)
                            .clipShape(.capsule)
                            .overlay(Capsule().stroke(active ? Color.clear : Theme.border.opacity(0.7), lineWidth: 0.5))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(active ? .isSelected : [])
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
                                    .frame(minWidth: 44, minHeight: 44)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Listen to \(item.pronoun) \(item.form)")
                        }
                        .padding(.vertical, 2)
                        if i < conj.forms().count - 1 {
                            Rectangle().fill(Theme.borderLight).frame(height: 1)
                        }
                    }
                }
                if let tense = currentTense { saveRow(for: verb, in: tense) }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift(radius: 14, y: 5, strength: 0.85)
    }

    /// Save-to-deck affordance (E25) for the verb in the selected tense.
    private func saveRow(for verb: FrenchVerb, in tense: FrenchTense) -> some View {
        let saved = store.hasGap(forWord: headword(verb, tense))
        return Button {
            guard !saved, let draft = draft(for: verb, in: tense) else { return }
            Haptics.tap()
            captureDraft = draft
        } label: {
            Label(saved ? "In your deck" : "Save \(tense.name.lowercased()) forms to my deck",
                  systemImage: saved ? "checkmark.circle.fill" : "plus.circle.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(saved ? Theme.success : Theme.indigo)
                .frame(maxWidth: .infinity).frame(minHeight: 44)
                .background(saved ? Theme.successLight : Theme.indigo.opacity(0.08))
                .clipShape(.rect(cornerRadius: Radius.chip))
        }
        .buttonStyle(.plain)
        .disabled(saved)
    }

    /// Build a natural spoken phrase, picking the first pronoun variant and
    /// eliding "je" before a vowel ("j'ai", "j'étais").
    private func verbPhrase(pronoun: String, form: String) -> String {
        let p = pronoun.split(separator: "/").first.map(String.init) ?? pronoun
        if p == "je", let first = form.lowercased().unicodeScalars.first,
           "aeiouyàâäéèêëîïôöùûüh".unicodeScalars.contains(first) {
            return "j'\(form)"
        }
        return "\(p) \(form)"
    }
}
