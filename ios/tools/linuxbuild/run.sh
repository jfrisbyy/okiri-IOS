#!/bin/bash
# Linux test harness for the FluentFrenchIOS engine, store and tests.
#
#   ios/tools/linuxbuild/run.sh                 # build + run every test
#   ios/tools/linuxbuild/run.sh --filter Store  # extra args go to `swift test`
#
# Copies the product files in engine-files.txt plus every test file into a private
# scratch package under runs/, then runs `swift test` in a Swift 6.2 Docker image.
# Each run gets its own directory, so several agents can run it at once.
#
# One rule matters above the rest: the harness must never SUPPLY an import the real
# build lacks. `import SwiftUI` / `import UIKit` lines are commented out in place
# (line numbers preserved, so errors point at the real source line) and the few
# SwiftUI/UIKit/Supabase/AVFoundation names the engine touches come from
# Shims.swift. An earlier version rewrote `import SwiftUI` into `import Foundation`
# + `import Observation`, which is why three files shipped using @Observable with no
# `import Observation` and the harness stayed green. Pair this with the import lints
# in ios/tools/ -- the harness cannot see SwiftUI view files at all.
set -u
H="$(cd "$(dirname "$0")" && pwd)"
IOS="$(cd "$H/../.." && pwd)"
SRC="$IOS/FluentFrenchIOS"
TESTS="$IOS/FluentFrenchIOSTests"
IMAGE="${HARNESS_IMAGE:-mirror.gcr.io/library/swift:6.2-noble}"

mkdir -p "$H/runs"
T="$(mktemp -d "$H/runs/run.XXXXXX")"
mkdir -p "$T/Sources/FluentFrenchIOS" "$T/Tests/FluentFrenchIOSTests"
cp "$H/Package.swift" "$T/Package.swift"

# Frameworks with no Linux build. Their import lines become comments in place, and the
# names the compiled files use come from HarnessShims.swift.
uncomment_ui='s#^(import (SwiftUI|UIKit|Supabase|Network|CryptoKit|AuthenticationServices))$#// \1   // harness: names come from HarnessShims.swift#'
# On Apple platforms URLSession/URLRequest are in Foundation, which every one of these
# files imports; on Linux they moved to FoundationNetworking. Appending the guarded
# import at the END keeps every real line number intact, and it supplies nothing the
# iOS build lacks -- unlike the old Observation rewrite, which did.
networking='
#if canImport(FoundationNetworking)
import FoundationNetworking   // harness: Linux home of URLSession; Foundation on iOS
#endif'
while IFS= read -r line; do
  f="${line%%#*}"; f="$(echo "$f" | xargs)"
  [ -z "$f" ] && continue
  [ -f "$SRC/$f" ] || { echo "harness: engine-files.txt names a missing file: $SRC/$f" >&2; exit 2; }
  out="$T/Sources/FluentFrenchIOS/$(basename "$f")"
  sed -E "$uncomment_ui" "$SRC/$f" > "$out"
  printf '%s\n' "$networking" >> "$out"
done < "$H/engine-files.txt"
cp "$H/Shims.swift" "$T/Sources/FluentFrenchIOS/HarnessShims.swift"
for f in "$TESTS"/*.swift; do
  out="$T/Tests/FluentFrenchIOSTests/$(basename "$f")"
  sed -E "$uncomment_ui" "$f" > "$out"
  printf '%s\n' "$networking" >> "$out"
done
# Bundle.main is not the app bundle on Linux; tests look for the shipped content
# at <cwd>/Resources/FoundationContent.json.
cp -R "$SRC/Resources" "$T/Resources"

docker run --rm -v "$T":/work -w /work "$IMAGE" swift test "$@" > "$T/log.txt" 2>&1
code=$?
grep -E "error:|warning:|✘|Test run with|Build complete|Fatal error" "$T/log.txt" | grep -v '^\s*|' | sort -u | head -80
echo "--- exit=$code  full log: $T/log.txt"
rm -rf "$T/.build" "$T/Sources" "$T/Tests" "$T/Resources"
exit $code
