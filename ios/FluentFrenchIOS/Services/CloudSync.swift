//
//  CloudSync.swift
//  FluentFrenchIOS
//
//  Continuous per-user progress backup. A single row per user in
//  `ios_progress_snapshots` holds the learner's full state as JSON. Writes are
//  debounced and fire-and-forget; reads reconcile newest-wins on sign-in and
//  on every launch.
//

import Foundation
import Supabase

/// The full persisted learner state, serialized to the cloud snapshot row.
nonisolated struct ProgressSnapshot: Codable, Sendable {
    var schemaVersion: Int = 1
    var clientUpdatedAt: Date

    var gaps: [GapItem]
    var concepts: [Concept]
    var errors: [ErrorRecord]
    var abilityTheta: Double
    var masteryDays: [String]
    var hasCompletedAssessment: Bool
    var assessedLevel: String
    var sessionIndex: Int
    var preferences: UserPreferences?
    var activityProgress: [String: Int]
    var gapsSinceLastLesson: Int
    var lessonsSinceCapstone: Int
}

@MainActor
final class CloudSync {
    private let client = SupabaseManager.client
    private let table = "ios_progress_snapshots"

    private(set) var userId: String?
    private var debounceTask: Task<Void, Never>?

    private static let isoEncoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
    private static let isoDecoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    func setUser(_ id: String?) {
        userId = id
        if id == nil { debounceTask?.cancel() }
    }

    // MARK: - Reconcile (newest-wins) on sign-in / launch

    /// Pull the cloud snapshot and reconcile against local state. Newest activity
    /// wins; if the cloud has nothing yet, the local state is uploaded (migration).
    func reconcile(store: AppStore, userId: String) async {
        let remote = await fetchRemote(userId: userId)
        let localTS = store.localUpdatedAt ?? .distantPast

        if let remote {
            if remote.clientUpdatedAt >= localTS {
                store.apply(snapshot: remote)
            } else {
                await pushNow(store: store, userId: userId)
            }
        } else {
            // No cloud record yet — first sign-in. Carry device progress forward.
            await pushNow(store: store, userId: userId)
        }
    }

    // MARK: - Writes

    /// Debounced background upload triggered by local mutations.
    func progressDidChange(_ store: AppStore) {
        guard let uid = userId else { return }
        debounceTask?.cancel()
        debounceTask = Task { [weak self, weak store] in
            try? await Task.sleep(for: .seconds(1.5))
            guard !Task.isCancelled, let self, let store else { return }
            await self.pushNow(store: store, userId: uid)
        }
    }

    /// Flush any pending debounced upload immediately (used before sign-out).
    func flushPending(store: AppStore) async {
        guard let uid = userId else { return }
        debounceTask?.cancel()
        await pushNow(store: store, userId: uid)
    }

    private func pushNow(store: AppStore, userId: String) async {
        let snapshot = store.makeSnapshot()
        do {
            let data = try Self.isoEncoder.encode(snapshot)
            let snapshotJSON = try JSONDecoder().decode(AnyJSON.self, from: data)
            let isoTimestamp = ISO8601DateFormatter().string(from: snapshot.clientUpdatedAt)
            let row = SnapshotRow(
                user_id: userId,
                snapshot: snapshotJSON,
                client_updated_at: isoTimestamp
            )
            try await client.from(table).upsert(row, onConflict: "user_id").execute()
        } catch {
            // Silent + resilient: keep working on-device, retry on the next change.
            print("[CloudSync] upload failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Reads

    private func fetchRemote(userId: String) async -> ProgressSnapshot? {
        do {
            let rows: [RemoteRow] = try await client
                .from(table)
                .select("snapshot")
                .eq("user_id", value: userId)
                .limit(1)
                .execute()
                .value
            guard let snapshotJSON = rows.first?.snapshot else { return nil }
            let data = try JSONEncoder().encode(snapshotJSON)
            return try Self.isoDecoder.decode(ProgressSnapshot.self, from: data)
        } catch {
            print("[CloudSync] fetch failed: \(error.localizedDescription)")
            return nil
        }
    }
}

// MARK: - Row DTOs

private nonisolated struct SnapshotRow: Encodable {
    let user_id: String
    let snapshot: AnyJSON
    let client_updated_at: String
}

private nonisolated struct RemoteRow: Decodable {
    let snapshot: AnyJSON
}
