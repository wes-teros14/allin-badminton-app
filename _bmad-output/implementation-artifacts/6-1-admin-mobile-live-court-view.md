# Story 6.1: Admin Mobile Live Court View

## Status: review

## Story

As an admin,
I want to see the live state of both courts and the full match queue from my phone,
So that I can monitor the session without being at the kiosk.

## Acceptance Criteria

- **AC1**: When session is `in_progress`, AdminView shows a `<CourtTabs>` component with Court 1 and Court 2 tabs instead of the "Session is live" placeholder.
- **AC2**: Each tab shows the currently playing match for that court (or "No match playing" if idle).
- **AC3**: Scrolling down shows all remaining queued matches in order — global queue, not per-court (we cannot predict which court a queued match will go to).
- **AC4**: Realtime channel `admin-{sessionId}` keeps the view in sync within ≤2 seconds.
- **AC5**: `<LiveIndicator>` is visible in the admin view with the same connected/disconnected states.
- **AC6**: Loading shows skeletons — no blank screen flash.

## Tasks / Subtasks

- [x] Task 1: Create `useAdminSession.ts` hook
- [x] Task 2: Create `<CourtTabs>` component
- [x] Task 3: Replace the `in_progress` placeholder in `AdminView.tsx`
- [x] Task 4: Build & lint pass clean

## Dev Notes

### Task 1 — `useAdminSession.ts`

**File:** `src/hooks/useAdminSession.ts`

**Returns:**
```typescript
{
  court1Current: AdminMatchDisplay | null
  court2Current: AdminMatchDisplay | null
  queued: AdminMatchDisplay[]
  sessionId: string | null
  sessionName: string
  isLoading: boolean
  refresh: () => void
}

interface AdminMatchDisplay {
  id: string
  gameNumber: number        // queue_position
  t1p1: string
  t1p2: string
  t2p1: string
  t2p2: string
}
```

**Logic:** Same pattern as `useCourtState` — find active session, fetch matches, resolve names. Differences:
- Return ALL queued matches as an array (not just queued[0] and queued[1])
- Return sessionName for display
- Use `refreshKey` + `isFirstLoad` ref pattern (same as `useCourtState` and `usePlayerSchedule`)
- Active session query: `.in('status', ['schedule_locked', 'in_progress'])`

**Realtime:** Do NOT add Realtime inside this hook — wire `useRealtime` at the component level (same pattern as KioskView).

### Task 2 — `<CourtTabs>` component

**File:** `src/components/CourtTabs.tsx`

**Props:**
```typescript
interface Props {
  court1Current: AdminMatchDisplay | null
  court2Current: AdminMatchDisplay | null
  queued: AdminMatchDisplay[]
  isLoading: boolean
}
```

**Layout:**
- Two tab buttons at top: "Court 1" | "Court 2" — use simple state for active tab (no router tabs needed)
- Active tab underline: `border-b-2 border-primary`
- **Current match section:** show game number + "Team 1 vs Team 2" for the selected court's current match. If null → "No match playing" in muted text
- **Queue section:** heading "Up Next", then list of queued matches in order. Each row: game number + "t1p1 & t1p2 vs t2p1 & t2p2"
- If queue empty and no current → "Queue is empty"
- Skeleton: while `isLoading`, show pulse placeholders

**Styling:** Mobile-first, single column. Match row: `py-3 border-b border-border last:border-b-0`

### Task 3 — Wire into `AdminView.tsx`

Replace the `in_progress` branch:

```tsx
// Before:
) : session.status === 'in_progress' ? (
  <Card>...</Card>  // "Session is live" placeholder

// After:
) : session.status === 'in_progress' ? (
  <AdminSessionView sessionId={session.id} sessionName={session.name} />
```

Create `AdminSessionView` as a local component inside AdminView (or a separate file) that:
1. Calls `useAdminSession()`
2. Calls `useRealtime(sessionId, refresh)`
3. Renders `<LiveIndicator>` + `<CourtTabs>`

### Imports to add in AdminView.tsx
```typescript
import { useAdminSession } from '@/hooks/useAdminSession'
import { useRealtime } from '@/hooks/useRealtime'
import { CourtTabs } from '@/components/CourtTabs'
import { LiveIndicator } from '@/components/LiveIndicator'
```

### Key constraint
The queue shown is the **global queue** (all queued matches, sorted by queue_position) — NOT filtered per court. We removed "Up Next" from CourtCard in Story 4.2 for this exact reason: we cannot predict which court a queued match will go to.

## File List
- `badminton-v2/src/hooks/useAdminSession.ts` (new)
- `badminton-v2/src/components/CourtTabs.tsx` (new)
- `badminton-v2/src/views/AdminView.tsx` (modified)

## Change Log
- 2026-03-19: Story created (Story 6.1)
