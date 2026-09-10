//
//  AnswerGraderTests.swift
//  FluentFrenchIOSTests
//
//  Package C part 1 — typed-answer grading (C3) and blanking / highlighting (C1 / C2).
//  The French here is only what the grader needs to be exercised on (apostrophes,
//  articles, accents); nothing is invented as content.
//

import Foundation
import Testing
@testable import FluentFrenchIOS

@MainActor
struct AnswerGraderTests {

    // MARK: Fixtures

    private func gap(_ fr: String, en: String = "x", ex: String = "", blank: String? = nil,
                     alts: [String]? = nil, category: GapCategory = .vocabulary) -> GapItem {
        var g = EngineFixtures.gap("g-\(fr)", concept: nil, category: category)
        g.frenchWord = fr
        g.englishTranslation = en
        g.exampleSentence = ex
        g.blankForm = blank
        g.acceptedAnswers = alts
        return g
    }

    private struct Case {
        let typed: String
        let expected: String
        let gap: GapItem
        let kind: QuestionKind
        let verdict: AnswerVerdict
        let note: String
    }

    // MARK: C3 — grading table

    @Test func gradingTable() {
        let water = gap("l'eau", en: "water")
        let bread = gap("le pain", en: "bread")
        let jai = gap("j'ai", en: "I have", alts: ["ai"], category: .grammar)
        let pupil = gap("élève", en: "pupil")
        let beside = gap("à côté de", en: "beside", category: .phrasing)
        let pair = gap("beau / belle", en: "beautiful")
        let where_ = gap("où", en: "where", category: .grammar)

        let table: [Case] = [
            // apostrophes and articles
            Case(typed: "l'eau", expected: "l'eau", gap: water, kind: .translation, verdict: .correct, note: "exact"),
            Case(typed: "l’eau", expected: "l'eau", gap: water, kind: .translation, verdict: .correct, note: "curly apostrophe"),
            Case(typed: "l`eau", expected: "l'eau", gap: water, kind: .translation, verdict: .correct, note: "grave accent as apostrophe"),
            Case(typed: "eau", expected: "l'eau", gap: water, kind: .translation, verdict: .correct, note: "vocabulary without its article"),
            Case(typed: "  L'EAU  ", expected: "l'eau", gap: water, kind: .translation, verdict: .correct, note: "case and whitespace"),
            Case(typed: "l'eau (f)", expected: "l'eau", gap: water, kind: .translation, verdict: .correct, note: "gender tag stripped"),
            Case(typed: "l' eau", expected: "l'eau", gap: water, kind: .translation, verdict: .correct, note: "space after elision"),
            Case(typed: "leau", expected: "l'eau", gap: water, kind: .translation, verdict: .incorrect, note: "missing apostrophe is wrong"),
            Case(typed: "pain", expected: "le pain", gap: bread, kind: .translation, verdict: .correct, note: "headword without article"),
            Case(typed: "le pain", expected: "le pain", gap: bread, kind: .translation, verdict: .correct, note: "headword with article"),
            Case(typed: "Le pain.", expected: "le pain", gap: bread, kind: .translation, verdict: .correct, note: "trailing full stop"),
            Case(typed: "la pain", expected: "le pain", gap: bread, kind: .translation, verdict: .incorrect, note: "wrong article is wrong"),
            Case(typed: "le pain", expected: "pain", gap: bread, kind: .fillBlank, verdict: .incorrect, note: "an article the sentence already supplies does not fit the blank"),
            Case(typed: "pain!", expected: "pain", gap: bread, kind: .fillBlank, verdict: .correct, note: "trailing bang"),
            // typographic vs straight apostrophe in j'ai, alts
            Case(typed: "j'ai", expected: "j'ai", gap: jai, kind: .translation, verdict: .correct, note: "straight apostrophe"),
            Case(typed: "j’ai", expected: "j'ai", gap: jai, kind: .translation, verdict: .correct, note: "typographic apostrophe"),
            Case(typed: "ai", expected: "j'ai", gap: jai, kind: .translation, verdict: .correct, note: "content alt"),
            Case(typed: "j'ai.", expected: "j'ai", gap: jai, kind: .translation, verdict: .correct, note: "punctuation"),
            Case(typed: "je ai", expected: "j'ai", gap: jai, kind: .translation, verdict: .incorrect, note: "no elision is wrong"),
            Case(typed: "j'ai", expected: "ai", gap: jai, kind: .fillBlank, verdict: .incorrect, note: "grammar is not article-lenient"),
            // accents
            Case(typed: "eleve", expected: "élève", gap: pupil, kind: .translation, verdict: .closeAccents(expected: "élève"), note: "accents dropped"),
            Case(typed: "élève", expected: "élève", gap: pupil, kind: .translation, verdict: .correct, note: "accents right"),
            Case(typed: "Élève", expected: "élève", gap: pupil, kind: .translation, verdict: .correct, note: "capital with accent"),
            Case(typed: "un eleve", expected: "élève", gap: pupil, kind: .translation, verdict: .closeAccents(expected: "élève"), note: "article plus accent slip"),
            Case(typed: "élèves", expected: "élève", gap: pupil, kind: .translation, verdict: .incorrect, note: "plural is wrong"),
            Case(typed: "ou", expected: "où", gap: where_, kind: .translation, verdict: .closeAccents(expected: "où"), note: "où without its accent"),
            Case(typed: "oú", expected: "où", gap: where_, kind: .translation, verdict: .closeAccents(expected: "où"), note: "wrong accent"),
            // whitespace and French punctuation
            Case(typed: "a cote de", expected: "à côté de", gap: beside, kind: .translation, verdict: .closeAccents(expected: "à côté de"), note: "phrase without accents"),
            Case(typed: "à  côté   de", expected: "à côté de", gap: beside, kind: .translation, verdict: .correct, note: "collapsed whitespace"),
            Case(typed: "à côté de !", expected: "à côté de", gap: beside, kind: .translation, verdict: .correct, note: "space before bang"),
            Case(typed: "à côté de\u{202F}!", expected: "à côté de", gap: beside, kind: .translation, verdict: .correct, note: "thin space before bang"),
            Case(typed: "à côté de…", expected: "à côté de", gap: beside, kind: .translation, verdict: .correct, note: "ellipsis"),
            // "a / b" glosses
            Case(typed: "beau", expected: "beau / belle", gap: pair, kind: .translation, verdict: .correct, note: "first side"),
            Case(typed: "belle", expected: "beau / belle", gap: pair, kind: .translation, verdict: .correct, note: "second side"),
            Case(typed: "beau / belle", expected: "beau / belle", gap: pair, kind: .translation, verdict: .correct, note: "both sides"),
            // wrong and empty
            Case(typed: "vin", expected: "l'eau", gap: water, kind: .translation, verdict: .incorrect, note: "a genuinely wrong answer"),
            Case(typed: "", expected: "l'eau", gap: water, kind: .translation, verdict: .incorrect, note: "empty"),
            Case(typed: "   ", expected: "l'eau", gap: water, kind: .translation, verdict: .incorrect, note: "blank"),
        ]
        #expect(table.count >= 25)
        for c in table {
            let verdict = AnswerGrader.grade(typed: c.typed, against: c.gap, expected: c.expected, kind: c.kind)
            #expect(verdict == c.verdict, "\(c.note): typed “\(c.typed)” for “\(c.expected)” → \(verdict)")
        }
    }

