---

description: "Task list for Leaderboard Celebrations"
---

# Tasks: Leaderboard Celebrations

**Input**: Design documents from `/specs/008-podium-celebration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/celebration-contract.md, quickstart.md

**Tests**: Included. Constitution Principle V requires `npm run lint`, `npm run test:unit`, and
browser-level coverage when a flow spans navigation and auth state — which this one does.

**Organization**: Grouped by user story so each can be implemented, tested and shipped independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: Which user story the task serves
- All paths are relative to the repository root

## Implementation status (2026-09-18)

**Phases 1, 2, 3 and 4 complete** — the MVP plus the toast and row sweep. US3 (non-podium
achievements) and US4 (several at once) are **not** implemented: the rule still returns podium
placings only, though the card already renders the multi-achievement layout and the bunny path, so
those phases are wiring rather than design.

Validated: `npm run lint` clean (one pre-existing unrelated warning in `ProfileView.tsx`),
`npm run test:unit` **339 passed**, `tests/leaderboard-celebration.spec.ts` **4 passed**.

**Pre-existing failure, not caused by this work**: `tests/pair-leaderboard.spec.ts` has 3 failing
tests. Measured by reverting all of this feature's changes and re-running — the same 3 fail at HEAD.
The cause is a copy mismatch: the test expects "No partnership has reached" and the app has said
"No partnership qualifies yet" since before this branch.

## Already on disk (from prior exploratory work)

Two files exist before this task list begins. Tasks below **complete and verify** them rather than
creating them, and their current state is stated honestly:

| File | State |
|---|---|
| `badminton-v2/src/lib/podiumCelebration.ts` | Podium rule only. 13 unit tests pass |
| `badminton-v2/src/__tests__/podiumCelebration.test.ts` | Covers the three silences and precedence |
| `badminton-v2/src/lib/leaderboardData.ts` | Extracted from `LeaderboardView`. Typechecks. **Lint and full test run were interrupted — unverified** |
| `badminton-v2/src/views/LeaderboardView.tsx` | Modified to import the extraction. Unverified |
| `temporary_files/bunny-thumbsup.png` | Keyed, cropped, hand recoloured, 192×261 RGBA |

---

## Phase 1: Setup

**Purpose**: Get assets and scaffolding in place. No behaviour yet.

- [X] T001 [P] Move the non-podium icon from `temporary_files/bunny-thumbsup.png` to `badminton-v2/public/bunny-thumbsup.png` and confirm it is served at `/bunny-thumbsup.png`
- [X] T002 [P] Add the `BoardKey` type and the watched-board list (`wins`, `pairs`, `cheers:<slug>` for all six categories; Awards excluded) to `badminton-v2/src/lib/podiumCelebration.ts`, exported for reuse

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared plumbing every user story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Finish verifying the `leaderboardData` extraction: run `npm run lint`, `npm run test:unit`, and `npx playwright test tests/pair-leaderboard.spec.ts` in `badminton-v2/`, and confirm the leaderboard renders identically to `main`. Fix or revert before proceeding — nothing downstream is trustworthy until this passes (contract C3)
- [X] T004 Implement `badminton-v2/src/lib/celebrationStorage.ts`: read and write `PlayerCelebrationState` namespaced by player id, with every read wrapped so blocked or cleared storage degrades to "no state" rather than throwing (contract C2, data-model.md)
- [X] T005 [P] Write `badminton-v2/src/__tests__/celebrationStorage.test.ts` covering: state for player A never returned for player B; absent state distinguishable from empty state; a read never throws when storage is unavailable; the version field round-trips
- [X] T006 Implement the sentinel check in `badminton-v2/src/lib/leaderboardData.ts`: one query for the latest `completed_at` among sessions with `status = 'complete'`, exported separately from the board fetchers so it can be called without triggering them (research.md R1)
- [X] T007 Add a development-only trigger that forces a celebration on demand, wired into the existing dev login panel in `badminton-v2/src/components/DevLoginPanel.tsx`. **Build this before the card** — the natural trigger needs a real session to complete *and* the first evaluation per player is deliberately silent, so without it the feedback loop is a week long (FR-027, quickstart.md)

**Checkpoint**: storage works and is tested, the sentinel can be read cheaply, and a celebration can be forced by hand.

---

## Phase 3: User Story 1 — A player learns they made the podium (Priority: P1) 🎯 MVP

**Goal**: A card appears over whatever screen the player is on, naming the medal, placing and board, and clears itself.

**Independent test**: Force a celebration for a test player moved into the top 3; confirm a card appears on the Sessions screen naming the right medal, placing and board, and that it leaves without interaction.

- [X] T008 [P] [US1] Extend `badminton-v2/src/__tests__/podiumCelebration.test.ts` with the remaining C1 podium rows: previous `null` → top 3, previous 5 → 3, previous 3 → 1, unchanged, worsened, dropped off the board
- [X] T009 [US1] Confirm `badminton-v2/src/lib/podiumCelebration.ts` satisfies every podium row in contract C1, including the present-`null` versus absent-key distinction that protects the two silences (data-model.md)
- [X] T010 [US1] Implement `badminton-v2/src/hooks/useLeaderboardCelebration.ts`: sentinel check → stop if unchanged; compute standings via `leaderboardData`; evaluate via `podiumCelebration`; persist snapshot and sentinel **whether or not anything is celebrated**; expose at most one celebration (contract C4)
- [X] T011 [US1] Make the hook run on app start and when the app returns to the foreground, and make it a silent no-op when signed out or when a query fails — a missed celebration must never break a launch (research.md R8, contract C4)
- [X] T012 [P] [US1] Implement `badminton-v2/src/components/ConfettiBurst.tsx` as a canvas overlay. Keep the animation loop alive while an emitter is still producing, not merely while particles exist — an emitter that seeds on a timer is otherwise killed before its first batch lands (research.md R5)
- [X] T013 [US1] Implement `badminton-v2/src/components/CelebrationCard.tsx` for a single achievement: medal, ordinal, board and detail; 3px border in the medal colour of the place, reusing the leaderboard's existing podium colours rather than a second palette; self-dismissing (FR-013, FR-014, FR-017)
- [X] T014 [US1] Honour `prefers-reduced-motion` in `CelebrationCard` and `ConfettiBurst`: same content, no spring, no particles (FR-025)
- [X] T015 [US1] Host the celebration from `badminton-v2/src/layouts/PlayerLayout.tsx` so it can appear over any player-facing screen without navigating (FR-011, FR-012)
- [X] T016 [US1] Add `badminton-v2/tests/leaderboard-celebration.spec.ts` (seed-backed, isolated, following `tests/pair-leaderboard.spec.ts`) asserting a card appears for a new podium placing and disappears unaided

**Checkpoint**: shippable on its own. A player who reaches the podium now finds out.

---

## Phase 4: User Story 2 — The player goes and looks at the board (Priority: P2)

**Goal**: A toast offers the board; accepting opens it on the right tab and sweeps the player's own row.

**Independent test**: Trigger a celebration, confirm the toast follows the card, tap its action, and confirm arrival on the correct board with the player's row visibly marked.

- [X] T017 [US2] Add `sweepOwed` arming and consumption to `badminton-v2/src/lib/celebrationStorage.ts`, storing the sentinel it was created under so expiry is a comparison rather than a timer (research.md R9, data-model.md)
- [X] T018 [US2] Arm the sweep in `badminton-v2/src/hooks/useLeaderboardCelebration.ts` **when the celebration is shown**, not when the offer is accepted. Both routes to the leaderboard must find the same owed state — a prototype armed it only on the ignoring path and the main route silently did nothing (research.md R10, FR-024)
- [X] T019 [US2] Emit the toast after the card clears, using the app's existing `sonner` toast, with a view action that navigates to `/leaderboard?tab=<board>`; ignoring or dismissing it must do nothing at all (FR-020, FR-021)
- [X] T020 [US2] Apply the wording rule in the toast: a board takes "on", a cheer category takes "in"; a Partners placing names the partner via the app's existing display-name handling (spec Assumptions)
- [X] T021 [US2] Play the row sweep in `badminton-v2/src/views/LeaderboardView.tsx` when a sweep is owed for the board being shown; clear the debt once played; play nothing for a lapsed debt; no sweep under reduced motion (contract C6)
- [X] T022 [US2] Extend `badminton-v2/tests/leaderboard-celebration.spec.ts` to cover **both arrival routes** — accepting the offer, and arriving at the leaderboard unprompted. A test that only exercises the toast would have passed against the broken prototype

**Checkpoint**: the announcement is now actionable, and the player can find themselves on the board.

---

## Phase 5: User Story 3 — A player who did not medal is celebrated too (Priority: P3)

**Goal**: The same celebration for first appearance, personal best and a climb of three or more — bunny icon, ordinary border, nothing else different.

**Independent test**: Move a test player 9th → 6th without entering the top 3; confirm a card reading "Your best yet!" with the bunny icon and a plain border, identical in size, confetti and dwell to a podium card.

- [ ] T023 [P] [US3] Add the `bestEver` map to `badminton-v2/src/lib/celebrationStorage.ts` and keep it updated on every evaluation (data-model.md)
- [ ] T024 [US3] Extend `badminton-v2/src/lib/podiumCelebration.ts` with the `first-appearance`, `personal-best` and `climb` kinds, the three-place climb threshold, and the precedence order: podium > first-appearance > personal-best > climb (FR-007, FR-008, research.md R7)
- [ ] T025 [P] [US3] Extend `badminton-v2/src/__tests__/podiumCelebration.test.ts` with the non-podium C1 rows, including: a 2-place climb produces nothing; first-appearance outranks personal-best when both are true; a podium beats every non-podium achievement earned at the same time
- [ ] T026 [US3] Render the non-podium variant in `badminton-v2/src/components/CelebrationCard.tsx`: the bunny icon from `/bunny-thumbsup.png`, the ordinary 1px border, and **identical** card size, animation, confetti count and dwell to a podium card (FR-018, FR-019, research.md R6)
- [ ] T027 [US3] Extend `badminton-v2/tests/leaderboard-celebration.spec.ts` with a non-podium celebration asserting the bunny icon and the ordinary border

**Checkpoint**: the feature now reaches most of the roster rather than three players.

---

## Phase 6: User Story 4 — Several achievements at once become one celebration (Priority: P4)

**Goal**: One card listing every achievement, never a queue of cards.

**Independent test**: Move a test player onto three boards in one session; confirm exactly one card appears listing all three, held on screen longer, still self-dismissing.

- [ ] T028 [US4] Render the multi-achievement layout in `badminton-v2/src/components/CelebrationCard.tsx`: a medal row, a count heading, and one line per board with medal, board and placing (FR-016)
- [ ] T029 [US4] Scale the dwell with content in `CelebrationCard`: a baseline for one achievement, extended per additional one, to a ceiling — and self-dismissing at every size (FR-015)
- [ ] T030 [US4] Take the card's border from the **best** placing on it, matching the toast, which names that same placing (spec Assumptions)
- [ ] T031 [US4] Name the best achievement in the toast and state how many others there were; the view action leads to the best one's board (FR-022)
- [ ] T032 [P] [US4] Extend `badminton-v2/tests/leaderboard-celebration.spec.ts` asserting that three simultaneous achievements produce exactly one card listing all three

**Checkpoint**: a player with a great night gets one moment, not a queue of interruptions.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 Verify in the browser's network panel that a launch with no newly completed session issues **no board queries** — the cost guarantee the whole design rests on (SC-007, FR-026)
- [ ] T034 [P] Check the celebration in light and dark: the three medal border colours, the ordinary border, and the bunny against both card backgrounds
- [ ] T035 [P] Check reduced motion end to end: card readable, no particles, no sweep, information unchanged (SC-008)
- [X] T036 Confirm the first evaluation after deploying is silent for a player with an existing high standing (SC-002) — the single most embarrassing thing to get wrong on release day
- [X] T037 Run the full validation per Constitution Principle V from `badminton-v2/`: `npm run lint`, `npm run test:unit`, `npx playwright test tests/leaderboard-celebration.spec.ts`. Name any pre-existing unrelated failure explicitly rather than implying a green suite
- [ ] T038 [P] Append the design reasoning to `badminton-v2/docs/qa-log.html` under a new heading: why the trigger is "newly theirs", why podium and non-podium are identical in weight, and the two-route sweep trap
- [ ] T039 [P] Update `handoff.md` and `project_memory.md`: the durable entries are the celebration's storage location, the precedence order, and that `leaderboardData` is now the single definition of a rank
- [ ] T040 Remove the development-only trigger from production paths, or gate it behind the same condition as the dev login panel

---

## Dependencies

```
Phase 1 (Setup)
      │
      ▼
