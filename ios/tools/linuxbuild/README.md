# Linux test harness

Builds the FluentFrenchIOS engine, store and services and runs the whole test suite
on Linux, in Docker, with the same compiler settings as the Xcode project.

```sh
ios/tools/linuxbuild/run.sh                  # every test
ios/tools/linuxbuild/run.sh --filter Store   # extra arguments go to `swift test`
```

Needs Docker and the `swift:6.2-noble` image (pulled from `mirror.gcr.io` by default;
set `HARNESS_IMAGE` to override). The build takes about a minute and the tests about
fifty seconds. Each run uses its own directory under `runs/` (ignored by git), so
several runs can happen at once.

## What it checks

- **All 23 test files**, and the **63 product files** listed in `engine-files.txt`:
  every model, every service including the networking ones, `CloudSync` and
  `SupabaseManager`, and `AppStore`.
- The settings match the Xcode project. Both targets use Swift 5 language mode,
  approachable concurrency and `MemberImportVisibility`. The app target also
  defaults to `MainActor` isolation; the test target does not, which is why every
  suite is an explicit `@MainActor struct`.
- A clean run means **zero errors and zero warnings**. Treat any warning as real:
  the harness emits none that the iOS build would not.

## What it cannot check

- **SwiftUI views and components.** Run `swiftc -parse` on any view file you change,
  and run the import lints in `ios/tools/` (`import_lint.py`, `foundation_lint.py`).
  Most compile findings in the audit rounds were files this harness cannot see.
- **The audio stack and sign-in** (`VoiceRecorder`, `DialoguePlayer`,
  `ElevenLabsTTS`, `FrenchSpeech`, `AuthManager`): AVFoundation and
  AuthenticationServices have no Linux build.

## The rule it exists to keep

The harness must never **supply** an import that the real build lacks. Lines that
import a framework with no Linux build (SwiftUI, UIKit, Supabase, Network, CryptoKit,
AuthenticationServices) are commented out in place, keeping their line numbers. The
few names the compiled files use from those frameworks come from `Shims.swift`, with
the real signatures and the real isolation.

The one import it adds is `FoundationNetworking`, guarded by `canImport` and appended
at the end of each file. On Linux, `URLSession` lives there; on iOS it lives in
`Foundation`, which every one of these files already imports. `FoundationNetworking`
does not re-export `Foundation` (a file that forgets `import Foundation` still fails
here), so the added import hides nothing.

An earlier version of this harness rewrote `import SwiftUI` into `import Foundation`
plus `import Observation`. Three files then shipped using `@Observable` without
`import Observation`, and the harness stayed green because it was supplying the
missing import itself.
