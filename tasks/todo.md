# Podium celebration — plan

Celebrate when a player's leaderboard placing becomes top 3 **and it is new to them**.

## Agreed

- **Celebrate in place.** Medal card + burst plays over whatever screen they are on.
- **Then a toast** offering to view that specific board. Tapping navigates to
  `/leaderboard?tab=<board>`.
- **Row sweep** plays on arrival, on their own row.
- **No auto-redirect.** Nothing overrides a tap the player made.

## Assumptions I am making (say if wrong)

- **Boards in v1: Individual (wins) and Partners (pairs).** Both are genuinely ranked with a
  real 1-2-3.
  - *Awards excluded* — single holder, no 2nd or 3rd, so "2nd place!" has nothing to say.
  - *Cheers excluded* — it is six sub-boards, one per cheer category, ranked by share of cheers
    received. Six podiums means roughly six times the celebrations, for a number that moves when
    *other* people's cheers change. Easy to add later if you want it.
- **Partners wording**: the podium entry is a pair, so the card reads "2nd place with Alex".

## The hard part: cost

`fetchAllTimeLeaderboard()` pulls `player_stats` + all `profiles` + recent sessions +
registrations. The pairs fetcher pages through matches. Running that on every navigation to
celebrate "in place" is far too expensive.

**Sentinel check.** Ranks can only move when a session completes.

1. On app boot, one tiny query: most recent `sessions.completed_at` where `status = 'complete'`.
2. Compare to the last value stored locally. Unchanged → stop. Zero further cost, which is the
   common case.
3. Changed → run the board fetchers once, find this player's rank on each, compare to their stored
   per-board rank, celebrate any that newly landed at ≤ 3.

**First run must be silent.** A player who has been 2nd for months must not be congratulated the
first time this ships. First run records ranks and celebrates nothing.

## Tasks

- [ ] `src/lib/podiumCelebration.ts` — pure logic: given previous ranks and current ranks, return
      which boards newly reached top 3. Unit-tested, including the silent-first-run case.
- [ ] Rank storage — per player, per board, in `localStorage`, keyed by user id so two accounts on
      one phone do not inherit each other's state.
- [ ] `useNewPodiumPlacings()` — the sentinel check, the fetch-when-changed, and the comparison.
- [ ] `PodiumCelebration` component — the medal card + canvas burst from the POC, rendered app-wide
      (in `PlayerLayout`), honouring `prefers-reduced-motion`.
- [ ] Toast after the card fades, with a View action → `/leaderboard?tab=<board>`.
- [ ] Row sweep on the leaderboard when arriving with a pending celebration for that board.
- [ ] Reduced motion: card only, no particles, no sweep.
- [ ] Verify in the running app; screenshot both themes.
- [ ] Update `docs/qa-log.html`, `handoff.md`, `project_memory.md`.

## Open question

- What happens when a player is newly top 3 on **both** boards at once? Plan is to celebrate the
  best placing only, and let the toast mention the other. Queuing two full celebrations back to back
  is a lot.

## Review

_(filled in after implementation)_
