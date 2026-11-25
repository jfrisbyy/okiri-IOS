#!/usr/bin/env python3
"""Files that use Foundation types without importing Foundation.

MEMBER_IMPORT_VISIBILITY is on, so a member reached only through another
module's re-export is not guaranteed visible. Rather than model exactly which
re-exports survive -- round 7's two compile findings split on precisely that --
this errs safe: naming the dependency is never wrong for a file that uses it.
"""
import os, re, sys

# Walk the ios/ directory this script lives under, wherever it is run from, and skip
# the Linux harness's tree (its scratch runs hold copies of these files).
IOS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def swift_files():
    for root, _, files in os.walk(IOS):
        if "/.build" in root or "/tools/linuxbuild" in root:
            continue
        for fn in files:
            if fn.endswith(".swift"):
                yield os.path.join(root, fn)

TYPES = r'\b(Date|DateFormatter|DateComponents|DateInterval|Calendar|TimeInterval|TimeZone|Locale|URL|URLSession|URLRequest|URLComponents|UUID|Data|JSONEncoder|JSONDecoder|JSONSerialization|NSRegularExpression|NSAttributedString|NSRange|Bundle|FileManager|UserDefaults|NumberFormatter|Notification|NotificationCenter|OperationQueue|Process|Pipe|IndexSet|CharacterSet|Scanner|Measurement|PropertyListDecoder|ISO8601DateFormatter)\b'

# Foundation MEMBERS on stdlib types (String, Array, ...) and Dispatch entry points
# normally reached through Foundation. A file can spell none of the TYPES above and
# still fail to compile without `import Foundation` -- round 8's read-8-1 was exactly
# that: `query.trimmingCharacters(in: .whitespaces)` in a file importing only SwiftUI.
#
# Round 9's compile-9-1 was the same shape one level further out: WelcomeView spelled
# no Foundation type at all -- `String(data:encoding:)` on an inferred `Data?` and
# `PersonNameComponents.formatted()` on an inferred credential property -- so the
# initialiser and format-style spellings below matter as much as the method ones.
MEMBERS = (
    r'\.(?:trimmingCharacters\(|replacingOccurrences\(|components\(separatedBy|range\(of:'
    r'|folding\(options|addingPercentEncoding\(|removingPercentEncoding\b|localizedCapitalized\b'
    r'|localizedStandardContains\(|localizedCaseInsensitiveContains\(|capitalized\b'
    r'|precomposedStringWithCanonicalMapping\b|decomposedStringWithCanonicalMapping\b'
    r'|write\(to:|contentsOfFile:|formatted\(|data\(using:|addingTimeInterval\(|timeIntervalSince'
    r'|uuidString\b|appendingPathComponent\(|appendingPathExtension\(|pathExtension\b'
    r'|lastPathComponent\b|absoluteString\b|base64EncodedString\(|isoLatin1\b)'
    r'|\bString\((?:data:|bytes:|contentsOf:|decoding:)'
    r'|\bData\((?:base64Encoded:|contentsOf:)'
    r'|\b(?:DispatchQueue|DispatchGroup|DispatchSemaphore|DispatchWorkItem|DispatchTime)\b'
)

bad = []
for p in swift_files():
    src = open(p, encoding="utf-8", errors="replace").read()
    s = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    s = re.sub(r'//[^\n]*', '', s)
    s = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', s)
    imports = set(re.findall(r'^\s*(?:@preconcurrency\s+)?import\s+([A-Za-z_][A-Za-z0-9_.]*)', s, re.M))
    imports = {i.split('.')[0] for i in imports}
    if "Foundation" in imports:
        continue
    hits = sorted(set(re.findall(TYPES, s)))
    hits += sorted({m.strip(".") for m in re.findall(MEMBERS, s)})
    if hits:
        bad.append((p, hits[:6]))

for p, hits in bad:
    print("%s: uses %s but does not import Foundation" % (p, ", ".join(hits)))
print("---\n%d file(s)" % len(bad))
sys.exit(1 if bad else 0)