    /// lesson-5-4: a headword written with the dictionary's ellipsis ("ne... pas")
    /// is a frame, not a spelling. Nothing on screen asks for the dots, so the
    /// spelling a learner actually types grades correct.
    @Test func ellipsisHeadwordsAcceptTheSpellingWithoutTheDots() {
        let not = gap("ne... pas", en: "not", category: .grammar)
        #expect(AnswerGrader.grade(typed: "ne pas", against: not, expected: "ne... pas", kind: .translation) == .correct)
        #expect(AnswerGrader.grade(typed: "ne... pas", against: not, expected: "ne... pas", kind: .translation) == .correct)
        #expect(AnswerGrader.grade(typed: "NE PAS", against: not, expected: "ne... pas", kind: .translation) == .correct)
        #expect(AnswerGrader.grade(typed: "pas", against: not, expected: "ne... pas", kind: .translation) == .incorrect,
                "half the frame is still half the frame")

        let never = gap("ne... jamais", en: "never", category: .grammar)
        #expect(AnswerGrader.grade(typed: "ne jamais", against: never, expected: "ne... jamais", kind: .translation) == .correct)
        #expect(AnswerGrader.grade(typed: "ne parle pas", against: never, expected: "ne... jamais", kind: .translation) == .incorrect)

        // A leading ellipsis leaves punctuation behind; the remainder is the answer.
        let tag = gap("..., quoi", en: "you know", category: .phrasing)
        #expect(AnswerGrader.grade(typed: "quoi", against: tag, expected: "..., quoi", kind: .translation) == .correct)

