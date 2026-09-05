//
//  LessonPipeline.swift
//  FluentFrenchIOS
//
//  The one path from intent to lesson (Pass 2):
//
//      SelectionRequest → ConceptSelector.select → SelectionLog → LessonAssembler.assemble
//
//  Views call this with a mode or a `SelectionScope`; they never rank, pool or
//  pick. It runs with no SwiftUI, so the headless driver and tests use exactly
//  the same path the app does.
//

import Foundation

@MainActor
struct LessonPipeline {
    let store: AppStore
    var weights: ConceptSelectionWeights = .tuning
    var config: LessonAssemblyConfig = .tuning

    init(store: AppStore, weights: ConceptSelectionWeights = .tuning, config: LessonAssemblyConfig = .tuning) {
        self.store = store
        self.weights = weights
        self.config = config
    }

    var selector: ConceptSelector { ConceptSelector(store: store, weights: weights, config: config) }
    var assembler: LessonAssembler { LessonAssembler(store: store, config: config) }

    /// Select without recording — for surfaces that only need to LOOK at what the
    /// engine would choose next (a "Continue: …" label, the daily plan).
    func preview(_ request: SelectionRequest) -> SelectionOutput {
        selector.select(request)
    }

    /// Select, record the decision, assemble. Every lesson the app shows comes
    /// through here, so the SelectionLog is a complete trace of the Select stage.
    func lesson(for request: SelectionRequest) -> AssembledLesson? {
        outcome(for: request).lesson
    }

    /// Select, record, assemble — and when the selector chose nothing (or nothing
    /// could be resolved), hand back its own headline so the entry point can show
    /// an honest empty state instead of silently doing nothing (C23).
    func outcome(for request: SelectionRequest) -> LessonOutcome {
        let output = selector.select(request)
        store.selectionLog.record(output)
        // Stall bookkeeping (B15): remember the target's state at selection so
        // `completeLesson` can tell whether this lesson moved it.
        store.noteLessonSelected(output)
        if let lesson = assembler.assemble(output) { return .lesson(lesson) }
        return .empty(headline: output.headline)
    }

    /// The outcome for a declared intent; the store resolves the scope to candidates.
    func outcome(for scope: SelectionScope, now: Date = Date()) -> LessonOutcome {
        outcome(for: store.selectionRequest(for: scope, now: now))
    }

    /// A lesson for a declared intent; the store resolves the scope to candidates.
    func lesson(for scope: SelectionScope, now: Date = Date()) -> AssembledLesson? {
        lesson(for: store.selectionRequest(for: scope, now: now))
    }

    func smartLesson(now: Date = Date()) -> AssembledLesson? {
        lesson(for: .smart(now: now))
    }

    func capstoneLesson(now: Date = Date()) -> AssembledLesson? {
        lesson(for: .capstone(now: now))
    }
}

/// What an entry point gets back: a lesson to present, or the selector's own
/// explanation of why there is none ("Nothing to practice right now.").
nonisolated enum LessonOutcome {
    case lesson(AssembledLesson)
    case empty(headline: String)

    var lesson: AssembledLesson? {
        if case .lesson(let l) = self { return l }
        return nil
    }

    var emptyHeadline: String? {
        if case .empty(let h) = self { return h }
        return nil
    }
}
