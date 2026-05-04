# Domain Pitfalls: Finance & Inventory on Existing React/Supabase App

**Domain:** Adding shuttle inventory, session P&L, and per-player payment tracking to an existing Supabase app
**Researched:** 2026-05-04
**Scope:** Pitfalls specific to adding these features to this codebase, not general finance app design

---

## Critical Pitfalls

Mistakes that require schema changes, data rewrites, or break existing features.

---

### Pitfall 1: Inventory Consumption Without Atomicity

**Symptom:** Two admin tabs open simultaneously both record shuttle consumption. Stock goes negative, or the same tube is consumed twice.

**Root cause:** "Cheapest batch first" logic runs client-side: fetch batches → pick cheapest → update `tubes_remaining` in two separate queries. No transaction boundary. Race condition on concurrent writes.

**Consequences:** Negative inventory, corrupted partial-tube tracking, incorrect COGS in P&L.

**Prevention:** Run consumption as a single Postgres function (RPC) that does SELECT + UPDATE inside one transaction. Never compute consumption in client JS. Use `FOR UPDATE` lock on the batch row inside the function.

**Detection warning signs:** `tubes_remaining` goes below zero. P&L COGS doesn't match sum of batch costs.

**Phase note:** Must be addressed in the schema/RPC phase before any UI is built.

---

### Pitfall 2: Partial Tube Tracking Breaks on Session Boundary

**Symptom:** A session uses 2.5 tubes from batch A. The 0.5 remainder is never recorded. Next session's consumption assumes batch A is full or empty — neither is correct.

**Root cause:** Inventory only tracks whole tubes per batch. There is no `tubes_remaining DECIMAL` or equivalent fractional field. Partial use gets rounded or dropped.

**Consequences:** COGS is wrong every session. Stock counts drift from physical reality after just 2-3 sessions.

**Prevention:** Store `tubes_remaining` as `NUMERIC(5,2)` (not INT). The consumption RPC accepts `shuttles_used INT` for a session and converts to tube fractions using the batch's `per_tube` count before deducting.

**Detection warning signs:** Admin finds the physical stock count never matches the app count after a session.

---

### Pitfall 3: RLS Grants Forgotten for New Finance Tables

**Symptom:** Finance tab loads blank with no error. Supabase returns `[]` silently. Admin sees empty inventory and zero P&L.

**Root cause:** This project has hit this exact bug four times (migrations 008, 009, 037, 042 all patched silent empty-result RLS gaps). New tables added via SQL migration without explicit `GRANT SELECT` or `GRANT INSERT/UPDATE` result in 403s that surface as empty arrays.

**Consequences:** Finance feature appears broken on first deploy. Difficult to diagnose — no JS error thrown.

**Prevention:** Every migration creating a finance table must include:
1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
2. An admin-only policy: `USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))`
3. An explicit `GRANT SELECT, INSERT, UPDATE ON ... TO authenticated` (no `anon` grant — finance is admin-only)
4. Confirm: no `TO anon` policy for any finance table

**Detection warning signs:** Empty array response. No console error. Identical to the `session_registrations` anon bug from migration 008.

---

### Pitfall 4: Finance Data Visible to Non-Admin Users

**Symptom:** A logged-in player navigates directly to `/finance` or hits the Supabase REST endpoint for `shuttle_batches` and sees admin cost data.

**Root cause:** The existing pattern for player-visible tables uses `TO authenticated USING (true)` for broad read access (e.g., `sessions: read all`, `profiles: authenticated read all`). If the same pattern is accidentally copied for finance tables, all authenticated users can read cost, revenue, and payment data.

**Consequences:** Players can see what the organizer charges for court rental vs. what they collect. Payment status of other players is exposed.

**Prevention:** Finance tables must use the admin-only USING pattern exclusively. Never add `TO anon` or broad `TO authenticated USING (true)` policies to `shuttle_batches`, `session_financials`, or any finance table. The `paid` column on `session_registrations` is already gated by the existing admin policy — verify it stays that way when moved to the Finance tab.

