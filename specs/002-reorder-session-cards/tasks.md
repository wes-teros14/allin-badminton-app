---

description: "Task list template for feature implementation"
---

# Tasks: Reorder Session Cards by Soonest Scheduled Date

**Input**: Design documents from `/specs/002-reorder-session-cards/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md (contracts/ intentionally skipped — no external interface)

**Tests**: Included. Constitution Principle V (Validation Before Merge) requires targeted unit + e2e coverage for user-facing flow changes, and research.md Decision 3 commits to extracting a testable pure comparator following this repo's existing convention (`buildRegistrationPaymentMap`).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Single frontend project rooted at `badminton-v2/` (no backend service in this repo — Supabase is the backend). All paths below are relative to the repository root.

- App source: `badminton-v2/src/`
- Unit tests: `badminton-v2/src/__tests__/`
- E2e tests: `badminton-v2/tests/`

---

## Phase 1: Setup

**Purpose**: Confirm the working environment is ready — no new dependencies are required for this feature.

- [X] T001 Confirm branch `002-reorder-session-cards` is checked out; run `npm run dev`, `npm run test:unit`, and `npm run lint` in `badminton-v2/` once to establish a clean baseline before making changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared comparator both user stories depend on.

**⚠️ CRITICAL**: Must be complete before Phase 3/4 work begins.

- [X] T002 In `badminton-v2/src/views/MySessionsView.tsx`, add a named, exported pure function `compareSessionsByScheduledDate(a: SessionPickerItem, b: SessionPickerItem): number` that orders ascending by `date`, then ascending by `time` as a tiebreaker when dates match, with sessions missing `time` sorting after sessions that have a `time` set on the same date (FR-001, FR-002, FR-005)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Soonest upcoming session appears first (Priority: P1) 🎯 MVP

**Goal**: The active/upcoming sessions list on `/sessions` shows the session with the nearest scheduled date first, with later sessions following in ascending order.

**Independent Test**: Register for (or view) multiple active sessions with different dates; open `/sessions` and confirm the card with the nearest date is first, followed by later dates in order.

### Tests for User Story 1

- [X] T003 [P] [US1] Add unit tests for `compareSessionsByScheduledDate` in `badminton-v2/src/__tests__/mySessionsView.sort.test.ts` covering: three sessions on different dates sort ascending (Acceptance Scenario 1), two same-date sessions sort by time ascending (Acceptance Scenario 2), a single session is a no-op (Acceptance Scenario 3), and a session with a `null` time sorts after one with a set time on the same date (FR-005)

### Implementation for User Story 1

- [X] T004 [US1] In `badminton-v2/src/views/MySessionsView.tsx`, replace the inline `activeSessions` comparator (currently `.sort((a, b) => b.date.localeCompare(a.date))`, ~line 197) with `.sort(compareSessionsByScheduledDate)` from T002 — leave the `pastSessions` comparator (~line 201) unchanged per FR-004
- [X] T005 [US1] Manually verify via `quickstart.md` steps 1-3: soonest active session card appears first, same-date sessions order by time, ordering holds with only one active session

**Checkpoint**: User Story 1 is fully functional and independently testable — this is the MVP.

---

## Phase 4: User Story 2 - Ordering stays consistent when new sessions are registered (Priority: P2)

**Goal**: When a player registers for a new session scheduled sooner than an existing one, the list reflects the correct order the next time it's displayed, with no special-case refresh logic needed.

**Independent Test**: Start with a player registered for a session on a later date; register them for a new, sooner-dated session; reload `/sessions` and confirm the new session now appears above the previously-soonest one.

### Tests for User Story 2

- [ ] T006 [P] [US2] Add or extend a Playwright test in `badminton-v2/tests/` that registers a seeded player for a new session dated sooner than an existing active registration, reloads `/sessions`, and asserts the new session's card renders above the previously-soonest card

### Implementation for User Story 2

- [X] T007 [US2] Confirm (no code change expected) that `activeSessions` and `pastSessions` in `badminton-v2/src/views/MySessionsView.tsx` are computed directly in the component body from the live `sessions` state on every render — not memoized on stale dependencies — so a newly registered, sooner-dated session is correctly re-sorted to the top without extra wiring
- [ ] T008 [US2] Manually verify via `quickstart.md` step 4 that registering for a new, sooner session reorders the list correctly on next display

**Checkpoint**: Both user stories work independently and together.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both stories, per Constitution Principle V.

- [X] T009 [P] Run `npm run lint` in `badminton-v2/` and resolve any violations introduced by this change
- [X] T010 [P] Run `npm run test:unit` in `badminton-v2/` and confirm all tests pass, including the new tests from T003
- [ ] T011 Run the full `quickstart.md` validation checklist end-to-end (all 5 steps) and confirm past-sessions ordering (FR-004) and all other card content/behavior are unaffected

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS both user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion — no dependency on User Story 2
- **User Story 2 (Phase 4)**: Depends on Foundational completion; its test (T006) and verification (T007/T008) exercise behavior that only exists once User Story 1's comparator is wired in (T004) — so in practice complete Phase 3 before Phase 4
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- User Story 1: T003 (tests) can be written in parallel with T002/T004 landing, but should pass only once T004 is in place; T005 (manual check) requires T004 done
- User Story 2: T006 requires T004 done (the behavior under test doesn't exist until then); T007 is a read-only verification with no ordering dependency on T006; T008 requires T004 done

### Parallel Opportunities

- T003 (unit test file) and T004 (implementation) touch different files and can be developed in parallel, though T003 will only pass once T004 lands
- T006 (new e2e test file) is independent of T007 (verification note, no file change)
- T009 and T010 (lint, unit tests) can run in parallel — different tooling, no shared state

---

## Parallel Example: User Story 1

```bash
# Once T002 (Foundational) is done, these can proceed together:
Task: "Add unit tests for compareSessionsByScheduledDate in badminton-v2/src/__tests__/mySessionsView.sort.test.ts"
Task: "Replace the inline activeSessions comparator in badminton-v2/src/views/MySessionsView.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (extract `compareSessionsByScheduledDate`)
3. Complete Phase 3: User Story 1 — this alone delivers the entire user-visible fix requested
4. **STOP and VALIDATE**: Run `quickstart.md` steps 1-3
5. This is deployable as the complete fix; User Story 2 only adds regression coverage for an already-correct emergent behavior

