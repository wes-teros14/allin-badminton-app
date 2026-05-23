# Phase 15 UAT: Split Stats Aggregation

**Date:** 2026-05-23
**Mode:** automated browser verification
**Runner:** Playwright (`tests/phase15-split-stats.spec.ts`)
**Result:** PASS

## Scenarios Verified

1. Split `2-0` session:
   - Today leaderboard shows the winning player at `100%` with `2W 0L`
   - Session leaderboard shows the same `100%` and `2W 0L`

2. Split `1-1` session:
   - Player schedule renders a neutral `1-1` badge
   - Session leaderboard shows the player at `50%` with `1W 1L`

3. Legacy one-game session:
   - Session leaderboard shows the player at `100%` with `1W 0L`
   - Profile stats show the expected cumulative `games played` and `W/L` totals after the three verification sessions

## Notes

- The verification run used isolated schedule-locked sessions created by the Playwright spec and restored affected player stats afterward.
- `sessions_attended` was intentionally not used as a Phase 15 assertion because it is outside the split-stats scope.

