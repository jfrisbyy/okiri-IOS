//
//  LessonTeachingStage.swift
//  FluentFrenchIOS
//
//  "Learn before you practice": content v2 skill cards (rule, examples with
//  notes, contrast pairs, common mistake — C17 / B15) followed by word cards.
//  The AI question prefetch starts as soon as this stage appears (C9).
//

import SwiftUI

struct LessonTeachingStage: View {
    let model: LessonViewModel
    let onClose: () -> Void
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(spacing: Space.lg) {
            HStack {
                Spacer()
                LessonCloseButton(action: onClose)
            }
            Text("Learn before you practice")
                .font(LessonFont.title).foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
            TabView {
                ForEach(model.conceptBlocks) { block in
                    LessonSkillCard(block: block, fallbackExplanation: model.conceptExplanations[block.id])
                }
                ForEach(model.teachingGaps) { gap in
                    LessonWordCard(gap: gap)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            LessonPrimaryButton(title: "Start practice") {
                Haptics.select()
                model.startPractice(store: store)
            }
        }
        .padding(Space.xl)
        .task {
            model.startPrefetch(store: store)
            model.loadConceptExplanations()
        }
    }
}

// MARK: - Skill card (C17 / B15)

struct LessonSkillCard: View {
    let block: ConceptBlock
    /// An AI summary, used only when the content has no `teaching` block.
    var fallbackExplanation: String? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                HStack(spacing: 8) {
                    Pill(text: "Skill", color: Theme.secondary, filled: true)
                    Pill(text: block.concept.category.label, color: block.concept.category.color)
                    Pill(text: block.concept.cefrLevel.rawValue, color: Theme.textSecondary)
                    Spacer()
                }
                if block.isStalled {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.counterclockwise").font(.footnote.weight(.bold))
                            .accessibilityHidden(true)
                        Text("Let's look at this again").font(.subheadline.weight(.semibold))
                    }
                    .foregroundStyle(Theme.warning)
                }
                Text(block.concept.name)
                    .font(LessonFont.display).foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)

                if let teaching = block.teaching {
                    Text(teaching.rule)
                        .font(.body).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if !teaching.examples.isEmpty {
                        examples("Examples", teaching.examples, tint: Theme.secondaryLight)
                    }
                    if !teaching.contrast.isEmpty {
                        examples("Compare", teaching.contrast, tint: Theme.accentLight)
                    }
                    if let mistake = teaching.commonMistake?.trimmingCharacters(in: .whitespacesAndNewlines), !mistake.isEmpty {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill").font(.footnote).foregroundStyle(Theme.warning)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Common mistake").font(.caption.weight(.bold)).foregroundStyle(Theme.warning)
                                Text(mistake).font(.subheadline).foregroundStyle(Theme.text)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .padding(Space.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.warningLight).clipShape(.rect(cornerRadius: Radius.card))
                        .accessibilityElement(children: .combine)
                    }
                } else {
                    Text(fallbackExplanation ?? block.explanation)
                        .font(.body).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let example = block.example {
                    workedExample(example)
                }
                if let reason = block.reason {
                    LessonReasonLine(text: reason)
                }
            }
            .padding(Space.xl)
        }
        .scrollIndicators(.hidden)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.hero)).softLift()
        .padding(.bottom, 36)
        .padding(.horizontal, 2)
    }

    private func examples(_ title: String, _ items: [FoundationExampleContent], tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased()).font(.caption.weight(.bold)).foregroundStyle(Theme.secondary).tracking(0.3)
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(item.fr).font(.body.weight(.semibold)).foregroundStyle(Theme.text)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                        SpeakButton(text: item.fr, size: 26)
                    }
                    Text(item.en).font(.footnote).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if let note = item.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                        Text(note).font(.caption).italic().foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg).background(tint).clipShape(.rect(cornerRadius: Radius.card))
    }

    /// The concept's own worked example from the learner's gaps, key part emphasised.
    private func workedExample(_ example: GapItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text("From your items").font(.caption.weight(.bold)).foregroundStyle(Theme.secondary)
                Spacer(minLength: 0)
                SpeakButton(text: example.exampleSentence.isEmpty ? example.frenchWord : example.exampleSentence, size: 28)
            }
            if example.exampleSentence.isEmpty {
                Text(example.frenchWord).font(.title3.weight(.bold)).foregroundStyle(Theme.primary)
                Text(example.englishTranslation).font(.footnote).foregroundStyle(Theme.textSecondary)
            } else {
                LessonHighlightedText(sentence: example.exampleSentence, gap: example)
                if !example.exampleTranslation.isEmpty {
                    Text(example.exampleTranslation).font(.footnote).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg).background(Theme.backgroundSecondary).clipShape(.rect(cornerRadius: Radius.card))
    }
}

