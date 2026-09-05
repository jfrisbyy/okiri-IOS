//
//  SelectionLog.swift
//  FluentFrenchIOS
//
//  Instrumentation for the Select stage (Pass 2). Every selection that becomes a
//  lesson is recorded here with its mode, target and item roles, so a headless
//  driver (or a debugging session) can replay what the engine decided and why.
//  It is the selection-side twin of the evidence log: ONE evidence stream in,
//  ONE selection output out — and both leave a trace.
//
//  In-memory and capped (`Tuning.selectionLogCapacity`); Codable so it can be
//  dumped or persisted later without changing its shape.
//

import Foundation

nonisolated struct SelectionLogEntry: Identifiable, Hashable, Codable {
    var id: String
    var at: Date
    var mode: SelectionMode
    var scopeName: String?
    var targetConceptId: String?
    var items: [SelectedItem]
    var headline: String

    var gapIds: [String] { items.map { $0.gapId } }

    func count(of role: SelectedItemRole) -> Int {
        items.filter { $0.role == role }.count
    }
}

nonisolated struct SelectionLog: Hashable, Codable {
    private(set) var entries: [SelectionLogEntry] = []
    /// Oldest entries are dropped once this many are kept.
    var capacity: Int = Tuning.selectionLogCapacity

    var last: SelectionLogEntry? { entries.last }
    var count: Int { entries.count }

    func entries(in mode: SelectionMode) -> [SelectionLogEntry] {
        entries.filter { $0.mode == mode }
    }

    func entries(with label: String) -> [SelectionLogEntry] {
        entries.filter { $0.mode.label == label }
    }

    @discardableResult
    mutating func record(_ output: SelectionOutput) -> SelectionLogEntry {
        let entry = SelectionLogEntry(
            id: UUID().uuidString,
            at: output.request.now,
            mode: output.request.mode,
            scopeName: output.request.scopeName,
            targetConceptId: output.targetConceptId,
            items: output.items,
            headline: output.headline
        )
        entries.append(entry)
        if capacity > 0, entries.count > capacity {
            entries.removeFirst(entries.count - capacity)
        }
        return entry
    }

    mutating func clear() {
        entries.removeAll()
    }
}
