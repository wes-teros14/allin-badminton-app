---

description: "Task list for Finance Net Totals Summary"
---

# Tasks: Finance Net Totals Summary

**Input**: Design documents from `/specs/004-finance-net-totals/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/get_session_finance.md, quickstart.md

**Tests**: Test tasks ARE included. Constitution Principle V mandates targeted validation proportional to impact, and the Testing Rules require deterministic unit tests under `badminton-v2/src/__tests__/`. SC-002 and SC-003 are arithmetic reconciliation claims that are only credibly verifiable by unit test.

**Organization**: Tasks are grouped by user story so each can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in every task

## Path Conventions

All runtime code lives under `badminton-v2/` per Constitution Principle I. Paths below are repo-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the working environment matches the plan's assumptions before touching code

- [X] T001 Verify branch `004-finance-net-totals` is checked out and `badminton-v2/` dependencies are installed (`npm install` if `node_modules/` is absent)
- [X] T002 Confirm baseline is green by running `npm run lint` and `npm run test:unit` from `badminton-v2/`, recording any pre-existing failures so they are not later misattributed to this feature (Constitution V)

**Checkpoint**: Baseline captured — any failure after this point is attributable to the feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Expose `sessions.status` through the finance read path. This is the single blocking dependency — **neither** user story can be completed without it, because the totals and the status partition both flow from this one RPC.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create migration `badminton-v2/supabase/migrations/074_add_status_to_get_session_finance.sql` by copying the full function body from `065_add_shuttle_allocation_mode.sql` (lines 17–118), appending `status public.session_status` to the `RETURNS TABLE` list and `s.status` to the final `SELECT` projection; retain `DROP FUNCTION IF EXISTS public.get_session_finance(UUID);` before the `CREATE` and re-issue `GRANT EXECUTE ON FUNCTION public.get_session_finance(UUID) TO authenticated;` after it
- [X] T004 Verify migration `074` preserves every invariant listed in `specs/004-finance-net-totals/contracts/get_session_finance.md`: `SECURITY INVOKER`, `SET search_path = public`, the admin guard raising `42501`, the `p_session_id` filter, `ORDER BY fb.date DESC, s.created_at DESC`, and unchanged values for all 16 pre-existing columns
- [X] T005 Add `status: Database["public"]["Enums"]["session_status"]` to the `get_session_finance` `Returns` object in `badminton-v2/src/types/database.ts` (~line 623); confirm the `session_status` enum already exists in the generated `Enums` block (~line 647) and requires no addition
- [X] T006 Add `status: SessionStatus` to the `FinanceSessionRow` interface in `badminton-v2/src/hooks/useFinanceSessions.ts`, importing `SessionStatus` from `@/types/app`, and map `status: row.status` inside the existing `.map()` over the RPC result

**Checkpoint**: Session status now reaches the Finance page — both user stories are unblocked

---

## Phase 3: User Story 1 — See the club's overall net position at a glance (Priority: P1) 🎯 MVP

**Goal**: An admin opening `/finance` sees a single cumulative gain/loss total across every session, level with the "Finance" heading, without scrolling or mental math.

**Independent Test**: Sign in as admin, open `/finance`, confirm the All Sessions total equals the sum of the Net Cash column across every visible row, with positive/negative treatment matching the sign.

### Tests for User Story 1

- [X] T007 [P] [US1] Create `badminton-v2/src/__tests__/financeTotals.test.ts` with `vi.mock('@/lib/supabase', () => ({ supabase: {} }))`, asserting `summarizeFinanceTotals` returns an `allSessions` value equal to the hand-computed sum of `profit` across a mixed fixture (validation rule V-2, SC-002)
- [X] T008 [P] [US1] Add cases to `badminton-v2/src/__tests__/financeTotals.test.ts` covering an empty array returning `{ allSessions: 0, completed: 0 }` (V-1, FR-010), rows with zero financial activity contributing `0` without erroring (V-3), and a negative sum being preserved unclamped (V-4, FR-006)
- [X] T009 [P] [US1] Add a float-drift case to `badminton-v2/src/__tests__/financeTotals.test.ts` using values whose naive float sum produces trailing-precision error, asserting the returned total is an exact 2-decimal number (V-2, research R-003)

### Implementation for User Story 1

- [X] T010 [US1] Export a pure `summarizeFinanceTotals(sessions: FinanceSessionRow[]): { allSessions: number; completed: number }` from `badminton-v2/src/hooks/useFinanceSessions.ts` that sums `profit` and rounds once via `Number(sum.toFixed(2))`, matching the money convention in `useSessionFinance.ts:135`; keep it free of I/O, clock, and randomness (V-7)
- [X] T011 [US1] Derive `totals` via `useMemo(() => summarizeFinanceTotals(sessions), [sessions])` in `useFinanceSessions` and add `totals` to the returned object and the `FinanceSessionsState` interface in `badminton-v2/src/hooks/useFinanceSessions.ts`
- [X] T012 [US1] Restructure the heading row in `badminton-v2/src/views/FinanceView.tsx` (~line 27) into a wrapping flex container holding the existing `<h1>Finance</h1>` on the left and a right-aligned totals area, allowing wrap on narrow viewports per FR-011
- [X] T013 [US1] Render the All Sessions total in `badminton-v2/src/views/FinanceView.tsx` as a small caption `All Sessions` above its value formatted with `formatPeso`, colored by the same conditional used by the Net Cash cell (`value >= 0 ? 'text-green-500' : 'text-destructive'`) per FR-005/FR-006/FR-007
- [X] T014 [US1] Implement the three display states for the totals area in `badminton-v2/src/views/FinanceView.tsx`: skeleton pulse while `isLoading` matching the table's existing `animate-pulse` (FR-008), an em-dash placeholder while `fetchError` is set so a failed load never renders `₱0.00` (FR-009), and formatted currency otherwise including a genuine `₱0.00` (FR-010)
- [X] T015 [US1] Run `npm run test:unit` from `badminton-v2/` and confirm all `financeTotals.test.ts` cases pass

**Checkpoint**: User Story 1 is independently deliverable — the All Sessions total is functional and correct on its own

---

## Phase 4: User Story 2 — Separate settled results from in-flight sessions (Priority: P2)

**Goal**: A second total restricted to completed sessions, so the admin can distinguish settled results from figures still moving.

**Independent Test**: With a mix of completed and non-completed sessions present, confirm the Completed total equals the sum of Net Cash across only `status === 'complete'` rows, and differs from the All Sessions total whenever a non-completed session has non-zero Net Cash.

### Tests for User Story 2

- [X] T016 [P] [US2] Add a mixed-status case to `badminton-v2/src/__tests__/financeTotals.test.ts` asserting `completed` excludes rows whose status is `setup`, `registration_open`, `registration_closed`, `schedule_locked`, or `in_progress` (SC-003, data-model status table)
- [X] T017 [P] [US2] Add cases to `badminton-v2/src/__tests__/financeTotals.test.ts` asserting the two totals are equal when every row is `'complete'` (V-5, US2 Scenario 2) and that `completed` is `0` while `allSessions` is non-zero when no row is `'complete'` (V-6, US2 Scenario 3)

### Implementation for User Story 2

- [X] T018 [US2] Extend `summarizeFinanceTotals` in `badminton-v2/src/hooks/useFinanceSessions.ts` to compute `completed` by summing `profit` over `sessions.filter((s) => s.status === 'complete')`, applying the same single 2-decimal rounding
- [X] T019 [US2] Render the Completed total in `badminton-v2/src/views/FinanceView.tsx` alongside the All Sessions total, using caption `Completed` and the identical formatting, coloring, and three-state loading/error/loaded handling applied in T013–T014
- [X] T020 [US2] Run `npm run test:unit` from `badminton-v2/` and confirm all `financeTotals.test.ts` cases pass

**Checkpoint**: Both totals functional; feature is behaviorally complete

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verification, regression protection, and the honest validation report Constitution V requires

- [X] T021 [P] Create `badminton-v2/tests/finance-totals.spec.ts` asserting that after signing in as admin and navigating to `/finance`, both `All Sessions` and `Completed` captions render in the heading area with peso-formatted values (SC-001)
- [ ] ⏸ DEFERRED — T022 Run `npx playwright test tests/finance-allocation-regression.spec.ts` from `badminton-v2/` to confirm the recreated RPC caused no regression on the finance detail surface, discharging contract check C-6 and the Constitution III cross-surface obligation
- [ ] ⏸ DEFERRED — T023 [P] Manually verify at a ~360px viewport that the "Finance" heading and both totals render with no clipped or truncated characters, wrapping if needed (SC-004, FR-011)
- [ ] ⏸ DEFERRED — T024 [P] Manually verify the All Sessions total equals the sum of the visible Net Cash cells on a real data set, using the dev-only admin login button at lower right on localhost (SC-002)
- [X] T025 Verify no existing Finance page behavior changed: all five table columns, row ordering, row navigation to `/finance/:sessionId`, the empty state, and the error toast (FR-013, SC-006)
- [X] T026 Run `npm run lint` from `badminton-v2/` and resolve any new violations introduced by this feature
- [X] T027 Add an entry to `tasks/lessons.md` recording that `get_session_finance` had no `status` column and required migration `074` to expose it, per the project's Bug & Resolution Log rule in `CLAUDE.md`
- [X] T028 Run `graphify update .` from the repo root to refresh the knowledge graph after code changes, per the graphify rule in `CLAUDE.md`
- [X] T029 Produce the final validation report naming exactly what passed, what was deferred, and any pre-existing unrelated failures carried over from the T002 baseline (Constitution V)

---

## Dependencies

### Phase-Level

```
Phase 1 (Setup)
      ↓
