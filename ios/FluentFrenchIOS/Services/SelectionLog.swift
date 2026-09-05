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
    /// Stalled concepts the lesson was told to re-teach (Package B15).
    var stalledConceptIds: [String] = []
    /// The retention governor was active for this selection (Pass 3 F6).
    var governorActive: Bool = false

    var gapIds: [String] { items.map { $0.gapId } }

    func count(of role: SelectedItemRole) -> Int {
        items.filter { $0.role == role }.count
    }

    enum CodingKeys: String, CodingKey {
        case id, at, mode, scopeName, targetConceptId, items, headline, stalledConceptIds, governorActive
    }

    init(id: String, at: Date, mode: SelectionMode, scopeName: String?, targetConceptId: String?,
         items: [SelectedItem], headline: String, stalledConceptIds: [String] = [], governorActive: Bool = false) {
        self.id = id
        self.at = at
        self.mode = mode
        self.scopeName = scopeName
        self.targetConceptId = targetConceptId
        self.items = items
        self.headline = headline
        self.stalledConceptIds = stalledConceptIds
        self.governorActive = governorActive
    }

    /// Entries dumped before the stall / governor fields existed still decode.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        at = try c.decode(Date.self, forKey: .at)
        mode = try c.decode(SelectionMode.self, forKey: .mode)
        scopeName = try c.decodeIfPresent(String.self, forKey: .scopeName)
        targetConceptId = try c.decodeIfPresent(String.self, forKey: .targetConceptId)
        items = try c.decodeIfPresent([SelectedItem].self, forKey: .items) ?? []
        headline = try c.decodeIfPresent(String.self, forKey: .headline) ?? ""
        stalledConceptIds = try c.decodeIfPresent([String].self, forKey: .stalledConceptIds) ?? []
        governorActive = try c.decodeIfPresent(Bool.self, forKey: .governorActive) ?? false
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
            headline: output.headline,
            stalledConceptIds: output.stalledConceptIds,
            governorActive: output.governorActive
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
