# Retrospective

## Milestone: v1.3 - Split Match Scoring

**Shipped:** 2026-05-23
**Phases:** 3 | **Plans:** 8

### What Was Built

- Added split-scoring schema support with session-level mode and game-numbered match results
- Added split result entry to admin and live board flows
- Added split-aware stats aggregation across leaderboard, schedule, and profile surfaces
- Added browser verification for split write-path and read-path behavior

### What Worked

- The phase split was clean: schema first, write path second, read path third
- Shared helpers reduced duplicate logic across result-entry and stats surfaces
- Playwright was effective for closing browser/DB validation gaps late in the milestone

### What Was Inefficient

- Nyquist validation artifacts were added after execution instead of during the phases
- Milestone docs drifted and had to be repaired before closeout
- Windows execution policy friction still slows routine verification commands

### Patterns Established

- Treat game-level rows as the canonical stats source, then derive legacy compatibility as a thin layer
- Close milestone audits with real browser coverage rather than leaving durable human-needed gaps
- Keep session-level feature flags threaded from one authoritative session read

### Key Lessons

- If a phase changes both write-path and read-path behavior, add E2E coverage before milestone audit
- Planning artifacts should be updated alongside validation, not after the fact
- Split compatibility work is easier when legacy semantics are centralized in a helper module

### Cost Observations

- Model mix: not tracked in repo artifacts
- Sessions: 1 concentrated milestone closeout day
- Notable: late validation automation prevented a false-negative milestone archive

## Cross-Milestone Trends

- Browser automation is becoming necessary for milestone close confidence, not optional polish
- Planning and validation drift is the main recurring closeout risk, more than implementation defects
