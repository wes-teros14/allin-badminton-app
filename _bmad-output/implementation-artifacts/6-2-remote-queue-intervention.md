# Story 6.2: Remote Queue Intervention

## Status: review

## Story

As an admin,
I want to remotely edit, reorder, and advance the match queue from my phone,
So that I can fix issues during the session without touching the kiosk tablet.

## Acceptance Criteria

- **AC1**: Tapping "Edit" on a queued match opens an inline form with 4 nameSlug text inputs — no modal. Tapping Save resolves slugs → UUIDs and updates the match. Kiosk/player reflect the change within ≤2 seconds.
- **AC2**: Tapping "Move Up" / "Move Down" on a queued match swaps its `queue_position` with the adjacent match. First match has no "Move Up"; last has no "Move Down".
- **AC3**: Tapping "Mark Done" on a currently playing match sets its `status = 'complete'` (no `winning_pair_index` — admin override, no stats impact), then advances the next queued match to playing on the same court.
- **AC4**: All action buttons disable during the write and re-enable on completion — no duplicate submissions.
- **AC5**: If a nameSlug cannot be resolved to a profile ID, show a `toast.error` and do not save.

## Tasks / Subtasks

- [x] Task 1: Create `useAdminActions.ts` hook with edit, reorder, and markDone functions
- [x] Task 2: Add action UI to `CourtTabs.tsx` (Edit form, Move Up/Down, Mark Done)
- [x] Task 3: Build & lint pass clean

## Dev Notes

### Task 1 — `useAdminActions.ts`

**File:** `src/hooks/useAdminActions.ts`

**Exports:**
```typescript
export function useAdminActions(onDone: () => void) {
  return { editMatch, moveUp, moveDown, markDone }
}
```
`onDone` is called after every successful write to trigger a refresh.

**`editMatch(matchId: string, slugs: { t1p1: string; t1p2: string; t2p1: string; t2p2: string })`**
1. Resolve all 4 slugs → IDs: `supabase.from('profiles').select('id, name_slug').in('name_slug', [t1p1, t1p2, t2p1, t2p2])`
2. If any slug not found → `toast.error('Player not found: {slug}')` and return
3. `supabase.from('matches').update({ team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id }).eq('id', matchId)`
4. Call `onDone()`

**`moveUp(matchId: string, currentPosition: number, allQueued: AdminMatchDisplay[])`**
- Find the match at `currentPosition - 1` (the one above)
- Swap `queue_position` values — must use temp value to avoid UNIQUE constraint violation:
  ```sql
  -- Step 1: move current to temp (-1)
  UPDATE matches SET queue_position = -1 WHERE id = matchId
  -- Step 2: move upper to current position
  UPDATE matches SET queue_position = currentPosition WHERE id = upperMatchId
  -- Step 3: move current to upper position
  UPDATE matches SET queue_position = currentPosition - 1 WHERE id = matchId
  ```
- Call `onDone()`

**`moveDown(matchId: string, currentPosition: number, allQueued: AdminMatchDisplay[])`**
- Same pattern but swap with `currentPosition + 1`

**`markDone(matchId: string, courtNumber: 1 | 2, sessionId: string)`**
1. `supabase.from('matches').update({ status: 'complete' }).eq('id', matchId)`
2. Find next queued match: `.from('matches').select('id').eq('session_id', sessionId).eq('status', 'queued').order('queue_position').limit(1).maybeSingle()`
3. If found: `update({ status: 'playing', court_number: courtNumber }).eq('id', nextMatch.id)`
4. Call `onDone()`

**Error handling:** Use `{ data, error }` destructuring (not try/catch). On error: `toast.error(error.message)`.

**Import:** `import { toast } from 'sonner'` — static import at top of file.

### Task 2 — Update `CourtTabs.tsx`

**Props additions:**
```typescript
interface Props {
  // existing...
  sessionId: string | null
  onDone: () => void
}
```

Pass `sessionId` and `onDone` (which calls `refresh` from `useAdminSession`) from `AdminLiveView`.

**Inside `CourtTabs`:** call `useAdminActions(onDone)` to get the action functions.

**Mark Done button** on the current match card (both courts):
```tsx
<button onClick={() => markDone(current.id, courtNumber, sessionId!)} disabled={isSaving}>
  Mark Done
</button>
```
Style: `text-xs px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10`

**Queue row additions:**
- "Edit" button → toggles `editingId === m.id`
- When editing: show 4 text inputs pre-filled with current slugs + Save/Cancel buttons
- "Move Up" button (hidden for first queued match)
- "Move Down" button (hidden for last queued match)

**`isSaving` state:** single boolean — disable ALL action buttons while any write is in flight.

**Edit form layout (mobile-friendly):**
```
[t1p1 input] & [t1p2 input]
vs
[t2p1 input] & [t2p2 input]
[Save]  [Cancel]
```
Inputs: `className="border rounded px-2 py-1 text-sm w-full"`

**courtNumber for Mark Done:** Pass `courtNumber` prop into the inner `CourtCard` component, and `sessionId` from props.

### AdminLiveView update

Pass `sessionId` and `refresh` as `onDone` to `CourtTabs`:
```tsx
<CourtTabs
  court1Current={court1Current}
  court2Current={court2Current}
  queued={queued}
  isLoading={isLoading}
  sessionId={sessionId}
  onDone={refresh}
/>
```

### Key constraints
- Admin only — these actions write to `matches` which has `GRANT INSERT, UPDATE, DELETE ON public.matches TO authenticated` and the "admin all" RLS policy. No new migrations needed.
- Do NOT record `match_results` for Mark Done — this is an admin override with no stats impact.
- `queue_position` has a UNIQUE constraint on `(session_id, queue_position)` — must use temp value (-1) when swapping.

## File List
- `badminton-v2/src/hooks/useAdminActions.ts` (new)
- `badminton-v2/src/components/CourtTabs.tsx` (modified)
- `badminton-v2/src/views/AdminView.tsx` (modified — pass sessionId + onDone to CourtTabs)

## Change Log
- 2026-03-19: Story created (Story 6.2)
