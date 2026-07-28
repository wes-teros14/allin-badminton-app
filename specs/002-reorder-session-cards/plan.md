# Implementation Plan: Reorder Session Cards by Soonest Scheduled Date

**Branch**: `002-reorder-session-cards` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-reorder-session-cards/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The `/sessions` page (`MySessionsView`) currently sorts a player's active/upcoming sessions in descending date order (furthest-future first), which is backwards from what players expect. The fix flips the active-sessions comparator to ascending by date (with time as a tiebreaker for same-day sessions), while leaving the past-sessions comparator untouched (most-recent-past-first still makes sense there). `usePlayerSessions.ts` also queries Supabase with `.order('date', { ascending: false })`, but that ordering is fully overridden by `MySessionsView`'s own `.sort()` calls on the merged list before render, so the hook needs no code change — confirmed by reading the hook's merge logic. This is a small, self-contained client-side change: no schema change, no new data, no other surface affected — confirmed by grepping the codebase for every `.sort()`/`.order()` call touching session dates.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19

**Primary Dependencies**: react-router 7, @supabase/supabase-js 2, existing `usePlayerSessions` hook

**Storage**: Supabase Postgres (read-only for this feature — no schema change; `sessions.date`/`sessions.time` columns already exist and are already fetched)

**Testing**: Vitest (`npm run test:unit`, existing suite includes `badminton-v2/src/__tests__/usePlayerSessions.test.ts`), Playwright (`npm run test:e2e`) for browser-level confirmation of card order

**Target Platform**: Web (player-facing SPA, mobile-width layout per existing `max-w-sm` container)

**Project Type**: Web application — single frontend (`badminton-v2/`), no backend service in this repo (Supabase is the backend)

**Performance Goals**: N/A — sorting an in-memory list of a player's own sessions (typically single-digit count); no measurable perf impact

**Constraints**: Must not alter past-sessions ordering, badge logic, or any other card content/behavior — pure comparator change

**Scale/Scope**: One view file (`MySessionsView.tsx`); no admin, liveboard, or finance surfaces involved, and no change needed in `usePlayerSessions.ts` (its query order is overridden downstream)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Single-App Runtime Boundaries** — PASS. All work targets `badminton-v2/src/views/MySessionsView.tsx` and `badminton-v2/src/hooks/usePlayerSessions.ts`, the player-facing surface. No root-level legacy/planning files touched.
- **II. Session Data Is the Source of Truth** — PASS. Ordering is derived directly from the persisted `sessions.date`/`sessions.time` fields already returned by the existing query; no new duplicated constant, no schema change, no database type changes needed.
- **III. Cross-Surface Consistency Is Mandatory** — PASS (scoped). A repo-wide grep of every `.sort()`/`.order()` call touching session dates confirms the descending-by-date logic exists only in `usePlayerSessions.ts` (the initial Supabase query for both the "active" and "history" branches) and its consumer `MySessionsView.tsx`. The admin session list (`useSessionList.ts`) orders by `created_at` for a different purpose (management recency, not "what's next chronologically") and is unaffected/out of scope. No other view renders this same "soonest first" session list, so there is no surface left in a stale/inconsistent state.
- **IV. Safe Stateful Changes First** — PASS. No mutation of session, match, or queue state — this is read-only display ordering.
- **V. Validation Before Merge** — PLANNED. `npm run lint`, `npm run test:unit` (adding a unit test for a newly extracted, exported sort comparator — following the existing `buildRegistrationPaymentMap` pattern of exporting pure helpers from the hook/view module for testability), and a targeted `npm run test:e2e` assertion (or manual Playwright check) that active session cards render in ascending date order.

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-reorder-session-cards/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — skipped, no external interface
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
badminton-v2/
├── src/
│   ├── views/
│   │   └── MySessionsView.tsx        # active/past sort comparators live here (lines ~195-201)
│   ├── hooks/
│   │   └── usePlayerSessions.ts      # unchanged — query order is overridden downstream, kept for reference
│   └── __tests__/
│       └── (new) sort comparator unit test, alongside existing usePlayerSessions.test.ts
└── tests/                             # Playwright specs (existing suite), add/extend ordering check
```

**Structure Decision**: Single frontend project (`badminton-v2/`), no backend service in-repo. Change is confined to one view component and one data hook already identified above; no new directories needed.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
