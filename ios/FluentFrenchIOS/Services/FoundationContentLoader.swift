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
    let items: [FoundationItemContent]
}

nonisolated struct FoundationItemContent: Codable {
    let fr: String      // french word / phrase
    let en: String      // english translation
    let note: String    // plain-language explanation
    let ex: String      // example sentence
    let exEn: String    // example translation
    let diff: String?   // GapDifficulty raw value; defaults to "okay"
}

// MARK: - Loader

nonisolated enum FoundationContentLoader {
    /// Decoded once and cached for the process lifetime.
    static let file: FoundationContentFile? = decode()

    private static func decode() -> FoundationContentFile? {
        guard let url = Bundle.main.url(forResource: "FoundationContent", withExtension: "json") else {
            print("[FoundationContent] FoundationContent.json missing from bundle — using fallback")
            return nil
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(FoundationContentFile.self, from: data)
        } catch {
            print("[FoundationContent] decode failed: \(error) — using fallback")
            return nil
        }
    }

    /// Build the full set of seeded Foundation gaps from the bundled curriculum.
    /// Falls back to a compact inline set only if the resource can't be read.
    static func gaps() -> [GapItem] {
        guard let file else { return FoundationCurriculum.fallbackGaps() }

        // CEFR level per concept, so each gap inherits its skill's level.
        let levels: [String: CEFRLevel] = Dictionary(
            ConceptTaxonomy.seed().map { ($0.id, $0.cefrLevel) },
            uniquingKeysWith: { first, _ in first }
        )
        let now = Date()
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
