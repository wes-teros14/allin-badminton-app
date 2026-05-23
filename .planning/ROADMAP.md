# Roadmap: All-In Badminton App

## Milestones

- Complete **v1.0 Initial Build** - Phases 1-7 (shipped 2026-05-03)
- Complete **v1.1 Finance & Inventory Tab** - Phases 8-11 (shipped 2026-05-06)
- Complete **v1.2 Public Registration Homepage** - Phase 12 (verified 2026-05-12)
- Planned **v1.3 Split Match Scoring** - Phases 13-15

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

### Phase 13: Split Scoring Schema
**Goal**: Database and TypeScript types can represent session-level split scoring and multiple game results per scheduled match
**Depends on**: Phase 12
**Requirements**: FMT-01, RES-03, RES-04, COMP-01
**Success Criteria** (what must be TRUE):
  1. `sessions` stores a boolean split-match scoring setting with a default that preserves current one-game behavior
  2. `match_results` stores a game number for each result row and existing rows remain valid as game 1
  3. Duplicate result rows for the same match and game number are rejected at the database level
  4. TypeScript database types include the new session and result fields without introducing `never` errors
  5. Existing completed one-game matches still read as one-game results
**Plans**: 2 plans
- [x] 13-01-PLAN.md - Split scoring schema migration, composite uniqueness, typed contract, and compatibility test baseline
- [x] 13-02-PLAN.md - App-side result compatibility helper plus reader/writer normalization for game-1 legacy behavior
**UI hint**: no

### Phase 14: Split Result Entry
**Goal**: Admin and live board finish flows support both one-game and two-game result recording while preserving queue advancement and realtime updates
**Depends on**: Phase 13
**Requirements**: FMT-01, FMT-02, FMT-03, RES-01, RES-02, RES-03, COMP-02
**Success Criteria** (what must be TRUE):
  1. Admin can enable or disable split-match scoring for a session from the admin/session setup flow
  2. One-game sessions keep the current finish flow and insert a single game result
  3. Split sessions show explicit result choices for `2-0` team 1, `2-0` team 2, and `1-1`
  4. Split result submission inserts exactly two game-level result rows for the scheduled match
  5. Finishing a match still completes the match, advances the next queued match to the same court, and refreshes both admin and live board views
**Plans**: 3 plans
Plans:
- [x] 14-01-PLAN.md — submitSplitResult helper in matchResults.ts + unit tests
- [x] 14-02-PLAN.md — Session toggle in SessionView + splitScoring propagation to CourtCard
- [x] 14-03-PLAN.md — Split finish UI in CourtCard and CourtTabs + useAdminActions split path
**UI hint**: yes

### Phase 15: Split Stats Aggregation
**Goal**: All stats, leaderboard, schedule, and profile surfaces aggregate every game-level result row correctly
**Depends on**: Phase 14
**Requirements**: STAT-01, STAT-02, STAT-03, COMP-01, COMP-02
**Success Criteria** (what must be TRUE):
  1. A `2-0` split result gives each winning player two wins and each losing player two games played
  2. A `1-1` split result gives every player two games played and one win
  3. Today leaderboard and session leaderboard calculate wins, games, losses, and win rate from all result rows
  4. Player schedule/profile views display completed split matches without treating only the first result as authoritative
  5. Existing one-game result rows continue to count exactly once across all stats surfaces
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 8. DB Foundation | v1.1 | 1/1 | Complete | 2026-05-04 |
| 9. Inventory Management | v1.1 | 3/3 | Complete | 2026-05-05 |
| 10. Session Finance | v1.1 | 4/4 | Complete | 2026-05-06 |
| 11. Payment Migration | v1.1 | 3/3 | Complete | 2026-05-06 |
| 12. Public Registration Homepage | v1.2 | 1/1 | Complete | 2026-05-12 |
| 13. Split Scoring Schema | v1.3 | 2/2 | Complete | 2026-05-23 |
| 14. Split Result Entry | v1.3 | 3/3 | Complete (UAT pending) | 2026-05-23 |
| 15. Split Stats Aggregation | v1.3 | 0/TBD | Pending | - |