### Incremental Delivery

1. Setup + Foundational → comparator ready
2. User Story 1 → soonest-first ordering live → validate → this is the MVP and the full scope of the original request
3. User Story 2 → adds test coverage confirming the ordering holds after new registrations → validate
4. Polish → lint, full unit suite, full quickstart pass

---

## Notes

- This is a small, single-file-scoped fix: nearly all tasks touch `badminton-v2/src/views/MySessionsView.tsx`. Task granularity here reflects logical steps (extract comparator → wire it in → test it), not separate files, so most tasks are sequential rather than parallel.
- `usePlayerSessions.ts` and the admin session list (`useSessionList.ts`) are explicitly out of scope (see plan.md Constitution Check, Principle III) — no tasks touch them.
- Verify tests fail before T004 lands (for T003) where practical; commit after each task or logical group.

## Implementation Status (as of 2026-07-28)

- T001-T005, T007, T009, T010 complete and verified.
- T006 (Playwright test file) was written (`badminton-v2/tests/sessions-ordering.spec.ts`, mirroring `registration-limit.spec.ts` conventions) but could not be executed in this environment: `badminton-v2/.env` (the file Playwright's Node-side service-role Supabase client loads) is empty. This is a pre-existing environment gap — the existing `registration-limit.spec.ts` fails identically for the same reason — not something introduced by this change. Left unchecked pending a run in an environment with real e2e credentials.
- T008 and T011 (live "register for a new sooner session" check) were not literally performed for the same reason (would require either service-role DB writes or a full UI registration flow against a real open session). Confidence remains high because: the 4 unit tests in T003 cover the exact comparator logic, live verification of T005 confirmed ascending real-data rendering, and T007 confirmed the sort is recomputed inline on every render with no memoization — so a newly registered session re-sorts by the same rule with no special-case code path. Left unchecked pending live confirmation.