// MARK: - Word card

struct LessonWordCard: View {
    let gap: GapItem

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                HStack {
                    Pill(text: gap.category.label, color: gap.category.color, filled: true)
                    if let level = gap.cefrLevel { Pill(text: level.rawValue, color: Theme.textSecondary) }
                    if gap.isNew { Pill(text: "New", color: Theme.secondary) }
                    Spacer()
                }
                HStack(spacing: 12) {
                    Text(gap.frenchWord).font(LessonFont.hero).foregroundStyle(Theme.primary)
                        .fixedSize(horizontal: false, vertical: true)
                    SpeakButton(text: gap.frenchWord, size: 42)
                }
                if let pronunciation = gap.pronunciation, !pronunciation.isEmpty {
                    Text(pronunciation).font(.subheadline).italic().foregroundStyle(Theme.textSecondary)
                }
                let grammarTags: [String] = [gap.partOfSpeech, gap.gender, gap.article, gap.register]
                    .compactMap { $0 }.filter { !$0.isEmpty }
                if !grammarTags.isEmpty {
                    FlowLayout(spacing: 6, lineSpacing: 6) {
                        ForEach(grammarTags, id: \.self) { tag in
                            GrammarChip(text: tag, accent: Theme.primary)
                        }
                    }
                }
                if let base = gap.baseForm, !base.isEmpty {
                    HStack(spacing: 5) {
                        Text("Base form:").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                        Text(base).font(.footnote.weight(.bold)).foregroundStyle(Theme.text)
                    }
                    .accessibilityElement(children: .combine)
                }
                Text(gap.englishTranslation).font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
                if !gap.explanation.isEmpty {
                    Text(gap.explanation).font(.subheadline).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !gap.exampleSentence.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Text("Example").font(.caption.weight(.bold)).foregroundStyle(Theme.secondary)
                            Spacer(minLength: 0)
                            SpeakButton(text: gap.exampleSentence, size: 28)
                        }
                        LessonHighlightedText(sentence: gap.exampleSentence, gap: gap)
                        if !gap.exampleTranslation.isEmpty {
                            Text(gap.exampleTranslation).font(.footnote).foregroundStyle(Theme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Space.lg).background(Theme.secondaryLight).clipShape(.rect(cornerRadius: Radius.card))
                }
                if let related = gap.relatedWords, !related.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("RELATED WORDS").font(.caption.weight(.bold)).foregroundStyle(Theme.textSecondary)
                        FlowLayout(spacing: 6, lineSpacing: 6) {
                            ForEach(related, id: \.self) { word in
                                Text(word)
                                    .font(.footnote.weight(.medium)).foregroundStyle(Theme.primary)
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(Theme.primary.opacity(0.10), in: Capsule())
                            }
                        }
                    }
                }
            }
            .padding(Space.xl)
        }
        .scrollIndicators(.hidden)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card).clipShape(.rect(cornerRadius: Radius.hero)).softLift()
        .padding(.bottom, 36)
        .padding(.horizontal, 2)
    }
}
