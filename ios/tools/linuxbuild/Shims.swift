//
//  HarnessShims.swift — Linux test harness ONLY. Never part of the app.
//
//  Stand-ins for the handful of names the harness-compiled product files take from
//  frameworks that do not exist on Linux. Each block names the framework it replaces
//  and the files that need it, and supplies only the surface those files actually
//  call, with the real signature, so a file that compiles here calls the real API
//  the same way. Nothing here is exercised for behaviour: tests never configure
//  Supabase (SupabaseManager.client is nil), never open the network monitor, and
//  never hash a cache key.
//
//  Isolation matters. The app target defaults to MainActor, so a stand-in for an
//  EXTERNAL framework's type is declared `nonisolated`, as the real one is; `Theme`
//  is the app's own enum and stays MainActor, exactly like Theme/Theme.swift.
//
import Foundation
import Dispatch

nonisolated struct HarnessShimUnavailable: Error, Sendable {
    let framework: String
}

// MARK: - SwiftUI: Color, as the engine files carry it (data, never drawn)
// Used by Models.swift, ReadingContent.swift, ResourcesData.swift, SpeakingPrompts.swift.
nonisolated struct Color: Hashable, Sendable {
    let name: String
    /// The app's own `Color(hex:)` extension lives in Theme/Theme.swift.
    init(hex: String) { self.name = "#" + hex }
    fileprivate init(named name: String) { self.name = name }
}

// MARK: - Theme (Theme/Theme.swift is SwiftUI + UIKit and is not compiled here)
// Only the members harness-compiled files reference. Declared exactly as the real file
// declares them: the enum takes the module's MainActor default, and every colour is
// `nonisolated static let`. Leaving `nonisolated` off once made this stand-in emit 320
// isolation warnings the real build does not have -- noise that would teach anyone
// reading the log to ignore harness warnings.
enum Theme {
    nonisolated static let primary = Color(named: "Theme.primary")
    nonisolated static let secondary = Color(named: "Theme.secondary")
    nonisolated static let purple = Color(named: "Theme.purple")
    nonisolated static let success = Color(named: "Theme.success")
    nonisolated static let warning = Color(named: "Theme.warning")
}

// MARK: - Supabase (supabase-swift): the two PostgREST chains in CloudSync.swift
//   .from(t).upsert(row, onConflict:).select(cols).single().execute().value
//   .from(t).select(cols).eq(col, value:).limit(n).execute().value
// plus SupabaseClient(supabaseURL:supabaseKey:) in SupabaseManager.swift.
nonisolated final class SupabaseClient: Sendable {
    init(supabaseURL: URL, supabaseKey: String) {}
    func from(_ table: String) -> PostgrestQueryBuilder { PostgrestQueryBuilder() }
}

nonisolated struct PostgrestQueryBuilder: Sendable {
    func select(_ columns: String = "*") -> PostgrestFilterBuilder { PostgrestFilterBuilder() }
    func upsert<T: Encodable & Sendable>(_ values: T, onConflict: String? = nil) -> PostgrestFilterBuilder {
        PostgrestFilterBuilder()
    }
}

nonisolated struct PostgrestFilterBuilder: Sendable {
    func select(_ columns: String = "*") -> PostgrestFilterBuilder { self }
    func eq<V: Sendable>(_ column: String, value: V) -> PostgrestFilterBuilder { self }
    func limit(_ count: Int) -> PostgrestFilterBuilder { self }
    func single() -> PostgrestFilterBuilder { self }
    func execute<T: Decodable & Sendable>() async throws -> PostgrestResponse<T> {
        throw HarnessShimUnavailable(framework: "Supabase")
    }
}

nonisolated struct PostgrestResponse<T: Sendable>: Sendable {
    let value: T
}

// MARK: - Network: NWPathMonitor in ConverseService.swift (reachability only)
nonisolated struct NWPath: Sendable {
    enum Status: Sendable { case satisfied, unsatisfied, requiresConnection }
    var status: Status { .satisfied }
}

nonisolated final class NWPathMonitor: @unchecked Sendable {
    init() {}
    var pathUpdateHandler: (@Sendable (_ newPath: NWPath) -> Void)?
    var currentPath: NWPath { NWPath() }
    func start(queue: DispatchQueue) {}
    func cancel() {}
}

// MARK: - CryptoKit: SHA256.hash(data:) in TranslationCache.swift
// NOT SHA-256. A stand-in digest with the real shape (a Sequence of UInt8) so the
// file type-checks; no test reads a cache fingerprint.
nonisolated enum SHA256 {
    static func hash<D: DataProtocol>(data: D) -> SHA256Digest {
        var h: UInt64 = 0xcbf29ce484222325
        for byte in data { h = (h ^ UInt64(byte)) &* 0x100000001b3 }
        return SHA256Digest(bytes: (0..<32).map { UInt8(truncatingIfNeeded: h >> (UInt64($0 % 8) * 8)) })
    }
}

nonisolated struct SHA256Digest: Sequence, Sendable {
    let bytes: [UInt8]
    func makeIterator() -> IndexingIterator<[UInt8]> { bytes.makeIterator() }
}

// MARK: - Supabase: AnyJSON, the row payload type CloudSync encodes and decodes
// CloudSync uses the Codable round trip plus `objectValue`, `intValue`, `doubleValue`.
// Decoding order follows supabase-swift (Int before Double, so 3 stays an integer).
nonisolated enum AnyJSON: Sendable, Hashable, Codable {
    case null
    case bool(Bool)
    case integer(Int)
    case double(Double)
    case string(String)
    case object([String: AnyJSON])
    case array([AnyJSON])

    var objectValue: [String: AnyJSON]? { if case .object(let o) = self { return o } else { return nil } }
    var arrayValue: [AnyJSON]? { if case .array(let a) = self { return a } else { return nil } }
    var intValue: Int? { if case .integer(let i) = self { return i } else { return nil } }
    var doubleValue: Double? { if case .double(let d) = self { return d } else { return nil } }
    var stringValue: String? { if case .string(let s) = self { return s } else { return nil } }
    var boolValue: Bool? { if case .bool(let b) = self { return b } else { return nil } }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Int.self) { self = .integer(v) }
        else if let v = try? c.decode(Double.self) { self = .double(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([AnyJSON].self) { self = .array(v) }
        else { self = .object(try c.decode([String: AnyJSON].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .integer(let v): try c.encode(v)
        case .double(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        }
    }
}
