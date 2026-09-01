# Phase 0 Research: Partner Combination Win-Rate Leaderboard

**Feature**: `006-pair-winrate-leaderboard` | **Date**: 2026-09-01

The spec carried no `[NEEDS CLARIFICATION]` markers — eligibility, ranking, and placement were settled with the organiser before drafting. This phase resolves the technical unknowns instead. Every decision below was checked against code already in the repository, and the precedent is cited so the implementation does not invent a second way of doing something the codebase already does.

---

## R1. Where the tally logic lives

**Decision**: A new pure module, `badminton-v2/src/lib/pairStats.ts`, exporting a pair key function and a tally function. It reuses `sortMatchResults()` from `lib/matchResults.ts` for per-game normalization but does not extend that file.

**Rationale**: `matchResults.ts` is scoped to *one match's* results — `computeStatsFromResults()` returns a map for the four players of a single match and is used that way by `TodayView`, `SessionPlayerDetailView`, and `usePlayerStats`. Pair aggregation is a different shape: it spans many matches and keys on a combination rather than a player. Adding it to `matchResults.ts` would blur a file three surfaces already depend on. A separate module keeps the existing file untouched (supporting FR-023's spirit) and gives the new logic its own unit test file alongside the 20 existing ones.

The Constitution's UI and Runtime Rules require shared business logic to live in "hooks, lib utilities, or typed helpers rather than being duplicated across views", so putting the arithmetic in the view is not an option.

**Alternatives considered**:

- *Extend `matchResults.ts`* — rejected: widens the contract of a file on three consuming surfaces for no gain.
- *Compute inline in `LeaderboardView.tsx`* — rejected: the split-scoring and unordered-key rules are exactly the logic that needs unit tests, and a view is the one place they cannot be tested cheaply.

---

## R2. Query shape, and the row cap that will silently truncate it

**Decision**: Read from `matches` with the nested results embed, selecting only what is needed, filtered to completed matches, ordered by `id`, and **paginated with `.range()`** in pages of 1000 until a short page returns.

```
supabase
  .from('matches')
  .select('id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index, game_number), sessions!inner(id)')
  .eq('status', 'complete')
  .order('id', { ascending: true })
  .range(offset, offset + PAGE_SIZE - 1)
```

**Rationale**: This is the same query shape `TodayView.tsx:24 fetchSessionLeaderboard()` already uses, minus its `session_id` restriction — so the two boards read the same data the same way, satisfying Principle III rather than inventing a parallel access path.

The pagination is not optional. Supabase caps rows returned per request (`db_max_rows`, 1000 by default), and **no file in `badminton-v2/src/` currently calls `.range()`** — every existing query is either session-scoped (≤ 20 matches) or over a small table, so the cap has never been reachable. This board is the first query in the app whose natural result set crosses it: at 20 matches per session and weekly play, a single year is roughly 1,000 match rows. Without paging, the board would silently drop the oldest history and show wrong win rates with no error anywhere — the worst failure mode available, because it looks like it worked.

`status = 'complete'` is a safe narrowing rather than a semantic filter: `unfinish_match` (migration `068`) deletes a match's result rows and returns it to `queued`, so a non-complete match contributes nothing anyway. Filtering server-side shrinks the payload instead of shipping empty rows to discard.

**Verification step for implementation**: after loading, compare the number of match rows received against a `count: 'exact'` head request. If they disagree, pagination is broken. This check is cheap and belongs in the implementation, not just in review.

**Alternatives considered**:

- *One unpaginated query* — rejected: silently truncates, as above.
- *A Postgres view or RPC doing the aggregation server-side* — rejected **for this feature only**, because it requires a migration and the spec's FR-024 and the organiser's instruction forbid schema changes here. It is the right answer if the client-side load ever outgrows the budget, and is recorded as the follow-up in R7.
- *Restricting to the last N sessions* — rejected: changes "all-time" into something else without the organiser asking for it.

---

## R3. Session scoping, built for the season filter that is coming

**Decision**: Include `sessions!inner(id)` in the select from day one, even though no filter is applied to it today.

**Rationale**: FR-025 requires that a future season or archive rule be "a single additional condition". With the inner join already present, that future change is exactly one line — `.eq('sessions.is_archived', false)` or `.eq('sessions.season', currentSeason)` — with no restructuring of the tally, the eligibility pass, or the rendering. Without the join, that same change means adding an embed, re-checking the row shape, and re-testing the query. The cost today is one UUID per row.

This also keeps the board honest about Principle II: the set of sessions that counts is read from session data, not hardcoded in the view.

**Alternatives considered**:

- *Fetch eligible session ids first, then `.in('session_id', ids)`* — rejected: the id list grows without bound and lands in a URL, and it adds a round trip that buys nothing today.
- *Add the join later when archiving ships* — rejected: that is precisely the "structural rework" FR-025 exists to prevent.

---

## R4. How a pair is labelled — the "Alexis & Alexis" trap

**Decision**: Resolve both names through `disambiguateDisplayNames()` from `lib/formatDisplayName.ts`, not through bare `formatDisplayName()`.

**Rationale**: `profiles.nickname` is free text with no uniqueness constraint, so two different players genuinely can both be "Alexis" — the reason `disambiguateDisplayNames()` was added and is already used by `usePlayerList.ts:109`, `useAdminSession.ts:176`, and `MatchGeneratorPanel.tsx:340`.