Phase 2 (Foundational)  ◄── T003 gates everything; the extraction is unverified
      │
      ▼
Phase 3 (US1, P1)  ◄── MVP
      │
      ├──────────────┬──────────────┐
      ▼              ▼              ▼
Phase 4 (US2)   Phase 5 (US3)  Phase 6 (US4)
      │              │              │
      └──────────────┴──────────────┘
                     │
                     ▼
              Phase 7 (Polish)
```

- **US2, US3 and US4 all depend on US1** and on nothing else. They do not depend on each other and can be built in any order, or in parallel by different people.
- **T003 blocks everything.** `leaderboardData` is currently unverified; building on it before it passes lint, unit tests and the pair-leaderboard e2e means building on sand.

## Parallel opportunities

| Phase | Can run together |
|---|---|
| Phase 1 | T001, T002 |
| Phase 2 | T005 alongside T006 once T004 lands |
| Phase 3 | T008 and T012 (different files, no shared state) |
| Phase 5 | T023 and T025 |
| Phase 7 | T034, T035, T038, T039 |

## Implementation strategy

**MVP is Phase 3 (US1)**: a card that tells a player they made the podium. That alone fixes the actual
problem — a player can currently top a board for weeks and never find out. Everything after it makes
the moment easier to act on.

**Recommended increments**:

1. Phases 1–3 → ship. Watch one real session's worth of celebrations before going further.
2. Phase 4 → the announcement becomes actionable.
3. Phase 5 → the feature stops being only for three people.
4. Phase 6 → before Cheers boards make multi-achievement common, which they will.

**Order note on Phase 6**: six of the eight watched boards are cheer categories whose shares move
together, so several achievements at once may be ordinary rather than rare. If real usage shows that,
promote Phase 6 ahead of Phase 5.

## Total: 40 tasks

| Phase | Tasks |
|---|---|
| Setup | 2 |
| Foundational | 5 |
| US1 (P1, MVP) | 9 |
| US2 (P2) | 6 |
| US3 (P3) | 5 |
| US4 (P4) | 5 |
| Polish | 8 |
