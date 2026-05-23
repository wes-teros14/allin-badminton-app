---
plan: 15-01
phase: 15-split-stats-aggregation
status: complete
completed: 2026-05-23
subsystem: stats-foundation
tags: [split-scoring, stats, helper, profile]
requirements: [STAT-01, STAT-02, STAT-03, COMP-01]
dependency-graph:
  requires: []
  provides: [compute-stats-from-results]
  affects: [matchResults, usePlayerStats]
tech-stack:
  added: []
  patterns: [shared-helper, row-based-aggregation]
key-files:
  created: []
  modified:
    - badminton-v2/src/lib/matchResults.ts
    - badminton-v2/src/hooks/usePlayerStats.ts
    - badminton-v2/src/__tests__/matchResults.test.ts
---

# Phase 15 Plan 01: Shared Stats Helper Summary

Added `computeStatsFromResults` to centralize split-aware row aggregation and migrated `usePlayerStats` to that helper. All-time profile stats now count every `match_results` row instead of treating only game 1 as authoritative.

## Self-Check

- `computeStatsFromResults` exported from `matchResults.ts` ✓
- Helper covers legacy one-row, `2-0`, and `1-1` result sets in unit tests ✓
- `usePlayerStats` no longer uses `getLegacyWinningPairIndex` ✓
- `npm run test:unit` passed (76 tests) ✓
- `npm run build` passed ✓

