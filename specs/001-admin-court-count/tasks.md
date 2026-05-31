# Tasks: Admin Court Count

**Input**: Design documents from `/specs/001-admin-court-count/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Include unit and end-to-end coverage because the design explicitly calls for updated unit tests plus one Playwright flow for a non-default court count.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- App code lives under `badminton-v2/src/`
- Unit tests live under `badminton-v2/src/__tests__/`
- End-to-end tests live under `badminton-v2/tests/`
- Database migrations live under `badminton-v2/supabase/migrations/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the persisted session schema and shared typing needed by every story.

- [X] T001 Add a Supabase migration for `sessions.court_count` with a legacy-safe default in `badminton-v2/supabase/migrations/`
- [X] T002 Update generated session typings to include `court_count` in `badminton-v2/src/types/database.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared court-count-aware state structures that all user stories build on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Refactor shared session types and persistence helpers to expose `court_count` in `badminton-v2/src/hooks/useSession.ts`
- [X] T004 [P] Introduce shared dynamic court-slot data structures in `badminton-v2/src/hooks/useCourtState.ts`
- [X] T005 [P] Refactor admin session state from fixed court branches to dynamic court collections in `badminton-v2/src/hooks/useAdminSession.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Configure Session Court Count (Priority: P1) 🎯 MVP

**Goal**: Let admins define and persist the number of courts per session instead of relying on the fixed two-court default.

**Independent Test**: Create or edit a session, save a non-default court count, reload the session, and confirm the saved value persists while invalid values are rejected.

### Tests for User Story 1

- [X] T006 [P] [US1] Add unit coverage for loading and saving `court_count` defaults in `badminton-v2/src/__tests__/useSessionCourtCount.test.ts`
- [X] T007 [P] [US1] Add an admin setup flow for court-count persistence and validation in `badminton-v2/tests/admin-court-count.spec.ts`

### Implementation for User Story 1

- [X] T008 [US1] Extend session creation and update flows to persist `court_count` in `badminton-v2/src/hooks/useSession.ts`
- [X] T009 [US1] Add validated court-count input to the setup form in `badminton-v2/src/views/SessionView.tsx`
- [X] T010 [US1] Ensure admin session creation and setup defaults remain legacy-safe in `badminton-v2/src/views/AdminView.tsx`

**Checkpoint**: User Story 1 should now support configuring and persisting session court count independently

---

## Phase 4: User Story 2 - Show the Correct Number of Court Cards Everywhere (Priority: P1)

**Goal**: Render the configured number of courts consistently in admin, liveboard, and player live court summaries.

**Independent Test**: Open a session configured for one court and another configured for more than two courts, then confirm the admin view, liveboard, and player live summary show the same court count and labels for each session.

### Tests for User Story 2

- [X] T011 [P] [US2] Add unit coverage for dynamic court-slot derivation and labels in `badminton-v2/src/__tests__/useCourtState.test.ts`
- [X] T012 [P] [US2] Extend the multi-court browser flow assertions for rendered court cards in `badminton-v2/tests/admin-court-count.spec.ts`

### Implementation for User Story 2

- [X] T013 [US2] Refactor shared live court loading to return ordered courts from `court_count` in `badminton-v2/src/hooks/useCourtState.ts`
- [X] T014 [US2] Refactor admin live court rendering to loop over dynamic courts in `badminton-v2/src/components/CourtTabs.tsx`
- [X] T015 [US2] Refactor liveboard rendering to display one card per configured court in `badminton-v2/src/views/LiveBoardView.tsx`
- [X] T016 [US2] Refactor player live court summaries to render dynamic courts in `badminton-v2/src/views/PlayerView.tsx`

**Checkpoint**: User Story 2 should now render the correct number of court cards across all impacted views

---

## Phase 5: User Story 3 - Keep Match Flow Consistent Across Impacted Views (Priority: P2)

**Goal**: Make session start, finish, promotion, and court assignment rules honor the configured number of courts without assigning matches to nonexistent courts.

**Independent Test**: Start a session with a non-default court count, verify the first `court_count` matches go live, finish matches from different courts, and confirm queue advancement and player guidance remain aligned to valid court numbers only.

### Tests for User Story 3

- [X] T017 [P] [US3] Add unit coverage for dynamic session start and queue promotion rules in `badminton-v2/src/__tests__/sessionCourtFlow.test.ts`
- [X] T018 [P] [US3] Add unit coverage for dynamic admin court actions and reassignment rules in `badminton-v2/src/__tests__/adminCourtActions.test.ts`
- [X] T019 [P] [US3] Extend the multi-court browser flow to cover start and finish behavior in `badminton-v2/tests/admin-court-count.spec.ts`

