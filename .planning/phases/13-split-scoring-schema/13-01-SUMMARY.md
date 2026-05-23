---
phase: 13-split-scoring-schema
plan: 01
subsystem: schema-contract
tags: [supabase, migration, typescript, vitest]
requires:
  - phase: 12-public-registration-homepage
    provides: Stable one-game match completion flows and existing `match_results` consumers.
provides:
  - Split-scoring schema migration with `sessions.split_match_scoring` and `match_results.game_number`.
  - Updated `database.ts` contract for the new fields.
  - Compatibility test baseline for legacy game-1 result behavior.
affects: [database-schema, result-contract, generated-types, unit-tests]
tech-stack:
  added: []
  patterns:
    - Additive migration with legacy normalization via default `game_number = 1`.
    - Database-enforced composite uniqueness on `(match_id, game_number)`.
key-files:
  created:
    - badminton-v2/supabase/migrations/063_add_split_scoring_schema.sql
    - badminton-v2/src/__tests__/matchResults.test.ts
  modified:
    - badminton-v2/src/types/database.ts
key-decisions:
  - "Kept `game_number` non-null with default 1 so later phases do not need nullable legacy handling."
  - "Made the composite `(match_id, game_number)` rule authoritative and prepared the migration to drop hidden one-row-per-match blockers if present."
patterns-established:
  - "Legacy one-game result rows are normalized as game 1 in both SQL and helper-backed tests."
requirements-completed:
  - FMT-01
  - RES-03
  - RES-04
  - COMP-01
duration: 20 min
completed: 2026-05-23
---

# Phase 13 Plan 01: Split Scoring Schema Summary

**Schema and type contract for split scoring, with compatibility tests locking legacy one-game rows to game 1**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-23T13:40:00+08:00
- **Completed:** 2026-05-23T14:00:00+08:00
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `063_add_split_scoring_schema.sql` with `sessions.split_match_scoring`, `match_results.game_number`, a game-number check, and composite uniqueness on `(match_id, game_number)`.
- Updated `badminton-v2/src/types/database.ts` so session and match-result types expose the new fields.
- Added `badminton-v2/src/__tests__/matchResults.test.ts` to lock in the compatibility contract for missing split mode, legacy game 1 normalization, result ordering, and effective winner lookup.

## Verification

- `npm.cmd run test:unit` - PASS, 70/70 tests
- `npm.cmd run build` - PASS

## Decisions Made

- The migration is additive and keeps `game_number` defaulted to `1` instead of introducing a nullable rollout.
- Any hidden unique-on-`match_id` blocker is removed in SQL so Phase 14 can write multiple result rows later.

## Deviations from Plan

- The compatibility helper itself was finalized during Plan 02, but Plan 01's test baseline was still created and validated in the same execution session.

## Issues Encountered

- The live Supabase migration could not be applied from this terminal because the project still relies on Dashboard SQL execution on Windows.
- PowerShell execution policy blocked `npm.ps1`; verification was rerun successfully with `npm.cmd`.

## User Setup Required

- Apply `badminton-v2/supabase/migrations/063_add_split_scoring_schema.sql` in the Supabase Dashboard SQL Editor.

## Next Phase Readiness

The repository-side schema contract and type updates are in place. App-side readers and writers can now normalize around `game_number` without changing user-facing split behavior yet.

## Self-Check: PASSED WITH MANUAL FOLLOW-UP

The code, tests, and build are green. Live database application still needs a manual dashboard step before phase verification can become fully passed.

---
*Phase: 13-split-scoring-schema*
*Completed: 2026-05-23*
