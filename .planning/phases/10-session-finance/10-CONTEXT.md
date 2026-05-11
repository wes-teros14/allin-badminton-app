# Phase 10: Session Finance - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the admin-only finance workflow: log shuttle usage per session, enter court rental cost, and read a P&L summary. Finance lives at `/finance` (session list) and `/finance/:sessionId` (detail/logging view). Revenue, shuttle COGS, court cost, and profit are computed client-side in a hook. This phase does not build payment tracking (Phase 11) or change the inventory screen (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### Navigation & Page Structure
- **D-01:** Finance is a **standalone top-level route** (`/finance`) with a **Finance tab in TopNavBar**, admin-only (hidden from players). Same admin-gate pattern as Inventory.
- **D-02:** `/finance` shows a session list table with columns: Date | Revenue | Cost | P&L. Clicking a row navigates to `/finance/:sessionId` for the detail/logging view.
- **D-03:** `/finance/:sessionId` contains two sections: Shuttle Usage (log and view usage rows) and Court Cost (enter flat total). P&L summary is shown below both.

### Shuttle Usage Logging (FIN-01)
- **D-04:** Admin enters **total tubes used** (one number). The system auto-allocates to batches using **cheapest-first** order (`cost_per_tube ASC`, then `created_at ASC`) — no batch picking by admin.
- **D-05:** Allocation logic runs client-side in JS: load batches cheapest-first with remaining stock, fill from cheapest until tubes are exhausted, generate one `shuttle_usage` row per batch used. If a session already has usage rows, re-submitting replaces them (delete-then-insert within a transaction, or delete-then-insert in sequence).
- **D-06:** The `shuttle_usage` table has UNIQUE(session_id, batch_id) — the allocation must ensure no duplicate (session_id, batch_id) pairs are generated.

### Court Cost Entry (FIN-02)
- **D-07:** Admin enters a **flat total amount** (single number field, e.g. ₱400). No rate × hours breakdown. Stored directly in `sessions.court_cost` (existing nullable numeric column). No default pre-fill — field starts empty.
- **D-08:** Saving court cost is a plain `UPDATE sessions SET court_cost = ? WHERE id = ?` (RLS-safe, admin only).

### P&L Computation (FIN-03)
- **D-09:** P&L is computed **client-side** in a `useSessionFinance` hook (same pattern as `useShuttleBatches`):
  ```
  revenue       = COUNT(session_players) × sessions.fee_per_player
  shuttle_cost  = SUM(shuttle_usage.tubes_used × shuttle_batches.cost_per_tube)
  court_cost    = sessions.court_cost ?? 0
  profit        = revenue - shuttle_cost - court_cost
  ```
- **D-10:** Hook fetches: `sessions` row (for fee_per_player, court_cost), `session_players` count, `shuttle_usage` joined to `shuttle_batches` for cost_per_tube.

### Finance Session List (FIN-04)
- **D-11:** `/finance` list shows all sessions (most recent first). Each row displays: Date, Revenue, Total Cost (shuttle + court), Net P&L. Color-code profit (green) vs loss (red) for quick scanning.
- **D-12:** List data can be fetched with a single hook `useFinanceSessions` that loads all sessions with their aggregated P&L — or reuse `useSessionFinance` per row. Planner chooses most efficient approach.

### Claude's Discretion
- Exact column widths, number formatting (formatPeso already exists in InventoryView — reuse it)
- Empty state copy on `/finance` when no sessions exist
- Loading skeleton design
- Whether the usage log on `/finance/:sessionId` shows a table of per-batch rows or a single "X tubes used" summary
- Error handling wording in toasts

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Schema
- `.planning/research/ARCHITECTURE.md` — `shuttle_usage`, `session_players`, `sessions` schema; P&L query patterns; `useSessionFinance` hook design
- `.planning/research/PITFALLS.md` — RLS grant gaps (silent empty results), stale database.ts types, double-insert pattern

### Stack Constraints
- `.planning/research/STACK.md` — Zero new npm dependencies; shadcn/ui (Table, Card, Dialog, Input, Label, Button), React Hook Form, Zod, Supabase cover all needs
- `.planning/research/FEATURES.md` — Anti-features: no auto-consumption on session start, no player-visible costs, no realtime updates

### Requirements
- `.planning/REQUIREMENTS.md` — FIN-01 through FIN-04 are the requirements this phase implements

### Existing Code Patterns
- `badminton-v2/src/hooks/useShuttleBatches.ts` — Hook pattern to follow for `useSessionFinance` and `useFinanceSessions`
- `badminton-v2/src/views/InventoryView.tsx` — `formatPeso` helper, Dialog pattern, Table pattern — reuse directly
- `badminton-v2/src/components/TopNavBar.tsx` — Admin-gated tab pattern for adding Finance tab
- `badminton-v2/src/App.tsx` — `React.lazy` + `Suspense` + `AdminRoute` pattern for new routes

### Schema
- `badminton-v2/src/types/database.ts` — `sessions.court_cost` (numeric | null), `shuttle_usage` (session_id, batch_id, tubes_used), `shuttle_batches` (cost_per_tube, tube_count)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatPeso` in `InventoryView.tsx` — already handles PHP currency formatting; copy or extract to shared util
- `shadcn/ui` Table, Card, Dialog, Input, Label, Button — all installed
- `useShuttleBatches` hook — cheapest-first batch list with stock remaining; re-use this data for allocation logic
- `sonner` toast — already wired in for success/error feedback

### Established Patterns
- **Admin-only gating:** `AdminRoute` in `App.tsx`, Finance tab hidden from players
- **Hook pattern:** `useState` + `useEffect` + Supabase queries + typed return object
- **Lazy routes:** `React.lazy(() => import('@/views/FinanceView'))` + `<Route>` inside `AdminRoute`
- **RLS pattern:** Every Supabase table access needs `ENABLE ROW LEVEL SECURITY` + policy + explicit `GRANT` to `authenticated`. Missing GRANT = silent empty results.

### Integration Points
- `App.tsx` — Add `/finance` and `/finance/:sessionId` routes under `AdminRoute` with `React.lazy`
- `TopNavBar.tsx` — Add Finance tab (admin-only, active on `/finance*`)
- `badminton-v2/src/types/database.ts` — Already has `shuttle_usage`, `sessions`, `session_players` types from Phase 8

</code_context>

<specifics>
## Specific Implementation Notes

- `shuttle_usage` UNIQUE(session_id, batch_id): allocation JS must never produce two entries for the same batch in one session. Safe because cheapest-first fills one batch at a time.
- Re-logging usage (admin corrects tube count): delete existing `shuttle_usage` rows for the session, then re-run allocation with the new total. Do not upsert/patch — delete-then-insert avoids stale partial rows.
- `sessions.court_cost` is already nullable — treat `null` as ₱0 in P&L computation (D-09).
- `fee_per_player` is already on the `sessions` row — no extra join needed for revenue.
- P&L color coding: profit ≥ 0 → green text, profit < 0 → red/destructive text.

</specifics>

<deferred>
## Deferred Ideas

- **Rate × hours breakdown for court cost** — Admin considered but chose flat total. Can be added later if breakdown tracking matters.
- **Per-batch usage editing** — Admin cannot manually assign tubes to a specific batch; auto-allocation only. Manual override deferred.
- **Session-level realtime updates** — Explicitly excluded per FEATURES.md anti-features.
- **Player-visible P&L** — Costs are admin-only. No player exposure in this phase.
- **Export / CSV download** — Finance list export deferred to post-v1.1.

</deferred>

---

*Phase: 10-session-finance*
*Context gathered: 2026-05-05*
