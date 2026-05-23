---
phase: 13-split-scoring-schema
plan: 02
subsystem: result-compatibility
tags: [react, supabase, compatibility, leaderboard, schedule]
requires:
  - phase: 13-01
    provides: `game_number` schema contract, updated DB types, and compatibility test baseline.
provides:
  - Shared `matchResults` helper for ordering and legacy winner normalization.
  - Explicit `game_number: 1` writes in current one-game admin and live-board flows.
  - Reader normalization across player stats, schedule, and leaderboard surfaces.
affects: [admin-finish, live-board-finish, player-stats, player-schedule, leaderboards]
tech-stack:
  added: []
  patterns:
    - Shared helper replaces raw `match_results[0]` assumptions.
    - Current one-game write paths emit explicit game numbers without changing UX.
key-files:
  created:
    - badminton-v2/src/lib/matchResults.ts
  modified:
    - badminton-v2/src/__tests__/matchResults.test.ts
    - badminton-v2/src/hooks/useAdminActions.ts
    - badminton-v2/src/components/CourtCard.tsx
    - badminton-v2/src/hooks/usePlayerStats.ts
    - badminton-v2/src/hooks/usePlayerSchedule.ts
    - badminton-v2/src/views/TodayView.tsx
    - badminton-v2/src/views/SessionPlayerDetailView.tsx
key-decisions:
  - "Kept Phase 13 compatibility semantics intentionally one-game-first by reading the earliest ordered result row."
  - "Avoided Phase 15 scope creep by not changing leaderboard math beyond ordered compatibility access."
patterns-established:
  - "Current result readers now normalize through `src/lib/matchResults.ts` instead of assuming the first nested row is authoritative."
requirements-completed:
  - FMT-01
  - RES-03
  - COMP-01
duration: 18 min
completed: 2026-05-23
---

# Phase 13 Plan 02: Split Scoring Schema Summary

**Shared result compatibility helper plus normalized one-game reader and writer paths**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-23T14:00:00+08:00
- **Completed:** 2026-05-23T14:18:00+08:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `badminton-v2/src/lib/matchResults.ts` to centralize split-scoring compatibility helpers.
- Updated `useAdminActions` and `CourtCard` to write `game_number: 1` explicitly for current one-game completions.
- Updated `usePlayerStats`, `usePlayerSchedule`, `TodayView`, and `SessionPlayerDetailView` to select `game_number` and normalize result interpretation through the helper instead of relying on raw first-element array access.

## Verification

- `npm.cmd run test:unit` - PASS, 70/70 tests
- `npm.cmd run build` - PASS
- `npm.cmd run lint` - PASS with 1 pre-existing warning in `src/views/ProfileView.tsx`

## Decisions Made

- The compatibility helper keeps current one-game semantics by treating the earliest ordered result row as the effective winner for existing readers.
- No split-result UI or multi-row aggregation changes were introduced in this phase.

## Deviations from Plan

- None in scope. All planned readers and both current writers were updated.

## Issues Encountered

- `npm.ps1` was blocked by PowerShell execution policy, so all verification commands were run via `npm.cmd`.
- Repo lint still reports one pre-existing exhaustive-deps warning in `ProfileView.tsx`, outside this phase's touched files.

## User Setup Required

- None beyond the Phase 13 migration application already recorded in Plan 01.

## Next Phase Readiness

Phase 14 can now add split-result entry logic on top of explicit `game_number` writes and shared compatibility helpers instead of reworking legacy assumptions first.

## Self-Check: PASSED

All touched app-side compatibility surfaces are updated, and the repo passes unit tests, build, and lint exit checks.

---
*Phase: 13-split-scoring-schema*
*Completed: 2026-05-23*
