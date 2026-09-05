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
        let output = selector.select(request)
        store.selectionLog.record(output)
        return assembler.assemble(output)
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
