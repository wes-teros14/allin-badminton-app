# Phase 0 Research: Finance Net Totals Summary

**Feature**: `004-finance-net-totals` | **Date**: 2026-08-18

All Technical Context unknowns are resolved below. No `NEEDS CLARIFICATION` markers remain.

---

## R-001: How does the client learn which sessions are completed?

**Problem**: `FinanceView` renders rows from `useFinanceSessions`, which is fed entirely by `supabase.rpc('get_session_finance', {})`. That function's `RETURNS TABLE` (defined in `065_add_shuttle_allocation_mode.sql`) exposes 16 columns — none of them `status`. There is currently no way for the Finance page to tell a completed session from one still in setup. This is the only real engineering problem in the feature.

**Decision**: Add a new migration `074_add_status_to_get_session_finance.sql` that recreates the RPC with `status public.session_status` appended to its `RETURNS TABLE`.

**Rationale**:
- The function's final `SELECT` already performs `JOIN public.sessions s ON s.id = fb.session_id`, so `s.status` is in scope with no query restructuring. The change is genuinely one line in the signature and one line in the projection.
- Keeps the page at **one** network round trip; totals and rows are guaranteed to derive from a single consistent snapshot, satisfying FR-012 (totals never disagree with the table).
- Honors Constitution II: completed-ness is read from persisted `sessions.status`, the actual source of truth.
- Follows the repo's own established pattern. `get_session_finance` has already been versioned three times this way (`058` created it, `060` added personal-share columns, `065` added allocation mode) — each doing `DROP FUNCTION IF EXISTS` then `CREATE OR REPLACE`.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Second client query — `supabase.from('sessions').select('id, status')`, joined client-side | Adds a round trip, introduces a window where the two result sets disagree (violating FR-012), and depends on `sessions` RLS granting the read separately from the admin-gated RPC. More surface area for a strictly worse result. |
| New dedicated RPC returning just the two totals | The totals would be computed by a different code path than the visible rows, so they could silently diverge from the table. FR-004 and SC-002 explicitly require exact reconciliation to the on-screen values — this alternative makes that a hope rather than a guarantee. Also a second round trip. |
| Infer "completed" client-side from `date < today` | Wrong. A session can be past-dated and never completed, or completed early. Directly violates Constitution II by duplicating a session rule in the UI. |
| `ALTER FUNCTION` to add the column | Not possible in Postgres — changing a function's return type requires DROP + CREATE. |

---

## R-002: Is appending a column to the RPC safe for existing consumers?

**Decision**: Yes — verified, not assumed.

**Rationale**: Two call sites consume this RPC:
- `src/hooks/useFinanceSessions.ts:34` — `supabase.rpc('get_session_finance', {})`
- `src/hooks/useSessionFinance.ts:361` — `supabase.rpc('get_session_finance', { p_session_id: sessionId })`

Both read result fields **by name** (`row.session_id`, `financeRow.profit_after_personal_share`, etc.). Neither destructures positionally nor iterates over columns. PostgREST returns JSON objects, so an added key is inert to both. The finance **detail** surface (`FinanceDetailView`) is therefore unaffected — this discharges the Constitution III cross-surface obligation by inspection rather than assertion.

**Alternatives considered**: Creating a parallel `get_session_finance_v2` to leave the original untouched — rejected as needless duplication that would leave two functions to keep in sync, with no consumer benefiting from the old signature.

---

## R-003: Which figure is summed, and how is float drift avoided?

**Decision**: Sum `profit_after_personal_share` (surfaced in the hook as `FinanceSessionRow.profit`), and round each total to 2 decimals via the `Number(x.toFixed(2))` convention.

**Rationale**:
- The Net Cash column already renders `s.profit`, which `useFinanceSessions` maps from `row.profit_after_personal_share ?? row.profit`. Summing that exact field is the only way to guarantee the reconciliation FR-004 demands. (Confirmed by the user during specification: net is taken *after* the personal-share deduction.)
- `NUMERIC(10,2)` arrives as a JS float. Accumulating dozens of 2-decimal floats produces classic drift — e.g. a running total landing on `4199.999999999999`, which `formatPeso` would render as `₱4,200.00` by luck but which fails an exact equality assertion in tests and could round the wrong way at other values. Rounding once at the end of the reduce makes the result deterministic and makes SC-002's "reconciles exactly" testable.
- `calculateProfitAfterPersonalShare` in `useSessionFinance.ts:135` already uses `Number((...).toFixed(2))`. Matching it keeps one money-rounding convention in the codebase.

