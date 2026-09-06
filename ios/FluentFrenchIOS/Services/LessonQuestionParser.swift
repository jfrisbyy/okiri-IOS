//
//  LessonQuestionParser.swift
//  FluentFrenchIOS
//
//  Turns the AI question writer's reply into validated `LessonQuestion`s (C7 / C8).
//  Pure string / JSON logic with no networking, so it compiles in the headless
//  harness; `LessonService` owns the request and calls this on the reply.
//
//  Rules: markdown fences and chatter around the JSON are tolerated; a question
//  without a usable `wordIndex` is rejected; true/false answers must be one of
//  true / false / vrai / faux (anything else rejects the question); multiple
//  choice options are matched case-insensitively and the correct option is
//  always kept when the list is trimmed to `optionCount`.
//
//  The model never writes the truth: a question is only accepted when its answer
//  is the gap's OWN meaning (multiple choice) or one of the gap's own accepted
//  French forms (fill-blank / translation). Anything else is rejected and the gap
//  falls back to its validated, content-derived local question.
//

import Foundation

nonisolated enum LessonQuestionParser {

    /// The writer's raw reply, decoded and validated.
    struct Batch {
        var questions: [LessonQuestion] = []
        /// Questions the reply contained that failed validation.
        var rejected: Int = 0
        /// Accepted questions per gap id.
        var countsByGap: [String: Int] = [:]

        /// Every gap has at least `target` accepted questions.
        func covers(_ gaps: [GapItem], target: Int) -> Bool {
            gaps.allSatisfy { (countsByGap[$0.id] ?? 0) >= target }
        }

        /// Gaps with fewer than `target` accepted questions.
        func gapsShort(of target: Int, in gaps: [GapItem]) -> [GapItem] {
            gaps.filter { (countsByGap[$0.id] ?? 0) < target }
        }
    }

    /// True/false whitelist: anything else is not an answer.
    static func trueFalseValue(_ raw: String) -> Bool? {
        switch AnswerGrader.normalize(raw) {
        case "true", "vrai": return true
        case "false", "faux": return false
        default: return nil
        }
    }

    /// Whether an AI-written English answer is the gap's own meaning: the same
    /// gloss, or one side of an "a / b" gloss. Parenthetical tags are kept, so
    /// "the" is not accepted for "the (masculine singular)".
    static func matchesGloss(_ answer: String, of gap: GapItem) -> Bool {
        let given = LessonScheduler.distractorSides(of: answer)
        guard !given.isEmpty else { return false }
        return !given.isDisjoint(with: LessonScheduler.distractorSides(of: gap.englishTranslation))
    }

    /// The two halves of a MEANING claim — `“le pain” means “bread”`, `"le pain" = "bread"`,
    /// `« le pain » veut dire « bread »` — or nil when the statement is not one.
    ///
    /// Only double-quote-style marks delimit the halves, so a French elision (`l'eau`)
    /// is never read as a quote, and the words BETWEEN the two halves must say
    /// "means" (or an equivalent): `“le pain” is the opposite of “bread”` is not a
    /// meaning claim and must not be graded as one.
    static func meaningClaim(in statement: String) -> (french: String, english: String)? {
        let marks: Set<Character> = ["\"", "“", "”", "«", "»", "„", "‟"]
        let parts = statement.split(omittingEmptySubsequences: false, whereSeparator: { marks.contains($0) })
        guard parts.count >= 4 else { return nil }
        let french = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
        let english = parts[3].trimmingCharacters(in: .whitespacesAndNewlines)
        guard !french.isEmpty, !english.isEmpty else { return nil }
        let connector = AnswerGrader.normalize(String(parts[2]))
        guard meaningConnectors.contains(connector) else { return nil }
        return (french, english)
    }

    /// What the words between the two halves of a meaning claim may say — the whole
    /// connector, not a substring of it, so "is the opposite meaning of" is not read
    /// as "means".
    /// Only explicit meaning verbs: `“le pain” is “masculine”` is a gender claim the
    /// content cannot settle, and reading its "is" as "means" would grade a true
    /// statement False.
    private static let meaningConnectors: Set<String> = ["means", "mean", "means:", "is the english for",
                                                         "is english for", "translates to", "translates as",
                                                         "veut dire", "signifie", "="]

    /// Whether an English half is CLEARLY a different meaning from the gap's gloss:
    /// it shares no content word with it.
    ///
    /// A meaning claim is settled as FALSE only on this. "the bread" against the gloss
    /// "bread" is a restatement the content cannot adjudicate, and grading it False
    /// would teach the learner that a correct meaning is wrong.
    static func isClearlyDifferentMeaning(_ english: String, from gloss: String) -> Bool {
        let claimed = meaningWords(english), own = meaningWords(gloss)
        guard !claimed.isEmpty, !own.isEmpty else { return false }
        return claimed.isDisjoint(with: own)
    }

    /// The content words of a gloss, folded — articles and other function words carry
    /// no meaning for this comparison.
    private static func meaningWords(_ s: String) -> Set<String> {
        let stop: Set<String> = ["the", "a", "an", "to", "of", "some", "any", "is", "it", "be", "and", "or"]
        let words = AnswerGrader.fold(AnswerGrader.normalize(s))
            .split(whereSeparator: { !$0.isLetter })
            .map(String.init)
            .filter { !stop.contains($0) }
        return Set(words)
    }

    /// Whether an AI-written French answer is a form the content already carries:
    /// the headword, the blank form, or a content `acceptedAnswers` alternative.
    /// The model may write a new sentence, never a new answer.
    ///
    /// A FILL-BLANK is stricter: the answer has to be able to stand in a blank, so
    /// only the content's `blankForm` (and alternatives that fit it) count. The
    /// prompt the model is given carries the dictionary headword — "ne... pas",
    /// "je suis" — and answering with it would build a question whose stated answer
    /// cannot go in its own sentence ("Je _____ anglais." → "Je ne... pas anglais.").
    /// `acceptedForms` still admits the headword when the blank IS the headword
    /// modulo its article ("le pain" / "pain"), which is the only case it fits.
    static func isContentForm(_ answer: String, of gap: GapItem, kind: QuestionKind) -> Bool {
        let target = AnswerGrader.normalize(answer)
        guard !target.isEmpty else { return false }
        let blankForms = AnswerGrader.acceptedForms(for: gap, expected: AnswerGrader.blankForm(for: gap), kind: kind)
        let forms = kind == .fillBlank
            ? blankForms
            : AnswerGrader.acceptedForms(for: gap, expected: gap.frenchWord, kind: kind) + blankForms
        return forms.contains { $0.normalized == target }
    }

    /// The JSON object inside a possibly chatty reply: a fenced ```json block
    /// first, else the outermost braces.
    static func extractJSON(from raw: String) -> String? {
        if let fenced = fencedBlock(in: raw), fenced.contains("{") {
            if let start = fenced.firstIndex(of: "{"), let end = fenced.lastIndex(of: "}"), start <= end {
                return String(fenced[start...end])
            }
        }
        guard let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}"), start <= end else { return nil }
        return String(raw[start...end])
    }

    private static func fencedBlock(in raw: String) -> String? {
        guard let open = raw.range(of: "```") else { return nil }
        var body = raw[open.upperBound...]
        // Drop a language tag ("json") on the opening fence line.
        if let newline = body.firstIndex(of: "\n") {
            body = body[body.index(after: newline)...]
        }
        guard let close = body.range(of: "```") else { return nil }
        return String(body[..<close.lowerBound])
    }

    /// Parse and validate the writer's reply for these gaps (indexed as they were
    /// sent). Questions come back with `source == .ai` and role `.review`; the
    /// scheduler assigns the real role when it merges them.
    static func parse(_ raw: String, gaps: [GapItem], optionCount: Int,
                      minOptions: Int = Tuning.minMultipleChoiceOptions, seed: UInt64? = nil) -> Batch {
        var batch = Batch()
        guard let json = extractJSON(from: raw),
              let data = json.data(using: .utf8),
              let dto = try? JSONDecoder().decode(ReplyDTO.self, from: data) else { return batch }
        var rng = LessonRandom(seed: seed)
        let count = max(minOptions, optionCount)

        for q in dto.questions {
            guard let index = q.wordIndex, gaps.indices.contains(index) else { batch.rejected += 1; continue }
            let gap = gaps[index]
            guard var built = build(q, for: gap, pool: gaps, optionCount: count, minOptions: minOptions, rng: &rng) else {
                batch.rejected += 1
                continue
            }
            built.source = .ai
            batch.questions.append(built)
            batch.countsByGap[gap.id, default: 0] += 1
        }
        return batch
    }

    // MARK: - Per-kind validation

    private static func build(_ q: QuestionDTO, for gap: GapItem, pool: [GapItem], optionCount: Int,
                              minOptions: Int, rng: inout LessonRandom) -> LessonQuestion? {
        let answer = (q.answer ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let prompt = (q.prompt ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let statement = (q.statement ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let explanation = (q.explanation ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let note = explanation.isEmpty ? nil : explanation
        guard !gap.isProbe else { return nil }

        switch (q.kind ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "multiplechoice", "multiple_choice", "mc":
            let correct = answer.isEmpty ? gap.englishTranslation : answer
            // The graded truth is the content's meaning, not the model's.
            guard matchesGloss(correct, of: gap) else { return nil }
            var options = (q.options ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            // Case-insensitive containment; the option's own spelling is the answer.
            // Tags are part of an option ("the (masculine singular)"), so two options
            // that differ only in their tag stay distinct and only one is correct.
            var correctOption = correct
            var others: [String] = []
            var seen = Set<String>()
            var found = false
            for option in options {
                let key = AnswerGrader.normalize(option, keepingTags: true)
                guard !key.isEmpty, seen.insert(key).inserted else { continue }
                if !found, AnswerGrader.optionMatches(option, correct) {
                    correctOption = option
                    found = true
                } else {
                    others.append(option)
                }
            }
            // Trim to the option count, always keeping the correct one.
            others = Array(others.prefix(optionCount - 1))
            let needed = (minOptions - 1) - others.count
            if needed > 0 {
                // Pad from the lesson's own gaps, skipping anything already offered.
                let taken = Set(([correctOption] + others).map { AnswerGrader.fold(AnswerGrader.normalize($0)) })
                let extra = LessonScheduler.smartDistractors(for: gap, from: pool, count: needed + taken.count, rng: &rng)
                    .filter { !taken.contains(AnswerGrader.fold(AnswerGrader.normalize($0))) }
                others.append(contentsOf: extra.prefix(needed))
            }
            guard others.count >= minOptions - 1 else { return nil }
            options = others + [correctOption]
            options.shuffle(using: &rng)
            return LessonQuestion(gap: gap, kind: .multipleChoice,
                                  prompt: prompt.isEmpty ? "What does “\(gap.frenchWord)” mean?" : prompt,
                                  correctAnswer: correctOption, options: options,
                                  hint: nil, explanation: note ?? (gap.explanation.isEmpty ? nil : gap.explanation))

        case "fillblank", "fill_blank", "fill-blank":
            guard gap.isTestable else { return nil }
            let blank = AnswerGrader.blankToken
            if prompt.contains(blank) {
                let expected = answer.isEmpty ? AnswerGrader.blankForm(for: gap) : answer
                guard isContentForm(expected, of: gap, kind: .fillBlank) else { return nil }
                let completed = prompt.replacingOccurrences(of: blank, with: expected)
                // NO hint: the sentence on screen is the model's own, and
                // `exampleTranslation` is the English of the CONTENT's example. Printing
                // it under the field captions one sentence with the translation of a
                // different one, which a beginner reads as the translation of what they
                // are filling in. Only the local branch below, where the prompt IS the
                // content example, may use it.
                return LessonQuestion(gap: gap, kind: .fillBlank, prompt: prompt, correctAnswer: expected,
                                      hint: nil,
                                      explanation: note.map { "\(completed)\n\($0)" } ?? completed)
            }
            // No usable AI sentence: the content's own blank, or nothing.
            guard let local = AnswerGrader.blankedPrompt(for: gap) else { return nil }
            let expected = AnswerGrader.blankForm(for: gap)
            var explanation = gap.exampleSentence
            if !gap.exampleTranslation.isEmpty { explanation += " — \(gap.exampleTranslation)" }
            if let note { explanation += "\n\(note)" }
            return LessonQuestion(gap: gap, kind: .fillBlank, prompt: local, correctAnswer: expected,
                                  hint: gap.exampleTranslation.isEmpty ? nil : gap.exampleTranslation,
                                  explanation: explanation)

        case "truefalse", "true_false", "true-false", "tf":
            // The model never writes the truth. A true/false item is accepted only
            // when its statement is a MEANING claim the content can settle — “le pain”
            // means “bread” — whose French half is this gap's own form: the verdict is
            // then computed here from the content's gloss and the model's own answer
            // must agree with it. A claim about gender, conjugation or usage cannot be
            // checked, and its feedback would be a meaning sentence that answers a
            // different question, so it is rejected and the gap keeps the scheduler's
            // own verified true/false.
            guard let claimed = trueFalseValue(answer), !statement.isEmpty,
                  let claim = meaningClaim(in: statement),
                  isContentForm(claim.french, of: gap, kind: .translation) else { return nil }
            let isTrue = matchesGloss(claim.english, of: gap)
            guard claimed == isTrue,
                  isTrue || isClearlyDifferentMeaning(claim.english, from: gap.englishTranslation) else { return nil }
            var explanation = "“\(gap.frenchWord)” means “\(gap.englishTranslation)”."
            if !isTrue { explanation += " It does not mean “\(claim.english)”." }
            if let note { explanation += "\n\(note)" }
            return LessonQuestion(gap: gap, kind: .trueFalse, prompt: "True or false?",
                                  correctAnswer: isTrue ? "True" : "False", statement: statement,
                                  hint: nil, explanation: explanation)

        case "translation", "translate":
            guard gap.isTestable else { return nil }
            let expected = answer.isEmpty ? gap.frenchWord : answer
            guard isContentForm(expected, of: gap, kind: .translation) else { return nil }
            let english = statement.isEmpty ? gap.englishTranslation : statement
            var explanation = "\(expected) — \(english)"
            if let note { explanation += "\n\(note)" }
            return LessonQuestion(gap: gap, kind: .translation, prompt: "Translate to French:",
                                  correctAnswer: expected, statement: english,
                                  hint: nil, explanation: explanation)

        default:
            return nil
        }
    }

    // MARK: - Wire shape (tolerant)

    private struct ReplyDTO: Decodable {
        var questions: [QuestionDTO] = []

        private enum CodingKeys: String, CodingKey { case questions }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            questions = try c.decodeIfPresent([FailableDecodable<QuestionDTO>].self, forKey: .questions)?
                .compactMap { $0.value } ?? []
        }
    }

    private struct QuestionDTO: Decodable {
        var wordIndex: Int?
        var kind: String?
        var prompt: String?
        var answer: String?
        var options: [String]?
        var statement: String?
        var explanation: String?

        private enum CodingKeys: String, CodingKey {
            case wordIndex, kind, prompt, answer, options, statement, explanation
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            if let n = try? c.decodeIfPresent(Int.self, forKey: .wordIndex) {
                wordIndex = n
            } else if let s = try? c.decodeIfPresent(String.self, forKey: .wordIndex) {
                wordIndex = Int(s.trimmingCharacters(in: .whitespaces))
            }
            kind = try? c.decodeIfPresent(String.self, forKey: .kind)
            prompt = try? c.decodeIfPresent(String.self, forKey: .prompt)
            answer = try? c.decodeIfPresent(String.self, forKey: .answer)
            if let list = try? c.decodeIfPresent([FailableDecodable<String>].self, forKey: .options) {
                options = list.compactMap { $0.value }
            }
            statement = try? c.decodeIfPresent(String.self, forKey: .statement)
            explanation = try? c.decodeIfPresent(String.self, forKey: .explanation)
        }
    }
}
