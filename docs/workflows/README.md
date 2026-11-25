# Workflows

These are Claude Code [Workflow](https://code.claude.com/docs) scripts. Each one
orchestrates many agents in a fixed structure, so a run can be repeated.

| Script | What it does |
|---|---|
| `audit-round.js` | One beta-readiness audit round. Run it as `{round: N}`. Seven auditors cover the 128 Swift files between them, and every file belongs to exactly one area. Three adversarial refuters check each finding. Fix agents then work area by area, in waves that touch disjoint files, and a final pass rechecks compilation. It reads `docs/audit-findings.md` so that it never re-reports an earlier finding. |
| `fluency-depth-audit.js` | September 2026: can a learner reach fluency end to end? |
| `teachability-architecture.js` | September 2026: the design study behind D6.8 and the evidence-weight floor. |
| `taxonomy-sufficiency.js` | September 2026: is the 181-concept taxonomy enough for C1? (80 of 96 proposals refuted.) |

The three September scripts are records of studies that have already run. Facts in
their prompts describe the repository as it was then.
