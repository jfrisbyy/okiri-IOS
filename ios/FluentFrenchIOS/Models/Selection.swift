//
//  Selection.swift
//  FluentFrenchIOS
//
//  The ONE selection contract (Pass 2 — "one selection output").
//
//  Every surface that shows a lesson or a plan builds a `SelectionRequest` and
//  consumes the `SelectionOutput` that `ConceptSelector.select(_:)` returns. Views
//  never rank, never build candidate pools, never pick items: they declare intent
//  (a mode, optionally a scope) and render what the selector chose.
//
//      SelectionRequest ──▶ ConceptSelector.select ──▶ SelectionOutput ──▶ LessonAssembler.assemble
//                                                                    └──▶ DailyPlanEngine.makePlan(from:)
//

import Foundation

// MARK: - Request

/// What kind of selection the caller wants.
nonisolated enum SelectionMode: Hashable, Codable {
    /// Home "Learn": the selector picks the target concept and interleaves review.
    case smart
    /// The learner declared intent (a deck, a category, a review set, a pattern).
    /// No target re-selection; eligibility, ordering, reasons and confusion
    /// adjacency still apply, and interleaving happens only WITHIN the candidates.
    case scoped(candidateGapIds: [String])
    /// Milestone quiz: rank broadly across recent material, weighted toward
    /// learning-but-trending-mastered concepts. Pure test, no teaching cards.
    case capstone

    var label: String {
        switch self {
        case .smart: return "smart"
        case .scoped: return "scoped"
        case .capstone: return "capstone"
        }
    }

    var isScoped: Bool {
        if case .scoped = self { return true }
        return false
    }

    var isCapstone: Bool {
        if case .capstone = self { return true }
        return false
    }
}

nonisolated struct SelectionRequest: Hashable {
    var mode: SelectionMode
    /// Number of items wanted. Defaults per mode from `Tuning` when not given.
    var lessonSize: Int
    /// The clock the selection is evaluated against (injectable for the headless driver).
    var now: Date
    /// Human label for scoped requests ("Grammar", "Spaced Repetition"); ignored otherwise.
    var scopeName: String?

    init(mode: SelectionMode, lessonSize: Int? = nil, now: Date = Date(), scopeName: String? = nil) {
        self.mode = mode
        self.now = now
        self.scopeName = scopeName
        if let lessonSize {
            self.lessonSize = lessonSize
        } else {
            switch mode {
            case .smart: self.lessonSize = Tuning.lessonSize
            case .scoped: self.lessonSize = Tuning.scopedLessonSize
            case .capstone: self.lessonSize = Tuning.capstoneSize
            }
        }
    }

    static func smart(now: Date = Date()) -> SelectionRequest {
        SelectionRequest(mode: .smart, now: now)
    }

    static func capstone(now: Date = Date()) -> SelectionRequest {
        SelectionRequest(mode: .capstone, now: now)
    }

    static func scoped(_ candidateGapIds: [String], name: String, now: Date = Date()) -> SelectionRequest {
        SelectionRequest(mode: .scoped(candidateGapIds: candidateGapIds), now: now, scopeName: name)
    }
}

// MARK: - Scope (user intent, resolved to candidates by the store — never by a View)

/// Retention buckets as the Retention screen tabs name them.
nonisolated enum RetentionBucket: String, Hashable, Codable, CaseIterable {
    case atRisk, fading, fresh, mastered

    var label: String {
        switch self {
        case .atRisk: return "At risk"
        case .fading: return "Fading"
        case .fresh: return "Fresh"
        case .mastered: return "Mastered"
        }
    }
}

/// A declared practice intent. Entry points name ONE of these; `AppStore`
/// resolves it into the candidate gap ids of a scoped `SelectionRequest`.
nonisolated enum SelectionScope: Hashable {
    /// Every active gap in a category (Deck category play, Gap Map card).
    case category(GapCategory)
    /// Overdue + due-today gaps in a category (Home "Recommended for you").
    case dueInCategory(GapCategory)
    /// The FSRS review queue (Deck "Spaced Repetition").
    case reviewQueue
    /// Gaps overdue by more than a day (Deck "Review Critical Gaps").
    case critical
    /// All active gaps (Deck "Start Practice").
    case mixed
    /// A retention bucket (Retention "Review these now").
    case retention(RetentionBucket)
    /// The gaps behind one error pattern (Pattern "Practice this pattern").
    case errorPattern(id: String)
    /// An explicit list (tests, deep links).
    case gapIds([String], name: String)

    /// Default label; the store may refine it (e.g. the error pattern's own label).
    var name: String {
        switch self {
        case .category(let c): return c.label
        case .dueInCategory(let c): return c.label
        case .reviewQueue: return "Spaced Repetition"
        case .critical: return "Critical Gaps"
        case .mixed: return "Mixed Practice"
        case .retention(let b): return b.label
        case .errorPattern: return "Error pattern"
        case .gapIds(_, let name): return name
        }
    }
}

// MARK: - Output

nonisolated enum SelectedItemRole: String, Hashable, Codable {
    /// Belongs to the lesson's target concept (the spine).
    case target
    /// Interleaved review (smart), or any item of a scoped / capstone selection.
    case review
    /// A one-item blind-spot probe for a never-observed frontier concept.
    case probe
}

/// One chosen item, with the data-driven reason the learner will see.
nonisolated struct SelectedItem: Identifiable, Hashable, Codable {
    var id: String { gapId }
    var gapId: String
    var conceptId: String?
    var role: SelectedItemRole
    var reason: String
}

/// A concept with the score the ONE ranker gave it.
nonisolated struct ScoredConcept: Identifiable, Hashable {
    var id: String { concept.id }
    let concept: Concept
    let score: Double
    let isFrontier: Bool
}

/// The selector's answer. Ordered `items` are in the selector's priority order
/// (spine weakest-first, then review most-urgent-first, probe last); the assembler
/// only groups, interleaves and applies confusion adjacency to them.
nonisolated struct SelectionOutput: Hashable {
    var request: SelectionRequest
    /// The lesson spine. `nil` in scoped / capstone mode and when nothing is eligible.
    var targetConceptId: String?
    var items: [SelectedItem]
    /// "Why this lesson" one-liner.
    var headline: String
    /// Every eligible concept scored and ranked high-to-low — the daily-plan engine
    /// computes its tilt from this and from nothing else.
    var rankedConcepts: [ScoredConcept]
    /// The learner's current ability band as the ranker sees it (theta → CEFR).
    var learnerLevel: CEFRLevel

    var mode: SelectionMode { request.mode }
    var isEmpty: Bool { items.isEmpty }
    var gapIds: [String] { items.map { $0.gapId } }
    var probeItem: SelectedItem? { items.first { $0.role == .probe } }
    var reasonsByGapId: [String: String] {
        var out: [String: String] = [:]
        for item in items { out[item.gapId] = item.reason }
        return out
    }

    /// An honest empty answer for a request nothing can satisfy.
    static func empty(for request: SelectionRequest, ranked: [ScoredConcept] = [], learnerLevel: CEFRLevel = .A1) -> SelectionOutput {
        SelectionOutput(request: request, targetConceptId: nil, items: [],
                        headline: "Nothing to practice right now.",
                        rankedConcepts: ranked, learnerLevel: learnerLevel)
    }
}
