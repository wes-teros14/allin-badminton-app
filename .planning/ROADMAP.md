# Roadmap: All-In Badminton App

## Milestones

- Complete **v1.0 Initial Build** - Phases 1-7 (shipped 2026-05-03)
- Complete **v1.1 Finance & Inventory Tab** - Phases 8-11 (shipped 2026-05-06)
- Complete **v1.2 Public Registration Homepage** - Phase 12 (verified 2026-05-12)

## Phases

<details>
<summary>Complete v1.0 Initial Build (Phases 1-7) - SHIPPED 2026-05-03</summary>

Phases 1-7 implemented via BMAD (Epics 1-7):
- Session lifecycle + admin controls
- Match generation engine with simulated annealing
- Player self-registration via Google OAuth + invite links
- Live board with Supabase Realtime
- Admin court view + result recording
- Player views, Cheers, leaderboards, awards
- Today tab, roster search, Early Bird award

</details>

<details>
<summary>Complete v1.1 Finance & Inventory Tab (Phases 8-11) - SHIPPED 2026-05-06</summary>

### Phase 8: DB Foundation
**Goal**: All database structures required for Finance & Inventory are live, secured, and reflected in TypeScript types
**Depends on**: Phase 7 (v1.0 complete)
**Requirements**: *(infrastructure - no direct requirement IDs; enables all v1.1 requirements)*
**Success Criteria** (what must be TRUE):
  1. `shuttle_batches` table exists with RLS enabled and admin-only write policy
  2. `shuttle_usage` table exists with a unique constraint on (session_id, batch_id) and RLS enabled
  3. `sessions.court_cost` column exists and accepts NUMERIC(10,2) values
  4. Running `supabase gen types` produces updated `database.ts` with all new tables and columns and no `never` errors on new fields
**Plans**: TBD

### Phase 9: Inventory Management
**Goal**: Admin can create and view shuttle batches with individual tube tracking and real-time stock levels
**Depends on**: Phase 8
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05
**Success Criteria** (what must be TRUE):
  1. Admin can submit the Add Batch form and the batch appears in the inventory list
  2. Batches are displayed sorted cheapest-cost-first and each batch shows its tubes under it
  3. Each tube displays a physical ID in T-1001 format, sequentially assigned across all batches
  4. Each tube shows its remaining shuttlecock count computed from usage records in Postgres
  5. The Finance page header shows the total shuttles currently in stock across all tubes
**Plans**: 3 plans
- [x] 09-01-PLAN.md - Create useShuttleBatches hook (data layer: fetch, compute tube IDs and stock remaining, addBatch mutation)
- [x] 09-02-PLAN.md - Build InventoryView component (table, loading skeleton, empty state, stock summary)
- [x] 09-03-PLAN.md - Add Batch dialog + form wiring, /inventory route, TopNavBar Inventory tab
**UI hint**: yes

### Phase 10: Session Finance
**Goal**: Admin can log shuttle usage and court costs per session and read an accurate P&L summary for every session
**Depends on**: Phase 9
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04
**Success Criteria** (what must be TRUE):
  1. Admin can select a tube by ID and enter how many shuttlecocks were used in a session, and re-submitting the same tube updates rather than duplicates the record
  2. Admin can enter or override the court rental cost for any session and the value persists on next page load
  3. A P&L card for each session shows revenue collected, court cost, shuttle COGS, and net profit, all computed server-side
  4. The Finance page lists all sessions with their P&L summary visible without entering each session
**Plans**: TBD
**UI hint**: yes

### Phase 11: Payment Migration
**Goal**: Payment controls are exclusively on the Finance page; the Admin tab no longer contains paid/unpaid toggles
**Depends on**: Phase 10
**Requirements**: PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):
  1. Admin can mark any registered player Paid or Unpaid from the Finance page session view
  2. Each session row on the Finance page shows a payment count summary
  3. The Admin tab contains no paid/unpaid controls and no dead UI remains
**Plans**: TBD
**UI hint**: yes

</details>

### Complete v1.2 Public Registration Homepage (Verified 2026-05-12)

**Milestone Goal:** Signed-out visitors who open the app homepage see a public registration entry point instead of an immediate Google sign-in prompt.

- [x] **Phase 12: Public Registration Homepage** - Signed-out visitors land on a public homepage with a direct registration entry point while signed-in users keep current behavior. (completed 2026-05-12)

## Phase Details

### Phase 12: Public Registration Homepage
**Goal**: Signed-out visitors can start registration from the root homepage without invite-link dependence, while signed-in users and Google OAuth behavior stay intact
**Depends on**: Phase 11
**Requirements**: REG-01, REG-02, REG-03, AUTH-01, AUTH-02, INVITE-01, INVITE-02
**Success Criteria** (what must be TRUE):
  1. A signed-out visitor who opens the root app URL sees a public homepage instead of an immediate Google sign-in prompt
  2. The public homepage presents a clear Register action that starts the existing Google sign-in flow directly, with no extra public registration form
  3. A signed-in user who opens the homepage continues into the existing authenticated app experience without an added landing step
  4. Normal onboarding can begin from the homepage without an invite link, and existing invite-link code paths still load for compatibility
**Plans**: 1 plan
- [x] 12-01-PLAN.md - Public homepage registration entry and compatibility smoke coverage
**UI hint**: yes

## Progress

**Execution Order:** 8 -> 9 -> 10 -> 11 -> 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 8. DB Foundation | v1.1 | 1/1 | Complete | 2026-05-04 |
| 9. Inventory Management | v1.1 | 3/3 | Complete | 2026-05-05 |
| 10. Session Finance | v1.1 | 4/4 | Complete | 2026-05-06 |
| 11. Payment Migration | v1.1 | 3/3 | Complete | 2026-05-06 |
| 12. Public Registration Homepage | v1.2 | 1/1 | Complete | 2026-05-12 |
