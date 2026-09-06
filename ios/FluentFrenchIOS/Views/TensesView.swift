//
//  TensesView.swift
//  FluentFrenchIOS
//
//  French verb-tense reference: pick a tense, read when to use it, and browse
//  full conjugation tables for common verbs with a listen button and a
//  save-this-form button on every row.
//

import SwiftUI

struct TensesView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 1 at the default text size; the round listen buttons grow with it so the
    /// glyph inside keeps its padding.
    @ScaledMetric private var typeScale: CGFloat = 1

    /// The pronoun column keeps the conjugation table aligned, so it grows with
    /// the text size but stops before it crowds out the verb form (the pronoun
    /// wraps instead).
    private var columnScale: CGFloat { min(max(typeScale, 1), 1.6) }
    @State private var selectedTense: String = "Present"
    /// The conjugated form being saved to the deck (E25).
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

    /// What saving a conjugation row stores: ONE form per card (E25).
    ///
    /// A card built from the whole table ("être — Imparfait" meaning "to be —
    /// imparfait") is unanswerable: the only question a non-testable card can
    /// produce is "What does “être — Imparfait” mean?", whose answer is spelled
    /// out in the prompt, and the six forms are never asked about at all. One
    /// card per form asks something real instead — recognition ("What does
    /// “étions” mean?" against the sibling forms) and, once there is evidence,
    /// production ("nous _____" → étions), filed under the tense's grammar
    /// concept so a right answer is genuine evidence for it.
    private func draft(for verb: FrenchVerb, in tense: FrenchTense,
                       pronoun: String, form: String) -> CaptureDraft? {
        let word = form.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !word.isEmpty else { return nil }
        let phrase = verbPhrase(pronoun: pronoun, form: word)
        // French paradigms repeat one form across pronouns (être/imparfait is
        // "étais" for both je and tu), and the deck keys cards by headword — so
        // one card has to stand for every pronoun that shares the form. Name
        // them all in the meaning and accept any of them, or "tu étais" would
        // be marked wrong on a card the learner saved from the "tu" row.
        let shared = (verb.tenses[tense.name]?.forms() ?? [])
            .filter { $0.form.trimmingCharacters(in: .whitespacesAndNewlines) == word }
            .map { $0.pronoun }
        let pronouns = shared.isEmpty ? [pronoun] : shared
        var answers: [String] = []
        for p in pronouns {
            let candidate = verbPhrase(pronoun: p, form: word)
            if !answers.contains(candidate) { answers.append(candidate) }
        }
        if !answers.contains(phrase) { answers.insert(phrase, at: 0) }
        return CaptureDraft(
            frenchWord: word,
            englishTranslation: ConjugationCard.meaning(verbMeaning: verb.meaning, pronouns: pronouns,
                                                        tense: tense.name),
            explanation: "\(tense.frenchName) of \(verb.infinitive) (\(verb.meaning)). \(tense.detail).",
            exampleSentence: phrase,
            exampleTranslation: "",
            sourceType: .reading,
            sourceTab: "tenses",
            sourceLevel: Self.level(for: tense),
            category: .grammar,
            partOfSpeech: "verb",
            conceptId: Self.conceptId(for: tense, verb: verb),
            acceptedAnswers: answers,
            // Paradigms also repeat a form ACROSS tenses (parler's "parlions" is
            // imparfait and subjonctif), so saving it from a second tense adds
            // that reading to the one card instead of being refused (read-4-2).
            mergeIntoExisting: true
        )
    }

    /// Whether the deck already holds this form AS the tense on screen. A form two
    /// tenses spell alike is one card, so "saved" has to mean the card covers this
    /// tense — not merely that the spelling is somewhere in the deck (read-4-2).
    private func isSaved(_ form: String, in tense: FrenchTense) -> Bool {
        let word = form.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let gap = store.existingGap(forWord: word) else { return false }
        return ConjugationCard.covers(tense: tense.name, meaning: gap.englishTranslation)
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
                    Button {
                        Haptics.tap()
                        withAnimation(Theme.motion(.spring(response: 0.3, dampingFraction: 0.8), reduceMotion: reduceMotion)) {
                            selectedTense = tense.name
                        }
                    } label: {
                        Text(tense.name).scaledFont(13, weight: .medium)
                            .foregroundStyle(active ? .white : Theme.text)
                            .padding(.horizontal, 14).frame(minHeight: Theme.minimumHitTarget)
                            .background(active ? Theme.indigo : Theme.card)
                            .clipShape(.capsule)
                            .overlay(Capsule().stroke(active ? Color.clear : Theme.border.opacity(0.7), lineWidth: 0.5))
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Shows this tense for every verb below")
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
                Text(tense.frenchName).scaledSerifDisplay(22, weight: .bold).foregroundStyle(Theme.indigo)
                    .accessibilityAddTraits(.isHeader)
                Text(tense.detail).scaledFont(15).foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text("WHEN TO USE").scaledFont(10, weight: .bold).foregroundStyle(Theme.textSecondary).tracking(0.8)
                Text(tense.usage).scaledFont(14).foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityElement(children: .combine)
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "text.quote").scaledFont(13).foregroundStyle(Theme.indigo)
                    .accessibilityHidden(true)
                Text(tense.example).scaledFont(14, weight: .medium).italic().foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
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
                    Text(verb.infinitive).scaledSerifDisplay(19, weight: .bold).foregroundStyle(Theme.text)
                        .accessibilityAddTraits(.isHeader)
                    Text(verb.meaning).scaledFont(13).foregroundStyle(Theme.textSecondary)
                }
                .accessibilityElement(children: .combine)
                Spacer()
                Pill(text: "-\(verb.group)", color: Theme.indigo)
            }
            if let conj {
                VStack(spacing: 0) {
                    ForEach(Array(conj.forms().enumerated()), id: \.offset) { i, item in
                        HStack {
                            Text(item.pronoun).scaledFont(14).foregroundStyle(Theme.textSecondary)
                                .frame(width: 92 * columnScale, alignment: .leading)
                            Text(item.form).scaledFont(15, weight: .semibold).foregroundStyle(Theme.text)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer()
                            Button { NaturalVoice.shared.speak(verbPhrase(pronoun: item.pronoun, form: item.form)) } label: {
                                Image(systemName: "speaker.wave.2.fill").scaledFont(12).foregroundStyle(Theme.indigo)
                                    .frame(width: 28 * Theme.chromeScale(typeScale), height: 28 * Theme.chromeScale(typeScale))
                                    .background(Theme.indigo.opacity(0.1)).clipShape(.circle)
                                    .minimumHitTarget()
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Listen to \(item.pronoun) \(item.form)")
                            .accessibilityHint("Reads the French aloud")
                            if let tense = currentTense {
                                saveButton(for: verb, in: tense, pronoun: item.pronoun, form: item.form)
                            }
                        }
                        .padding(.vertical, 2)
                        if i < conj.forms().count - 1 {
                            Rectangle().fill(Theme.borderLight).frame(height: 1)
                        }
                    }
                }
                if let tense = currentTense { saveHint(for: verb, in: tense, forms: conj.forms()) }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(.rect(cornerRadius: Radius.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.card).stroke(Theme.border.opacity(0.5), lineWidth: 0.5))
        .softLift(radius: 14, y: 5, strength: 0.85)
    }

    /// Save-to-deck affordance (E25) for ONE conjugated form.
    private func saveButton(for verb: FrenchVerb, in tense: FrenchTense,
                            pronoun: String, form: String) -> some View {
        let saved = isSaved(form, in: tense)
        return Button {
            guard !saved, let draft = draft(for: verb, in: tense, pronoun: pronoun, form: form) else { return }
            Haptics.tap()
            captureDraft = draft
        } label: {
            Image(systemName: saved ? "checkmark.circle.fill" : "plus.circle")
                .scaledFont(13)
                .foregroundStyle(saved ? Theme.success : Theme.indigo)
                .frame(width: 28 * Theme.chromeScale(typeScale), height: 28 * Theme.chromeScale(typeScale))
                .background(saved ? Theme.successLight : Theme.indigo.opacity(0.1)).clipShape(.circle)
                .minimumHitTarget()
        }
        .buttonStyle(.plain)
        .disabled(saved)
        .accessibilityLabel(saved ? "\(pronoun) \(form) is already in your deck"
                                  : "Save \(pronoun) \(form) to my deck")
        .accessibilityHint(saved ? "" : "Adds this form to your practice deck")
    }

    /// How much of this table is already in the deck, and how to add the rest.
    private func saveHint(for verb: FrenchVerb, in tense: FrenchTense,
                          forms: [(pronoun: String, form: String)]) -> some View {
        // Count DISTINCT forms: the deck keys cards by headword, so the repeated
        // rows of a paradigm (être/imparfait "étais" for je and tu) are one card,
        // and counting rows would jump to "2 of 6" after a single save. A card
        // only counts when it covers THIS tense (read-4-2).
        let unique = Set(forms.map { $0.form.trimmingCharacters(in: .whitespacesAndNewlines) })
        let saved = unique.filter { isSaved($0, in: tense) }.count
        let text: String
        if saved == 0 {
            text = "Tap + on a form to save it to your deck"
        } else if saved >= unique.count {
            text = "Every form of \(verb.infinitive) in the \(tense.name.lowercased()) is in your deck"
        } else {
            text = "\(saved) of \(unique.count) forms in your deck"
        }
        return Text(text)
            .font(.footnote)
            .foregroundStyle(saved >= unique.count ? Theme.success : Theme.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
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
