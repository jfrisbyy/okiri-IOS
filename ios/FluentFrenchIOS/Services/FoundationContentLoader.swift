//
//  FoundationContentLoader.swift
//  FluentFrenchIOS
//
//  Reads the bundled Foundation curriculum (FoundationContent.json) and turns it
//  into the seeded `GapItem`s the lesson engine consumes in DELIVERY mode. Keeping
//  the curriculum in a data file (not inline Swift) lets the word/skill banks grow
//  to full A1+ breadth as a content edit, never a code change. The engine, mastery
//  tracking, and readiness gate all keep consuming these gaps exactly as before.
//

import Foundation

// MARK: - On-disk shape (decoded from the bundled JSON)

nonisolated struct FoundationContentFile: Codable {
    let version: Int
    let skills: [FoundationSkillContent]
}

nonisolated struct FoundationSkillContent: Codable {
    /// Concept id this skill teaches — must match a ConceptTaxonomy id.
    let id: String
    /// GapCategory raw value for the whole skill.
    let category: String
    /// Content v2: the plain-language skill card. Absent in v1 files.
    var teaching: FoundationTeachingContent? = nil
    /// Content v2: diagnostic multiple-choice probes (3 per concept). Absent in v1 files.
    var probes: [FoundationProbeContent] = []
    let items: [FoundationItemContent]

    enum CodingKeys: String, CodingKey {
        case id, category, teaching, probes, items
    }

    init(id: String, category: String, teaching: FoundationTeachingContent? = nil,
         probes: [FoundationProbeContent] = [], items: [FoundationItemContent]) {
        self.id = id
        self.category = category
        self.teaching = teaching
        self.probes = probes
        self.items = items
    }

    /// Tolerant of v1 files: `teaching` and `probes` are optional on disk.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        category = try c.decode(String.self, forKey: .category)
        teaching = try c.decodeIfPresent(FoundationTeachingContent.self, forKey: .teaching)
        probes = try c.decodeIfPresent([FoundationProbeContent].self, forKey: .probes) ?? []
        items = try c.decodeIfPresent([FoundationItemContent].self, forKey: .items) ?? []
    }
}

/// Content v2 skill card: a rule, worked examples, a contrast and the common mistake.
nonisolated struct FoundationTeachingContent: Codable, Hashable {
    let rule: String
    var examples: [FoundationExampleContent] = []
    var contrast: [FoundationExampleContent] = []
    var commonMistake: String? = nil

    enum CodingKeys: String, CodingKey {
        case rule, examples, contrast, commonMistake
    }

    init(rule: String, examples: [FoundationExampleContent] = [], contrast: [FoundationExampleContent] = [],
         commonMistake: String? = nil) {
        self.rule = rule
        self.examples = examples
        self.contrast = contrast
        self.commonMistake = commonMistake
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rule = try c.decodeIfPresent(String.self, forKey: .rule) ?? ""
        examples = try c.decodeIfPresent([FoundationExampleContent].self, forKey: .examples) ?? []
        contrast = try c.decodeIfPresent([FoundationExampleContent].self, forKey: .contrast) ?? []
        commonMistake = try c.decodeIfPresent(String.self, forKey: .commonMistake)
    }
}

/// One worked example on a skill card.
nonisolated struct FoundationExampleContent: Codable, Hashable {
    let fr: String
    let en: String
    var note: String? = nil
}

