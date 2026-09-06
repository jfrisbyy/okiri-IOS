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
            Case(typed: "le pain", expected: "pain", gap: bread, kind: .fillBlank, verdict: .correct, note: "article added to a bare blank"),
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
}
