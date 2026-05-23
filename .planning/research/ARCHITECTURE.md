# Architecture Research: v1.3 Split Match Scoring

## Current Flow

1. `useSession.lockSchedule` inserts one row per scheduled match in `matches`.
2. Starting a session marks the first queued matches as `playing`.
3. `CourtCard` and `CourtTabs` finish a match by marking the match `complete` and inserting one `match_results` row.
4. `on_match_result_insert` trigger increments `player_stats` and `player_pair_stats` once per inserted result row.
5. Leaderboard and schedule views read `match_results`, but several views use only `match_results[0]`.

## Recommended Design

Keep one `matches` row as the scheduled match and store each split game as its own `match_results` row.

Why:

- The existing stats trigger already counts each result row as one game.
- A `2-0` result naturally becomes two rows for the same winner.
- A `1-1` result naturally becomes two rows with opposite winners.
- No custom draw math is needed in `player_stats`.

## Build Order

1. Add DB migration and TypeScript type updates.
2. Add result aggregation helpers for interpreting all result rows per match.
3. Update live board and admin court finish flows to insert one or two result rows atomically enough for the UI path.
4. Update player schedule/profile/session leaderboard readers to aggregate all rows.
5. Add focused unit tests for aggregation logic and E2E or integration coverage for the split result flow.

