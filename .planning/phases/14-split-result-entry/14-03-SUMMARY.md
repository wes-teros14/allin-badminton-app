---
plan: 14-03
phase: 14-split-result-entry
status: complete
completed: 2026-05-23
subsystem: match-result-ui
tags: [split-scoring, court-card, admin-panel, result-entry]
requirements: [FMT-02, FMT-03, RES-01, RES-02, COMP-02]
dependency-graph:
  requires: [14-01, 14-02]
  provides: [split-finish-ui, admin-split-path]
  affects: [CourtCard, CourtTabs, useAdminActions, SessionView]
tech-stack:
  added: []
  patterns: [conditional-render-on-prop, optional-param-branching]
key-files:
  created: []
  modified:
    - badminton-v2/src/components/CourtCard.tsx
    - badminton-v2/src/components/CourtTabs.tsx
    - badminton-v2/src/hooks/useAdminActions.ts
    - badminton-v2/src/views/SessionView.tsx
decisions:
  - Thread splitScoring as prop from SessionView -> LiveSessionView -> CourtTabs rather than adding a new fetch inside LiveSessionView
  - Reuse existing session.split_match_scoring state already in SessionView rather than reading useAdminSession
metrics:
  duration: ~15 minutes
  tasks: 2
  files: 4
---

# Phase 14 Plan 03: Split Finish UI Summary

Implemented 3-button split finish UI in CourtCard (live board) and CourtTabs (admin panel). When `splitScoring=true`, the finish screen shows "{t1p1} & {t1p2} won 2-0", "1-1 Draw", and "{t2p1} & {t2p2} won 2-0" buttons. One-game sessions see no change (COMP-02). Split outcomes route through `submitSplitResult`; queue advancement is identical in both paths.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Split finish UI in CourtCard (live board) | a1bc9cd | CourtCard.tsx |
| 2 | Split finish UI in CourtTabs + useAdminActions split path | 7116ae4 | CourtTabs.tsx, useAdminActions.ts, SessionView.tsx |

## Key Files

- `badminton-v2/src/components/CourtCard.tsx` — 3-button split UI gated on splitScoring prop; handleFinish extended with optional splitOutcome
- `badminton-v2/src/components/CourtTabs.tsx` — 3-button split UI in admin panel; splitScoring prop threaded to inner CourtCard
- `badminton-v2/src/hooks/useAdminActions.ts` — markDone extended with splitOutcome parameter; calls submitSplitResult when provided
- `badminton-v2/src/views/SessionView.tsx` — splitScoring threaded from session.split_match_scoring to LiveSessionView to CourtTabs

## Decisions Made

1. **splitScoring prop threading via LiveSessionView props** — Added `splitScoring: boolean` to `LiveSessionView` props and computed it from `session.split_match_scoring ?? false` in `SessionView`. This avoids an extra fetch since `SessionView` already holds the full session object from `useSession`.

2. **CourtTabs Draw/No Winner preserved for non-split path** — The original 3-button screen (team1, team2, Draw/No Winner) is kept intact when `splitScoring=false`, preserving COMP-02 compatibility.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints or auth paths introduced. All writes are gated by existing auth in CourtCard (`.eq('status', 'playing')` guard) and useAdminActions (same guard).

## Self-Check: PASSED

- CourtCard shows 3 split buttons when splitScoring=true ✓
- CourtCard shows 2 original buttons when splitScoring=false ✓
- CourtTabs shows 3 split buttons when splitScoring=true ✓
- CourtTabs shows original 3-button screen (team1/team2/Draw) when splitScoring=false ✓
- submitSplitResult called for split outcomes in CourtCard ✓
- submitSplitResult called for split outcomes in useAdminActions ✓
- useAdminActions.markDone has splitOutcome parameter ✓
- splitScoring threaded from SessionView through LiveSessionView to CourtTabs ✓
- "won 2-0" appears 4 times across components (grep -rn "won 2-0" src/components/ returns 4 lines) ✓
- submitSplitResult appears 4+ times in src/ ✓
- npm run build exits 0 ✓
- npm run test:unit: 73 tests pass ✓
- npm run lint: 0 errors (2 pre-existing warnings only) ✓
