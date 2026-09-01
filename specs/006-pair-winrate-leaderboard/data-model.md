# Data Model: Partner Combination Win-Rate Leaderboard

**Feature**: `006-pair-winrate-leaderboard` | **Date**: 2026-09-01

## Schema changes

**None.** No new table, no new column, no new index, no new policy, no migration file.

Per Constitution Principle II, a schema-backed behaviour change would require a migration plus `src/types/database.ts` updates. This feature reads existing tables only, so neither applies. If implementation concludes a migration is required, that is a signal to stop and re-plan, not to add one (spec FR-024).

## Tables read

All four are read-only for this feature. Every one already permits the read.

| Table | Columns read | Existing access |
|-------|--------------|-----------------|
| `matches` | `id`, `team1_player1_id`, `team1_player2_id`, `team2_player1_id`, `team2_player2_id`, `status`, `session_id` (via embed) | `"matches: read all"` — `SELECT` to `anon, authenticated` (`005_create_matches.sql:35`) |
| `match_results` | `winning_pair_index`, `game_number` (nested under `matches`) | `"match_results: read all"` — `SELECT` to `anon, authenticated` (`007_match_results_and_court.sql:41`) |
| `sessions` | `id`, `status`, `date` | Read policies already relied on by the existing leaderboard |
| `session_registrations` | `session_id`, `player_id` | Read-all policy (`009_session_registrations_read_all.sql`) |
| `profiles` | `id`, `nickname`, `name_slug`, `avatar_url`, `is_active` | Read policy already used by `fetchAllTimeLeaderboard()` |

## Tables explicitly NOT touched

`player_stats`, `player_pair_stats`, `player_cheer_stats`, their triggers from `013_player_stats_tables.sql`, and the reversal functions `reverse_session_stats` (`018`) and `unfinish_match` (`068`) are neither read nor written by this feature.

This is a scope boundary, not an oversight. `player_pair_stats.wins_together` already holds partner wins and would have been the obvious source — but its companion column `losses_against` counts losses *to an opponent*, not losses *beside a partner*, and partner losses cannot be reconstructed from it. Using that table would therefore have required a new column, a trigger change, and edits to both reversal paths. Deriving from match records avoids all four.

## Derived entities

Nothing below is stored. All of it is computed when the tab is viewed and discarded when it unmounts.

### PairTally

The raw output of the tally pass, one per unordered player combination encountered.

| Field | Type | Derivation |
|-------|------|------------|
| `key` | string | The two player ids sorted ascending and joined — stable, unique, order-independent (FR-004) |
| `playerA`, `playerB` | string | The two ids, in the same sorted order as the key |
| `wins` | number | Count of recorded games where this pair was the winning side |
| `losses` | number | Count of recorded games where this pair was the losing side |
| `games` | number | `wins + losses` — the pair's games together (FR-007) |

**Derivation rules**

1. Each `matches` row yields two candidate pairs: `(team1_player1_id, team1_player2_id)` and `(team2_player1_id, team2_player2_id)` (FR-005).
2. For each row in that match's `match_results`, `winning_pair_index = 1` means team 1 won and team 2 lost; `2` means the reverse (FR-008). Both pairs' `games` increase by one per result row.
3. A match with an empty `match_results` array contributes nothing (FR-009).
4. A candidate pair whose two ids are equal is discarded before tallying (research R5).

**Invariant**: `games === wins + losses` for every tally, always.

### PairLeaderboardEntry

A `PairTally` that survived eligibility, decorated for display.

| Field | Type | Derivation |
|-------|------|------------|
| `key` | string | Carried through from the tally; the React list key and the final sort tiebreaker |
| `players` | two entries of `{ id, displayName, avatarUrl }` | `displayName` from `disambiguateDisplayNames()`; `avatarUrl` from `profiles.avatar_url` |
| `wins`, `losses`, `games` | number | Carried through unchanged |
| `winRate` | number | `Math.round(wins / games * 100)` — identical to the player board (FR-010) |

## Validation rules

Applied in this order. Order matters: eligibility runs on complete tallies, so a pair is not accidentally admitted on a partial count.

| # | Rule | Source |
|---|------|--------|
| 1 | Discard pairs whose two ids are equal | research R5 |
| 2 | Require `games >= 6` | FR-012 |
| 3 | Require **both** players registered in ≥ 1 of the 4 most recent **completed** sessions | FR-013 |
| 4 | Require **both** players present in `profiles` with `is_active = true` | FR-014 |
| 5 | Sort: `winRate` desc → `wins` desc → `key` asc | FR-015, FR-016 |
| 6 | Take the first 10 | FR-017 |

Rules 3 and 4 reuse the exact queries `fetchAllTimeLeaderboard()` already runs (`RECENT_SESSIONS_WINDOW = 4`, `sessions.status = 'complete'`, `profiles.is_active = true`), so the two boards agree on who counts as an active player.

## Session scoping

The match query carries an inner join to `sessions` with no filter applied today. This is deliberate: it makes the future season or archive rule a single added condition on an existing join rather than a new embed (FR-025, research R3).

## State transitions

None. The feature is read-only and introduces no state machine, no writes, and no side effects. Per Constitution Principle IV, it cannot affect in-progress session continuity — there is no path from this code to a write.

Underlying data does move beneath it, and the board must tolerate that:

| Event elsewhere in the app | Effect on this board |
|---------------------------|----------------------|
| A match result is recorded | The pair gains a win or loss on the next load (FR-011) |
| An organiser un-finishes a match (`068`) | Its result rows are deleted, so the pair's totals fall on the next load — no reconciliation step (SC-008) |
| A player is deactivated | Every partnership containing them drops off (rule 4) |
| A player stops attending for 4+ completed sessions | Their partnerships drop off (rule 3) |
| A session is deleted outright | Its matches cascade away and those games vanish from the board — accepted, and moot once archiving is a flag rather than a deletion |