**Detection warning signs:** A query from a non-admin authenticated session returns rows from finance tables.

---

### Pitfall 5: Stale `database.ts` Types Cause Silent Cast Failures on New Tables

**Symptom:** New finance table columns like `cost_per_tube`, `tubes_remaining`, `court_cost` are treated as `never` by TypeScript. Developers use `as never` workarounds. Runtime values are passed incorrectly (e.g., string instead of number), causing Postgres type errors.

**Root cause:** `CONCERNS.md` documents this explicitly: `database.ts` is already out of sync with the real schema (missing `duration_seconds`, `paid`, `gender`, `level`, `nickname`). Adding 3-4 new finance tables without regenerating types compounds the debt significantly.

**Consequences:** Finance mutations silently send wrong types. Numeric calculations on `cost_per_tube` fail if stored as string. Developers waste time debugging casts instead of building features.

**Prevention:** Run `npx supabase gen types --linked > src/types/database.ts` against dev immediately after the finance migrations land — before writing any hooks. Do not write hooks against stale types.

**Detection warning signs:** TypeScript errors referencing `never` on new table columns. `as never` casts appearing in finance hooks.

---

### Pitfall 6: P&L Computed Client-Side Diverges From Source of Truth

**Symptom:** Two admin users open the Finance tab simultaneously and see different P&L totals. Or: an admin updates court cost, but the P&L still shows the old number until page refresh.

**Root cause:** P&L is computed in a React hook by fetching raw rows and doing arithmetic in JS. No server-side aggregation. Each client's calculation depends on when it last fetched.

**Consequences:** Inconsistent figures. If the Finance tab is shown to someone for reporting, they see a stale number. Worse, if P&L logic is duplicated in two hooks, they can produce different results from the same data.

**Prevention:** Compute P&L in a single Postgres view or RPC (`get_session_pnl(session_id)`). The React hook fetches the result, never recomputes it. This is the single source of truth. Cache invalidation is a single cache key.

**Detection warning signs:** Two browser tabs showing different net profit for the same session.

---

## Moderate Pitfalls

---

### Pitfall 7: Payment Status Migration Breaks Existing `paid` Column

**Symptom:** Moving `paid` from the Admin tab's RosterPanel into a Finance tab context causes a regression: the existing `updatePaid()` in `useRoster.ts` and the `on_payment_confirmed` trigger both still reference `session_registrations.paid`. Finance tab has its own payment mutation that conflicts.

**Root cause:** `paid` already exists on `session_registrations` (migration 042). The trigger `notify_payment_confirmed` fires on every `paid = true` update. If the Finance tab introduces a second update path for the same column, the trigger fires twice or the two UI paths get out of sync.

**Prevention:** Do not create a second mutation for `paid`. The Finance tab should reuse `updatePaid()` from `useRoster.ts` or extract it to a shared hook. One mutation, one trigger path. The UI location (Finance tab vs. Admin tab) changes, but the data mutation does not.

---

### Pitfall 8: Cheapest-First Logic Silently Degrades With Mixed Batch Prices

**Symptom:** Admin adds two batches: one at ₱40/tube, one at ₱38/tube. The app picks the wrong batch as "cheapest" because it sorts by `cost_per_tube` DESC instead of ASC, or uses batch insertion order.

**Root cause:** "Cheapest first" ordering must be explicitly `ORDER BY cost_per_tube ASC, created_at ASC` (cheapest, then oldest first as tiebreaker). An off-by-one in sort direction produces wrong COGS silently — no error is thrown.

**Prevention:** Add a unit test for the consumption RPC that verifies: given two batches at different prices, consumption always draws from the cheaper one first. This is the one calculation in the feature where a wrong sort direction has compounding financial impact.

---

### Pitfall 9: No Guard Against Consuming From a Depleted Batch

**Symptom:** `tubes_remaining` reaches 0 on batch A. A new session still pulls from it, sending `tubes_remaining` negative.

**Root cause:** The consumption RPC does not filter out batches where `tubes_remaining <= 0`. If all known batches are depleted but admin records shuttle use, the RPC fails silently or picks a depleted batch.

