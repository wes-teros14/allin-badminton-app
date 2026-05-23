---
phase: 14-split-result-entry
status: issues_found
depth: standard
files_reviewed: 8
files_reviewed_list:
  - badminton-v2/src/lib/matchResults.ts
  - badminton-v2/src/__tests__/matchResults.test.ts
  - badminton-v2/src/hooks/useCourtState.ts
  - badminton-v2/src/views/LiveBoardView.tsx
  - badminton-v2/src/components/CourtCard.tsx
  - badminton-v2/src/views/SessionView.tsx
  - badminton-v2/src/components/CourtTabs.tsx
  - badminton-v2/src/hooks/useAdminActions.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
---

## Summary

Phase 14 introduces split match result entry (2-0-t1 / 1-1 / 2-0-t2) cleanly and the core logic in `matchResults.ts` is correct. Two critical bugs exist in the result-submission flow: a silent failure in `CourtCard.tsx` leaves a match permanently broken when `submitSplitResult` errors, and `swapCourts` in `useAdminActions.ts` has a partial-failure window that can corrupt court assignment state. Four warnings cover missing error feedback, a loading-state bug in `useCourtState`, and an unguarded result insert. Three info items cover test gaps and minor consistency issues.

---

## Findings

### CR-001 (critical): Silent split-result failure leaves match in broken state

**File:** `badminton-v2/src/components/CourtCard.tsx:59-60`

**Issue:** When `submitSplitResult` returns an error, `handleFinish` returns early with no user feedback and no rollback. At this point step 1 has already succeeded — the match row is `status = 'complete'`. The match is now permanently completed with zero result rows, the next queued match is never promoted, and the operator sees nothing on screen to indicate anything went wrong.

**Impact:** Unrecoverable silent data corruption. The match appears finished on the board (live timer stops) but leaderboard and stats will never count it. The queue stalls because the next match is not promoted.

**Fix:**
```typescript
// CourtCard.tsx handleFinish — replace the splitOutcome block
if (splitOutcome) {
  const { error } = await submitSplitResult(current.id, splitOutcome)
  if (error) {
    // Surface the error; match is already complete but result is missing.
    // Caller should log or show a toast — import toast from 'sonner' or
    // use a prop callback. Minimum viable fix:
    console.error('Failed to record split result', error)
    // Still fall through to promote next match so the queue does not stall.
    // The admin can re-enter the result manually later.
  }
}
```
A stronger fix is to also expose `onError` via a prop or use `sonner` toast (already imported elsewhere in the component tree). The key fix is: do NOT bail out of the queue-promotion step on a result-insert failure.

---

### CR-002 (critical): `swapCourts` has a partial-failure window that corrupts court assignment

**File:** `badminton-v2/src/hooks/useAdminActions.ts:171-183`

**Issue:** The three-step court swap sets `court_number: null` on match1, then assigns court numbers. If step 2 (`court_number: 1` on match2) or step 3 (`court_number: 2` on match1) fails, match1 is left as a `playing` match with `court_number = null`. `useCourtState` finds playing matches via `court_number === 1` / `court_number === 2`, so match1 becomes invisible to the LiveBoard and the admin panel until manually fixed.

**Impact:** Playing match disappears from the court display mid-session. Admin has no recovery path from the UI.

**Fix:** Add rollback on intermediate failure:
```typescript
async function swapCourts(match1Id: string, match2Id: string) {
  setIsSaving(true)
  try {
    const { error: e1 } = await supabase.from('matches').update({ court_number: null }).eq('id', match1Id)
    if (e1) { toast.error(e1.message); return }

    const { error: e2 } = await supabase.from('matches').update({ court_number: 1 }).eq('id', match2Id)
    if (e2) {
      // Rollback: restore match1's court number
      await supabase.from('matches').update({ court_number: 2 }).eq('id', match1Id)
      toast.error(e2.message)
      return
    }

    const { error: e3 } = await supabase.from('matches').update({ court_number: 2 }).eq('id', match1Id)
    if (e3) {
      // Rollback both
      await supabase.from('matches').update({ court_number: 1 }).eq('id', match1Id)
      await supabase.from('matches').update({ court_number: 2 }).eq('id', match2Id)
      toast.error(e3.message)
      return
    }
    onDone()
  } finally {
    setIsSaving(false)
  }
}
```

---

### WR-001 (warning): Legacy result insert in `CourtCard` has no error handling

**File:** `badminton-v2/src/components/CourtCard.tsx:62-66`

**Issue:** The non-split path calls `supabase.from('match_results').insert(...)` without awaiting the error or showing any feedback. Same broken-state risk as CR-001 but for the legacy scoring path.

**Impact:** If the insert fails, the match is complete with no result row and no user feedback.

**Fix:**
```typescript
} else if (winningPairIndex !== null) {
  const { error: resultError } = await supabase.from('match_results').insert({
    match_id: current.id,
    winning_pair_index: winningPairIndex,
    game_number: 1,
  })
  if (resultError) {
    console.error('Failed to record result', resultError)
    // Fall through to promote next match; log for admin awareness.
  }
}
```

---

### WR-002 (warning): `isFirstLoad` ref never reset on early-return paths in `useCourtState`