### Implementation for User Story 3

- [X] T020 [US3] Update session start and unstart logic to use `court_count` instead of two fixed courts in `badminton-v2/src/hooks/useSession.ts`
- [X] T021 [US3] Update admin live court actions to work with dynamic court numbers in `badminton-v2/src/hooks/useAdminActions.ts`
- [X] T022 [US3] Update liveboard finish handling to promote matches into the triggering dynamic court in `badminton-v2/src/components/CourtCard.tsx`
- [X] T023 [US3] Reconcile admin-session queue and playing-match state with dynamic court assignments in `badminton-v2/src/hooks/useAdminSession.ts`
- [X] T024 [US3] Align player schedule and live summary court references with dynamic assignments in `badminton-v2/src/hooks/usePlayerSchedule.ts`

**Checkpoint**: User Story 3 should now keep live match flow consistent for any valid configured court count

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all stories

- [X] T025 [P] Review match generator assumptions against dynamic court counts in `badminton-v2/src/components/MatchGeneratorPanel.tsx`
- [ ] T026 Run full validation from `badminton-v2/` with `npm run lint`, `npm run test:unit`, and `npm run test:e2e`

Deferred note: court-count-specific validation passed (`lint`, `test:unit`, and `tests/admin-court-count.spec.ts`), but full repo-wide `test:e2e` remains open due to unrelated existing Playwright failures outside this feature scope.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all story work
- **User Story 1 (Phase 3)**: Depends on Phase 2
- **User Story 2 (Phase 4)**: Depends on Phase 2 and benefits from User Story 1 persistence work
- **User Story 3 (Phase 5)**: Depends on Phase 2 and on the dynamic court structures completed in User Story 2
- **Polish (Phase 6)**: Depends on the completion of the desired user stories

### User Story Dependencies

- **US1**: No dependency on other user stories after foundational work
- **US2**: Depends on foundational dynamic court structures and the persisted `court_count` field from US1
- **US3**: Depends on foundational work plus the dynamic rendering/state model introduced in US2

### Within Each User Story

- Tests should be added before or alongside implementation and must fail before the final implementation is considered complete
- Persistence changes precede UI wiring in US1
- Shared dynamic hook refactors precede view refactors in US2
- Session flow changes precede action and player-flow reconciliation in US3

### Parallel Opportunities

- T004 and T005 can run in parallel after T003
- T006 and T007 can run in parallel within US1
- T011 and T012 can run in parallel within US2
- T017, T018, and T019 can run in parallel within US3
- T025 can run in parallel with late-story verification before T026

---

## Parallel Example: User Story 2

```bash
# Launch User Story 2 test tasks together:
Task: "Add unit coverage for dynamic court-slot derivation and labels in badminton-v2/src/__tests__/useCourtState.test.ts"
Task: "Extend the multi-court browser flow assertions for rendered court cards in badminton-v2/tests/admin-court-count.spec.ts"

# Launch independent dynamic court rendering refactors after shared hook output is stable:
Task: "Refactor liveboard rendering to display one card per configured court in badminton-v2/src/views/LiveBoardView.tsx"
Task: "Refactor player live court summaries to render dynamic courts in badminton-v2/src/views/PlayerView.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2
2. Complete Phase 3 (US1)
3. Validate that session court count saves, reloads, and rejects invalid values
4. Demo or merge the persistence/setup slice if partial delivery is needed

### Incremental Delivery

1. Finish Setup + Foundational
2. Deliver US1 for session-level court-count configuration
3. Deliver US2 for correct dynamic court rendering everywhere
4. Deliver US3 for dynamic live match flow and assignment behavior
5. Run final polish validation

### Parallel Team Strategy

1. One developer handles schema and foundational hook changes
2. A second developer handles US1 setup form and persistence UX once the schema shape is stable
3. After foundational work, view rendering tasks in US2 can split across admin/liveboard/player surfaces
4. US3 action-flow work can split between session lifecycle logic and admin/player/liveboard follow-through

---

## Notes

- All tasks follow the required checklist format with task IDs, optional `[P]` markers, required story labels for story phases, and exact file paths
- Suggested MVP scope: **Phase 3 / User Story 1 only**
- Total tasks: 26
