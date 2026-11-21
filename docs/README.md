# Okiri iOS — docs

| Document | What it is |
|---|---|
| [`workplan.md`](workplan.md) | The binding rules: scope, French content, honesty, engineering, evidence integrity, the verification gates, owner decisions and content schema v2 |
| [`roadmap.md`](roadmap.md) | The build plan: packages P1–P21 and the Depth lane (D3–D6), each with its status |
| [`spec-concept-map.md`](spec-concept-map.md) | D6, the A1–C1 concept map, including the D6.8 design for linking saved words to concepts |
| [`audit-findings.md`](audit-findings.md) | Every finding the audit loop confirmed and fixed, round by round |
| [`workflows/`](workflows/) | The Claude Code Workflow scripts behind the audits and design studies |

The developer tools live in [`ios/tools/`](../ios/tools/):

- the Linux test harness, `linuxbuild/run.sh`;
- the two import lints;
- the content validator.

## What was lost

Until November 2026, these documents lived in a cloud session's scratch directory
rather than in the repository, and they were lost when the container was rebuilt.
Everything on this page has been recovered or reconstructed: `roadmap.md` and
`workplan.md` are rebuilt, and each says so at the top. The following could not be
recovered:

- **The working roadmap's per-package change lists** (587 lines). The goals, efforts
  and dependencies survived on the published roadmap page.
- **The P1 adaptive-reading implementation spec** (about 1,050 lines) and **the
  reading-sources spec** (about 3,173 lines).
- **The six Expo-vs-iOS surface comparison reports.** Their conclusions survive in
  `roadmap.md`.
- **Authored French content that was never merged into the app:** about 1,196 example
  sentences, 135 listening items (beginner to advanced) and a ten-channel watch list.
  It had passed the content validator, but it existed only in the scratch directory.
- **The per-finding ledger entries for audit rounds 1–4.** Each round's commit message
  still describes its findings.

The lesson is now one of the verification gates in `workplan.md`: work that exists
only in a container is not safe.