/// Content v2 diagnostic probe: `fr` is the prompt, `en` the correct answer, and
/// `options` the three distractors (the answer is NOT repeated in `options`).
nonisolated struct FoundationProbeContent: Codable, Hashable {
    let fr: String
    let en: String
    var ex: String = ""
    var exEn: String = ""
    var options: [String] = []

    enum CodingKeys: String, CodingKey {
        case fr, en, ex, exEn, options
    }

    init(fr: String, en: String, ex: String = "", exEn: String = "", options: [String] = []) {
        self.fr = fr
        self.en = en
        self.ex = ex
        self.exEn = exEn
        self.options = options
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        fr = try c.decode(String.self, forKey: .fr)
        en = try c.decode(String.self, forKey: .en)
        ex = try c.decodeIfPresent(String.self, forKey: .ex) ?? ""
        exEn = try c.decodeIfPresent(String.self, forKey: .exEn) ?? ""
        options = try c.decodeIfPresent([String].self, forKey: .options) ?? []
    }

    /// A probe is usable only with a real prompt, an answer and distinct distractors
    /// that don't repeat the answer.
    var isUsable: Bool {
        guard !fr.isEmpty, !en.isEmpty, !options.isEmpty else { return false }
        let answer = en.lowercased()
        return Set(options.map { $0.lowercased() }).count == options.count
            && !options.contains { $0.lowercased() == answer }
    }
}

nonisolated struct FoundationItemContent: Codable {
    let fr: String      // french word / phrase
    let en: String      // english translation
    let note: String    // plain-language explanation
    let ex: String      // example sentence
    let exEn: String    // example translation
    let diff: String?   // GapDifficulty raw value; defaults to "okay"
    /// Content v2: exact surface form of `fr` inside `ex` (must occur verbatim there).
    var blank: String? = nil
    /// Content v2: accepted alternative typed answers.
    var alts: [String]? = nil
    /// Content v2: false for rule-label items (skill cards / MC only).
    var testable: Bool? = nil

    enum CodingKeys: String, CodingKey {
        case fr, en, note, ex, exEn, diff, blank, alts, testable
    }

    init(fr: String, en: String, note: String, ex: String, exEn: String, diff: String? = nil,
         blank: String? = nil, alts: [String]? = nil, testable: Bool? = nil) {
        self.fr = fr
        self.en = en
        self.note = note
        self.ex = ex
        self.exEn = exEn
        self.diff = diff
        self.blank = blank
        self.alts = alts
        self.testable = testable
    }

    /// Tolerant of v1 files (no `blank` / `alts` / `testable`) and of missing notes.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        fr = try c.decode(String.self, forKey: .fr)
        en = try c.decode(String.self, forKey: .en)
        note = try c.decodeIfPresent(String.self, forKey: .note) ?? ""
        ex = try c.decodeIfPresent(String.self, forKey: .ex) ?? ""
        exEn = try c.decodeIfPresent(String.self, forKey: .exEn) ?? ""
        diff = try c.decodeIfPresent(String.self, forKey: .diff)
        blank = try c.decodeIfPresent(String.self, forKey: .blank)
        alts = try c.decodeIfPresent([String].self, forKey: .alts)
        testable = try c.decodeIfPresent(Bool.self, forKey: .testable)
    }

    /// The fill-blank surface form, only when the content really contains it verbatim.
    var verifiedBlank: String? {
        guard let blank, !blank.isEmpty, ex.contains(blank) else { return nil }
        return blank
    }

    var isTestable: Bool { testable ?? true }
}

// MARK: - Loader

