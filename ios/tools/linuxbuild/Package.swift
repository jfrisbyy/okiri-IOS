// swift-tools-version: 6.2
//
// Linux test harness for the FluentFrenchIOS engine, store and tests.
// `run.sh` copies the product files listed in engine-files.txt (and every test file)
// into a scratch copy of this package and runs `swift test` there, in Docker.
//
// The settings mirror the Xcode project exactly, because the harness is only worth
// something if it rejects what the real build rejects:
//   app target   SWIFT_VERSION 5, SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor,
//                SWIFT_APPROACHABLE_CONCURRENCY, MEMBER_IMPORT_VISIBILITY
//   test target  the same, WITHOUT default MainActor isolation (the suites are
//                explicit `@MainActor struct`s for that reason)
import PackageDescription

let approachable: [SwiftSetting] = [
    .enableUpcomingFeature("MemberImportVisibility"),
    .enableUpcomingFeature("NonisolatedNonsendingByDefault"),
    .enableUpcomingFeature("InferIsolatedConformances"),
]

let package = Package(
    name: "FluentFrenchIOSHarness",
    targets: [
        .target(
            name: "FluentFrenchIOS",
            path: "Sources/FluentFrenchIOS",
            swiftSettings: approachable + [.defaultIsolation(MainActor.self)]
        ),
        .testTarget(
            name: "FluentFrenchIOSTests",
            dependencies: ["FluentFrenchIOS"],
            path: "Tests/FluentFrenchIOSTests",
            swiftSettings: approachable
        ),
    ],
    swiftLanguageModes: [.v5]
)