On a per-player board a repeated name is merely ambiguous. On a *pair* board it is actively misleading: a row reading "Alexis & Alexis" is indistinguishable from the duplicate-player data bug that migration `079_matches_distinct_players.sql` was written to stop after it hit a live session. Rendering two distinct players as that exact string would send the organiser hunting for a bug that isn't there. Disambiguation turns it into "Alexis (Cruz) & Alexis (Santos)".

Note this makes the new tab *more* correct than the existing Mga Lodi tab, which still calls bare `formatDisplayName`. That is not a contradiction of FR-003 — no existing tab changes — but it is worth telling the organiser, since the same fix on the player board is a two-line follow-up.

**Alternatives considered**:

- *Bare `formatDisplayName`* — rejected as above.
- *Also fix the Mga Lodi tab in this feature* — rejected: FR-003 and the organiser's explicit scope narrowing put existing tabs out of bounds. Recorded as a follow-up instead.

---

## R5. Defensive skip for self-pairs

**Decision**: Discard any tallied pair whose two player ids are equal, before eligibility and ranking.

**Rationale**: Migration `079` adds `matches_distinct_players_check` and `lib/matchPlayers.ts` guards both manual edit forms, so no *new* match can repeat a player. But the constraint was added in response to a row that already existed in production ("one team showed as 'Alexis & Alexis'"), and `079` aborts rather than cleaning, with `supabase/maintenance/duplicate-match-players-scan.sql` provided to find offenders by hand. If any historical row survived, an unguarded tally would produce a partnership of one player with themselves and rank it.

The guard is two lines and removes an entire class of nonsense row. Constitution Principle IV requires edge cases for legacy data to be specified and tested, so this gets a unit test rather than just a comment.

---

## R6. Deterministic ordering

**Decision**: Sort by win rate descending, then wins descending, then by the pair key (the two ids sorted and joined) ascending.

**Rationale**: FR-016 requires identical ordering across loads of identical data. Win rate and wins alone do not guarantee it — `Array.prototype.sort` is stable in modern engines, but the *input* order is whatever the paginated query returned, which is stable only because R2 orders by `id`. Relying on that coupling is fragile: change the query order and the board silently starts reshuffling ties. Sorting on the pair key makes the final order a property of the data, independent of fetch order.

The key is used rather than the display name because names are mutable free text and can collide (R4), while the id pair is unique and immutable.

---

## R7. Volume and the 2-second budget

**Decision**: Compute client-side, and treat the season filter as the long-term control rather than optimising now.

**Sizing**: A session is 20 matches (the organiser's standard is 16 players / 20 matches). Weekly play gives roughly 1,000 matches and up to ~2,000 recorded games per year. Each row carries five UUIDs plus a small results array — on the order of 200 bytes, so a full year is roughly 200 KB before compression, in one or two paginated requests. That comfortably meets SC-002's 2-second target on a normal mobile connection, and the tally itself is a single linear pass over the rows.

**The honest limit**: this grows without bound. Two or three years in, the payload doubles and triples. Two things resolve that, in order: the season filter from R3 (which the organiser already intends, and which caps the working set at one year by design), and — only if that is not enough — moving the aggregation into a Postgres view or RPC so the client receives ~10 rows instead of thousands. The second is deliberately not built here: it needs a migration, which this feature forbids.

---

## R8. Test strategy

**Decision**: Unit tests carry the logic; one Playwright spec carries the surface.

**Unit** — `badminton-v2/src/__tests__/pairStats.test.ts`, matching the 20 existing vitest files and the Constitution's requirement that unit tests be deterministic and live in `src/__tests__/`:

- unordered key: the same two players partnered in either slot order tally to one entry
- both sides counted: winners gain a win, losers gain a loss, from the same match
- split scoring: a match with two result rows scored 1-1 yields exactly 1W and 1L for each pair (SC-005)
- a match with no result rows contributes nothing (FR-009)
- self-pair rows are discarded (R5)
- the 6-game threshold excludes a 5-game pair and admits a 6-game pair (FR-012)
- ranking: win rate, then wins, then the deterministic key tiebreak (FR-015, FR-016)
- win rate rounding matches the existing board's `Math.round(wins / games * 100)`

**E2E** — one spec in `badminton-v2/tests/`, seed-backed and isolated as the Constitution requires, asserting: the fourth tab exists and is reachable; the deep link opens it directly (FR-002); the caption states both eligibility rules (FR-021); and the empty state renders when no pair qualifies (FR-022). `phase15-split-stats.spec.ts` is the closest precedent for seeding results.

**Regression evidence for FR-003 / SC-006**: capture the three existing tabs' values before the change and compare after. This is a manual comparison, not a new automated test — adding assertions to existing tabs would itself be a change to them.

---

## R9. Rounding and the zero-games case

**Decision**: `Math.round(wins / games * 100)`, identical to `fetchAllTimeLeaderboard()`. Pairs with zero games cannot reach the display path because the 6-game threshold (FR-012) excludes them, but the tally function guards the division anyway so it is safe to call in isolation from tests.

**Rationale**: A second rounding rule would make the pair board disagree with the player board on the same underlying arithmetic — a Principle III divergence, and the kind players notice immediately.