nonisolated enum FoundationContentLoader {
    /// Decoded once and cached for the process lifetime.
    static let file: FoundationContentFile? = decodeBundled()

    private static func decodeBundled() -> FoundationContentFile? {
        guard let url = Bundle.main.url(forResource: "FoundationContent", withExtension: "json") else {
            print("[FoundationContent] FoundationContent.json missing from bundle — using fallback")
            return nil
        }
        do {
            let data = try Data(contentsOf: url)
            return try decode(data)
        } catch {
            print("[FoundationContent] decode failed: \(error) — using fallback")
            return nil
        }
    }

    /// Decode a content file (v1 or v2) from raw JSON. Tolerant of v1 files that
    /// lack `teaching`, `probes`, `blank`, `alts` and `testable`.
    static func decode(_ data: Data) throws -> FoundationContentFile {
        try JSONDecoder().decode(FoundationContentFile.self, from: data)
    }

    // MARK: Lookups (content v2)

    static func skill(for conceptId: String, in file: FoundationContentFile? = file) -> FoundationSkillContent? {
        file?.skills.first { $0.id == conceptId }
    }

    /// The skill card for a concept, if the content has one.
    static func teaching(for conceptId: String, in file: FoundationContentFile? = file) -> FoundationTeachingContent? {
        skill(for: conceptId, in: file)?.teaching
    }

    /// The usable diagnostic probes for a concept (empty for v1 content).
    static func probes(for conceptId: String, in file: FoundationContentFile? = file) -> [FoundationProbeContent] {
        (skill(for: conceptId, in: file)?.probes ?? []).filter { $0.isUsable }
    }

    /// The raw items of a concept's skill.
    static func items(for conceptId: String, in file: FoundationContentFile? = file) -> [FoundationItemContent] {
        skill(for: conceptId, in: file)?.items ?? []
    }

    /// Build the full set of seeded Foundation gaps from the bundled curriculum.
    /// Falls back to a compact inline set only if the resource can't be read.
    static func gaps() -> [GapItem] {
        guard let file else { return FoundationCurriculum.fallbackGaps() }
        return gaps(from: file)
    }

    /// Seeded gaps for a decoded content file (v1 or v2). Content v2 fields ride
    /// along: `blankForm` only when the blank occurs verbatim in the example,
    /// `acceptedAnswers` from `alts`, `isTestable` from `testable`.
    static func gaps(from file: FoundationContentFile, now: Date = Date()) -> [GapItem] {
        // CEFR level per concept, so each gap inherits its skill's level.
        let levels: [String: CEFRLevel] = Dictionary(
            ConceptTaxonomy.seed().map { ($0.id, $0.cefrLevel) },
            uniquingKeysWith: { first, _ in first }
        )
        var result: [GapItem] = []

        for skill in file.skills {
            let category = GapCategory(rawValue: skill.category) ?? .vocabulary
            let level = levels[skill.id] ?? .A1
            for (idx, item) in skill.items.enumerated() {
                let difficulty = GapDifficulty(rawValue: item.diff ?? "okay") ?? .okay
                var gap = GapItem(
                    id: "foundation-\(skill.id)-\(idx)",
                    frenchWord: item.fr,
                    englishTranslation: item.en,
                    explanation: item.note,
                    exampleSentence: item.ex,
                    exampleTranslation: item.exEn,
                    pronunciation: nil,
                    sourceType: .foundation,
                    category: category,
                    difficulty: difficulty,
                    reviewCount: 0,
                    consecutiveCorrect: 0,
                    lastReviewedAt: nil,
                    nextReviewAt: now,
                    masteredAt: nil,
                    createdAt: now,
                    cefrLevel: level,
                    easeFactor: 2.5,
                    currentInterval: 0,
                    irtDifficulty: irtDifficulty(level: level, difficulty: difficulty),
                    fsrs: nil,
                    originalContext: nil,
                    confusionLinks: [],
                    conceptId: skill.id
                )
                gap.blankForm = item.verifiedBlank
                gap.acceptedAnswers = item.alts
                gap.isTestable = item.isTestable
                gap.fsrs = FSRS.makeInitialState(grade: .again, now: now)
                gap.fsrs?.dueAt = now
                result.append(gap)
            }
        }
        return result
    }

    /// Map a skill's level + an item's difficulty tag onto an IRT difficulty.
    /// Foundation items sit at the easy end of the scale (negative b).
    private static func irtDifficulty(level: CEFRLevel, difficulty: GapDifficulty) -> Double {
        let base: Double = level == .A1 ? -1.1 : -0.5   // A1 vs early-A2 bridge
        let bump: Double
        switch difficulty {
        case .easy: bump = -0.3
        case .okay: bump = 0
        case .hard: bump = 0.4
        }
        return max(-1.6, min(0.2, base + bump))
    }
}
