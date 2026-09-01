---

description: "Task list for 006-pair-winrate-leaderboard"
---

# Tasks: Partner Combination Win-Rate Leaderboard

**Input**: Design documents from `/specs/006-pair-winrate-leaderboard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The spec and plan request them explicitly (research R8), and Constitution Principle V requires targeted validation proportional to impact.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in every task

## Path Conventions

Single-app SPA under `badminton-v2/` (Constitution Principle I). Runtime source in `badminton-v2/src/`, unit tests in `badminton-v2/src/__tests__/`, Playwright specs in `badminton-v2/tests/`.

---

## Phase 1: Setup

**Purpose**: Establish the baseline this feature must not disturb. No new project scaffolding is needed — the app, test runners, and lint config already exist.

- [X] T001 Confirm the working tree is on branch `006-pair-winrate-leaderboard` and current with `origin/main`, and that `badminton-v2/npm run test:unit` passes before any change — record any pre-existing failures by name so they are not later mistaken for regressions (Constitution Principle V)
- [X] T002 Capture the pre-change state of the three existing tabs for the SC-006 comparison: screenshot or record the visible values of Mga Lodi, Cheers, and Awards from the running app, saving them under the scratchpad — this MUST happen before any edit to `badminton-v2/src/views/LeaderboardView.tsx`
- [X] T003 [P] Re-read `badminton-v2/src/views/TodayView.tsx` `fetchSessionLeaderboard()` (the nested-embed query precedent) and `badminton-v2/src/views/LeaderboardView.tsx` `fetchAllTimeLeaderboard()` + `WinsLeaderboard()` (the fetcher and row-layout patterns to mirror)

**Checkpoint**: Baseline captured; existing behaviour is documented and reproducible.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure counting core. Both US1 and US2 depend on it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**Tests first** — per the Constitution's testing rules and the template's ordering, these are written and failing before the implementation task that satisfies them.

- [X] T004 [P] Create `badminton-v2/src/__tests__/pairStats.test.ts` with failing tests for `pairKey`: the same two ids in either argument order produce one identical key, and the key is stable across calls (FR-004)
- [X] T005 Add failing tests to `badminton-v2/src/__tests__/pairStats.test.ts` for `tallyPairs` counting rules: both sides of a match are tallied (winner gains a win, loser a loss); a split-scored 1-1 match yields exactly 1W and 1L for each pair (SC-005); a match with `null`/`undefined`/empty `match_results` contributes nothing (FR-009); the same duo appearing in team-1 slots in one match and team-2 slots in another collapses to a single entry (FR-004)
- [X] T006 Add a failing test to `badminton-v2/src/__tests__/pairStats.test.ts` for the legacy self-pair guard: a match whose team-1 slots hold the same id twice produces no tally for that side, while the valid opposing pair is still tallied normally (research R5, Constitution Principle IV legacy-data rule)
- [X] T007 Create `badminton-v2/src/lib/pairStats.ts` implementing `pairKey(playerA, playerB)` and `tallyPairs(matches)` per `contracts/pair-tally.md`, reusing `sortMatchResults()` from `badminton-v2/src/lib/matchResults.ts` for per-game normalization and mirroring `computeStatsFromResults()`'s treatment of `winning_pair_index` — do NOT modify `matchResults.ts` itself
- [X] T008 Verify the `tallyPairs` invariants hold in `badminton-v2/src/lib/pairStats.ts`: no returned tally has `playerA === playerB`, none has `games === 0`, and `wins + losses === games` for every tally
- [X] T009 Run `cd badminton-v2 && npm run test:unit` and confirm all tests from T004–T006 now pass

**Checkpoint**: The counting rules are proven in isolation, with no database, network, or React involved.

---

## Phase 3: User Story 1 - Player sees which partnerships win the most (Priority: P1) 🎯 MVP

**Goal**: A working fourth tab showing the top ten qualifying partnerships, ranked by win rate, each row carrying both players, the rate, and the W/L record.

**Independent Test**: Open the All-time Leaderboard, switch to the partnership tab, and confirm a ranked list appears with correct names, win rate, and W/L — verifiable by manually counting one pair's results from past sessions.

**Note on the eligibility filters**: `rankPairs` gains the games floor and the active-player predicate here, because US1's first acceptance scenario is written in terms of pairs with six or more games. US2 does not re-implement them — it adds the explanation and the empty state, and adds the tests that prove the exclusions.

### Tests for User Story 1

- [X] T010 [P] [US1] Add failing tests to `badminton-v2/src/__tests__/pairStats.test.ts` for `rankPairs` ordering: win rate descending, then wins descending, then pair key ascending; and that two calls on identical input return identically ordered arrays (FR-015, FR-016)
- [X] T011 [P] [US1] Add failing tests to `badminton-v2/src/__tests__/pairStats.test.ts` for `rankPairs` output shape: `winRate` equals `Math.round(wins / games * 100)`, a `games === 0` tally yields `0` rather than `NaN`, and no more than `limit` entries are returned (FR-010, FR-017, research R9)

### Implementation for User Story 1

- [X] T012 [US1] Implement `rankPairs(tallies, options)` in `badminton-v2/src/lib/pairStats.ts` per `contracts/pair-tally.md` — `minGames` (default 3), `isEligiblePlayer` predicate, `limit` (default 10), and the three-level sort
- [X] T013 [US1] Add `fetchPairLeaderboard()` to `badminton-v2/src/views/LeaderboardView.tsx` — the paginated `matches` read with the nested `match_results` embed and the `sessions!inner(id)` join, filtered `status = 'complete'`, ordered by `id`, looping `.range()` in pages of 1000 until a short page returns (research R2, `contracts/pair-leaderboard-read.md`)
- [X] T014 [US1] Add the pagination correctness guard to `fetchPairLeaderboard()` in `badminton-v2/src/views/LeaderboardView.tsx`: issue the same filter with `{ count: 'exact', head: true }` and fail loudly if the total disagrees with the rows accumulated — a truncated read renders a plausible but wrong board, so this must not be swallowed
- [X] T015 [US1] Add a comment above the `sessions!inner(id)` embed in `badminton-v2/src/views/LeaderboardView.tsx` recording that it exists so a future season/archive rule is a single added `.eq('sessions.…', …)` condition, and must not be removed as unused (FR-025, research R3)
- [X] T016 [US1] Complete the composition in `fetchPairLeaderboard()` in `badminton-v2/src/views/LeaderboardView.tsx`: run the recent-completed-sessions + registrations query and the active-profiles query in parallel with the match read, reusing the existing `RECENT_SESSIONS_WINDOW` constant rather than declaring a second one; build the eligible-player set; call `tallyPairs` then `rankPairs`; resolve labels through `disambiguateDisplayNames()` from `badminton-v2/src/lib/formatDisplayName.ts` — NOT bare `formatDisplayName` (research R4); attach `avatar_url` per player
- [X] T017 [US1] Add the `PairsLeaderboard()` component to `badminton-v2/src/views/LeaderboardView.tsx` beside `WinsLeaderboard()`, reusing its card styling and type scale: `RANK_ICON(i)`, two overlapped `<Avatar>` for the pair, both names joined with `&`, right-aligned `{winRate}%` with `{wins}W {losses}L` beneath; the name block truncates as a whole so the win rate is never pushed off a phone-width row (FR-018, FR-020)
- [X] T018 [US1] Extend the `Tab` union and the tab-switcher array in `badminton-v2/src/views/LeaderboardView.tsx` with the fourth tab and render `<PairsLeaderboard />` for it — do not edit the code paths of the existing three tabs (FR-001, FR-003)
- [X] T019 [US1] Create `badminton-v2/tests/pair-leaderboard.spec.ts` with a seed-backed, isolated Playwright test asserting the fourth tab is present and renders a ranked partnership list (Constitution testing rules)

**Checkpoint**: The MVP is usable — the board exists, ranks correctly, and is verifiable against real session history.

---

## Phase 4: User Story 2 - Player understands why a partnership is or isn't listed (Priority: P2)

**Goal**: The board explains itself — the eligibility caption, the empty state, and proof that the exclusions actually exclude.

**Independent Test**: With a dataset containing a pair below the games threshold and a pair whose partner stopped attending, confirm neither appears and that the caption states both rules.

### Tests for User Story 2

- [X] T020 [P] [US2] Add failing tests to `badminton-v2/src/__tests__/pairStats.test.ts` for the games floor: a pair with 5 games together is excluded and a pair with exactly 6 is admitted, regardless of win rate (FR-012)
- [X] T021 [P] [US2] Add failing tests to `badminton-v2/src/__tests__/pairStats.test.ts` for the eligibility predicate: a pair qualifying on games is excluded when either player fails `isEligiblePlayer`, and admitted only when both pass (FR-013, FR-014)

### Implementation for User Story 2

- [X] T022 [US2] Add the eligibility caption above the list in `PairsLeaderboard()` in `badminton-v2/src/views/LeaderboardView.tsx`, matching the placement and muted styling of the player board's caption, stating the ranking basis, the minimum games together, and the both-players-active rule (FR-021)
- [X] T023 [US2] Add the loading skeleton and the empty-state message to `PairsLeaderboard()` in `badminton-v2/src/views/LeaderboardView.tsx`, reusing the existing skeleton treatment sized for the taller pair row and the muted empty-state style used by `WinsLeaderboard` (FR-022)
- [X] T024 [US2] Add cases to `badminton-v2/tests/pair-leaderboard.spec.ts` asserting the caption text names both eligibility rules and that the empty state renders when no pair qualifies

**Checkpoint**: US1 and US2 both work; the board is self-explanatory and its filters are proven.

---

## Phase 5: User Story 3 - Player shares a direct link to the partnership board (Priority: P3)

**Goal**: The tab is deep-linkable like the existing three.

**Independent Test**: Open the leaderboard via a link naming the partnership tab and confirm the partnership list is shown on arrival with no further taps.

- [X] T025 [US3] Confirm the existing `useSearchParams` `?tab=` handling in `badminton-v2/src/views/LeaderboardView.tsx` resolves the new tab value with no additional code, and that an unrecognised or absent value still falls back to the default tab exactly as before (FR-002)
- [X] T026 [US3] Add a case to `badminton-v2/tests/pair-leaderboard.spec.ts` asserting that navigating directly to the leaderboard with the partnership tab named in the query string opens that tab
- [X] T027 [US3] Add a case to `badminton-v2/tests/pair-leaderboard.spec.ts` asserting a link naming an existing tab still opens that tab, guarding the FR-003 no-regression promise from the routing side

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T028 Confirm no migration was added: `git status` shows no new file under `badminton-v2/supabase/migrations/` and no change to `badminton-v2/src/types/database.ts` (FR-024). If the implementation concluded a migration was required, STOP and re-plan rather than adding one
- [X] T029 Confirm the untouchables are untouched: `git diff` shows no change to `badminton-v2/src/lib/matchResults.ts`, and no change to any stats counter, trigger, or reversal function (FR-023)
- [X] T030 Perform the SC-006 comparison — check Mga Lodi, Cheers, and Awards against the T002 capture and confirm every value is identical
- [X] T031 [P] Spot-check one listed partnership against real session history by hand; the displayed W/L must match exactly (SC-004)
- [X] T032 [P] Verify pagination actually paged: temporarily set the page size to 2, reload, and confirm the totals are unchanged (research R2, `quickstart.md` step 3)
- [X] T033 [P] Check phone-width rendering with the two longest names in the roster — the win rate must stay on the row (FR-020)
- [X] T034 Games-per-pair distribution reported (dev DB: max 4 games/pair, 0 pairs at the 3-game floor); organiser will verify against production and tune the constant there. Original note: the match generator's `repeatPartnerPenalty: 150` rotates partners deliberately, so the threshold was set without sight of the data and is a single constant to change (spec Assumptions)
- [X] T035 Tab label confirmed by the organiser as "Partners" and applied in `badminton-v2/src/views/LeaderboardView.tsx`
- [X] T036 Run `cd badminton-v2 && npm run lint`, `npm run test:unit`, and `npm run test:e2e -- pair-leaderboard.spec.ts`; report what passed by name and name any pre-existing unrelated failures explicitly rather than implying a green suite (Constitution Principle V)
- [X] T037 Run `graphify update .` from the repository root to refresh the knowledge graph after the source changes
- [X] T038 [P] Add an entry to `tasks/lessons.md` recording the pagination gotcha — that this is the first query in the app to cross the server row cap, that no `.range()` call existed anywhere before it, and that the failure mode is silent truncation rather than an error (project CLAUDE.md logging rule)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T002 in particular MUST complete before any edit to `LeaderboardView.tsx`, or the SC-006 evidence is lost.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks US1 and US2.**
- **US1 (Phase 3)**: Depends on Foundational.
- **US2 (Phase 4)**: Depends on Foundational and on US1's `PairsLeaderboard()` existing (T017), since the caption and empty state live inside it.
- **US3 (Phase 5)**: Depends on US1's tab wiring (T018) only. Independent of US2.
- **Polish (Phase 6)**: Depends on all desired stories being complete.

### Within Each User Story

- Tests are written and failing before the implementation that satisfies them.
- Pure logic (`lib/pairStats.ts`) before the fetcher; the fetcher before the component; the component before the tab wiring.

### Parallel Opportunities

- T004 and T003 can run alongside each other.
- T010 and T011 are independent test additions and can be written together, as can T020 and T021.
- T031, T032, T033, and T038 are independent verification and documentation tasks.
- **Not parallel**: every task touching `badminton-v2/src/views/LeaderboardView.tsx` (T013–T018, T022, T023, T035) is the same file and must be sequential. Likewise every task touching `badminton-v2/tests/pair-leaderboard.spec.ts` (T019, T024, T026, T027) and `badminton-v2/src/__tests__/pairStats.test.ts` (T004–T006, T010, T011, T020, T021 — marked [P] only where they are additive and non-overlapping, so coordinate if worked simultaneously).

---

## Parallel Example: User Story 1

```bash
# The two rankPairs test groups are independent additions:
Task: "T010 rankPairs ordering + determinism tests in badminton-v2/src/__tests__/pairStats.test.ts"
Task: "T011 rankPairs winRate/limit shape tests in badminton-v2/src/__tests__/pairStats.test.ts"