Phase 2 (Foundational) ← BLOCKING: exposes sessions.status
      ↓
      ├──→ Phase 3 (US1 — All Sessions total)  🎯 MVP
      │           ↓
      └──→ Phase 4 (US2 — Completed total)
                  ↓
            Phase 5 (Polish)
```

### Story-Level

- **US1** depends only on Phase 2. Independently deliverable and shippable as the MVP.
- **US2** depends on Phase 2 for `status`, and on T010 (US1) because it extends the same helper function and the same heading layout. This is a genuine sequential dependency, not an artificial one — US2 adds a second field to a container US1 creates.

### File-Level Contention

These files are touched by multiple tasks and must be edited sequentially, never in parallel:

- `badminton-v2/src/hooks/useFinanceSessions.ts` — T006, T010, T011, T018
- `badminton-v2/src/views/FinanceView.tsx` — T012, T013, T014, T019
- `badminton-v2/src/__tests__/financeTotals.test.ts` — T007, T008, T009, T016, T017 (marked `[P]` as independent *test cases*, but if written by a single agent they append to one file and must be serialized)

---

## Parallel Execution Opportunities

**Within Phase 3 (US1)** — the three test tasks describe independent case groups:

```
T007, T008, T009  (test cases for the helper — same file, distinct concerns)
```

**Within Phase 4 (US2)**:

```
T016, T017  (mixed-status and equality cases — same file, distinct concerns)
```

**Within Phase 5 (Polish)** — genuinely independent, different files and activities:

```
T021 (E2E spec)  ‖  T023 (viewport check)  ‖  T024 (reconciliation check)
```

Note: parallelism here is modest by nature. This is a five-file feature with a strict migration → types → hook → view dependency chain; most of the sequence is real, not incidental.

---

## Implementation Strategy

### MVP Scope

**Phase 1 + Phase 2 + Phase 3** delivers a working, shippable increment: the All Sessions total rendering correctly in the heading. Stopping here is a coherent product state — the admin gets the club's overall position at a glance, which is the primary value in the request.

### Incremental Delivery

1. **Foundation** (T001–T006) — expose `status`; no user-visible change yet
2. **MVP** (T007–T015) — All Sessions total live and unit-tested → demoable
3. **Full feature** (T016–T020) — Completed total added → spec-complete
4. **Hardened** (T021–T029) — regression-checked, lint-clean, validated at target viewport

### Critical Implementation Notes

- **Do not skip the re-`GRANT`** in T003. Dropping a function discards its privileges; omitting it breaks `/finance` for every admin.
- **Do not change any computed column** in migration `074`. It is a signature-only change; any diff in `revenue`, `total_cost`, `profit`, or `profit_after_personal_share` for identical input is a defect.
- **Round once, at the end** of each reduce (T010). `NUMERIC(10,2)` arrives as a JS float and accumulating drift makes SC-002's exact-reconciliation claim untestable.
- **Never render `₱0.00` on error** (T014). On fetch failure the hook leaves `sessions` as `[]` and clears `isLoading`, so the naive path shows a confident zero that an admin reads as "exactly break-even."

---

## Task Count Summary

| Phase | Tasks | Story |
|-------|:-----:|-------|
| Phase 1 — Setup | 2 | — |
| Phase 2 — Foundational | 4 | — |
| Phase 3 — User Story 1 | 9 | US1 (3 tests, 6 impl) |
| Phase 4 — User Story 2 | 5 | US2 (2 tests, 3 impl) |
| Phase 5 — Polish | 9 | — |
| **Total** | **29** | |

---

## Deferral Notes

**T022, T023, T024 are deferred — they all require migration `074` to be applied to a live Supabase project, which has not been done.**

The migration file is committed but **not applied to any database**. Until it is:

- `get_session_finance` returns no `status` key, so `row.status` is `undefined`
- `summarizeFinanceTotals` filters on `status === 'complete'`, which matches nothing
- **All Sessions** still computes correctly; **Completed** renders `₱0.00` regardless of real data

This is graceful degradation, not a crash — but the Completed total is wrong until the migration lands.

Applying it was deliberately not attempted because:

1. The Supabase CLI is currently linked to the **production** project (`ensdfitpeyreunihkqkh` in `supabase/.temp/project-ref`), not dev. Running `supabase db push` here would target prod.
2. `tasks/lessons.md` documents that the dev project's `supabase_migrations.schema_migrations` table has corrupted duplicate rows for versions 037–044 that **block `supabase db push`** and cannot be fixed via `supabase migration repair`. Migration `070` is still unapplied for this reason.

**Action required by a human**: link to the intended project, resolve the known migration-history corruption, apply `074`, then run T022–T024.
