# Phase 15: Split Stats Aggregation - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all app-side stats surfaces — session leaderboards, today leaderboard, player schedule, and all-time player stats — so they count every game-level result row independently rather than treating only game 1 as authoritative. The Postgres-side `player_stats` trigger already fires per row and requires no changes. This phase is purely app-side computation fixes plus a small GameCard UI extension for the 1-1 draw outcome.

</domain>

<decisions>
## Implementation Decisions

### Stats Computation Approach
- **D-01:** Add a new split-aware helper function (e.g., `computeStatsFromResults`) in `src/lib/matchResults.ts` that iterates ALL `match_results` rows for a match and accumulates `{ wins, games }` per player/team, instead of using `getLegacyWinningPairIndex` (which only reads game 1).
- **D-02:** `getLegacyWinningPairIndex` is kept as-is — it is still used for backward-compat single-game checks (e.g., queue advancement). The new helper is additive, not a replacement.
- **D-03:** `useProfileStats` reads from the `player_stats` Postgres table which is updated by a `FOR EACH ROW` trigger on `match_results`. With split matches inserting 2 rows, this trigger already fires twice and counts correctly. **No DB migration or change to `useProfileStats` is required.**

### Leaderboard Surfaces (TodayView, SessionPlayerDetailView)
- **D-04:** Both `fetchSessionLeaderboard` (TodayView) and `fetchLeaderboard` (SessionPlayerDetailView) contain in-function loops over `match.match_results`. Replace the current `getLegacyWinningPairIndex` call in those loops with iteration over every result row — each row contributes 1 game and 1 win to the appropriate team's players.
- **D-05:** Leaderboard column labels and display style stay unchanged (`2W 1L`). Numbers will naturally be higher for split-scoring sessions — no UI label changes needed.

### All-Time Player Stats Hook (usePlayerStats)
- **D-06:** `usePlayerStats` computes `wins` and `totalGames` client-side using `getLegacyWinningPairIndex`. Replace with the same per-row iteration — every result row in `match.match_results` contributes one game and (if the player's team won) one win.

### Player Schedule — Split Match Outcome (usePlayerSchedule + GameCard)
- **D-07:** The `PlayerMatch` type currently has `won: boolean | null`. Extend it with a new field: `outcome: 'won' | 'lost' | 'draw' | null`. For legacy one-game matches, `outcome` mirrors `won`. For split matches:
  - `2-0` result: `outcome = 'won'` for winning players, `outcome = 'lost'` for losing players.
  - `1-1` result: `outcome = 'draw'` for all four players.
- **D-08:** `won` stays on `PlayerMatch` for backward compatibility (computed from `outcome` for non-null cases: won → true, lost → false, draw → null).
- **D-09:** `GameCard` receives the `outcome` prop and renders a neutral muted chip labeled **"1-1"** for the draw state — same rounded chip style as the win/loss chip, just with a muted/gray background and "1-1" text instead of ✓ or ✗.

### Compatibility
- **D-10:** One-game legacy matches (single `match_results` row with `game_number = 1`) must produce identical stats output to what they produced before Phase 15. The new iteration-based helper naturally handles this: one row → one game counted.
- **D-11:** No DB migrations needed for this phase.

### Claude's Discretion
- Exact function signature for the new split-aware stats helper
- Whether `computeStatsFromResults` is exported or kept private to its consumers
- How the draw detection logic is structured in `usePlayerSchedule` (e.g., checking result count and comparing winners across all game rows)
- Minor GameCard chip color choice for the draw state (muted gray recommended)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stats Computation (fix targets)
- `badminton-v2/src/lib/matchResults.ts` — Add new split-aware helper here; `getLegacyWinningPairIndex` stays for compat
- `badminton-v2/src/hooks/usePlayerStats.ts` — All-time stats hook; currently uses `getLegacyWinningPairIndex`
- `badminton-v2/src/hooks/usePlayerSchedule.ts` — Schedule `won` field; extend to `outcome` field for draw detection

### Leaderboard Surfaces (fix targets)
- `badminton-v2/src/views/TodayView.tsx` — `fetchSessionLeaderboard` function; uses `getLegacyWinningPairIndex`
- `badminton-v2/src/views/SessionPlayerDetailView.tsx` — `fetchLeaderboard` function; same pattern as TodayView

### UI (GameCard draw state)
- `badminton-v2/src/components/GameCard.tsx` — Add draw outcome rendering for "1-1" chip

### DB Layer (no changes needed — read for context only)
- `badminton-v2/supabase/migrations/013_player_stats_tables.sql` — `update_player_stats_on_result` trigger fires FOR EACH ROW; already counts split rows correctly
- `badminton-v2/src/hooks/useProfileStats.ts` — Reads `player_stats` DB table; no app-side changes needed

### Requirements
- `.planning/REQUIREMENTS.md` — STAT-01, STAT-02, STAT-03, COMP-01, COMP-02

### Phase 13/14 Foundation
- `badminton-v2/supabase/migrations/063_add_split_scoring_schema.sql` — Adds `match_results.game_number`; every split match row has a distinct game_number
- `.planning/phases/13-split-scoring-schema/13-CONTEXT.md` — D-08: "legacy one-game results read as game 1" — the compatibility rule this phase builds on

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getLegacyWinningPairIndex(results)` in `matchResults.ts`: reads only game 1 — keep but don't use for stats aggregation
- `sortMatchResults(results)` in `matchResults.ts`: normalizes and sorts by `game_number` — useful in the new helper
- Leaderboard `statsMap` pattern in `TodayView` and `SessionPlayerDetailView`: `Map<playerId, { wins, games }>` accumulated in a loop — extend the inner loop to iterate each result row

### Established Patterns
- Stats accumulation: `statsMap.get(id).wins++` / `statsMap.get(id).games++` in both leaderboard fetchFunctions — the new per-row loop follows the exact same shape
- Chip rendering in GameCard: currently renders `won` boolean as a ✓ or ✗ chip — add a third branch for `outcome === 'draw'` returning a muted "1-1" chip
- Supabase result fetch: `match_results(winning_pair_index, game_number)` is already selected in all relevant queries — no fetch changes needed, just logic changes

### Integration Points
- `usePlayerSchedule` → `PlayerMatch[]` → `GameCard` — the `outcome` field flows from hook to card; no parent components need changes
- `TodayView` and `SessionPlayerDetailView.LeaderboardTab` are self-contained — changes are isolated to the inner fetch functions
- `usePlayerStats` is consumed by the player profile view — changing wins/totalGames values is the only external effect

</code_context>

<specifics>
## Specific Ideas

- The "1-1" chip on GameCard should feel consistent with the existing win/loss chip — same border-radius, same font size — just muted/neutral color to signal neither a full win nor a full loss.
- The per-row iteration approach (loop over every game row) is simpler and more correct than trying to detect split vs non-split mode — it naturally works for both, since one-game matches have exactly one row.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-split-stats-aggregation*
*Context gathered: 2026-05-23*