**Prevention:** The consumption RPC must filter `WHERE tubes_remaining > 0`. If no tubes are available, it should return an error code the client surfaces as a toast: "No shuttle stock available — add a batch first."

---

### Pitfall 10: `lockSchedule` Double-Insert Pattern Exists — Finance Writes Need the Same Guard

**Symptom:** Admin clicks "Record Shuttles Used" twice. Two consumption records are inserted. COGS doubles.

**Root cause:** `CONCERNS.md` documents `lockSchedule()` has no duplicate-check guard. The same pattern will recur for any finance write that isn't idempotent.

**Prevention:** Session shuttle consumption should be `UPSERT` on `(session_id)` unique constraint, not bare INSERT. Court cost and revenue writes should also be UPSERT-safe. Add loading state + disabled button on the Finance tab's mutation buttons.

---

## Minor Pitfalls

---

### Pitfall 11: Finance Tab Showing Raw Pesos Without Locale Formatting

**Symptom:** Cost displays as `1200` instead of `₱1,200.00`. Or worse: floating point arithmetic in JS produces `₱1199.9999999` for a COGS calculation.

**Prevention:** Store all monetary values as `INTEGER` in centavos (or whole pesos with `NUMERIC(10,2)`) in Postgres — never `FLOAT`. Format display with `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`. Never do monetary arithmetic in JS with `number` type.

---

### Pitfall 12: No Pagination on Finance Queries as Session Count Grows

**Symptom:** `useSessionList` already fetches all rows without pagination (documented in CONCERNS.md). If the Finance tab fetches all sessions with their shuttle consumption joined, this becomes a slow query after 50+ sessions.

**Prevention:** Finance queries should be scoped to a single session at a time (the selected session's P&L). Do not load all-sessions financial history in a single query. If a summary view is needed later, use aggregated Postgres views.

---

### Pitfall 13: Admin Role Check Drift

**Symptom:** A new finance route (`/finance`) is accessible to any authenticated user because the `AdminRoute` guard wasn't applied, even though the Supabase RLS blocks the data.

**Root cause:** The app protects admin routes at the React Router level with role checks. If the Finance tab is a new top-level route, it needs the same guard. RLS is the real gate, but showing a blank Finance tab to a non-admin is a UX problem.

**Prevention:** Wrap all finance routes in the existing `AdminRoute` (or equivalent role check). Defense in depth: UI guard + RLS policy both enforced.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Schema design (inventory tables) | Partial tube stored as INT, not DECIMAL | Use `NUMERIC(5,2)` for `tubes_remaining` from day one |
| Consumption RPC | Race condition on concurrent writes | Postgres function with `FOR UPDATE` lock, not client-side logic |
| RLS for finance tables | Silent empty results (project has hit this 4x) | Checklist: ENABLE RLS + admin USING policy + explicit GRANT |
| Types | Stale `database.ts` causes `as never` casts | Regenerate types immediately after migrations land |
| P&L calculation | Client-side divergence | Server-side view or RPC for all aggregation |
| Payment status in Finance tab | Duplicate mutation path for existing `paid` column | Reuse `updatePaid()`, don't create a second path |
| Finance route | Route not guarded by admin role check | Apply `AdminRoute` wrapper before shipping |
| Monetary display | Float arithmetic produces wrong pesos | Store as `NUMERIC`, format with `Intl.NumberFormat` |

---

## Sources

- Codebase: `CONCERNS.md` (type debt, RLS gaps, lockSchedule double-insert)
- Codebase: `tasks/lessons.md` (RLS grants required separately, anon vs authenticated policy scope)
- Codebase: Migrations 042 (`paid` column), 046 (payment trigger), 032 (`price` column on sessions)
- Codebase: `useRoster.ts` (existing `updatePaid` mutation path)
- Pattern: Supabase PostgREST RLS silent-empty behavior (confirmed in this project 4 separate times)
- Confidence: HIGH — all critical pitfalls are grounded in documented bugs already hit in this codebase
