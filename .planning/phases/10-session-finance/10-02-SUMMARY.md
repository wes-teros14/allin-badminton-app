---
phase: 10-session-finance
plan: 02
subsystem: api
tags: [react, supabase, typescript, hooks]

requires:
  - phase: 08-db-foundation
    provides: sessions, session_registrations, shuttle_usage, shuttle_batches tables with admin-only RLS

provides:
  - useFinanceSessions hook — all-sessions finance list with P&L per row
  - FinanceSessionRow interface with revenue, shuttleCost, courtCost, totalCost, profit fields

affects: [10-03, 10-04, finance-list-view]

tech-stack:
  added: []
  patterns: [Promise.all parallel Supabase fetch, client-side P&L aggregation via in-memory lookup maps]

key-files:
  created:
    - badminton-v2/src/hooks/useFinanceSessions.ts
  modified: []

key-decisions:
  - "Revenue uses paid-only registration count (if r.paid guard) — aligns with Plan 10-01 approach"
  - "4 independent Supabase queries run in parallel via Promise.all (D-12: single efficient all-sessions fetch)"
  - "P&L computed client-side: profit = revenue - shuttleCost - courtCost (D-09)"
  - "Sessions ordered date DESC (most recent first)"

patterns-established:
  - "Promise.all pattern: fetch independent queries simultaneously, join via Map lookups in JS"
  - "batchCostMap + shuttleCostMap: O(n) aggregation without N+1 queries"

requirements-completed: [FIN-04]

duration: 3min
completed: 2026-05-05
---

# Phase 10-02: useFinanceSessions Hook Summary

**All-sessions finance list hook using Promise.all parallel fetch with client-side P&L aggregation via Map lookups**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-05T09:30:00+08:00
- **Completed:** 2026-05-05T09:34:54+08:00
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created useFinanceSessions hook with 4-query Promise.all parallel fetch
- Aggregates shuttleCost per session via batch cost_per_tube lookup maps
- Filters paid-only registrations for revenue calculation
- Exports FinanceSessionRow interface with all P&L fields

## Task Commits

1. **Task 1: Create useFinanceSessions hook** - `670abdd` (feat(10-02): create useFinanceSessions hook with Promise.all parallel fetch)

## Files Created/Modified
- `badminton-v2/src/hooks/useFinanceSessions.ts` — Hook with FinanceSessionRow interface, Promise.all fetch, and P&L computation

## Decisions Made
- Paid-only revenue filter propagated from Plan 10-01 decision: `if (r.paid)` guards registration count aggregation
- Promise.all for 4 independent queries (sessions, registrations, usage, batches) minimizes network latency

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None — TypeScript compilation passed with zero errors.

## Next Phase Readiness
- useFinanceSessions hook ready for FinanceView (Plan 10-04)
- FinanceSessionRow interface ready for table rendering
