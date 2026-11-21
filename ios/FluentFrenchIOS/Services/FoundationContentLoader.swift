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
///
/// `ask` is the question stem to print. Most probes are asked "What does “<fr>”
/// mean?" — but a probe whose answer is a CLAIM about `fr` rather than its meaning
/// ("the s links as a z: 'vou-za-vé'", "correct: colour adjectives go after the
/// noun") is unanswerable under that stem, so those items carry their own.
nonisolated struct FoundationProbeContent: Codable, Hashable {
    /// Stable content id, "<skillId>.p<n>" (engine-10-6): assigned once, never
    /// recomputed, unique across the file. The validator requires it on shipped
    /// content; the decoder tolerates its absence only for hand-written test items.
    var id: String? = nil
    let fr: String
    let en: String
    var ask: String? = nil
    var ex: String = ""
    var exEn: String = ""
    var options: [String] = []

    enum CodingKeys: String, CodingKey {
        case id, fr, en, ask, ex, exEn, options
    }

    init(id: String? = nil, fr: String, en: String, ask: String? = nil, ex: String = "", exEn: String = "",
         options: [String] = []) {
        self.id = id
        self.fr = fr
        self.en = en
        self.ask = ask
        self.ex = ex
        self.exEn = exEn
        self.options = options
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
        fr = try c.decode(String.self, forKey: .fr)
        en = try c.decode(String.self, forKey: .en)
        ask = try c.decodeIfPresent(String.self, forKey: .ask)
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
    /// Stable content id, "<skillId>.<n>" (engine-10-6): assigned once, never
    /// recomputed, unique across the file. A seeded gap carries it
    /// (`GapItem.contentItemId`), so a corrected `fr` updates the learner's card in
    /// place instead of orphaning it. The validator requires it on shipped content;
    /// the decoder tolerates its absence only for v1 files and hand-written test items.
    var id: String? = nil
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
        case id, fr, en, note, ex, exEn, diff, blank, alts, testable
    }

    init(id: String? = nil, fr: String, en: String, note: String, ex: String, exEn: String, diff: String? = nil,
         blank: String? = nil, alts: [String]? = nil, testable: Bool? = nil) {
        self.id = id
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

    /// Tolerant of v1 files (no `id` / `blank` / `alts` / `testable`) and of missing notes.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
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

    /// Decode a content file from an explicit location — for tests and tooling
    /// that run where `Bundle.main` is not the app bundle (the Linux harness).
    static func load(from url: URL) throws -> FoundationContentFile {
        try decode(Data(contentsOf: url))
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
    /// Every gap is due at `now`; the store staggers them at seeding time (D3).
    static func gaps(now: Date = Date()) -> [GapItem] {
        guard let file else { return FoundationCurriculum.fallbackGaps() }
        return gaps(from: file, now: now)
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
                result.append(gap(from: item, conceptId: skill.id, index: idx,
                                  category: category, level: level, now: now))
            }
        }
        return result
    }

    /// One seeded gap for one content item — the single construction path for
    /// Foundation gaps, shared by the full seed above and by a placement miss that
    /// has to seed a REAL headword instead of the probe's cloze stem
    /// (`AssessmentService.gaps(forMissed:)`). `id` matches the full seed's id for
    /// the same item, so the two can never both land in the record. The gap carries
    /// the item's stable content id (`contentItemId`) for later content refreshes.
    /// `difficulty` overrides the item's own tag (a missed item is seeded `.hard`).
    static func gap(from item: FoundationItemContent, conceptId: String, index: Int,
                    category: GapCategory, level: CEFRLevel,
                    difficulty override: GapDifficulty? = nil, now: Date) -> GapItem {
        let difficulty = override ?? (GapDifficulty(rawValue: item.diff ?? "okay") ?? .okay)
        var gap = GapItem(
            id: "foundation-\(conceptId)-\(index)",
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
            conceptId: conceptId
        )
        gap.blankForm = item.verifiedBlank
        gap.acceptedAnswers = item.alts
        gap.isTestable = item.isTestable
        gap.contentItemId = item.id
        gap.contentFingerprint = contentFingerprint(of: gap)
        gap.fsrs = FSRS.makeUnseenState(now: now)
        return gap
    }

    // MARK: Content corrections (engine-10-6)

    /// A stable fingerprint of a gap's content-owned fields: the meaning, note,
    /// example pair, blank, accepted answers and the testable flag — a stable hash, so
    /// it is the same in every process (Swift's `Hasher` is seeded per run).
    static func contentFingerprint(of gap: GapItem) -> String {
        let fields: [String] = [
            gap.englishTranslation, gap.explanation, gap.exampleSentence, gap.exampleTranslation,
            gap.blankForm ?? "\u{0}", (gap.acceptedAnswers ?? []).joined(separator: "\u{1F}"),
            gap.isTestable ? "1" : "0",
        ]
        return FoundationSeeder.stableHash(fields.joined(separator: "\u{1E}"))
    }

    /// The learner's gaps with the CURRENT curriculum applied to everything seeded
    /// from it (engine-10-6). A seeded gap used to be a frozen copy: no path re-read
    /// content for a gap already on the record, so a corrected blank, a fixed
    /// "also accepted" answer or a rewritten note never reached a learner who had
    /// been seeded, and an item added to a skill they already had never arrived.
    ///
    /// - A seeded gap is matched to its content item by the item's stable content id
    ///   (`GapItem.contentItemId`), never by the array-index gap id, which an
    ///   inserted item shifts. Its headword and content-owned fields are replaced, so
    ///   a corrected `fr` updates the card in place instead of leaving an orphan; its
    ///   schedule, evidence, difficulty tag and gap id are untouched.
    /// - A gap persisted before content ids existed is matched ONCE by concept and
    ///   headword (the key the content keeps unique) and stamped with the item's id;
    ///   from then on it is matched by id alone. (A headword corrected before that
    ///   first stamp cannot be recognised: that one card stays as it was.)
    /// - A gap whose fields no longer match the fingerprint it was seeded with has
    ///   been extended by the learner (a second reading folded into the card): its
    ///   meaning, note and accepted answers are theirs and are kept; only the fields
    ///   no learner path writes (headword, example, blank, testable) follow the content.
    /// - A gap seeded before fingerprints existed is taken to be unedited.
    /// - A skill the learner was seeded with (at least
    ///   `Tuning.foundationTopUpSeededShare` of its content present) gains the
    ///   items added to it since, due at `now`. A skill they only met through one
    ///   placement miss is left for its own seeding path.
    static func refreshSeeded(_ gaps: [GapItem], content: [GapItem], now: Date) -> [GapItem] {
        func key(_ conceptId: String, _ word: String) -> String { conceptId + "\u{1F}" + FoundationSeeder.headwordKey(word) }
        /// A content item's identity: its stable id, or concept + headword for content
        /// that carries none (hand-written test content).
        func identity(_ item: GapItem, _ conceptId: String) -> String {
            item.contentItemId ?? key(conceptId, item.frenchWord)
        }
        var byId: [String: GapItem] = [:]
        var byKey: [String: GapItem] = [:]
        for item in content {
            guard let cid = item.conceptId else { continue }
            if let itemId = item.contentItemId, byId[itemId] == nil { byId[itemId] = item }
            let k = key(cid, item.frenchWord)
            if byKey[k] == nil { byKey[k] = item }
        }
        var result = gaps
        var present = Set<String>()
        for i in result.indices {
            let gap = result[i]
            guard gap.sourceType == .foundation, !gap.isProbe, let cid = gap.conceptId else { continue }
            // Stamped: by id only. Unstamped (persisted before ids): once, by headword.
            let match: GapItem?
            if let itemId = gap.contentItemId {
                match = byId[itemId]
            } else {
                match = byKey[key(cid, gap.frenchWord)]
            }
            guard let item = match else {
                present.insert(gap.contentItemId ?? key(cid, gap.frenchWord))
                continue
            }
            present.insert(identity(item, cid))
            let target = contentFingerprint(of: item)
            let stamp = item.contentItemId ?? gap.contentItemId
            if gap.contentFingerprint == target, gap.frenchWord == item.frenchWord, gap.contentItemId == stamp { continue }
            let edited = gap.contentFingerprint.map { contentFingerprint(of: gap) != $0 } ?? false
            var updated = gap
            if !edited {
                updated.englishTranslation = item.englishTranslation
                updated.explanation = item.explanation
                updated.acceptedAnswers = item.acceptedAnswers
            }
            updated.frenchWord = item.frenchWord
            updated.exampleSentence = item.exampleSentence
            updated.exampleTranslation = item.exampleTranslation
            updated.blankForm = item.blankForm
            updated.isTestable = item.isTestable
            updated.contentFingerprint = target
            updated.contentItemId = stamp
            result[i] = updated
        }

        // Items added to a skill the learner already has. An item already on the
        // record (by content id), or a headword already there from ANY source (a word
        // they captured while reading, say), is skipped, exactly as every seeding
        // path skips it.
        let contentByConcept = Dictionary(grouping: content.filter { $0.conceptId != nil }, by: { $0.conceptId! })
        var ids = Set(result.map { $0.id })
        var headwords = Set(result.map { FoundationSeeder.headwordKey($0.frenchWord) })
        for (cid, items) in contentByConcept.sorted(by: { $0.key < $1.key }) {
            let have = items.filter { present.contains(identity($0, cid)) }.count
            guard have > 0, Double(have) >= Double(items.count) * Tuning.foundationTopUpSeededShare else { continue }
            for item in items where !present.contains(identity(item, cid))
                && !headwords.contains(FoundationSeeder.headwordKey(item.frenchWord)) {
                var fresh = item
                fresh.id = FoundationSeeder.availableId(for: item, taken: ids)
                fresh.nextReviewAt = now
                fresh.createdAt = now
                fresh.fsrs = FSRS.makeUnseenState(now: now)
                ids.insert(fresh.id)
                present.insert(identity(item, cid))
                headwords.insert(FoundationSeeder.headwordKey(item.frenchWord))
                result.append(fresh)
            }
        }
        return result
    }

    /// Map a skill's level + an item's difficulty tag onto an IRT difficulty. Every
    /// number lives in Tuning, and each band has its own base: the old literal
    /// mapping gave every non-A1 skill the "early-A2 bridge" value, so B1 grammar
    /// was scored easier than an A2 capture and θ could not tell B1 content from A2
    /// (engine-10-7). Clamped to the range ability itself can take.
    static func irtDifficulty(level: CEFRLevel, difficulty: GapDifficulty) -> Double {
        let bump: Double
        switch difficulty {
        case .easy: bump = Tuning.irtEasyBump
        case .okay: bump = 0
        case .hard: bump = Tuning.irtHardBump
        }
        let b = Tuning.foundationIrtDifficulty(for: level) + bump
        return max(Tuning.abilityThetaFloor, min(Tuning.abilityThetaCeiling, b))
    }
}
