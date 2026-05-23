---
plan: 15-03
phase: 15-split-stats-aggregation
status: complete
completed: 2026-05-23
subsystem: player-schedule
tags: [split-scoring, schedule, game-card, draw-state]
requirements: [STAT-02, STAT-03, COMP-01, COMP-02]
dependency-graph:
  requires: [15-01]
  provides: [draw-aware-schedule]
  affects: [usePlayerSchedule, GameCard, SessionPlayerDetailView]
tech-stack:
  added: []
  patterns: [additive-contract, derived-outcome]
key-files:
  created: []
  modified:
    - badminton-v2/src/hooks/usePlayerSchedule.ts
    - badminton-v2/src/components/GameCard.tsx
    - badminton-v2/src/views/SessionPlayerDetailView.tsx
---

# Phase 15 Plan 03: Schedule Outcome Summary

Extended `usePlayerSchedule` with a new `outcome` field and kept `won` for backward compatibility. Completed split `1-1` matches now surface as `outcome: 'draw'`, and `GameCard` renders a neutral `1-1` chip while legacy one-game matches still show win/loss.

## Self-Check

- `PlayerMatch` now carries `outcome` plus legacy `won` ✓
- Split `1-1` schedules render a muted `1-1` badge ✓
- Session schedule cards pass `outcome` through to `GameCard` ✓
- `npm run test:unit` passed ✓
- `npm run build` passed ✓

