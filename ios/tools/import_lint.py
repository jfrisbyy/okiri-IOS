#!/usr/bin/env python3
"""Attribute/type usage vs required import. MEMBER_IMPORT_VISIBILITY is on, so
transitive imports do not cover these -- each is a type-check error, invisible
to `swiftc -parse` and to the Linux harness (which omits view/network files)."""
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

# symbol -> (regex, set of modules any one of which satisfies it)
RULES = [
 ("@Observable",        r'@Observable\b',                 {"Observation"}),
 ("@ObservationIgnored",r'@ObservationIgnored\b',         {"Observation"}),
 ("ObservableObject",   r'\bObservableObject\b',          {"Combine","SwiftUI"}),
 ("@Published",         r'@Published\b',                  {"Combine","SwiftUI"}),
 ("@Model",             r'@Model\b',                      {"SwiftData"}),
 ("AVAudio/AVPlayer",   r'\bAV(Audio|Player|Speech|Capture|Asset)\w*',{"AVFoundation","AVFAudio","AVKit"}),
 ("UIKit type",         r'\bUI(Application|Device|Impact|Notification|Pasteboard|Screen|View(Controller)?|Color|Image)\b',{"UIKit","SwiftUI"}),
 ("Combine pub",        r'\b(AnyCancellable|PassthroughSubject|CurrentValueSubject)\b',{"Combine"}),
 ("os.Logger",          r'\bLogger\(',                    {"OSLog","os"}),
 ("CryptoKit",          r'\b(SHA256|SymmetricKey|AES\.GCM)\b',{"CryptoKit"}),
]

bad=[]
for p in swift_files():
    src=open(p,encoding="utf-8",errors="replace").read()
    # strip line + block comments and string literals so mentions in prose don't count
    s=re.sub(r'/\*.*?\*/','',src,flags=re.S)
    s=re.sub(r'//[^\n]*','',s)
    s=re.sub(r'"(?:[^"\\\n]|\\.)*"','""',s)
    imports=set(re.findall(r'^\s*(?:@preconcurrency\s+)?import\s+([A-Za-z_][A-Za-z0-9_.]*)',s,re.M))
    imports={i.split('.')[0] for i in imports}
    for name,pat,need in RULES:
        if re.search(pat,s) and not (imports & need):
            bad.append((p,name,"|".join(sorted(need))))
for p,name,need in bad:
    print("%s: uses %s but imports none of {%s}"%(p,name,need))
print("---\n%d file/symbol violations"%len(bad))
sys.exit(1 if bad else 0)
