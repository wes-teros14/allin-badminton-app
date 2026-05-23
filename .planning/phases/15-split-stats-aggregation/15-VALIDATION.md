---
phase: 15
slug: split-stats-aggregation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-23
---

# Phase 15 - Validation Strategy

Nyquist validation was reconstructed after execution. The shared stats helper is covered by Vitest, and the player-facing split/legacy behavior is closed by a dedicated Playwright browser spec.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Playwright |
| **Config file** | `badminton-v2/playwright.config.ts` |
| **Quick run command** | `npm.cmd run test:unit` |
| **Full suite command** | `npx.cmd playwright test tests/phase15-split-stats.spec.ts` |
| **Estimated runtime** | ~35 seconds |

## Sampling Rate

- After every task commit: Run `npm.cmd run test:unit`
- After every plan wave: Run `npm.cmd run build`
- Before `$gsd-verify-work`: Run `npx.cmd playwright test tests/phase15-split-stats.spec.ts`
- Max feedback latency: 40 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | STAT-01 | — | `2-0` rows aggregate as two wins for the winning side and two games for all players | unit | `npm.cmd run test:unit` | [matchResults.test.ts](/C:/1Wes/all-in-badminton-app/badminton-v2/src/__tests__/matchResults.test.ts) | green |
| 15-01-02 | 01 | 1 | STAT-02 | — | `1-1` rows aggregate as one win per side across two games | unit | `npm.cmd run test:unit` | [matchResults.test.ts](/C:/1Wes/all-in-badminton-app/badminton-v2/src/__tests__/matchResults.test.ts) | green |
| 15-02-01 | 02 | 1 | STAT-03 | — | Today and session leaderboards count all `match_results` rows instead of treating only game 1 as authoritative | e2e | `npx.cmd playwright test tests/phase15-split-stats.spec.ts` | [phase15-split-stats.spec.ts](/C:/1Wes/all-in-badminton-app/badminton-v2/tests/phase15-split-stats.spec.ts) | green |
| 15-03-01 | 03 | 1 | STAT-03 | — | Player schedule/profile surfaces render split results correctly, including `1-1` draw state | e2e | `npx.cmd playwright test tests/phase15-split-stats.spec.ts` | [phase15-split-stats.spec.ts](/C:/1Wes/all-in-badminton-app/badminton-v2/tests/phase15-split-stats.spec.ts) | green |
| 15-03-02 | 03 | 1 | COMP-01 | — | Legacy one-game matches still count exactly once across stats surfaces | e2e | `npx.cmd playwright test tests/phase15-split-stats.spec.ts` | [phase15-split-stats.spec.ts](/C:/1Wes/all-in-badminton-app/badminton-v2/tests/phase15-split-stats.spec.ts) | green |
| 15-03-03 | 03 | 1 | COMP-02 | — | Draw-aware schedule updates do not regress one-game result rendering | e2e | `npx.cmd playwright test tests/phase15-split-stats.spec.ts` | [phase15-split-stats.spec.ts](/C:/1Wes/all-in-badminton-app/badminton-v2/tests/phase15-split-stats.spec.ts) | green |

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

## Manual-Only Verifications

All phase behaviors have automated verification.

## Validation Sign-Off

- [x] All tasks have automated verification
- [x] Sampling continuity preserved across all three plans
- [x] Existing infrastructure covered all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 40s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-23
