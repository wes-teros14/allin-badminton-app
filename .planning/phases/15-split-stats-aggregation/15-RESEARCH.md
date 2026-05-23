# Phase 15: Split Stats Aggregation - Research

**Researched:** 2026-05-23
**Domain:** App-side aggregation fixes for split match results
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add a split-aware helper in `src/lib/matchResults.ts` that iterates all `match_results` rows.
- **D-02:** Keep `getLegacyWinningPairIndex` for backward-compatible one-game winner checks.
- **D-03:** `useProfileStats` and the `player_stats` Postgres trigger need no changes.
- **D-04:** Today/session leaderboards must count every result row independently.
- **D-05:** `usePlayerStats` must stop treating only game 1 as authoritative.
- **D-06:** `usePlayerSchedule` should expose a new `outcome` field so split `1-1` matches render as a draw.
- **D-07:** `GameCard` should show a muted `1-1` badge for draw outcomes.
- **D-08:** One-game legacy matches must continue to count exactly once everywhere.

### Claude's Discretion
- Helper signature and naming inside `matchResults.ts`
- Exact split between helper-level and consumer-level tests
- Draw-chip color token choice in `GameCard`

### Deferred Ideas (OUT OF SCOPE)
- Any database migration or trigger rewrite
- Any queue advancement or result-entry behavior change
- Any label rewrite for leaderboard `W/L` text
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAT-01 | A `2-0` result counts as two wins for each winning player. | Iterate every `match_results` row; each winning row contributes one win. |
| STAT-02 | A `1-1` result counts as one win for each team's players. | Two rows with different winners naturally produce one win per team. |
| STAT-03 | Stats surfaces aggregate all game-level result rows correctly. | Replace all `getLegacyWinningPairIndex` aggregation paths with per-row accumulation. |
| COMP-01 | Legacy one-game matches still count once. | One-row matches still produce exactly one game in the new helper. |
| COMP-02 | Existing lifecycle/realtime behavior keeps working. | This phase touches read-side aggregation only, plus a schedule badge. |
</phase_requirements>

## Summary

Phase 15 is entirely an app-side read-model correction. The database already stores split results as separate `match_results` rows, and the `player_stats` trigger already updates once per inserted row. The remaining defects are all places in the React app that still collapse a match down to `getLegacyWinningPairIndex(...)`, which only reads the first result row.

The cleanest implementation is to centralize per-row aggregation in `matchResults.ts`, then reuse that logic in the all-time player stats hook and both leaderboard surfaces. The player schedule needs one additional concern: it is not just counting wins, it needs a presentational match outcome. For split results, `1-1` should become a first-class draw state instead of being coerced to a normal win/loss.

**Primary recommendation:** Plan the phase in three steps. First, add and test a split-aware aggregation helper, then migrate `usePlayerStats`. Second, update the two leaderboard surfaces to use the same helper so all session/today calculations match. Third, extend `usePlayerSchedule` and `GameCard` with a draw-aware outcome contract while preserving the legacy `won` field for compatibility.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Per-row stats math | `src/lib/matchResults.ts` | Hooks/views | One shared helper prevents drift between surfaces. |
| All-time player stats | `usePlayerStats` | helper tests | Hook should consume shared math, not reimplement winner logic. |
| Session/today leaderboards | `TodayView`, `SessionPlayerDetailView` | helper | Both already use identical `statsMap` patterns. |
| Schedule draw rendering | `usePlayerSchedule` | `GameCard` | Hook computes outcome state; card renders it. |
| Profile stats DB aggregate | Postgres trigger + `useProfileStats` | none | Already row-based; phase should not duplicate this logic. |

## Architecture Patterns

### Pattern 1: Shared Per-Row Aggregation Helper

Create one helper that consumes a match's teams plus all result rows and returns `{ games, wins }` totals by player or team membership. This avoids duplicating split-match rules across three read surfaces.

### Pattern 2: Additive Outcome Contract

Keep `PlayerMatch.won` for backward compatibility, but add `outcome: 'won' | 'lost' | 'draw' | null`. This lets schedule/UI code represent `1-1` cleanly without breaking existing call sites that still expect `won`.

### Pattern 3: Natural Legacy Compatibility

Do not branch on "split mode" when aggregating historical stats. A one-game match already has exactly one result row, so the per-row helper naturally preserves legacy behavior.

## Anti-Patterns to Avoid

- Replacing `getLegacyWinningPairIndex` globally. It still has valid single-winner use cases outside stats.
- Adding split-mode conditionals to leaderboard logic. Row iteration is simpler and safer.
- Touching `useProfileStats` or the `player_stats` migration path. Those are already correct.
- Encoding draw UI directly from raw result arrays in `GameCard`. The hook should compute the outcome contract.

## Validation Architecture

| Area | Validation |
|------|------------|
| Shared helper semantics | Unit tests covering legacy one-row, `2-0`, and `1-1` result sets |
| Hook/view compile safety | `npm run build` |
| Regression coverage | `npm run test:unit` |
| UI/read-path lint | `npm run lint` |

### Human Verification Focus

1. A split `2-0` session shows `2W 0L` impact on today and session leaderboards.
2. A split `1-1` match renders a muted `1-1` chip on the player schedule.
3. A legacy one-game match still renders win/loss and counts once everywhere.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/phases/15-split-stats-aggregation/15-CONTEXT.md`
- `badminton-v2/src/lib/matchResults.ts`
- `badminton-v2/src/hooks/usePlayerStats.ts`
- `badminton-v2/src/hooks/usePlayerSchedule.ts`
- `badminton-v2/src/views/TodayView.tsx`
- `badminton-v2/src/views/SessionPlayerDetailView.tsx`
- `badminton-v2/src/components/GameCard.tsx`
- `badminton-v2/supabase/migrations/013_player_stats_tables.sql`
- `badminton-v2/src/hooks/useProfileStats.ts`

## Metadata

**Confidence breakdown:**
- Shared helper direction: HIGH
- Leaderboard migration scope: HIGH
- Schedule draw outcome approach: HIGH

**Research date:** 2026-05-23
**Valid until:** 2026-06-22