**Alternatives considered**: Integer centavo arithmetic (multiply by 100, sum, divide) — more robust in principle, but inconsistent with the existing convention and unjustified at this scale (tens of rows, values well inside safe-integer range). Rejected as gold-plating. A decimal library — rejected outright; a new dependency for one summation is not warranted.

---

## R-004: How should loading and error states render?

**Decision**: Three distinct display states — skeleton while `isLoading`, em-dash placeholder while `fetchError` is set, formatted currency otherwise (including a genuine `₱0.00`).

**Rationale**: `useFinanceSessions` already exposes `isLoading` and `fetchError` as separate state, so all three cases are distinguishable without new plumbing. The trap worth naming: on fetch failure the hook leaves `sessions` as `[]` and clears `isLoading`, so a naive `formatPeso(total)` would confidently render `₱0.00` — an admin would read that as "the club is exactly break-even" rather than "the data failed to load." FR-009 exists precisely to prevent that, and the em-dash is the conventional this-is-not-a-number signal. The skeleton reuses the table's existing `animate-pulse` treatment, satisfying the Constitution's UI rule about preserving established patterns.

**Alternatives considered**: Hiding the totals entirely on error — rejected; the heading row would reflow and the admin gets no acknowledgment the fields exist. Showing the last known value — rejected; stale financial figures presented as current are worse than no figures.

---

## R-005: How do two currency values fit beside the heading at 360px?

**Decision**: A wrapping flex row — `<h1>` left, a right-aligned pair of stacked caption-over-value blocks — allowed to wrap beneath the heading when width runs out.

**Rationale**: The page is `max-w-lg` (512px) with `p-6` padding, leaving ~464px of content width, and the real design target is a ~360px phone. `formatPeso` emits values like `₱12,345.00` (~85px at the small type size). Two of those plus captions plus the "Finance" heading is tight but feasible at 464px and marginal at 360px. Letting the row wrap is what keeps FR-011/SC-004 achievable without shrinking type below legibility. The spec already records the assumption that same-row placement applies "wherever width allows," so wrapping is a sanctioned outcome, not a compromise.

This is also why the labels were kept to **"All Sessions"** and **"Completed"** rather than repeating "Net Cash" — the rejected alternatives were roughly double the width and would have forced a wrap at every viewport.

**Alternatives considered**: Fixed single-line layout with truncation — rejected, SC-004 forbids clipping. Moving the totals into a separate card below the heading — rejected, contradicts the explicit request that they sit level with the "Finance" label. Abbreviated currency (`₱12.3k`) — rejected; imprecise figures defeat the purpose of a finance summary.

---

## R-006: What is the testing approach?

**Decision**: Export `summarizeFinanceTotals` as a pure function and unit-test it in `src/__tests__/financeTotals.test.ts` with Vitest; add one targeted Playwright assertion on the heading totals.

**Rationale**: The existing `src/__tests__/useSessionFinance.test.ts` establishes exactly this pattern — it imports pure helpers (`calculateProfitAfterPersonalShare`, `allocateCheapestFirst`, `normalizeAllocationMode`) from the hook module and stubs Supabase with `vi.mock('@/lib/supabase', () => ({ supabase: {} }))`, testing the arithmetic without mounting a component or faking a network. Following it keeps the new tests deterministic (Constitution Testing Rules) and makes SC-002/SC-003 directly assertable against hand-computed fixtures.

The E2E assertion covers what a unit test cannot: that the totals actually render in the heading and match the rows a real admin sees. `finance-allocation-regression.spec.ts` should also be re-run, since it exercises the same RPC being re-created.

**Alternatives considered**: Component tests via Testing Library — the repo has no established component-test setup for views; introducing one for this feature is out of scope. Relying on E2E alone — too slow and too coarse to cover the arithmetic edge cases (empty list, all-complete, negative totals, float drift).

---

## Summary of Decisions

| ID | Decision |
|----|----------|
| R-001 | New migration `074` appends `status` to the `get_session_finance` return signature |
| R-002 | Additive change verified safe — both consumers read fields by name |
| R-003 | Sum `profit_after_personal_share`; round to 2 decimals via the existing `toFixed(2)` convention |
| R-004 | Three display states: skeleton / em-dash on error / formatted currency |
| R-005 | Wrapping flex heading row; short labels chosen partly to make this fit |
| R-006 | Pure exported helper unit-tested with Vitest, plus one targeted Playwright assertion |
