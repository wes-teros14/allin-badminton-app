# Implementation Plan: Finance Net Totals Summary

**Branch**: `004-finance-net-totals` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-finance-net-totals/spec.md`

## Summary

Add two read-only gain/loss totals to the `/finance` page heading row — **All Sessions** and **Completed** — each summing the same per-session net (`profit_after_personal_share`) already rendered in the table's Net Cash column.

The only substantive engineering problem is that `get_session_finance` does not return session status today, so nothing on the client can distinguish a completed session from an in-flight one. The approach is a new additive migration (`074`) that recreates the RPC with a `status` column appended to its `RETURNS TABLE`, following the same DROP-and-CREATE versioning pattern already used by migrations `058 → 060 → 065`. Every existing consumer reads fields by name, so appending a column is non-breaking.

Everything above that line is a pure summation and a heading-row layout: one exported helper (`summarizeFinanceTotals`) unit-tested in isolation, consumed by `useFinanceSessions`, rendered by `FinanceView`.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, targeting ES2022

**Primary Dependencies**: React Router (route `/finance`), Supabase JS client (`supabase.rpc`), Tailwind CSS + shadcn/ui (`Card`, `Table`), `lucide-react`, `sonner` (toasts)

**Storage**: Supabase Postgres. Read path is the `public.get_session_finance(UUID)` RPC (`SECURITY INVOKER`, admin-gated). This feature adds **no new tables and no new columns** — only an additional field on an existing function's return signature.

**Testing**: Vitest for unit tests (`npm run test:unit`, specs in `badminton-v2/src/__tests__/`); Playwright for E2E (`npm run test:e2e`, specs in `badminton-v2/tests/`)

**Target Platform**: Mobile-first responsive web. The Finance page is constrained to `max-w-lg` (512px); the practical design target is a ~360px phone viewport.

**Project Type**: Single-page web application with a Supabase backend — all runtime code lives under `badminton-v2/`

**Performance Goals**: No new network round trips. Totals are derived synchronously from data the page already fetches; the summation is O(n) over the session list (tens of rows, not thousands) and adds no perceptible cost to first paint.

**Constraints**:
- Both totals plus the "Finance" heading must remain legible at ~360px with no clipping (FR-011).
- Currency drift is a real risk: `NUMERIC(10,2)` values become JS floats, and naive summation of many 2-decimal values accumulates error. Totals must be rounded to 2 decimals, matching the existing `calculateProfitAfterPersonalShare` convention.
- The all-sessions total must reconcile *exactly* to the sum of the visible Net Cash cells (FR-004, SC-002) — this forbids computing the total by any path other than summing the same per-row value.
- Error state must not render `₱0.00`, which would read as a real result (FR-009).

**Scale/Scope**: 1 new migration, 1 regenerated type entry, 1 hook extended, 1 view modified, 1 new unit test file. Roughly 5 touched files. Single admin-only surface.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Single-App Runtime Boundaries** | ✅ PASS | All runtime changes land in `badminton-v2/`. Affected surface identified explicitly: **finance (admin-only)**. No legacy or root-level folders touched. |
| **II. Session Data Is the Source of Truth** | ✅ PASS | Completed-session status is read from persisted `sessions.status`, not inferred client-side from dates or duplicated as a UI constant. Schema-backed change ships with a Supabase migration (`074`) **and** a matching `src/types/database.ts` update, as required. |
| **III. Cross-Surface Consistency Is Mandatory** | ✅ PASS | Club-level net cash is admin finance information and is not exposed on the liveboard, player, or admin operational surfaces — there is no sibling surface that could go stale. The RPC signature change is additive and every existing consumer (`useSessionFinance` for the detail view) reads fields by name, so the finance detail surface is verified unaffected rather than assumed unaffected. |
| **IV. Safe Stateful Changes First** | ✅ PASS | Read-only feature. No writes, no state transitions, no destructive operations. In-progress sessions are *included* in the All Sessions total and *excluded* from Completed — both are display outcomes, and both are specified as edge cases. Legacy sessions with no financial data contribute zero rather than erroring. |
| **V. Validation Before Merge** | ✅ PASS | Plan commits to `npm run lint`, `npm run test:unit` (including a new deterministic test file for the summation helper), and a targeted E2E assertion on the finance heading. Any pre-existing unrelated failures will be named explicitly in the final report. |

**Additional Constraints check**:
- *Data and Migration Rules* — ✅ Migration is additive-first. Appending a column to a `RETURNS TABLE` requires `DROP FUNCTION` + `CREATE`, which is the established pattern in this repo (`058`, `060`, `065` all do exactly this); it is a function-signature replacement, not destructive data change. No secrets involved.
- *Testing Rules* — ✅ New unit tests are deterministic and land in `badminton-v2/src/__tests__/`. The summation helper is exported as a pure function so it is testable without mounting a component or touching Supabase, matching the existing `useSessionFinance.test.ts` pattern.
- *UI and Runtime Rules* — ✅ Existing visual language preserved. Reuses `formatPeso` and the exact positive/negative color treatment (`text-green-500` / `text-destructive`) already applied to the Net Cash column. Summation logic lives in the hook layer, not duplicated in the view.

**Gate result**: PASS — no violations, Complexity Tracking section not required.

## Project Structure

### Documentation (this feature)

```text
specs/004-finance-net-totals/
├── plan.md              # This file
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── get_session_finance.md   # Phase 1 output — RPC return contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
badminton-v2/
├── supabase/
│   └── migrations/
│       └── 074_add_status_to_get_session_finance.sql   # NEW — additive RPC signature change
├── src/
│   ├── types/
│   │   └── database.ts              # MODIFIED — add `status` to get_session_finance Returns
│   ├── hooks/
│   │   └── useFinanceSessions.ts    # MODIFIED — map status; export summarizeFinanceTotals; return totals
│   ├── views/
│   │   └── FinanceView.tsx          # MODIFIED — render the two totals in the heading row
│   ├── utils/
│   │   └── formatPeso.ts            # UNCHANGED — reused as-is
│   └── __tests__/
│       └── financeTotals.test.ts    # NEW — deterministic unit tests for the summation helper
└── tests/
    └── finance-totals.spec.ts       # NEW (optional) — browser assertion on heading totals
