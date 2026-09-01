# Contract: Partnership Board Data Access

**Feature**: `006-pair-winrate-leaderboard` | **Location**: `fetchPairLeaderboard()` in `badminton-v2/src/views/LeaderboardView.tsx`

Mirrors the existing `fetchAllTimeLeaderboard()` in the same file: an async function returning display-ready entries, called from a small component that owns loading state. No new hook, no new context — the existing tabs set the pattern and Constitution UI Rules say to preserve it.

## Reads

### 1. Match rows (paginated)

```
from('matches')
  .select('id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index, game_number), sessions!inner(id)')
  .eq('status', 'complete')
  .order('id', { ascending: true })
  .range(offset, offset + PAGE_SIZE - 1)
```

**Pagination is mandatory.** Loop, advancing `offset` by `PAGE_SIZE` (1000), until a page returns fewer rows than requested. A single unpaginated call is silently truncated by the server's row cap and produces wrong win rates with no error — see research R2.

**Verification**: issue the same filter with `{ count: 'exact', head: true }` and assert the total matches the number of rows accumulated. A mismatch means pagination is broken; fail loudly rather than rendering a plausible-looking wrong board.

**The `sessions!inner(id)` embed is intentional and must not be removed as "unused".** It exists so a future season rule is one added `.eq('sessions.…', …)` line (FR-025). Leave a comment saying so.

### 2. Recent completed sessions — the activity window

Identical to what `fetchAllTimeLeaderboard()` already does: the 4 most recent sessions with `status = 'complete'`, ordered by `date` descending, then every `session_registrations.player_id` for those sessions. Reuse the existing `RECENT_SESSIONS_WINDOW` constant rather than declaring a second one.

### 3. Active profiles

`profiles` where `is_active = true`, selecting `id, nickname, name_slug, avatar_url` — the same query the player board runs.

All three reads issue in parallel via `Promise.all`, as the existing fetchers do.

## Composition

1. Page through matches, accumulating rows.
2. `tallyPairs(rows)` → `Map<string, PairTally>`.
3. Build the eligible-player set: present in the active-profiles result **and** present in the recent-registrations set.
4. `rankPairs(tallies, { minGames: 6, limit: 10, isEligiblePlayer })`.
5. Resolve labels for the players appearing in the ranked pairs through `disambiguateDisplayNames()` — **not** bare `formatDisplayName()`. Two real players can share a nickname, and on a pair row that renders as "Alexis & Alexis", which is indistinguishable from the duplicate-player data bug migration `079` was written to stop (research R4).
6. Attach `avatar_url` per player and return.

## Return shape

```ts
interface PairLeaderboardEntry {
  key: string
  players: [
    { id: string; displayName: string; avatarUrl: string | null },
    { id: string; displayName: string; avatarUrl: string | null },
  ]
  wins: number
  losses: number
  games: number
  winRate: number
}
```

## Rendering contract

A `PairsLeaderboard()` component beside the existing `WinsLeaderboard()`, reusing its visual language exactly (Constitution UI Rules — preserve the established pattern):

- **Row**: `RANK_ICON(i)` → both avatars → both names → right-aligned `{winRate}%` with `{wins}W {losses}L` beneath, in the same type sizes and card styling the player rows use.
- **Avatars**: two `<Avatar>` at the player board's size, overlapped slightly with a negative margin and a ring so they read as one unit rather than two list items. The pair, not each player, is the row's subject.
- **Names**: joined with `&`. Must stay legible at phone width with two long names — truncate the name block as a whole rather than letting it push the win rate off the row (FR-020).
- **Caption**: same placement and styling as the player board's, stating ranking basis and both eligibility rules, e.g. *"Ranked by win rate · min. 6 games together · both players active in the last 4 sessions"* (FR-021).
- **Loading**: the existing skeleton treatment, sized for the taller pair row (FR-022).
- **Empty**: a plain message in the muted style used by `WinsLeaderboard`'s "No stats recorded yet." (FR-022).

## Tab wiring

- Extend the `Tab` union with a fourth value and add it to the tab-switcher array; the existing `?tab=` handling via `useSearchParams` then covers FR-002 with no extra code.
- The label follows the playful naming of "Mga Lodi" rather than a literal English word. Suggested: **"Tambalan"**. Cosmetic — settle it with the organiser at implementation time.
- The three existing tabs' code paths must not be edited (FR-003).

## Failure behaviour

Match the existing fetchers: a failed read resolves to an empty list and the empty state renders. Do not introduce a new error UI on this tab alone — that would be a surface inconsistency, and the existing tabs establish the convention. The one exception is the pagination count mismatch above, which is a correctness bug rather than a transient failure and must not be swallowed into an innocuous-looking board.
