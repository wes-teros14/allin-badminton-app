---
phase: 10-session-finance
plan: "04"
subsystem: ui
tags: [react, react-router, finance, table, lazy-loading]

# Dependency graph
requires:
  - phase: 10-session-finance
    provides: useFinanceSessions hook (plan 02), FinanceDetailView (plan 03)
provides:
  - FinanceView list page with P&L table per session
  - Finance tab in TopNavBar (admin-only)
  - /finance and /finance/:sessionId routes registered in App.tsx
affects: [10-session-finance]

# Tech tracking
tech-stack:
  added: []
  patterns: [lazy-loaded admin view, role-gated nav tab, click-to-navigate table row]

key-files:
  created:
    - badminton-v2/src/views/FinanceView.tsx
  modified:
    - badminton-v2/src/components/TopNavBar.tsx
    - badminton-v2/src/App.tsx

key-decisions:
  - "Finance tab placed after Inventory in TopNavBar tabs array, admin-only via show: role === 'admin'"
  - "FinanceDetailView lazy-imported alongside FinanceView even though built in plan 03, to keep routes co-located"
  - "P&L positive values use text-green-500, negative use text-destructive for semantic color coding"

patterns-established:
  - "Admin-only tab pattern: { label, href, active: pathname.startsWith(...), show: role === 'admin', badge: false }"
  - "Row-click navigation: TableRow onClick triggers navigate() to detail view"

requirements-completed: [FIN-04]

# Metrics
duration: 8min
completed: 2026-05-05
---

# Phase 10 Plan 04: FinanceView + Navigation Summary

**FinanceView list page with Date/Revenue/Cost/P&L table, admin-only Finance tab in TopNavBar, and lazy-loaded /finance routes wired in App.tsx**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-05T09:40:00Z
- **Completed:** 2026-05-05T09:48:00Z
- **Tasks:** 1 (implementation) + checkpoint pending
- **Files modified:** 3

## Accomplishments
- Created FinanceView with full P&L table (Date, Revenue, Cost, P&L columns) from useFinanceSessions hook
- Empty state with ReceiptText icon and skeleton loading (4x h-12 animate-pulse rows)
- Finance tab added to TopNavBar after Inventory, visible to admin role only, active on /finance* paths
- Lazy imports for FinanceView and FinanceDetailView added to App.tsx
- /finance and /finance/:sessionId routes registered under AdminRoute + PlayerLayout block

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FinanceView + update TopNavBar + update App.tsx** - `b6904b7` (feat)

**Plan metadata:** pending docs commit

## Files Created/Modified
- `badminton-v2/src/views/FinanceView.tsx` - Finance list view with P&L table, empty state, skeleton loading, row-click navigation
- `badminton-v2/src/components/TopNavBar.tsx` - Added Finance tab (admin-only) after Inventory
- `badminton-v2/src/App.tsx` - Added lazy imports for FinanceView + FinanceDetailView; added /finance and /finance/:sessionId routes

## Decisions Made
- Finance tab placed immediately after Inventory in the tabs array to maintain logical admin grouping
- FinanceDetailView lazy import added here (alongside routes) even though the view was built in plan 03, keeping route declarations co-located
- P&L positive: `text-green-500`, negative: `text-destructive` for clear financial signaling

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Human Checkpoint Pending

The following manual verification is required before this plan is marked complete:

1. Run `cd badminton-v2 && npm run dev`
2. Sign in as admin
3. Verify Finance tab appears in TopNavBar (hidden for non-admin users)
4. Navigate to /finance — session list shows Date, Revenue, Cost, P&L columns
5. Verify P&L positive rows show green, negative rows show destructive red
6. Click a row — verify navigation to /finance/:sessionId (FinanceDetailView)
7. On detail view: log shuttle usage, update usage, enter court cost, verify P&L updates live

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 10 (session-finance) is fully implemented: hook (plan 01), data layer queries (plan 02), FinanceDetailView (plan 03), FinanceView + routing (plan 04)
- Human end-to-end verification of admin Finance tab and /finance routes is the remaining gate

---
*Phase: 10-session-finance*
*Completed: 2026-05-05*
