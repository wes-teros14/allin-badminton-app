# Research Summary: v1.1 Finance & Inventory Tab

**Project:** All-In Badminton App
**Milestone:** v1.1 — Finance & Inventory Tab
**Researched:** 2026-05-04
**Confidence:** HIGH

---

## Executive Summary

The Finance & Inventory feature is a greenfield addition to an existing Supabase + React app with a mature schema. No new dependencies, no new libraries, and no changes to existing tables beyond one column. Two new DB tables (`shuttle_batches`, `shuttle_usage`) plus `sessions.court_cost NUMERIC(10,2)` deliver everything needed. The existing `sessions.price` and `session_registrations.paid` columns are already the financial anchors — the feature is largely about surfacing data that already exists.

The recommended approach is database-first, compute-on-server. All monetary arithmetic (P&L, COGS, stock remaining) must live in Postgres, not in React hooks. The Finance tab lives inside the existing `SessionView` as a third tab; a separate `/inventory` route handles batch CRUD. Build order is strictly: DB migrations → regenerate types → hooks → UI.

---

## Stack: What Is New vs Reused

| Need | Status | Solution |
|------|--------|----------|
| DB schema | NEW tables | `shuttle_batches`, `shuttle_usage` (migrations 053, 054) |
| `court_cost` field | NEW column | `NUMERIC(10,2)` on `sessions` table |
| Forms | REUSED | React Hook Form + Zod |
| UI components | REUSED | shadcn/ui Table, Card, Badge, Dialog |
| Data fetching | REUSED | `@supabase/supabase-js` |
| Monetary display | REUSED | `Intl.NumberFormat` — native browser API |
| TypeScript types | RE-GENERATE | `supabase gen types` after migrations land |
| Tests | REUSED | Vitest for P&L unit tests |

**No new npm packages.** Do not add charting libs, Decimal.js, date-fns, or Zustand.

---

## Feature Table Stakes (v1.1 must-haves)

| Feature | Complexity |
|---------|------------|
| Shuttle batch management (CRUD) | Low |
| Cheapest-first batch ordering | Low |
| Partial tube tracking per batch | Medium |
| Session shuttle usage log | Medium |
| Session P&L summary | Medium |
| Per-player payment status | Low |
| Current stock level | Low |

**Defer:** profit trend chart, low stock alert, shuttle sell-price tracking.
**Exclude:** player-visible cost data, auto-allocation, Realtime subscriptions for finance.

---

## Architecture Highlights

**New migrations:**
- 053: `shuttle_batches` (id, purchased_at, brand, tube_count, cost_per_tube, notes, created_by)
- 054: `shuttle_usage` (id, session_id, batch_id, tubes_used NUMERIC(4,1), UNIQUE session+batch)
- sessions: ADD COLUMN `court_cost NUMERIC(10,2)`

**Key computations (server-side only, never stored):**
- `tubes_remaining = tube_count - COALESCE(SUM(tubes_used), 0)`
- `net_pnl = (price × paid_players) - court_cost - SUM(tubes_used × cost_per_tube)`

**New hooks:** `useShuttleBatches`, `useShuttleUsage`, `useSessionFinance`

**Routing:** Finance tab inside `SessionView` + standalone `/inventory` route (both admin-only).

**Build order:** Migrations → gen types → useShuttleBatches + InventoryView → useShuttleUsage + usage UI → useSessionFinance + FinancePanel → wire Finance tab.

---

## Watch Out For

1. **Silent RLS empty results** — Every new table needs `ENABLE ROW LEVEL SECURITY` + admin-only USING policy + explicit `GRANT`. This project has hit this 4× already.
2. **Stale `database.ts` types** — Run `supabase gen types` immediately after migrations, before writing any hook. Skipping causes `never` errors on every new column.
3. **P&L computed client-side** — Aggregate in Postgres RPC only. Two tabs show different numbers if JS does the math.
4. **Double-insert on Finance writes** — Shuttle usage must UPSERT on `(session_id, batch_id)` unique constraint. Disable mutation buttons during loading.
5. **Duplicate `paid` mutation path** — Reuse `updatePaid()` from `useRoster.ts`. Creating a second path causes trigger double-fires.

---

## Ready to Build

Scope is clear and bounded. Two new tables, one column addition, three new hooks, two new UI surfaces, zero new dependencies. The SQL for every key query is in `.planning/research/ARCHITECTURE.md`. All pitfalls are known failure modes with documented mitigations.
