# Quickstart: Partner Combination Win-Rate Leaderboard

**Feature**: `006-pair-winrate-leaderboard` | **Branch**: `006-pair-winrate-leaderboard`

## Files

| File | Change |
|------|--------|
| `badminton-v2/src/lib/pairStats.ts` | **New** — `pairKey`, `tallyPairs`, `rankPairs` (contract: `contracts/pair-tally.md`) |
| `badminton-v2/src/__tests__/pairStats.test.ts` | **New** — unit tests for the above |
| `badminton-v2/src/views/LeaderboardView.tsx` | **Edit** — add `fetchPairLeaderboard()`, `PairsLeaderboard()`, extend the `Tab` union and the tab-switcher array |
| `badminton-v2/tests/pair-leaderboard.spec.ts` | **New** — one seed-backed Playwright spec |

Nothing else. No migration, no change to `matchResults.ts`, no change to the three existing tabs.

## Running it

```bash
cd badminton-v2
npm run dev
```

Open the app, sign in with the dev-only login button at the lower right (admin), and go to the All-time Leaderboard. The new tab is the fourth one. Deep link straight to it with `?tab=<tabvalue>` on the leaderboard route.

## Validation (Constitution Principle V)

```bash
cd badminton-v2
npm run lint
npm run test:unit
npm run test:e2e -- pair-leaderboard.spec.ts
```

Report what passed by name. If unrelated pre-existing failures block the full suite, say so explicitly rather than implying green — the Constitution requires honest validation.

After implementation, refresh the knowledge graph:

```bash
graphify update .
```

## Manual verification

The checks that automated tests cannot make for you.

1. **Spot-check one pair against reality (SC-004).** Pick a listed partnership, open past sessions, and count their games by hand. The displayed W/L must match exactly.
2. **Confirm the three existing tabs are untouched (SC-006, FR-003).** Capture Mga Lodi, Cheers, and Awards *before* the change and compare after. This is deliberately manual — adding assertions to those tabs would itself be a change to them.
3. **Confirm pagination actually paged (research R2).** The count check in `fetchPairLeaderboard()` should agree with the rows accumulated. This is the failure that looks like success: without paging, the board renders happily on truncated history. If your dataset is under the row cap today, temporarily lower `PAGE_SIZE` to 2 and confirm totals are unchanged.
4. **Check the threshold is doing something.** If almost every pair qualifies or almost none do, 6 is the wrong number — the generator's `repeatPartnerPenalty: 150` rotates partners deliberately, so the real distribution is unknown until this ships. Report the actual spread to the organiser; it is one constant to change.
5. **Look for a shared nickname.** If two players share one, confirm the row reads "Alexis (Cruz) & Alexis (Santos)" and not "Alexis & Alexis" (research R4).
6. **Phone width.** Two long names on one row must not push the win rate off-screen (FR-020).

## Known follow-ups (out of scope here)

- **Season / archive filter.** The organiser intends yearly archiving so archived games stop counting all-time. The match query is already inner-joined to `sessions` so that becomes one added condition — but the *existing* counter-based surfaces (`player_stats`, `player_pair_stats`, `player_cheer_stats`) cannot be filtered that way at all and need their own plan.
- **Disambiguated names on the Mga Lodi tab.** That board still uses bare `formatDisplayName`. A two-line fix, deliberately not made here because FR-003 puts existing tabs out of bounds.
- **Server-side aggregation.** If the client-side load outgrows the 2-second budget once the season filter is in place, move the tally into a Postgres view or RPC. Needs a migration, so not now.
