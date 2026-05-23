---
phase: 14-split-result-entry
status: all_fixed
findings_in_scope: 6
fixed: 6
skipped: 0
iteration: 1
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-05-23
**Source review:** .planning/phases/14-split-result-entry/14-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-001: Silent split-result failure leaves match in broken state

**Files modified:** `badminton-v2/src/components/CourtCard.tsx`
**Commit:** 21e9367
**Applied fix:** Replaced `if (error) return` with `console.error(...)` and fall-through. When `submitSplitResult` fails the match is already `complete`; the function now logs the error and continues to step 3 (promote next queued match) so the board does not stall. WR-001 was addressed in the same edit (see below).

---

### CR-002: `swapCourts` has a partial-failure window that corrupts court assignment

**Files modified:** `badminton-v2/src/hooks/useAdminActions.ts`
**Commit:** 63078f2
**Applied fix:** Added rollback logic after step 2 and step 3 failures. If step 2 fails (`court_number: 1` on match2), match1 is restored to `court_number: 2` before returning. If step 3 fails (`court_number: 2` on match1), both matches are rolled back to their original court numbers. WR-003 was addressed in the same commit (see below).

---

### WR-001: Legacy result insert in `CourtCard` has no error handling

**Files modified:** `badminton-v2/src/components/CourtCard.tsx`
**Commit:** 21e9367 (same commit as CR-001)
**Applied fix:** Awaited the error from the non-split `match_results` insert and added `console.error(...)` on failure, but continued fall-through to queue promotion — matching the pattern applied to the split path.

---

### WR-002: `isFirstLoad` ref never reset on early-return paths in `useCourtState`

**Files modified:** `badminton-v2/src/hooks/useCourtState.ts`
**Commit:** 84db2b9
**Applied fix:** Added `isFirstLoad.current = false` before `setIsLoading(false)` in all four early-return paths: session not found (line 99), session complete/closed (line 111), no active session in else-branch (line 136), and no matches fetched (line 162). The happy-path reset on line 212 was already present.

---

### WR-003: `moveUp`/`moveDown` use `-1` as temp position without collision guard

**Files modified:** `badminton-v2/src/hooks/useAdminActions.ts`
**Commit:** 63078f2 (same commit as CR-002)
**Applied fix:** Replaced `queue_position: -1` with `queue_position: 9999` in both `moveUp` and `moveDown`. The sentinel `9999` is far above any realistic queue length and will not collide with a row left by a previous interrupted move (which could sit at `-1`).

---

### WR-004: `splitScoring` toggle available during `in_progress` session

**Files modified:** `badminton-v2/src/views/SessionView.tsx`
**Commit:** df32872
**Applied fix:** Added `|| session.status === 'in_progress'` to the `disabled` prop on both split scoring checkbox inputs (in the `registration_closed` block and the `schedule_locked` block). The flag can no longer be toggled once a session transitions to `in_progress`, preventing mismatched scoring UIs mid-session.

---

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-05-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
