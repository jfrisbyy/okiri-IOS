//
//  TranslationCache.swift
//  FluentFrenchIOS
//
//  Two-layer cache for word/phrase/sentence translations so the same lookup is
//  never paid for twice — by you or anyone else using the app.
//
//  Lookup order on a tap: device cache → shared cloud cache (Supabase) →
//  live translation. Whatever the live translation produces is written back to
//  both layers. Only genuine results are stored; failures/placeholders are never
//  cached, so the shared cache stays trustworthy.
//

import CryptoKit
import Foundation

nonisolated enum TranslationCache {
    // MARK: Configuration

    private static var baseURL: String { Config.EXPO_PUBLIC_SUPABASE_URL }
    private static var anonKey: String { Config.EXPO_PUBLIC_SUPABASE_ANON_KEY }
    private static var cloudEnabled: Bool { !baseURL.isEmpty && !anonKey.isEmpty }

    private static let table = "translation_cache"
    private static let localKey = "translation_cache_local_v1"
    private static var localLimit: Int { Tuning.translationCacheLocalLimit }

    // MARK: Fingerprint

    /// A stable, normalized fingerprint of the lookup so identical taps collapse
    /// to one cache entry — context-aware, so the same word in a clearly
    /// different sentence is stored separately. Callers pass the CONTAINING
    /// SENTENCE (`SentenceExtractor.sentence(containing:in:)`), never a whole
    /// article, so the same word in the same sentence always hits (E5).
    static func fingerprint(kind: String, term: String, context: String, direction: String) -> String {
        let raw = "\(kind)|\(direction)|\(normalize(term))|\(normalize(context))"
        let digest = SHA256.hash(data: Data(raw.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private static func normalize(_ value: String) -> String {
        let lowered = value.lowercased()
        let collapsed = lowered
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        let trimChars = CharacterSet(charactersIn: " \"'`.,!?;:()[]{}«»…—–-")
        return collapsed.trimmingCharacters(in: trimChars)
    }

    // MARK: Public API

    /// Look up a cached payload: device cache first, then the shared cloud cache.
    /// A cloud hit is written back to the device so it's instant next time.
    static func cached(kind: String, term: String, context: String, direction: String) async -> [String: String]? {
        let fp = fingerprint(kind: kind, term: term, context: context, direction: direction)
        if let local = localGet(fp) { return local }
        if let cloud = await cloudGet(fp) {
            localSet(fp, payload: cloud)
            return cloud
        }
        return nil
    }

    /// Persist a genuine result to both layers. The device write is instant; the
    /// cloud write is fire-and-forget so it never blocks the UI.
    static func store(kind: String, term: String, context: String, direction: String, payload: [String: String]) {
        guard isMeaningful(payload) else { return }
        let fp = fingerprint(kind: kind, term: term, context: context, direction: direction)
        localSet(fp, payload: payload)
        guard cloudEnabled else { return }
        let cleanTerm = term.trimmingCharacters(in: .whitespacesAndNewlines)
        Task.detached {
            await cloudSet(
                fingerprint: fp,
                kind: kind,
                term: cleanTerm,
                context: context,
                direction: direction,
                payload: payload
            )
        }
    }

    /// A payload counts only if it carries at least one non-empty value.
    private static func isMeaningful(_ payload: [String: String]) -> Bool {
        payload.values.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    // MARK: Device layer (UserDefaults, LRU-capped)

    private struct LocalStore: Codable {
        var order: [String]
        var items: [String: [String: String]]
    }

    private static func loadLocal() -> LocalStore {
        guard let data = UserDefaults.standard.data(forKey: localKey),
              let store = try? JSONDecoder().decode(LocalStore.self, from: data)
        else { return LocalStore(order: [], items: [:]) }
        return store
    }

    private static func saveLocal(_ store: LocalStore) {
        guard let data = try? JSONEncoder().encode(store) else { return }
        UserDefaults.standard.set(data, forKey: localKey)
    }

    private static func localGet(_ fp: String) -> [String: String]? {
        loadLocal().items[fp]
    }

    private static func localSet(_ fp: String, payload: [String: String]) {
        var store = loadLocal()
        if store.items[fp] == nil {
            store.order.append(fp)
        } else {
            // Move to most-recently-used.
            store.order.removeAll { $0 == fp }
            store.order.append(fp)
        }
        store.items[fp] = payload
        // Evict oldest entries beyond the cap.
        while store.order.count > localLimit {
            let oldest = store.order.removeFirst()
            store.items[oldest] = nil
        }
        saveLocal(store)
    }

    // MARK: Shared cloud layer (Supabase REST / PostgREST)

    private static func cloudGet(_ fp: String) async -> [String: String]? {
        guard cloudEnabled,
              let encoded = fp.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(baseURL)/rest/v1/\(table)?fingerprint=eq.\(encoded)&select=result&limit=1")
        else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 4
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            let rows = try JSONDecoder().decode([CloudRow].self, from: data)
            return rows.first?.result
        } catch {
            return nil
        }
    }

    private static func cloudSet(
        fingerprint: String,
        kind: String,
        term: String,
        context: String,
        direction: String,
        payload: [String: String]
    ) async {
        guard cloudEnabled,
              let url = URL(string: "\(baseURL)/rest/v1/\(table)?on_conflict=fingerprint")
        else { return }

        let row: [String: Any] = [
            "fingerprint": fingerprint,
            "kind": kind,
            "term": term,
            "context": context,
            "direction": direction,
            "result": payload,
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 6
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [row])

        _ = try? await URLSession.shared.data(for: request)
    }

    private struct CloudRow: Decodable {
        let result: [String: String]
    }
}
