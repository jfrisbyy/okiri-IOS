//
//  ReadCaptureTests.swift
//  FluentFrenchIOSTests
//
//  Package E-read: sentence extraction (E5), the heuristic tagger's scoring,
//  floor and near-duplicate folding (E1/E3), the capture builder's category /
//  level / difficulty mapping through the store (E4/E6/E7), pending-translation
//  retry (E4), serialised tagging (E3), the selector's learner-capture exemption
//  (E2) and the level-aware reading shelf (E20).
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct ReadCaptureTests {
    private let now = EngineFixtures.now

    // MARK: - E5 Sentence extraction

    @Test func splitsSentencesOnTerminatorsAndNewlines() {
        let text = "Ce matin, je suis allé au café. Le serveur m'a souri ! Il pleut… Vraiment ?\nUne autre ligne sans point"
        let s = SentenceExtractor.sentences(in: text)
        #expect(s == ["Ce matin, je suis allé au café.", "Le serveur m'a souri !", "Il pleut…", "Vraiment ?", "Une autre ligne sans point"])
    }

    @Test func abbreviationsAndDecimalsDoNotEndASentence() {
        let s = SentenceExtractor.sentences(in: "M. Dupont a payé 3.5 euros. Il est parti.")
        #expect(s == ["M. Dupont a payé 3.5 euros.", "Il est parti."])
    }

    @Test func findsTheContainingSentenceOnWordBoundaries() {
        let text = "Il faut partir tôt. L'art est partout. On boit de l'eau."
        #expect(SentenceExtractor.sentence(containing: "art", in: text) == "L'art est partout.")
        #expect(SentenceExtractor.sentence(containing: "eau", in: text) == "On boit de l'eau.", "elision splits at the apostrophe")
        #expect(SentenceExtractor.sentence(containing: "partir tôt", in: text) == "Il faut partir tôt.", "phrases match as a run of words")
        #expect(SentenceExtractor.sentence(containing: "Partout", in: text) == "L'art est partout.", "case-insensitive")
        #expect(SentenceExtractor.sentence(containing: "fromage", in: text) == "", "absent term → no context, never a wrong one")
        #expect(SentenceExtractor.sentence(containing: "", in: text) == "")
    }

    @Test func dialogueDashesSplitIntoTurns() {
        let s = SentenceExtractor.sentences(in: "— Allô, bonjour, je voudrais parler à Marie. — C'est de la part de qui ?")
        #expect(s.count == 2)
        #expect(SentenceExtractor.sentence(containing: "Marie", in: "— Allô, je voudrais parler à Marie. — C'est de la part de qui ?").hasSuffix("Marie."))
    }

    // MARK: - E1 Heuristic tagger

    private var taxonomy: [Concept] { ConceptTaxonomy.seed() }

    private func captured(_ word: String, english: String = "", explanation: String = "", pos: String? = nil,
                          register: String? = nil, category: GapCategory = .vocabulary, level: CEFRLevel? = .A2,
                          baseForm: String? = nil) -> GapItem {
        var g = EngineFixtures.gap(word, concept: nil, category: category, level: level ?? .A2, sourceType: .reading)
        g.frenchWord = word
        g.englishTranslation = english
        g.explanation = explanation
        g.partOfSpeech = pos
        g.register = register
        g.cefrLevel = level
        g.baseForm = baseForm
        return g
    }

    @Test func keywordHitTagsAboveTheFloor() {
        let gap = captured("du coup", english: "so / as a result", explanation: "A very common spoken filler.", pos: "phrase", category: .phrasing, level: .B1)
        let result = HeuristicTagger.tag(gap: gap, concepts: taxonomy)
        guard case .existing(let id, let confidence) = result else { Issue.record("expected a tag, got \(result)"); return }
        #expect(id == "spoken-fillers")
        #expect(confidence >= Tuning.tagConfidenceFloor)
    }

    @Test func contentLexiconHitIsAuthoritative() {
        let gap = captured("le pain", english: "bread", pos: "noun")
        let lexicon = HeuristicTagger.lexicon(from: FoundationContentFile(version: 2, skills: [
            FoundationSkillContent(id: "food-drink-vocab", category: "vocabulary",
                                   items: [FoundationItemContent(fr: "le pain", en: "bread", note: "", ex: "Je mange du pain.", exEn: "I eat bread.", diff: "okay")]),
        ]))
        #expect(lexicon["pain"] == "food-drink-vocab", "article-stripped form is indexed too")
        let result = HeuristicTagger.tag(gap: captured("pain", english: "bread"), concepts: taxonomy, lexicon: lexicon)
        guard case .existing(let id, let confidence) = result else { Issue.record("expected a tag, got \(result)"); return }
        #expect(id == "food-drink-vocab")
        #expect(confidence == 1)
        _ = gap
    }

    @Test func belowTheFloorStaysUntaggedAndNeverFallsBackToEasiestConcept() {
        // A bare noun with no theme keyword: nothing to go on.
        let noun = captured("ordinateur", english: "computer", explanation: "A masculine noun.", pos: "noun", level: .B1)
        let result = HeuristicTagger.tag(gap: noun, concepts: taxonomy)
        guard case .untagged(let confidence) = result else { Issue.record("expected untagged, got \(result)"); return }
        #expect(confidence < Tuning.tagConfidenceFloor)

        // A grammar-categorised gap with no signal must not land on the easiest grammar concept.
        let grammar = captured("truc", english: "thing", category: .grammar, level: .A1)
        #expect(HeuristicTagger.tag(gap: grammar, concepts: taxonomy) == .untagged(confidence: 0))
        #expect(HeuristicTagger.rank(gap: grammar, concepts: taxonomy).isEmpty)
    }

    @Test func partOfSpeechPlusCategoryAloneIsBelowTheFloor() {
        // POS + category + level fit clears the floor for a beginner-level verb…
        let easyVerb = captured("manger", english: "to eat", pos: "verb", level: .A1)
        guard case .existing(let id, _) = HeuristicTagger.tag(gap: easyVerb, concepts: taxonomy) else {
            Issue.record("an A1 verb should map to common verbs"); return
        }
        #expect(id == "common-verbs")
        // …but a B2 verb is not a "common verb": the level penalty keeps it untagged.
        let hardVerb = captured("s'acharner", english: "to persist doggedly", pos: "verb", level: .B2)
        guard case .untagged(let confidence) = HeuristicTagger.tag(gap: hardVerb, concepts: taxonomy) else {
            Issue.record("a B2 verb must not be filed under A1 common verbs"); return
        }
        #expect(confidence < Tuning.tagConfidenceFloor)
        #expect(Tuning.tagPartOfSpeechWeight + Tuning.tagCategoryWeight < Tuning.tagConfidenceFloor)
    }

    @Test func aWordInsideAPhraseDoesNotSpeakForThePhrase() {
        // "bras" would be body vocabulary and "avoir" the irregular-verb skill for a
        // single word; inside a captured idiom neither is what the phrase is about,
        // so the phrase stays untagged (an untagged card is still practicable — a
        // card filed under "être, avoir, aller, faire" teaches the wrong thing).
        let idiom = captured("Avoir le bras long", english: "to have connections", explanation: "An idiomatic expression.", pos: "phrase", category: .phrasing, level: .B1)
        let ranked = HeuristicTagger.rank(gap: idiom, concepts: taxonomy)
        #expect(!ranked.contains { $0.conceptId == "body-vocab" || $0.conceptId == "present-irregular" })
        #expect(HeuristicTagger.tag(gap: idiom, concepts: taxonomy) == .untagged(confidence: 0))
        // A phrase key still speaks for a phrase.
        let filler = captured("du coup", english: "so / as a result", pos: "phrase", category: .phrasing, level: .B1)
        guard case .existing(let id, _) = HeuristicTagger.tag(gap: filler, concepts: taxonomy) else {
            Issue.record("expected spoken-fillers"); return
        }
        #expect(id == "spoken-fillers")
    }

    @Test func explanationProseNeverNamesAConcept() {
        // The explanation is free LLM prose and carries the learner's own note, so a
        // gloss that happens to say "know" or "expression" must not file the card
        // under a B1 grammar contrast the learner never met.
        let gap = captured("renseignement", english: "information",
                           explanation: "Information you need to know. A common expression in the news.",
                           pos: "noun", level: .B1)
        let ranked = HeuristicTagger.rank(gap: gap, concepts: taxonomy)
        #expect(!ranked.contains { $0.conceptId == "savoir-vs-connaitre" || $0.conceptId == "idioms" })
        // The same trigger still fires when the MEANING says it.
        let savoir = captured("savoir", english: "to know (a fact)", pos: "verb", level: .B1)
        guard case .existing(let id, let confidence) = HeuristicTagger.tag(gap: savoir, concepts: taxonomy) else {
            Issue.record("expected savoir-vs-connaitre"); return
        }
        #expect(id == "savoir-vs-connaitre")
        #expect(confidence >= Tuning.tagConfidenceFloor)
    }

    @Test func functionWordsOnlyMatchWhenTheyAreTheCapture() {
        // "la" in the gloss must not tag a noun as definite articles.
        let noun = captured("gare", english: "station", explanation: "la gare, a feminine noun", pos: "noun", level: .A1)
        guard case .existing(let id, _) = HeuristicTagger.tag(gap: noun, concepts: taxonomy) else {
            Issue.record("expected places-town-vocab"); return
        }
        #expect(id == "places-town-vocab")
        let article = captured("la", english: "the", pos: "article", category: .grammar, level: .A1)
        guard case .existing(let aid, _) = HeuristicTagger.tag(gap: article, concepts: taxonomy) else {
            Issue.record("expected definite-articles"); return
        }
        #expect(aid == "definite-articles")
    }

    @Test func markedRegisterTagsFormalRegister() {
        let gap = captured("bouffer", english: "to eat (slang)", pos: "verb", register: "slang", category: .register, level: .B1)
        guard case .existing(let id, _) = HeuristicTagger.tag(gap: gap, concepts: taxonomy) else {
            Issue.record("expected formal-register"); return
        }
        #expect(id == "formal-register")
    }

    // MARK: - E3 Near-duplicate concept names

    @Test func nearDuplicateNamesFoldIntoTheExistingConcept() {
        let existing = taxonomy
        #expect(HeuristicTagger.nearDuplicate(named: "Past tense", id: "past-tense", among: existing)?.id == "passe-compose-avoir")
        #expect(HeuristicTagger.nearDuplicate(named: "Compound past", id: "compound-past", among: existing)?.id == "passe-compose-avoir")
        #expect(HeuristicTagger.nearDuplicate(named: "Adjective agreement rules", id: "adj-agreement", among: existing)?.id == "adjective-agreement")
        #expect(HeuristicTagger.nearDuplicate(named: "Subjunctive", id: "subjunctive", among: existing)?.id == "subjunctive-intro")
        #expect(HeuristicTagger.nearDuplicate(named: "Cooking verbs", id: "cooking-verbs", among: existing) == nil)
        #expect(HeuristicTagger.nearDuplicate(named: "Anything", id: "IDIOMS", among: existing)?.id == "idioms", "same id, different case")
    }

    @Test func taggingIsSerialisedAndDedupesNewConcepts() async {
        let s = EngineFixtures.store()
        var seenConceptCounts: [Int] = []
        let baseline = s.concepts.count
        s.conceptTagger = { gap, concepts, _ in
            seenConceptCounts.append(concepts.count)
            // Both captures propose the same skill under two different names.
            if gap.frenchWord == "a" {
                return .new(Concept(id: "past-tense", name: "Past tense", category: .grammar, cefrLevel: .A2, prerequisites: [], description: ""))
            }
            return .new(Concept(id: "compound-past", name: "Compound past", category: .grammar, cefrLevel: .A2, prerequisites: [], description: ""))
        }
        // Remove the taxonomy's own passé composé so the fake's first concept is genuinely new.
        s.concepts.removeAll { $0.id == "passe-compose-avoir" || $0.id == "passe-compose-etre" || $0.id == "imparfait-vs-pc" || $0.id == "object-pronouns" || $0.id == "imparfait" }
        let base = s.concepts.count

        s.capture(CaptureDraft(untranslated: "a", sourceType: .reading, sourceTab: "read"), now: now)
        s.capture(CaptureDraft(untranslated: "b", sourceType: .reading, sourceTab: "read"), now: now)
        await s.awaitPendingTags()

        #expect(seenConceptCounts == [base, base + 1], "the second request saw the concept the first created")
        #expect(s.concepts.count == base + 1, "one new concept, not two")
        #expect(s.concepts.contains { $0.id == "past-tense" })
        #expect(!s.concepts.contains { $0.id == "compound-past" })
        let a = s.gaps.first { $0.frenchWord == "a" }, b = s.gaps.first { $0.frenchWord == "b" }
        #expect(a?.conceptId == "past-tense")
        #expect(b?.conceptId == "past-tense", "folded into the near-duplicate")
        #expect(a?.tagConfidence == Tuning.tagNewConceptConfidence)
        _ = baseline
    }

    @Test func untaggedResultRecordsConfidenceAndLeavesConceptNil() async {
        let s = EngineFixtures.store()
        s.conceptTagger = { _, _, _ in .untagged(confidence: 0.3) }
        s.capture(CaptureDraft(untranslated: "ordinateur", sourceType: .reading, sourceTab: "read"), now: now)
        await s.awaitPendingTags()
        let gap = s.gaps.first { $0.frenchWord == "ordinateur" }
        #expect(gap?.conceptId == nil)
        #expect(gap?.tagConfidence == 0.3)
    }

    // MARK: - E4 / E6 / E7 Capture through the store

    private func quietStore() -> AppStore {
        let s = EngineFixtures.store()
        s.conceptTagger = { _, _, _ in nil }
        return s
    }

    @Test func captureDerivesCategoryFromPartOfSpeechAndRegister() {
        let s = quietStore()
        func cat(_ draft: CaptureDraft) -> GapCategory? {
            if case .saved(let g) = s.capture(draft, now: now) { return g.category }
            return nil
        }
        #expect(cat(CaptureDraft(frenchWord: "gare", englishTranslation: "station", sourceType: .reading, sourceTab: "read", partOfSpeech: "noun")) == .vocabulary)
        #expect(cat(CaptureDraft(frenchWord: "chez", englishTranslation: "at the home of", sourceType: .reading, sourceTab: "read", partOfSpeech: "preposition")) == .grammar)
        #expect(cat(CaptureDraft(frenchWord: "du coup", englishTranslation: "so", sourceType: .reading, sourceTab: "read", partOfSpeech: "phrase")) == .phrasing)
        #expect(cat(CaptureDraft(frenchWord: "il y a", englishTranslation: "there is", sourceType: .reading, sourceTab: "read")) == .phrasing, "multi-word without POS → phrasing")
        #expect(cat(CaptureDraft(frenchWord: "bouffer", englishTranslation: "to eat", sourceType: .reading, sourceTab: "read", partOfSpeech: "verb", register: "slang")) == .register)
        #expect(cat(CaptureDraft(frenchWord: "vin", englishTranslation: "wine", sourceType: .reading, sourceTab: "read", partOfSpeech: "noun", register: "neutral")) == .vocabulary, "neutral register is not a register gap")
        #expect(cat(CaptureDraft(frenchWord: "bon", englishTranslation: "good", sourceType: .reading, sourceTab: "accent", category: .pronunciation, partOfSpeech: "adjective")) == .pronunciation, "an explicit category wins")
    }

    @Test func captureDerivesLevelAndDifficultyFromSourceAndLearner() {
        let s = quietStore()
        #expect(s.learnerLevel == .A2, "fresh store sits at the default A2 band")
        guard case .saved(let hard) = s.capture(CaptureDraft(frenchWord: "reprise", englishTranslation: "recovery", sourceType: .reading, sourceTab: "read", sourceLevel: .B2), now: now) else {
            Issue.record("expected a save"); return
        }
        #expect(hard.cefrLevel == .B2)
        #expect(hard.difficulty == .hard)
        #expect(hard.irtDifficulty == Tuning.irtDifficulty(for: .B2) + Tuning.irtHardBump)
        #expect(hard.fsrs != nil, "captured gaps start scheduled (B4)")
        #expect(hard.sourceType == .reading)

        guard case .saved(let own) = s.capture(CaptureDraft(frenchWord: "merci", englishTranslation: "thanks", sourceType: .reading, sourceTab: "read"), now: now) else {
            Issue.record("expected a save"); return
        }
        #expect(own.cefrLevel == .A2, "no source level → the learner's own")
        #expect(own.difficulty == .okay)
        #expect(own.irtDifficulty == Tuning.irtDifficulty(for: .A2))
    }

    @Test func captureDedupesOnHeadwordAndRejectsEmpty() {
        let s = quietStore()
        guard case .saved(let first) = s.capture(CaptureDraft(frenchWord: "Bonjour", englishTranslation: "hello", sourceType: .reading, sourceTab: "read"), now: now) else {
            Issue.record("expected a save"); return
        }
        let again = s.capture(CaptureDraft(frenchWord: "bonjour ", englishTranslation: "hi", sourceType: .listening, sourceTab: "listen"), now: now)
        #expect(again == .duplicate(first))
        #expect(s.gaps.count == 1)
        #expect(s.capture(CaptureDraft(frenchWord: "   ", englishTranslation: "x", sourceType: .reading, sourceTab: "read"), now: now) == .rejected)
    }

    @Test func offlineCaptureNeverPersistsAPlaceholder() {
        let s = quietStore()
        let context = "Le serveur m'a souri et m'a demandé ce que je voulais."
        let draft = CaptureDraft(untranslated: "souri", sourceType: .reading, sourceTab: "read", contextSentence: context, note: "past participle?")
        guard case .saved(let gap) = s.capture(draft, now: now) else { Issue.record("expected a save"); return }
        #expect(gap.needsTranslation)
        #expect(gap.englishTranslation == "")
        #expect(gap.exampleSentence == context, "the containing sentence is the example, never the bare term")
        #expect(gap.exampleTranslation == "")
        #expect(gap.originalContext?.sentence == context)
        #expect(gap.originalContext?.sourceTab == "read")
        #expect(gap.explanation == "Note: past participle?")
        #expect(s.pendingTranslations.map(\.id) == [gap.id])

        // A gloss whose meaning is empty is not usable and is not saved as one.
        let empty = WordGloss(term: "souri", translation: "   ", explanation: "", example: "", exampleTranslation: "")
        #expect(!empty.isUsable)
        let fromEmpty = CaptureDraft(gloss: empty, sourceType: .reading, sourceTab: "read")
        #expect(fromEmpty.needsTranslation)
        #expect(!WordGloss.unavailable(for: "x", failure: .offline).isUsable)
    }

    @Test func glossDraftCarriesDictionaryDetail() {
        let s = quietStore()
        let gloss = WordGloss(term: "renouvelables", translation: "renewable", explanation: "Plural adjective.",
                              example: "Les énergies renouvelables.", exampleTranslation: "Renewable energies.",
                              partOfSpeech: "adjective", gender: "", article: "", baseForm: "renouvelable",
                              baseFormNote: "", pronunciation: "re-nou-VELLE-ah-bel", register: "", relatedWords: ["durable"])
        let draft = CaptureDraft(gloss: gloss, sourceType: .reading, sourceTab: "read", contextSentence: "La France investit dans les énergies renouvelables.", sourceLevel: .B1, note: "")
        guard case .saved(let gap) = s.capture(draft, now: now) else { Issue.record("expected a save"); return }
        #expect(!gap.needsTranslation)
        #expect(gap.englishTranslation == "renewable")
        #expect(gap.exampleSentence == "Les énergies renouvelables.", "the gloss's own example wins over the context")
        #expect(gap.originalContext?.sentence == "La France investit dans les énergies renouvelables.")
        #expect(gap.pronunciation == "re-nou-VELLE-ah-bel")
        #expect(gap.baseForm == "renouvelable")
        #expect(gap.relatedWords == ["durable"])
        #expect(gap.cefrLevel == .B1)
        #expect(gap.tagConfidence == nil)
    }

    @Test func explicitConceptLinksDirectlyWhenTheLearnerHasIt() {
        let s = quietStore()
        let draft = CaptureDraft(frenchWord: "Avoir le cafard", englishTranslation: "to feel down", sourceType: .reading, sourceTab: "idioms", category: .phrasing, conceptId: "idioms")
        guard case .saved(let gap) = s.capture(draft, now: now) else { Issue.record("expected a save"); return }
        #expect(gap.conceptId == "idioms")
        #expect(gap.tagConfidence == nil, "content-known, not a heuristic guess")
        let unknown = CaptureDraft(frenchWord: "x", englishTranslation: "y", sourceType: .reading, sourceTab: "idioms", conceptId: "no-such-concept")
        guard case .saved(let loose) = s.capture(unknown, now: now) else { Issue.record("expected a save"); return }
        #expect(loose.conceptId == nil)
    }

    @Test func captureDedupeIgnoresTheTypographicApostrophe() {
        let s = quietStore()
        func save(_ word: String, _ english: String) -> CaptureOutcome {
            s.capture(CaptureDraft(frenchWord: word, englishTranslation: english, sourceType: .reading, sourceTab: "read"), now: now)
        }
        guard case .saved = save("l'eau", "water") else { Issue.record("expected a save"); return }
        // The same word tapped in a live headline, which writes U+2019.
        let again = save("l\u{2019}eau", "water")
        guard case .duplicate = again else { Issue.record("expected a duplicate, got \(again)"); return }
        #expect(s.hasGap(forWord: "L\u{2019}EAU"), "the deck reports it as saved whichever apostrophe is used")
        #expect(s.gaps.filter { $0.frenchWord.hasSuffix("eau") }.count == 1)
        // Diacritics are NOT folded: ou and où are different words.
        guard case .saved = save("o\u{f9}", "where") else { Issue.record("expected a save"); return }
        guard case .saved = save("ou", "or") else { Issue.record("ou and où must stay separate cards"); return }
    }

    @Test func aTermWithNoLettersIsNeverSavedAsACard() {
        let s = quietStore()
        for junk in ["2030", "%", "€", "  "] {
            #expect(s.capture(CaptureDraft(frenchWord: junk, englishTranslation: "x", sourceType: .reading, sourceTab: "read"), now: now) == .rejected,
                    "\(junk) is text, not vocabulary")
        }
        guard case .saved = s.capture(CaptureDraft(frenchWord: "20 ans", englishTranslation: "20 years", sourceType: .reading, sourceTab: "read"), now: now) else {
            Issue.record("a term with letters in it is still a word"); return
        }
    }

    // MARK: - E4 Pending translation retry

    @Test func pendingTranslationsResolveWhenAGlossSucceeds() async {
        let s = quietStore()
        s.capture(CaptureDraft(untranslated: "souri", sourceType: .reading, sourceTab: "read", contextSentence: "Il m'a souri."), now: now)
        s.capture(CaptureDraft(untranslated: "foule", sourceType: .reading, sourceTab: "read", contextSentence: "La foule attend."), now: now.addingTimeInterval(60))
        #expect(s.pendingTranslations.count == 2)

        var asked: [(String, String)] = []
        let resolved = await s.resolvePendingTranslations(using: { term, context in
            asked.append((term, context))
            return .gloss(WordGloss(term: term, translation: "meaning of \(term)", explanation: "e", example: "Ex \(term).", exampleTranslation: "T", pronunciation: "p"))
        })
        #expect(resolved == 2)
        #expect(asked.map(\.0) == ["souri", "foule"], "oldest first")
        #expect(asked.map(\.1) == ["Il m'a souri.", "La foule attend."], "the stored sentence is the lookup context")
        #expect(s.pendingTranslations.isEmpty)
        let souri = s.gaps.first { $0.frenchWord == "souri" }
        #expect(souri?.englishTranslation == "meaning of souri")
        #expect(souri?.needsTranslation == false)
        #expect(souri?.exampleSentence == "Ex souri.", "the gloss example replaces the context stand-in")
        #expect(souri?.pronunciation == "p")
    }

    @Test func pendingRetryStopsWhenOfflineAndHonoursTheBatch() async {
        let s = quietStore()
        for (i, w) in ["a", "b", "c"].enumerated() {
            s.capture(CaptureDraft(untranslated: w, sourceType: .reading, sourceTab: "read"), now: now.addingTimeInterval(Double(i)))
        }
        var calls = 0
        let offline = await s.resolvePendingTranslations(using: { _, _ in calls += 1; return .unavailable(.offline) })
        #expect(offline == 0)
        #expect(calls == 1, "offline ends the pass at once — no spinner-storm while offline")
        #expect(s.pendingTranslations.count == 3)

        calls = 0
        let limited = await s.resolvePendingTranslations(using: { term, _ in
            calls += 1
            return .gloss(WordGloss(term: term, translation: "m", explanation: "", example: "", exampleTranslation: ""))
        }, limit: 2)
        #expect(limited == 2)
        #expect(calls == 2)
        #expect(s.pendingTranslations.map(\.frenchWord) == ["c"])
        // An unusable gloss does not count and does not clear the flag.
        let bogus = await s.resolvePendingTranslations(using: { term, _ in
            .gloss(WordGloss(term: term, translation: "", explanation: "", example: "", exampleTranslation: ""))
        })
        #expect(bogus == 0)
        #expect(s.pendingTranslations.map(\.frenchWord) == ["c"])
    }

    @Test func aTermTheServiceCannotParseDoesNotBlockEveryOtherSavedWord() async {
        let s = quietStore()
        for (i, w) in ["bloque", "suivant", "dernier"].enumerated() {
            s.capture(CaptureDraft(untranslated: w, sourceType: .reading, sourceTab: "read"), now: now.addingTimeInterval(Double(i)))
        }
        var asked: [String] = []
        func resolver(_ term: String, _ context: String) async -> GlossLookup {
            asked.append(term)
            if term == "bloque" { return .unavailable(.serviceError) }
            return .gloss(WordGloss(term: term, translation: "m", explanation: "", example: "", exampleTranslation: ""))
        }
        let first = await s.resolvePendingTranslations(using: resolver)
        #expect(first == 2, "the words behind the failing one are still translated")
        #expect(asked == ["bloque", "suivant", "dernier"])
        #expect(s.pendingTranslations.map(\.frenchWord) == ["bloque"])

        // Next pass: the repeatedly failing term is tried last, not first.
        s.capture(CaptureDraft(untranslated: "nouveau", sourceType: .reading, sourceTab: "read"), now: now.addingTimeInterval(10))
        asked = []
        _ = await s.resolvePendingTranslations(using: resolver)
        #expect(asked == ["nouveau", "bloque"], "a term that keeps failing sinks to the back of the queue")
        #expect(s.pendingTranslations.map(\.frenchWord) == ["bloque"])
    }

    @Test func aDeadServiceEndsThePassInsteadOfBeingAskedOncePerWord() async {
        let s = quietStore()
        for (i, w) in ["a", "b", "c", "d"].enumerated() {
            s.capture(CaptureDraft(untranslated: w, sourceType: .reading, sourceTab: "read"), now: now.addingTimeInterval(Double(i)))
        }
        var calls = 0
        let resolved = await s.resolvePendingTranslations(using: { _, _ in calls += 1; return .unavailable(.serviceError) })
        #expect(resolved == 0)
        #expect(calls == Tuning.pendingTranslationFailureStreak, "a service that is down is not asked once per pending word")
        #expect(s.pendingTranslations.count == 4)
    }

    @Test func resolvedTranslationQueuesTagging() async {
        let s = EngineFixtures.store()
        var tagged: [String] = []
        s.conceptTagger = { gap, _, _ in
            tagged.append(gap.englishTranslation)
            return gap.englishTranslation.isEmpty ? .untagged(confidence: 0) : .existing(id: "food-drink-vocab", confidence: 0.8)
        }
        s.capture(CaptureDraft(untranslated: "pain", sourceType: .reading, sourceTab: "read"), now: now)
        await s.awaitPendingTags()
        #expect(tagged == [""])
        _ = await s.resolvePendingTranslations(using: { term, _ in
            .gloss(WordGloss(term: term, translation: "bread", explanation: "", example: "", exampleTranslation: "", partOfSpeech: "noun"))
        })
        await s.awaitPendingTags()
        #expect(tagged == ["", "bread"], "re-tagged once it has English")
        #expect(s.gaps.first { $0.frenchWord == "pain" }?.conceptId == "food-drink-vocab")
    }

    @Test func untranslatedCaptureWaitsForItsMeaningBeforePractice() async {
        let s = quietStore()
        guard case .saved(let pending) = s.capture(CaptureDraft(untranslated: "foule", sourceType: .reading, sourceTab: "read", contextSentence: "La foule attend."), now: now) else {
            Issue.record("expected a save"); return
        }
        let selector = ConceptSelector(store: s)
        #expect(pending.fsrs != nil, "an untranslated capture is still scheduled")
        #expect(pending.isPracticable(at: now), "the item's own schedule offers it…")
        #expect(!selector.isPracticable(pending, at: now), "…but a blank meaning can never enter a lesson")

        let resolved = await s.resolvePendingTranslations(using: { term, _ in
            .gloss(WordGloss(term: term, translation: "crowd", explanation: "", example: "", exampleTranslation: ""))
        })
        #expect(resolved == 1)
        guard let filled = s.gaps.first(where: { $0.id == pending.id }) else { Issue.record("gap vanished"); return }
        #expect(!filled.needsTranslation)
        #expect(filled.englishTranslation == "crowd")
        #expect(filled.fsrs?.dueAt == pending.fsrs?.dueAt, "resolving the meaning does not touch the schedule")
        #expect(selector.isPracticable(filled, at: now), "practicable once it has a meaning")
    }

    // MARK: - E25 Reference paradigms are recognition-only cards

    @Test func paradigmCaptureIsRecognitionOnly() {
        let s = quietStore()
        let paradigm = CaptureDraft(frenchWord: "être — Imparfait", englishTranslation: "to be — imparfait",
                                    explanation: "j'étais, tu étais, il/elle/on était, nous étions, vous étiez, ils/elles étaient",
                                    exampleSentence: "j'étais", sourceType: .reading, sourceTab: "tenses",
                                    sourceLevel: .B1, category: .grammar, partOfSpeech: "verb", isTestable: false)
        guard case .saved(let gap) = s.capture(paradigm, now: now) else { Issue.record("expected a save"); return }
        #expect(!gap.isTestable)
        let scheduler = LessonScheduler()
        #expect(scheduler.level(for: gap) == .recognition)
        #expect(scheduler.kinds(for: gap) == [.multipleChoice], "never fill-blank, translation or arrange")
        #expect(scheduler.allowedAIKinds(for: gap) == [.multipleChoice])
        #expect(!LessonScheduler.isBlankable(gap))

        // Ordinary captures keep the default.
        guard case .saved(let word) = s.capture(CaptureDraft(frenchWord: "foule", englishTranslation: "crowd", sourceType: .reading, sourceTab: "read"), now: now) else {
            Issue.record("expected a save"); return
        }
        #expect(word.isTestable)
        #expect(CaptureDraft(untranslated: "x", sourceType: .reading, sourceTab: "read").isTestable)
    }

    // MARK: - E2 Learner captures are never prerequisite-blocked

    @Test func learnerCapturedGapsBypassPrerequisiteBlocking() {
        let blocked = EngineFixtures.concept("advanced", prerequisites: ["base"])
        let base = EngineFixtures.concept("base")
        var foundation = EngineFixtures.gap("f", concept: "advanced", sourceType: .foundation)
        foundation.fsrs = EngineFixtures.freshFsrs()
        var captured = EngineFixtures.gap("c", concept: "advanced", sourceType: .reading)
        captured.fsrs = EngineFixtures.freshFsrs()
        var spoken = EngineFixtures.gap("s", concept: "advanced", sourceType: .speech)
        spoken.fsrs = EngineFixtures.freshFsrs()
        let s = EngineFixtures.store(concepts: [base, blocked], gaps: [foundation, captured, spoken])
        let selector = ConceptSelector(store: s)
        #expect(selector.isPrerequisiteBlocked(blocked))
        #expect(!selector.isPracticable(foundation, at: now), "content of a blocked concept waits")
        #expect(selector.isPracticable(captured, at: now), "a word the learner met is theirs to practice")
        #expect(selector.isPracticable(spoken, at: now))
        #expect(selector.eligibleConcepts(now: now).map(\.id) == ["base"], "the blocked concept still cannot be a lesson target")
    }

    // MARK: - E20 Level-aware reading shelf

    private func piece(_ id: String, level: CEFRLevel, minutes: Int = 5) -> ReadingPiece {
        ReadingPiece(id: id, title: id, subtitle: "", category: .story, region: .france, difficulty: .easy,
                     minutes: minutes, level: level, body: "")
    }

    @Test func bridgeStateShowsOnlyShortLowLevelPieces() {
        let library = [piece("b2", level: .B2), piece("a2-long", level: .A2, minutes: 8), piece("a1", level: .A1), piece("a2", level: .A2, minutes: 3), piece("c1", level: .C1)]
        let bridge = ReadingShelf.pieces(for: .A1, readiness: .foundation, from: library)
        #expect(bridge.map(\.id) == ["a1", "a2", "a2-long"])
        #expect(bridge.allSatisfy { ReadingShelf.rank($0.level) <= ReadingShelf.rank(Tuning.readingBridgeMaxLevel) })
        #expect(ReadingShelf.pieces(for: .A1, readiness: .locked, from: library).isEmpty)
    }

    @Test func unlockedShelfSortsByClosenessToTheLearner() {
        let library = [piece("c1", level: .C1), piece("a1", level: .A1), piece("b2", level: .B2), piece("b1", level: .B1), piece("a2", level: .A2)]
        #expect(ReadingShelf.pieces(for: .B1, readiness: .unlocked, from: library).map(\.id) == ["b1", "a2", "b2", "a1", "c1"])
        #expect(ReadingShelf.fit(of: .B2, for: .B1) == .atLevel)
        #expect(ReadingShelf.fit(of: .C1, for: .B1) == .stretch)
        #expect(ReadingShelf.fit(of: .A1, for: .B1) == .easy)
    }

    @Test func readabilityEstimateTracksSentenceLength() {
        let simple = "Je vais au café. Il fait beau. J'aime le pain. Marie est là. Nous parlons."
        #expect(ReadingShelf.rank(ReadingLevelEstimator.estimate(simple)) <= ReadingShelf.rank(.A2))
        let dense = "Les avancées technologiques récentes bouleversent profondément de nombreux secteurs économiques traditionnels, tandis que certaines entreprises françaises développent des outils particulièrement innovants qui simplifient considérablement le travail quotidien des salariés."
        #expect(ReadingShelf.rank(ReadingLevelEstimator.estimate(dense)) >= ReadingShelf.rank(.B2))
        #expect(ReadingLevelEstimator.estimate("") == .B1, "no text → the honest default, labelled as an estimate by the caller")
    }

    // MARK: - E22 A live article's region comes from its source

    @Test func liveRegionIsDerivedFromTheSourceAndNeverGuessedAsEurope() {
        #expect(ReadRegionGroup.forSource(name: "RFI Afrique", url: "https://www.rfi.fr/fr/afrique/x") == .africa)
        #expect(ReadRegionGroup.forSource(name: "Seneweb", url: "https://www.seneweb.sn/news/x") == .africa)
        #expect(ReadRegionGroup.forSource(name: "Radio-Canada", url: "https://ici.radio-canada.ca/x") == .canada)
        #expect(ReadRegionGroup.forSource(name: "Le Devoir", url: nil) == .canada)
        #expect(ReadRegionGroup.forSource(name: "Le Nouvelliste", url: "https://lenouvelliste.ht/x") == .caribbean)
        #expect(ReadRegionGroup.forSource(name: "Le Monde", url: "https://www.lemonde.fr/x") == .europe)
        #expect(ReadRegionGroup.forSource(name: "RTBF", url: "https://www.rtbf.be/x") == .europe)
        // Nothing to go on → no region at all, so the card claims nothing and the
        // story still shows under "All".
        #expect(ReadRegionGroup.forSource(name: "Sports Daily", url: "https://example.com/x") == nil)
        #expect(ReadRegionGroup.forSource(name: nil, url: nil) == nil)
    }
}
