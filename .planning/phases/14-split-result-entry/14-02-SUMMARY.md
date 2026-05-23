---
plan: 14-02
phase: 14-split-result-entry
status: complete
completed: 2026-05-23
---

## Summary

Wired `split_match_scoring` from sessions table into component tree. `useCourtState` now exposes `splitMatchScoring: boolean`, populated from session queries in both the sessionIdParam and latest-active branches, and forwarded through `LiveBoardView` to `CourtCard` props. `SessionView` now shows a "Split match scoring" checkbox in `registration_closed` and `schedule_locked` states that persists to `sessions.split_match_scoring` via Supabase, with toast confirmation and error revert. `Session` interface in `useSession.ts` updated to include `split_match_scoring`. Build and lint clean (only pre-existing ProfileView warning).

## Key Files

- `badminton-v2/src/hooks/useCourtState.ts` — splitMatchScoring added to interface, state, both session select queries, early-return resets, and return object
- `badminton-v2/src/components/CourtCard.tsx` — splitScoring: boolean added to Props interface; eslint-disable comment for unused prop (Plan 14-03 will consume it)
- `badminton-v2/src/views/LiveBoardView.tsx` — splitMatchScoring destructured from useCourtState; splitScoring forwarded to both CourtCard instances
- `badminton-v2/src/views/SessionView.tsx` — splitScoring/splitSaving state, useEffect sync, handleSplitScoringChange handler, toggle UI in both registration_closed and schedule_locked sections
- `badminton-v2/src/hooks/useSession.ts` — split_match_scoring: boolean | null added to Session interface

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed impossible `in_progress` status check in toggle disabled condition**
- **Found during:** Task 2 build verification
- **Issue:** TypeScript error TS2367 — inside `session.status === 'registration_closed'` and `session.status === 'schedule_locked'` conditional blocks, comparing `session.status === 'in_progress'` is always false (types have no overlap)
- **Fix:** Removed `session.status === 'in_progress'` from `disabled` prop; the toggle is already not rendered in `in_progress` state since neither block renders at that status
- **Files modified:** `badminton-v2/src/views/SessionView.tsx`
- **Commit:** af08b68

**2. [Rule 2 - Missing] Added split_match_scoring to Session interface in useSession.ts**
- **Found during:** Task 2 implementation
- **Issue:** `Session` interface did not include `split_match_scoring` field, which is needed for `session.split_match_scoring` access in SessionView
- **Fix:** Added `split_match_scoring: boolean | null` to the Session interface
- **Files modified:** `badminton-v2/src/hooks/useSession.ts`
- **Commit:** af08b68

## Self-Check: PASSED

- useCourtState returns splitMatchScoring ✓
- CourtCard Props has splitScoring: boolean ✓
- LiveBoardView forwards splitScoring to both CourtCards ✓
- SessionView toggle in both registration_closed and schedule_locked sections ✓
- Toggle saves to sessions.split_match_scoring via Supabase update ✓
- Toast confirms save; reverts on error ✓
- Build clean ✓
- Lint clean (only pre-existing ProfileView warning) ✓
