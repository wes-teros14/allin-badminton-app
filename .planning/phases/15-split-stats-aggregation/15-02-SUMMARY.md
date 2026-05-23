---
plan: 15-02
phase: 15-split-stats-aggregation
status: complete
completed: 2026-05-23
subsystem: leaderboards
tags: [split-scoring, leaderboard, today-view, session-view]
requirements: [STAT-01, STAT-02, STAT-03, COMP-01]
dependency-graph:
  requires: [15-01]
  provides: [split-aware-leaderboards]
  affects: [TodayView, SessionPlayerDetailView]
tech-stack:
  added: []
  patterns: [shared-helper-reuse, map-merge]
key-files:
  created: []
  modified:
    - badminton-v2/src/views/TodayView.tsx
    - badminton-v2/src/views/SessionPlayerDetailView.tsx
---

# Phase 15 Plan 02: Leaderboard Aggregation Summary

Updated the today leaderboard and the session leaderboard to merge player totals from `computeStatsFromResults(match)` for every completed match. The UI remains unchanged; only the win/game totals now reflect split rows correctly.

## Self-Check

- Today leaderboard uses `computeStatsFromResults` ✓
- Session leaderboard uses `computeStatsFromResults` ✓
- Existing `{wins}W {losses}L` display preserved ✓
- `npm run test:unit` passed ✓
- `npm run build` passed ✓

