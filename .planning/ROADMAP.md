# Roadmap: All-In Badminton App

## Milestones

- ✅ **v1.0 Initial Build** - Phases 1-7 (shipped 2026-05-03)
- 🚧 **v1.1 Finance & Inventory Tab** - Phases 8-11 (in progress)

## Phases

<details>
<summary>✅ v1.0 Initial Build (Phases 1-7) - SHIPPED 2026-05-03</summary>

Phases 1-7 implemented via BMAD (Epics 1-7):
- Session lifecycle + admin controls
- Match generation engine with simulated annealing
- Player self-registration via Google OAuth + invite links
- Live board with Supabase Realtime
- Admin court view + result recording
- Player views, Cheers, leaderboards, awards
- Today tab, roster search, Early Bird award

</details>

### 🚧 v1.1 Finance & Inventory Tab (In Progress)

**Milestone Goal:** Admin can track shuttle inventory, log session costs, view P&L summaries, and manage player payments — all from a dedicated Finance page.

## Phase Details

### Phase 8: DB Foundation
**Goal**: All database structures required for Finance & Inventory are live, secured, and reflected in TypeScript types
**Depends on**: Phase 7 (v1.0 complete)
**Requirements**: *(infrastructure — no direct requirement IDs; enables all v1.1 requirements)*
**Success Criteria** (what must be TRUE):
  1. `shuttle_batches` table exists with RLS enabled and admin-only write policy
  2. `shuttle_usage` table exists with a unique constraint on (session_id, batch_id) and RLS enabled
  3. `sessions.court_cost` column exists and accepts NUMERIC(10,2) values
  4. Running `supabase gen types` produces updated `database.ts` with all new tables and columns — no `never` errors on new fields
**Plans**: TBD

### Phase 9: Inventory Management
**Goal**: Admin can create and view shuttle batches with individual tube tracking and real-time stock levels
**Depends on**: Phase 8
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05
**Success Criteria** (what must be TRUE):
  1. Admin can submit the Add Batch form (brand, tube count, cost per tube, date purchased) and the batch appears in the inventory list
  2. Batches are displayed sorted cheapest-cost-first; each batch shows its tubes listed under it
  3. Each tube displays a physical ID in T-1001 format, sequentially assigned starting from 1001 across all batches
  4. Each tube shows its remaining shuttlecock count (e.g., "T-1001: 4 / 12") computed from usage records in Postgres
  5. The Finance page header shows the total shuttles currently in stock across all tubes
**Plans**: 3 plans
- [x] 09-01-PLAN.md — Create useShuttleBatches hook (data layer: fetch, compute tube IDs and stock remaining, addBatch mutation)
- [x] 09-02-PLAN.md — Build InventoryView component (table, loading skeleton, empty state, stock summary)
- [ ] 09-03-PLAN.md — Add Batch dialog + form wiring, /inventory route, TopNavBar Inventory tab
**UI hint**: yes

### Phase 10: Session Finance
**Goal**: Admin can log shuttle usage and court costs per session and read an accurate P&L summary for every session
**Depends on**: Phase 9
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04
**Success Criteria** (what must be TRUE):
  1. Admin can select a tube by ID and enter how many shuttlecocks were used in a session; re-submitting the same tube updates rather than duplicates the record
  2. Admin can enter or override the court rental cost for any session and the value persists on next page load
  3. A P&L card for each session shows: revenue collected (price × paid players), court cost, shuttle COGS (sum of tubes used × cost per tube), and net profit — all computed server-side
  4. The Finance page lists all sessions with their P&L summary visible without entering each session
**Plans**: TBD
**UI hint**: yes

### Phase 11: Payment Migration
**Goal**: Payment controls are exclusively on the Finance page; the Admin tab no longer contains paid/unpaid toggles
**Depends on**: Phase 10
**Requirements**: PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):
  1. Admin can mark any registered player Paid or Unpaid from the Finance page session view
  2. Each session row on the Finance page shows a payment count summary (e.g., "12 / 16 paid")
  3. The Admin tab contains no paid/unpaid controls — the section is fully removed and no dead UI remains
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** 8 → 9 → 10 → 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 8. DB Foundation | v1.1 | 1/1 | Complete | 2026-05-04 |
| 9. Inventory Management | v1.1 | 2/3 | In progress | - |
| 10. Session Finance | v1.1 | 0/TBD | Not started | - |
| 11. Payment Migration | v1.1 | 3/3 | Complete | 2026-05-06 |