```

**Structure Decision**: This repository is a single-page web application with a Supabase backend, all runtime code under `badminton-v2/`, per Constitution Principle I. There is no separate frontend/backend split to mirror — the "backend" is SQL migrations defining RPCs, and the "frontend" is the Vite/React `src/` tree. The feature therefore follows the repo's established vertical slice: *migration → generated types → hook → view → tests*. No new directories are introduced.

## Implementation Approach

### 1. Migration — `074_add_status_to_get_session_finance.sql`

Recreate `public.get_session_finance(UUID)` identical to the `065` definition with one change: append `status public.session_status` to the `RETURNS TABLE` and select `s.status` in the final projection. The function already `JOIN public.sessions s ON s.id = fb.session_id` in its outer select, so the column is available without restructuring the query — no CTE changes, no recalculation of any existing figure.

Preserve verbatim: `SECURITY INVOKER`, `SET search_path = public`, the admin-role guard, the `p_session_id` filter, the `ORDER BY fb.date DESC, s.created_at DESC`, and the `GRANT EXECUTE ... TO authenticated`.

**Non-negotiable**: no existing computed column changes value. This migration is signature-only.

### 2. Types — `src/types/database.ts`

Add `status: Database["public"]["Enums"]["session_status"]` to the `get_session_finance` `Returns` object (currently at ~line 623). The `session_status` enum already exists in the generated types, so no enum addition is needed.

### 3. Hook — `src/hooks/useFinanceSessions.ts`

- Add `status: SessionStatus` to the `FinanceSessionRow` interface and map `row.status` in the existing `.map()`.
- Export a **pure** helper:
  ```
  summarizeFinanceTotals(sessions: FinanceSessionRow[]): { allSessions: number; completed: number }
  ```
  It sums `profit` across all rows for `allSessions`, and across rows where `status === 'complete'` for `completed`, rounding each result to 2 decimals to prevent float drift. Empty input yields `{ allSessions: 0, completed: 0 }`.
- Return `totals` from the hook, derived via `useMemo` over `sessions`.

Exporting the helper as a standalone pure function (rather than inlining the reduce) is what makes SC-002 and SC-003 unit-testable without a component or a network mock — the same design already used for `calculateProfitAfterPersonalShare`.

### 4. View — `src/views/FinanceView.tsx`

Extend the existing heading row:

```
<div className="flex items-center justify-between">
  <h1 className="text-lg font-semibold text-primary">Finance</h1>
</div>
```

into a wrapping flex row holding the `<h1>` on the left and the two totals on the right. Each total is a small caption (`All Sessions` / `Completed`) above its peso value, formatted with `formatPeso` and colored with the identical conditional already used by the Net Cash cell (`s.profit >= 0 ? 'text-green-500' : 'text-destructive'`).

Three display states, matching FR-008/FR-009/FR-010:
- **Loading** (`isLoading`) → skeleton pulse blocks consistent with the table's existing `animate-pulse` treatment.
- **Error** (`fetchError`) → em-dash placeholder, never `₱0.00`.
- **Loaded** → formatted totals, including `₱0.00` when genuinely zero.

Allow the row to wrap on narrow viewports; "level with the Finance label" is satisfied by same-row placement wherever width permits (per the spec's stated assumption).

### 5. Validation

- `npm run lint`
- `npm run test:unit` — new `financeTotals.test.ts` covering: mixed statuses, all-complete equality, no-complete zero, empty list, negative totals, and float-drift resistance.
- `npm run test:e2e` — targeted run of the new finance heading assertion plus the existing `finance-allocation-regression.spec.ts` to confirm no regression on the shared RPC.
- Manual check at ~360px viewport for SC-004 (no clipping).

## Complexity Tracking

> Not required — Constitution Check passed with no violations.