**File:** `badminton-v2/src/hooks/useCourtState.ts:76-160`

**Issue:** `isFirstLoad.current = false` is set on line 208, which is only reachable after the full happy-path load completes. The function returns early in multiple cases (session not found at line 99, session closed at line 110, session list empty at line 127, no matches at line 157). When any of these early returns occur, `isFirstLoad.current` stays `true`. On the next `refresh()` call, line 76 sets `isLoading(true)` again, causing a full loading skeleton flash on every subsequent refresh even though data is already showing.

**Impact:** The LiveBoard and admin session view flash a loading skeleton on every realtime refresh after these state transitions.

**Fix:** Set `isFirstLoad.current = false` before every early return that calls `setIsLoading(false)`:
```typescript
// Example for the "session not found" early return:
if (!s) {
  setHasSession(false)
  // ... other state resets ...
  isFirstLoad.current = false   // add this
  setIsLoading(false)
  return
}
```
Apply the same pattern to all other early returns (lines ~110, ~135, ~160).

---

### WR-003 (warning): `moveUp`/`moveDown` use `-1` as temp position without collision guard

**File:** `badminton-v2/src/hooks/useAdminActions.ts:44-55`

**Issue:** The three-step reorder uses `queue_position: -1` as a scratch position to work around the UNIQUE constraint on `(session_id, queue_position)`. If a row already holds position `-1` (e.g., from a previous interrupted move), the first update will violate the constraint, toast an error, and bail — leaving the target match at the wrong position.

**Impact:** Occasional reorder failures during rapid tapping or after a previous interrupted move. Low probability but leaves queue in wrong order without a recovery path.

**Fix:** Use a large sentinel value (e.g., `9999`) or add a pre-check for `queue_position < 0` rows and clean them up at session start. Alternatively, use an RPC that does the swap atomically. Minimum fix: use a value guaranteed unique, such as `Date.now()` modulo a safe range, or use a `DO UPDATE`-style upsert via RPC.

---

### WR-004 (warning): `splitScoring` toggle available during `in_progress` session (state machine gap)

**File:** `badminton-v2/src/views/SessionView.tsx:332-342`

**Issue:** The split scoring checkbox is only rendered in the `registration_closed` and `schedule_locked` states (lines 398-408, 419-429). However, `LiveSessionView` at line 51 receives `splitScoring={session.split_match_scoring ?? false}` which is read directly from the session row. If `split_match_scoring` is toggled via a direct DB edit while a session is `in_progress`, the LiveBoard and admin panel would show mismatched scoring UIs mid-session. The bigger concern is that there is no enforcement that the flag cannot be changed once the session starts.

**Impact:** An admin opening the Supabase dashboard or a second browser tab could toggle the flag mid-session, causing the LiveBoard to show "Who won?" (2-0/1-1/2-0) while the admin panel shows single-winner buttons (or vice versa), leading to wrong result rows being inserted.

**Fix:** This is primarily a product/policy decision, but a lightweight guard is to set the toggle to `disabled` when `session.status === 'in_progress'`. Add the same logic to the `in_progress` render branch if the toggle is ever added there:
```tsx
// In registration_closed and schedule_locked checkbox inputs, add:
disabled={splitSaving || session.status === 'in_progress'}
```

---

### IN-001 (info): `submitSplitResult` error path not covered in tests

**File:** `badminton-v2/src/__tests__/matchResults.test.ts`

**Issue:** All three `submitSplitResult` tests only mock a successful insert. There is no test for the error case (`insert` returns `{ error: new Error('...') }`), which means the error propagation path (the `{ error }` return) is untested.

**Fix:** Add a test:
```typescript
it('returns the error when insert fails', async () => {
  const { supabase } = await import('@/lib/supabase')
  const dbError = new Error('insert failed')
  const insertMock = vi.fn(() => Promise.resolve({ error: dbError }))
  ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ insert: insertMock })

  const result = await submitSplitResult('match-1', '2-0-t1')
  expect(result.error).toBe(dbError)
})
```

---

### IN-002 (info): Unused ESLint suppress comment in `CourtCard.tsx`

**File:** `badminton-v2/src/components/CourtCard.tsx:22`

**Issue:** `// eslint-disable-next-line @typescript-eslint/no-unused-vars` on the export line suppresses a lint warning rather than fixing the underlying issue. Inspecting the props, all destructured parameters appear to be used. The disable comment may be left over from a refactor.

**Fix:** Remove the comment. If the lint warning reappears, identify and remove the actually-unused parameter.

---

### IN-003 (info): `editForm` initial state has inconsistent field order

**File:** `badminton-v2/src/components/CourtTabs.tsx:251`

**Issue:** `setEditForm({ t1p1Id: '', t1p2Id: '', t2p2Id: '', t2p1Id: '' })` — `t2p2Id` and `t2p1Id` are in reversed order compared to the `EditForm` interface (`t2p1Id` first, then `t2p2Id`). This is not a runtime bug (object key order is irrelevant here) but creates a visual inconsistency that could cause confusion during future edits.

**Fix:** Reorder to match the interface:
```typescript
setEditForm({ t1p1Id: '', t1p2Id: '', t2p1Id: '', t2p2Id: '' })
```

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