        // The collapsed spelling is offered as an accepted alternative, once.
        let forms = AnswerGrader.acceptedForms(for: not, expected: "ne... pas", kind: .translation)
        #expect(forms.contains { $0.normalized == "ne pas" })
        #expect(forms.filter { $0.normalized == "ne pas" }.count == 1)
        #expect(AnswerGrader.ellipsisForms(of: "le pain").isEmpty, "no ellipsis, nothing added")
    }

    /// The headword is accepted for a blank only when it IS the answer (article
    /// leniency). When the item's blank is an inflected form — the conjugation or
    /// agreement the item exists to teach — the dictionary form is wrong.
    @Test func inflectedBlanksDoNotAcceptTheHeadword() {
        let eat = gap("manger", en: "to eat", ex: "On mange à midi.", blank: "mange")
        #expect(AnswerGrader.grade(typed: "mange", against: eat, expected: "mange", kind: .fillBlank) == .correct)
        #expect(AnswerGrader.grade(typed: "manger", against: eat, expected: "mange", kind: .fillBlank) == .incorrect,
                "the infinitive is not the conjugated blank")
        #expect(AnswerGrader.grade(typed: "manger", against: eat, expected: "manger", kind: .translation) == .correct,
                "the headword is still the answer when the headword is asked for")

        let green = gap("vert", en: "green", ex: "La pomme est verte.", blank: "verte")
        #expect(AnswerGrader.grade(typed: "vert", against: green, expected: "verte", kind: .fillBlank) == .incorrect,
                "the masculine form is not the feminine agreement")
        #expect(AnswerGrader.grade(typed: "verte", against: green, expected: "verte", kind: .fillBlank) == .correct)

        // The headword is still the headword — but only where the headword is asked for.
        let bread = gap("le pain", en: "bread", ex: "Je veux du pain.", blank: "pain")
        #expect(AnswerGrader.acceptsHeadword(bread, expected: "pain"))
        #expect(!AnswerGrader.acceptsHeadword(eat, expected: "mange"))
        #expect(AnswerGrader.grade(typed: "le pain", against: bread, expected: "pain", kind: .translation) == .correct)
        // Article leniency stays one-directional for vocabulary.
        let hands = gap("la main", en: "hand", ex: "Lave-toi les mains.", blank: "mains")
        #expect(AnswerGrader.grade(typed: "la main", against: hands, expected: "mains", kind: .fillBlank) == .incorrect)
    }

    /// lesson-6-2: a fill-blank gets NO article leniency in either direction — the
    /// sentence around the blank already supplies (or withholds) the determiner, so
    /// the dictionary headword cannot stand in the hole and is never advertised as
    /// "Also accepted" under it.
    @Test func fillBlankRejectsTheHeadwordsArticle() {
        // "Ma _____ est gentille." — "la mère" would read "Ma la mère est gentille."
        let mother = gap("la mère", en: "mother", ex: "Ma mère est gentille.", blank: "mère")
        #expect(AnswerGrader.grade(typed: "mère", against: mother, expected: "mère", kind: .fillBlank) == .correct)
        #expect(AnswerGrader.grade(typed: "la mère", against: mother, expected: "mère", kind: .fillBlank) == .incorrect)
        #expect(AnswerGrader.acceptedForms(for: mother, expected: "mère", kind: .fillBlank).map { $0.display } == ["mère"],
                "nothing else is offered under “Also accepted”")
        // The same word asked as a translation keeps its leniency.
        #expect(AnswerGrader.grade(typed: "la mère", against: mother, expected: "mère", kind: .translation) == .correct)
        #expect(AnswerGrader.acceptedForms(for: mother, expected: "mère", kind: .translation).map { $0.display } == ["mère", "la mère"])

        // …and the other way: "Je bois de _____." wants "l'eau", not "eau".
        let water = gap("l'eau", en: "water", ex: "Je bois de l'eau.", blank: "l'eau")
        #expect(AnswerGrader.grade(typed: "l'eau", against: water, expected: "l'eau", kind: .fillBlank) == .correct)
        #expect(AnswerGrader.grade(typed: "eau", against: water, expected: "l'eau", kind: .fillBlank) == .incorrect)
        #expect(AnswerGrader.grade(typed: "eau", against: water, expected: "l'eau", kind: .translation) == .correct)
        // An accent slip inside the blank is still an accent slip, not a miss.
        let pupil = gap("l'élève", en: "the pupil", ex: "Je vois l'élève.", blank: "l'élève")
        #expect(AnswerGrader.grade(typed: "l'eleve", against: pupil, expected: "l'élève", kind: .fillBlank)
                == .closeAccents(expected: "l'élève"))
    }

    /// An accent-stripped spelling in the content's `alts` is an accent slip, not a
    /// second correct spelling: it grades `.closeAccents` (a `.hard` success that
    /// says "check the accents") and is never advertised under "Also accepted",
    /// where it would present "ou" as a spelling of "où".
    @Test func accentStrippedAlternativesAreAccentSlipsNotSpellings() {
        let where_ = gap("où", en: "where", alts: ["ou"], category: .grammar)
        #expect(AnswerGrader.grade(typed: "ou", against: where_, expected: "où", kind: .translation)
                == .closeAccents(expected: "où"))
        #expect(AnswerGrader.acceptedForms(for: where_, expected: "où", kind: .translation).map { $0.normalized } == ["où"])

        let mother = gap("mère", en: "mother", alts: ["mere"])
        #expect(AnswerGrader.grade(typed: "mere", against: mother, expected: "mère", kind: .translation)
                == .closeAccents(expected: "mère"))

        // A real alternative — not the same word with its accents dropped — survives.
        let please = gap("s'il vous plaît", en: "please", alts: ["svp", "s'il vous plait"], category: .phrasing)
        let forms = AnswerGrader.acceptedForms(for: please, expected: "s'il vous plaît", kind: .translation).map { $0.normalized }
        #expect(forms.contains("svp"))
        #expect(!forms.contains("s'il vous plait"), "an accent variant is not a second spelling")
        #expect(AnswerGrader.grade(typed: "svp", against: please, expected: "s'il vous plaît", kind: .translation) == .correct)
    }

    /// lesson-7-3: an alternative that is the expected answer with a separator missing
    /// — an apostrophe, a hyphen, the space around them, a trailing comma — exists so a
    /// phone keyboard is forgiven. It is accepted when typed and never printed back
    /// under "Also accepted", where it would show a beginner "c est" as a second way to
    /// write "c'est".
    @Test func separatorOnlyAlternativesAreAcceptedButNeverAdvertised() {
        let itIs = gap("c'est", en: "it is", alts: ["c est"], category: .phrasing)
        #expect(AnswerGrader.grade(typed: "c est", against: itIs, expected: "c'est", kind: .translation) == .correct)
        #expect(AnswerGrader.displayAlternatives(for: itIs, expected: "c'est", kind: .translation).isEmpty)

        let today = gap("aujourd'hui", en: "today", alts: ["aujourd hui"])
        #expect(AnswerGrader.grade(typed: "aujourd hui", against: today, expected: "aujourd'hui", kind: .translation) == .correct)
        #expect(AnswerGrader.displayAlternatives(for: today, expected: "aujourd'hui", kind: .translation).isEmpty)

        // A hyphen dropped (with or without the accent) is the same spelling typed loosely.
        let overThere = gap("là-bas", en: "over there", alts: ["là bas", "la bas"])
        #expect(AnswerGrader.grade(typed: "là bas", against: overThere, expected: "là-bas", kind: .translation) == .correct)
        #expect(AnswerGrader.displayAlternatives(for: overThere, expected: "là-bas", kind: .translation).isEmpty)

        // A trailing comma in a filler's alt is punctuation, not a spelling.
        let soAnyway = gap("du coup", en: "so", alts: ["du coup,"], category: .phrasing)
        #expect(AnswerGrader.displayAlternatives(for: soAnyway, expected: "du coup", kind: .translation).isEmpty)

        // A genuinely different way to write it still shows, and only typed formats
        // have anything to advertise at all.
        let please = gap("s'il vous plaît", en: "please", alts: ["svp", "s'il vous plait"], category: .phrasing)
        #expect(AnswerGrader.displayAlternatives(for: please, expected: "s'il vous plaît", kind: .translation) == ["svp"])
        #expect(AnswerGrader.displayAlternatives(for: please, expected: "s'il vous plaît", kind: .multipleChoice).isEmpty)

        // The article form of a vocabulary headword is a real second answer, not a slip.
        let bread = gap("le pain", en: "bread")
        #expect(AnswerGrader.displayAlternatives(for: bread, expected: "pain", kind: .translation) == ["le pain"])
    }

    /// `alts` are authored for the translation format ("parle" for "je parle"):
    /// dropping or adding a word the sentence around the blank already supplies
    /// makes the filled sentence ungrammatical, so it is neither accepted in a
    /// fill-blank nor listed as "Also accepted" there.
    @Test func fillBlankAlternativesMustFitTheBlank() {
        // "Au travail, _____ anglais." — "parle" alone leaves the subject out.
        let speak = gap("je parle", en: "I speak", ex: "Au travail, je parle anglais.",
                        blank: "je parle", alts: ["parle"], category: .grammar)
        #expect(AnswerGrader.grade(typed: "parle", against: speak, expected: "je parle", kind: .fillBlank) == .incorrect)
        #expect(AnswerGrader.acceptedForms(for: speak, expected: "je parle", kind: .fillBlank).map { $0.display } == ["je parle"])
        #expect(AnswerGrader.grade(typed: "parle", against: speak, expected: "je parle", kind: .translation) == .correct,
                "the same alternative is still right when the item asks for the headword")

        // An elision counts as two words: "adore" is not "j'adore".
        let adore = gap("j'adore", en: "I love", ex: "J'adore le café.", blank: "j'adore",
                        alts: ["adore"], category: .grammar)
        #expect(AnswerGrader.grade(typed: "adore", against: adore, expected: "j'adore", kind: .fillBlank) == .incorrect)

        // A same-shape variant — the agreement the learner's own gender needs — stays.
        let went = gap("je suis allé", en: "I went", ex: "Hier, je suis allé au marché.",
                       blank: "suis allé", alts: ["suis allée", "je suis allée"], category: .grammar)
        #expect(AnswerGrader.grade(typed: "suis allée", against: went, expected: "suis allé", kind: .fillBlank) == .correct)
        #expect(AnswerGrader.grade(typed: "je suis allée", against: went, expected: "suis allé", kind: .fillBlank) == .incorrect)
        #expect(AnswerGrader.acceptedForms(for: went, expected: "suis allé", kind: .fillBlank).map { $0.display }
                == ["suis allé", "suis allée"])

        // The dictionary headword is not a filler for the form the item teaches.
        let wash = gap("se laver", en: "to wash", ex: "Je me lave les mains.", blank: "me lave",
                       alts: ["se laver"], category: .grammar)
        #expect(AnswerGrader.grade(typed: "se laver", against: wash, expected: "me lave", kind: .fillBlank) == .incorrect)

        // …and neither are its opening words.
        let teeth = gap("se brosser les dents", en: "to brush one's teeth", ex: "Tu te brosses les dents ?",
                        blank: "te brosses", alts: ["se brosser"], category: .phrasing)
        #expect(AnswerGrader.grade(typed: "se brosser", against: teeth, expected: "te brosses", kind: .fillBlank) == .incorrect)
        #expect(!AnswerGrader.fitsBlank("se brosser", gap: teeth, expected: "te brosses"))

        #expect(AnswerGrader.wordCount("j'ai") == 2 && AnswerGrader.wordCount("suis allé") == 2)
        #expect(AnswerGrader.wordCount("d'habitude,") == 2 && AnswerGrader.wordCount("") == 0)
    }

    /// lesson-8-1: an `alts` entry that is exactly the item's own BLANK form was
    /// authored to fill a hole, not to translate the headword. Accepting "mains" for
    /// "Translate to French: hand" — and printing "Also accepted: mains" under it —
    /// teaches the plural as the translation of the singular.
    @Test func blankFormAlternativesAreOnlyAcceptedInsideTheBlank() {
        let hand = gap("la main", en: "hand", ex: "Lave-toi les mains.", blank: "mains", alts: ["mains"])
        #expect(AnswerGrader.grade(typed: "mains", against: hand, expected: "mains", kind: .fillBlank) == .correct)
        #expect(AnswerGrader.grade(typed: "mains", against: hand, expected: "la main", kind: .translation) == .incorrect,
                "the plural in the sentence is not the translation of “hand”")
        #expect(AnswerGrader.displayAlternatives(for: hand, expected: "la main", kind: .translation).isEmpty,
                "“Also accepted: mains” under “hand” advertised the wrong form")
        #expect(AnswerGrader.displayAlternatives(for: hand, expected: "main", kind: .translation) == ["la main"],
                "the article form is still a second answer")
        #expect(AnswerGrader.grade(typed: "la main", against: hand, expected: "la main", kind: .translation) == .correct)
        #expect(AnswerGrader.isBlankOnlyForm("mains", gap: hand))

        // The agreement an item exists to teach is not a second translation either.
        let green = gap("vert", en: "green", ex: "La pomme est verte.", blank: "verte", alts: ["verte"])
        #expect(AnswerGrader.grade(typed: "verte", against: green, expected: "vert", kind: .translation) == .incorrect)
        #expect(AnswerGrader.grade(typed: "verte", against: green, expected: "verte", kind: .fillBlank) == .correct)

        // …nor is the conjugated frame under a dictionary headword.
        let not = gap("ne... pas", en: "not", ex: "Je ne parle pas anglais.", blank: "ne parle pas",
                      alts: ["ne parle pas"], category: .grammar)
        #expect(AnswerGrader.grade(typed: "ne parle pas", against: not, expected: "ne... pas", kind: .translation) == .incorrect)
        #expect(AnswerGrader.displayAlternatives(for: not, expected: "ne... pas", kind: .translation).isEmpty)
        #expect(AnswerGrader.isBlankOnlyForm("ne parle pas", gap: not))
        #expect(AnswerGrader.grade(typed: "ne parle pas", against: not, expected: "ne parle pas", kind: .fillBlank) == .correct)

        // A blank form that IS the headword (modulo its article) is the same word,
        // so article leniency and its "Also accepted" line survive untouched.
        let bread = gap("le pain", en: "bread", ex: "J'aime le pain.", blank: "pain", alts: ["pain"])
        #expect(!AnswerGrader.isBlankOnlyForm("pain", gap: bread))
        #expect(AnswerGrader.grade(typed: "pain", against: bread, expected: "le pain", kind: .translation) == .correct)
        #expect(AnswerGrader.displayAlternatives(for: bread, expected: "pain", kind: .translation) == ["le pain"])

        // An alternative that is not the blank form is untouched in either format.
        let went = gap("je suis allé", en: "I went", ex: "Hier, je suis allé au marché.",
                       blank: "suis allé", alts: ["suis allée", "je suis allée"], category: .grammar)
        #expect(AnswerGrader.grade(typed: "je suis allée", against: went, expected: "je suis allé", kind: .translation) == .correct)
    }

    /// lesson-8-3: a fill-blank prompt shows exactly one hole, spelled the way the
    /// app spells it — the screen has one text field.
    @Test func blankRunsCountTheHolesInAPrompt() {
        #expect(AnswerGrader.hasSingleBlank("Je _____ anglais."))
        #expect(!AnswerGrader.hasSingleBlank("Je _____ anglais _____ ici."))
        #expect(!AnswerGrader.hasSingleBlank("Je parle anglais."))
        #expect(!AnswerGrader.hasSingleBlank("Je ___ anglais."), "a short run is not the app's blank")
        #expect(!AnswerGrader.hasSingleBlank("Je ______ anglais."), "nor is a long one")
        #expect(AnswerGrader.blankRuns(in: "a __ b _____ c_") == ["__", "_____"])
        #expect(AnswerGrader.blankRuns(in: "").isEmpty)
    }

    /// Options are compared with their parenthetical tag: the tag is the whole
    /// point of "the (masculine singular)" vs "the (feminine singular)".
    @Test func optionMatchingKeepsParentheticalTags() {
        #expect(AnswerGrader.optionMatches("the (masculine singular)", "the (masculine singular)"))
        #expect(AnswerGrader.optionMatches("  THE (masculine singular) ", "the (masculine singular)"))
        #expect(!AnswerGrader.optionMatches("the (feminine singular)", "the (masculine singular)"))
        #expect(!AnswerGrader.optionMatches("the (plural)", "the (masculine singular)"))
        #expect(!AnswerGrader.optionMatches("the", "the (masculine singular)"))
        #expect(AnswerGrader.optionMatches("bread", "bread"), "an untagged gloss still matches")
        #expect(!AnswerGrader.optionMatches("", "bread"))
        #expect(AnswerGrader.normalize("the (masculine singular)", keepingTags: true) == "the (masculine singular)")
        #expect(AnswerGrader.normalize("the (masculine singular)") == "the", "typed grading still strips tags")
    }

    @Test func accentSlipCountsAsCorrectButGradesHard() {
        let verdict = AnswerVerdict.closeAccents(expected: "élève")
        #expect(verdict.countsAsCorrect && !verdict.isExact)
        #expect(verdict.reviewGrade(format: .translation, firstTry: true) == .hard)
        #expect(verdict.message == "Almost — check the accents: élève")
        #expect(AnswerVerdict.correct.reviewGrade(format: .translation, firstTry: true) == .easy)
        #expect(AnswerVerdict.correct.reviewGrade(format: .fillBlank, firstTry: false) == .good)
        #expect(AnswerVerdict.incorrect.reviewGrade(format: .fillBlank, firstTry: true) == .again)
        #expect(!AnswerVerdict.incorrect.countsAsCorrect && AnswerVerdict.incorrect.message == nil)
    }

    @Test func normalisationFoldsQuotesTagsAndPunctuation() {
        #expect(AnswerGrader.normalize("  C’est “ça” !  ") == "c'est \"ça\"")
        #expect(AnswerGrader.normalize("l'eau (f)") == "l'eau")
        #expect(AnswerGrader.normalize("bonjour (formal)…") == "bonjour")
        #expect(AnswerGrader.normalize("e\u{0301}le\u{0300}ve") == "élève", "NFC")
        #expect(AnswerGrader.fold("Élève") == "eleve")
        #expect(AnswerGrader.fold("cœur") == "coeur")
        #expect(AnswerGrader.strippingArticle("de la crème") == "crème")
        #expect(AnswerGrader.strippingArticle("les") == nil, "an article alone is not stripped")
        #expect(AnswerGrader.strippingArticle("lesquels") == nil, "a word starting like an article is not an article")
    }

    // MARK: C1 / C2 — blanking and highlighting

    @Test func blankingRequiresExactlyOneWholeWordOccurrence() {
        #expect(AnswerGrader.blankedPrompt(for: gap("vert", ex: "l'herbe verte")) == nil, "verte is not vert")
        #expect(AnswerGrader.blankedPrompt(for: gap("cent", ex: "cent pour cent")) == nil, "two occurrences")
        #expect(AnswerGrader.blankedPrompt(for: gap("le pain", ex: "Je veux du pain.")) == "Je veux du _____.",
                "the headword's article is dropped for the fallback form")
        #expect(AnswerGrader.blankedPrompt(for: gap("le pain", ex: "Je veux du pain.", blank: "du pain")) == "Je veux _____.",
                "content blankForm wins over the headword")
        #expect(AnswerGrader.blankedPrompt(for: gap("l'", ex: "J'aime l'école.", blank: "l'")) == "J'aime _____école.",
                "an elision form may be followed by a letter")
        #expect(AnswerGrader.blankedPrompt(for: gap("bonjour", ex: "Bonjour, Marie !")) == "_____, Marie !",
                "case-insensitive fallback when no exact match")
        #expect(AnswerGrader.blankedPrompt(for: gap("le", ex: "Le chat et le chien.", blank: "le")) == "Le chat et _____ chien.",
                "an exact single match wins before the case-insensitive pass")
        #expect(AnswerGrader.blankedPrompt(for: gap("le", ex: "Le chat et le chien et le chat.", blank: "le")) == nil,
                "two exact matches → no blank")
        #expect(AnswerGrader.blankedPrompt(for: gap("chat", ex: "")) == nil, "no sentence")
        #expect(AnswerGrader.blankedPrompt(for: gap("chat", ex: "Le chaton dort.")) == nil, "substring only")
    }

    /// A captured phrase whose example IS the phrase (Converse / Speak / listening
    /// corrections set `exampleSentence == frenchWord`) must never become a prompt
    /// that is nothing but the blank token.
    @Test func blankingNeedsSomeSentenceAroundTheBlank() {
        let phrase = "Je voudrais un café"
        #expect(AnswerGrader.blankedPrompt(for: gap(phrase, ex: phrase)) == nil, "the match covers the whole sentence")
        #expect(AnswerGrader.highlightRange(in: phrase, for: gap(phrase, ex: phrase)) == nil, "highlight shares the rule")
        #expect(AnswerGrader.blankedPrompt(for: gap(phrase, ex: "Je voudrais un café !")) == nil,
                "trailing punctuation alone is not context")
        #expect(AnswerGrader.blankedPrompt(for: gap("Un café", ex: "un café.", blank: "Un café")) == nil,
                "the case-insensitive pass applies the same rule")
        #expect(AnswerGrader.blankedPrompt(for: gap("Je voudrais", ex: phrase, blank: "Je voudrais")) == "_____ un café",
                "a phrase inside a longer sentence still blanks")
        #expect(AnswerGrader.highlightRange(of: "café", in: "café") == nil)
        let two = "Un café"
        #expect(AnswerGrader.leavesContext(two.startIndex..<two.index(two.startIndex, offsetBy: 2), in: two))
        #expect(!AnswerGrader.leavesContext(two.startIndex..<two.endIndex, in: two))
    }

    @Test func highlightSharesTheBlankingRule() throws {
        let g = gap("le pain", ex: "Je veux du pain.")
        let range = try #require(AnswerGrader.highlightRange(in: g.exampleSentence, for: g))
        #expect(String(g.exampleSentence[range]) == "pain")
        #expect(AnswerGrader.highlightRange(in: "cent pour cent", for: gap("cent", ex: "cent pour cent")) == nil)
        #expect(AnswerGrader.highlightRange(in: "l'herbe verte", for: gap("vert", ex: "l'herbe verte")) == nil)
        #expect(AnswerGrader.wholeWordRanges(of: "a", in: "Elle a un chat.", caseInsensitive: false).count == 1)
    }

    /// The bundled content file, located from the source tree (Xcode) or the
    /// harness's `Resources/` copy (Linux).
    private func bundledContentData() -> Data? {
        let here = URL(fileURLWithPath: #filePath)
        let candidates = [
            here.deletingLastPathComponent().deletingLastPathComponent()
                .appendingPathComponent("FluentFrenchIOS/Resources/FoundationContent.json"),
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("Resources/FoundationContent.json"),
        ]
        for url in candidates {
            if let data = try? Data(contentsOf: url) { return data }
        }
        return nil
    }

    @Test func everyTestableShippedItemBlanks() throws {
        let data = try #require(bundledContentData(), "FoundationContent.json must be reachable from the test host")
        let file = try FoundationContentLoader.decode(data)
        let gaps = FoundationContentLoader.gaps(from: file, now: EngineFixtures.now)
        #expect(gaps.count > 500)
        var blanked = 0
        for gap in gaps where gap.isTestable {
            let prompt = AnswerGrader.blankedPrompt(for: gap)
            #expect(prompt != nil, "\(gap.id) “\(gap.frenchWord)”: blank “\(gap.blankForm ?? "")” must occur exactly once in “\(gap.exampleSentence)”")
            #expect(prompt?.contains(AnswerGrader.blankToken) == true)
            #expect(AnswerGrader.highlightRange(in: gap.exampleSentence, for: gap) != nil)
            #expect(LessonScheduler.isBlankable(gap))
            if prompt != nil { blanked += 1 }
        }
        #expect(blanked == gaps.filter { $0.isTestable }.count)
        // And the blank form itself grades as correct against the fill-blank question.
        for gap in gaps.prefix(60) where gap.isTestable {
            let expected = AnswerGrader.blankForm(for: gap)
            #expect(AnswerGrader.grade(typed: expected, against: gap, expected: expected, kind: .fillBlank) == .correct, "\(gap.id)")
        }
    }

    /// lesson-8-1 over the shipped content: many items carry an `alts` entry that is
    /// exactly their own blank ("mains" under "la main", "verte" under "vert"). It
    /// fills that item's hole and nothing else — asked for the headword, it is a
    /// miss, it is never advertised as "Also accepted", and the AI writer may not
    /// build a translation on it.
    @Test func shippedBlankFormsAreNeverTranslationsOfTheirHeadword() throws {
        let data = try #require(bundledContentData(), "FoundationContent.json must be reachable from the test host")
        let file = try FoundationContentLoader.decode(data)
        let gaps = FoundationContentLoader.gaps(from: file, now: EngineFixtures.now)
        var checked = 0
        for gap in gaps where gap.isTestable && !gap.frenchWord.contains("/") {
            let blank = AnswerGrader.blankForm(for: gap)
            guard AnswerGrader.isBlankOnlyForm(blank, gap: gap) else { continue }
            checked += 1
            #expect(AnswerGrader.grade(typed: blank, against: gap, expected: gap.frenchWord, kind: .translation) == .incorrect,
                    "\(gap.id): “\(blank)” graded as the translation of “\(gap.frenchWord)”")
            #expect(!AnswerGrader.displayAlternatives(for: gap, expected: gap.frenchWord, kind: .translation)
                .contains { AnswerGrader.normalize($0) == AnswerGrader.normalize(blank) },
                    "\(gap.id): “Also accepted: \(blank)” under “\(gap.frenchWord)”")
            #expect(!LessonQuestionParser.isContentForm(blank, of: gap, kind: .translation),
                    "\(gap.id): an AI translation could state “\(blank)”")
            // …and it still answers its own blank.
            #expect(AnswerGrader.grade(typed: blank, against: gap, expected: blank, kind: .fillBlank) == .correct, "\(gap.id)")
        }
        #expect(checked > 50, "the content carries items whose blank is a different form (\(checked))")
    }

    // MARK: lesson-9-3 — article leniency is decided by the item, not the skill

    /// The category comes from the SKILL, so an ordinary articled noun that happens to
    /// sit in a pronunciation or register skill ("le riz" in guttural-r) used to lose
    /// article leniency and a learner typing "riz" for "rice" was graded wrong. The
    /// article stays required where it is the point: every grammar item, and any item
    /// whose English gloss names a determiner of its own ("the friends" — the liaison
    /// item — "some bread", "a friend").
    @Test func articleLeniencyFollowsTheItemNotTheSkill() {
        let rice = gap("le riz", en: "rice", category: .pronunciation)
        let france = gap("la France", en: "France", category: .pronunciation)
        let work = gap("le boulot", en: "work (informal)", category: .register)
        let friends = gap("les amis", en: "the friends", category: .pronunciation)
        let sea = gap("la mer", en: "the sea", category: .pronunciation)
        let mondays = gap("le lundi", en: "on Mondays", category: .grammar)
        let someBread = gap("du pain", en: "some bread", category: .grammar)

        #expect(AnswerGrader.grade(typed: "riz", against: rice, expected: "le riz", kind: .translation) == .correct)
        #expect(AnswerGrader.grade(typed: "le riz", against: rice, expected: "le riz", kind: .translation) == .correct)
        #expect(AnswerGrader.grade(typed: "France", against: france, expected: "la France", kind: .translation) == .correct)
        #expect(AnswerGrader.grade(typed: "boulot", against: work, expected: "le boulot", kind: .translation) == .correct)
        #expect(AnswerGrader.grade(typed: "la riz", against: rice, expected: "le riz", kind: .translation) == .incorrect,
                "leniency drops the article, it never swaps it")
        #expect(AnswerGrader.grade(typed: "amis", against: friends, expected: "les amis", kind: .translation) == .incorrect,
                "“the friends” asks for the article the liaison item teaches")
        #expect(AnswerGrader.grade(typed: "mer", against: sea, expected: "la mer", kind: .translation) == .incorrect)
        #expect(AnswerGrader.grade(typed: "lundi", against: mondays, expected: "le lundi", kind: .translation) == .incorrect,
                "grammar keeps its determiner: “lundi” is not “on Mondays”")
        #expect(AnswerGrader.grade(typed: "pain", against: someBread, expected: "du pain", kind: .translation) == .incorrect)
        // A fill-blank is still never lenient: the sentence around the hole supplies
        // the determiner.
        var blanked = rice
        blanked.blankForm = "riz"
        blanked.exampleSentence = "Le riz est chaud."
        #expect(AnswerGrader.grade(typed: "le riz", against: blanked, expected: "riz", kind: .fillBlank) == .incorrect)

        #expect(AnswerGrader.isArticleLenient(rice) && AnswerGrader.isArticleLenient(work))
        #expect(!AnswerGrader.isArticleLenient(friends) && !AnswerGrader.isArticleLenient(mondays))
        #expect(AnswerGrader.isArticleLenient(gap("le pain", en: "the bread")), "vocabulary is lenient as before")
        #expect(!AnswerGrader.isArticleLenient(gap("parler", en: "to speak", category: .pronunciation)),
                "an item with no article of its own has nothing to be lenient about")
        #expect(AnswerGrader.glossCarriesDeterminer("the sea") && AnswerGrader.glossCarriesDeterminer("a friend (male)"))
        #expect(!AnswerGrader.glossCarriesDeterminer("cats (in general)") && !AnswerGrader.glossCarriesDeterminer("rice"))
    }

    // MARK: lesson-9-1 — a hint that spells the answer is not a hint

    @Test func aHintThatSpellsTheAnswerIsSuppressed() {
        #expect(AnswerGrader.hintRevealsAnswer("The train is late.", answer: "train"))
        #expect(AnswerGrader.hintRevealsAnswer("My parents live here.", answer: "parents"))
        #expect(AnswerGrader.hintRevealsAnswer("Why is he looking at me?", answer: "me"))
        #expect(AnswerGrader.hintRevealsAnswer("She has a sister.", answer: "a"))
        #expect(AnswerGrader.hintRevealsAnswer("She drinks tea in the evening.", answer: "thé"),
                "accents folded: typing the English “the” already grades close-accents")
        #expect(!AnswerGrader.hintRevealsAnswer("It is three o'clock.", answer: "trois"))
        #expect(!AnswerGrader.hintRevealsAnswer("The trainer is late.", answer: "train"), "whole words only")
        #expect(!AnswerGrader.hintRevealsAnswer("", answer: "train") && !AnswerGrader.hintRevealsAnswer("x", answer: " "))
        #expect(AnswerGrader.safeHint("The train is late.", answer: "train") == nil)
        #expect(AnswerGrader.safeHint("  It is three o'clock. ", answer: "trois") == "It is three o'clock.")
        #expect(AnswerGrader.safeHint("   ", answer: "trois") == nil)
    }

    /// Over the shipped content: no fill-blank ever ships a hint that contains the
    /// French form its blank is asking for.
    @Test func noShippedFillBlankHintContainsItsOwnAnswer() throws {
        let data = try #require(bundledContentData(), "FoundationContent.json must be reachable from the test host")
        let file = try FoundationContentLoader.decode(data)
        let gaps = FoundationContentLoader.gaps(from: file, now: EngineFixtures.now)
        var scheduler = LessonSchedulerConfig.tuning
        scheduler.seed = 11
        let builder = LessonScheduler(config: scheduler)
        var rng = LessonRandom(seed: 11)
        var asked = 0
        for gap in gaps where LessonScheduler.isBlankable(gap) {
            guard let q = builder.question(for: gap, kind: .fillBlank, pool: [gap], optionCount: 4, rng: &rng),
                  q.kind == .fillBlank else { continue }
            asked += 1
            #expect(!AnswerGrader.hintRevealsAnswer(q.hint ?? "", answer: q.correctAnswer),
                    "\(gap.id): the hint “\(q.hint ?? "")” spells “\(q.correctAnswer)”")
        }
        #expect(asked > 100, "the content ships fill-blanks (\(asked))")
    }
}