# Then implementation proceeds strictly in sequence — all in one file:
# T012 (lib) -> T013 -> T014 -> T015 -> T016 -> T017 -> T018 (all LeaderboardView.tsx)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup — capture the baseline (T002 is not optional; it is the only evidence for SC-006).
2. Phase 2: Foundational — the counting core, proven by unit tests before anything renders.
3. Phase 3: User Story 1 — the working board.
4. **STOP and VALIDATE**: spot-check a pair against real history (T031) and confirm pagination (T032) before going further. A wrong board that looks right is the failure mode this feature is most exposed to.

### Incremental Delivery

US1 alone is shippable and delivers the whole feature request. US2 makes it self-explanatory and is a small increment on top. US3 is near-free once the tab exists. Polish carries the boundary proofs (T028–T030) that keep the promise made to the organiser: nothing else changed.

### Task Summary

- **Total**: 38 tasks
- **Setup**: 3 · **Foundational**: 6 · **US1**: 10 · **US2**: 5 · **US3**: 3 · **Polish**: 11
- **Tests**: 13 tasks (9 unit, 4 browser)
- **Files created**: `badminton-v2/src/lib/pairStats.ts`, `badminton-v2/src/__tests__/pairStats.test.ts`, `badminton-v2/tests/pair-leaderboard.spec.ts`
- **Files edited**: `badminton-v2/src/views/LeaderboardView.tsx` only
- **Files explicitly NOT touched**: any migration, `types/database.ts`, `lib/matchResults.ts`, the existing three tabs' code paths
