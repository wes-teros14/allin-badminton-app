# Contract: Pair Tally Helper

**Feature**: `006-pair-winrate-leaderboard` | **Module**: `badminton-v2/src/lib/pairStats.ts` (new)

The pure logic of this feature. No network, no React, no Supabase client — takes match rows in, gives pair tallies out, so every counting rule is unit-testable in isolation.

## Exports

### `pairKey(playerA: string, playerB: string): string`

Returns a stable, order-independent identifier for a partnership: the two ids sorted ascending and joined with a separator that cannot occur in a UUID.

**Contract**

- `pairKey(a, b) === pairKey(b, a)` for all inputs (FR-004)
- The same two ids always produce the same string, across loads and processes
- Callers are responsible for not passing `a === b`; `tallyPairs` filters those out (see below)

### `tallyPairs(matches: PairTallyMatch[]): Map<string, PairTally>`

Walks the match rows once and returns one tally per partnership encountered.

**Input shape** — deliberately structural, not the Supabase row type, so tests can build fixtures without a database:

```ts
interface PairTallyMatch {
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  match_results: Array<{ winning_pair_index: number; game_number?: number | null }> | null | undefined
}

interface PairTally {
  key: string
  playerA: string   // the lower-sorting id
  playerB: string   // the higher-sorting id
  wins: number
  losses: number
  games: number
}
```

**Rules**

1. Each match contributes two candidate pairs: team 1's two players, and team 2's two players (FR-005).
2. A candidate pair whose two ids are equal is **skipped entirely** — neither tallied nor created (research R5). The other pair in that match is still tallied normally.
3. Result rows are normalized through `sortMatchResults()` from `lib/matchResults.ts`, so a missing `game_number` behaves exactly as it does on every other stats surface.
4. For each result row: `winning_pair_index === 2` means team 2 won and team 1 lost; any other value means team 1 won and team 2 lost. This mirrors `computeStatsFromResults()` exactly, including its treatment of unexpected values.
5. A match with `null`, `undefined`, or an empty `match_results` array contributes nothing to any pair (FR-009).
6. `games` is incremented for both pairs on every result row, so `games === wins + losses` always holds.

**Invariants**

- Calling `tallyPairs` twice on the same input returns equal tallies
- No returned tally has `playerA === playerB`
- No returned tally has `games === 0`
- `wins + losses === games` for every returned tally

### `rankPairs(tallies, options): RankedPair[]`

Applies the eligibility floor and the ordering. Kept separate from `tallyPairs` so the threshold can be tuned or tested without touching the counting.

**Contract**

- Excludes any tally with `games < options.minGames` (FR-012, default 6)
- Excludes any tally either of whose players fails `options.isEligiblePlayer(id)` — the caller supplies this, combining the activity window and the active-profile check (FR-013, FR-014)
- `winRate` is `Math.round(wins / games * 100)`; a tally with `games === 0` yields `0` rather than `NaN` (research R9)
- Orders by `winRate` descending, then `wins` descending, then `key` ascending (FR-015, FR-016)
- Assigns a dense `rank`: equal `winRate` shares a rank, and the next distinct rate takes the next number (FR-015a, FR-015b)
- Returns `options.limit` entries (default 10), extended so a tie group straddling the cut is kept whole (FR-017)
- `groupByRank(ranked)` collapses the result into one group per shared rank, so the view draws the rank once (FR-015c)
- Given identical input, returns an identically ordered array every time — no dependence on input order

## Worked examples

**Split-scored match, 1-1.** Team 1 is (A, B); team 2 is (C, D). `match_results` holds two rows: `{winning_pair_index: 1, game_number: 1}` and `{winning_pair_index: 2, game_number: 2}`.

Result: pair (A,B) → 1W 1L, 2 games. Pair (C,D) → 1W 1L, 2 games. (SC-005)

**Same duo, both slot orders.** Match 1 has team 1 = (A, B) and wins. Match 2 has team 2 = (B, A) and wins.

Result: one entry keyed on sorted (A,B) with 2W 0L, 2 games — not two entries. (FR-004)

**Legacy self-pair row.** A historical match has team 1 = (A, A) and team 2 = (C, D), with one result row where team 2 won.

Result: pair (A,A) is absent entirely. Pair (C,D) → 1W 0L, 1 game. The malformed side does not suppress the valid one. (research R5)

**Unfinished match.** A match whose results were deleted by `unfinish_match` has an empty `match_results` array.

Result: no tally changes at all — as if the match were not in the input. (FR-009, SC-008)

## Non-goals

This module does not fetch data, resolve display names, apply avatars, or know what a session is. Name resolution via `disambiguateDisplayNames()` and the eligibility queries live in the view's fetcher — see `pair-leaderboard-read.md`.
