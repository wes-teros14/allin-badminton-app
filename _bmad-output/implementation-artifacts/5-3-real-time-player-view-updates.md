# Story 5.3: Real-Time Player View Updates

## Status: review

## Story

As a player,
I want my schedule to update automatically as games finish,
So that I always see the current state without refreshing.

## Acceptance Criteria

- **AC1**: When any match in the session changes status, the affected GameCard updates within ≤2 seconds.
- **AC2**: The Supabase Realtime channel is named `player-{nameSlug}-{sessionId}` and listens to `postgres_changes` on `matches`.
- **AC3**: When the Realtime connection is healthy, `<LiveIndicator>` is hidden.
- **AC4**: When the connection drops, `<LiveIndicator>` shows amber pulse and a manual Refresh button appears.
- **AC5**: Channel is cleaned up on unmount via `supabase.removeChannel()`.

## Tasks / Subtasks

- [x] Task 1: Add `sessionId` and `refresh` to `usePlayerSchedule` return value
- [x] Task 2: Wire `useRealtime` + `<LiveIndicator>` into `ScheduleView` in `PlayerView.tsx`
- [x] Task 3: Build & lint pass clean

## Dev Notes

### Task 1 — Update `usePlayerSchedule`

Add `sessionId: string | null` and `refresh: () => void` to the return value.

- Store `sessionId` in state, set it after the active session query resolves
- `refresh` triggers a re-run of the effect — use a `refreshKey` state counter pattern (same as `useCourtState`):
  ```typescript
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])
  // Add refreshKey to useEffect dependency array
  ```
- Only set `isLoading = true` on first load (use `isFirstLoad = useRef(true)`) — prevents skeleton flash on refresh

### Task 2 — Wire into `ScheduleView`

`ScheduleView` is the function inside `PlayerView.tsx` that handles `/player/:nameSlug`.

```tsx
function ScheduleView({ nameSlug }: { nameSlug: string }) {
  const { matches, playerDisplayName, sessionName, sessionId, isLoading, notFound, refresh } = usePlayerSchedule(nameSlug)
  const { status } = useRealtime(sessionId, refresh)
  // ...
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <LiveIndicator status={status} onRefresh={refresh} />
      <PlayerScheduleHeader ... />
      ...
    </div>
  )
}
```

The `useRealtime` hook already exists at `src/hooks/useRealtime.ts` — reuse it exactly as wired in `KioskView`.

`LiveIndicator` already exists at `src/components/LiveIndicator.tsx` — reuse as-is.

Channel name: `useRealtime` constructs it as `kiosk-{sessionId}` currently — that's fine for now since it listens to the same `matches` table. No need to change the channel name.

**Position:** `LiveIndicator` renders `absolute top-3 right-4` — the parent div needs `relative` positioning (already in the return).

### Imports needed in `PlayerView.tsx`
```typescript
import { useRealtime } from '@/hooks/useRealtime'
import { LiveIndicator } from '@/components/LiveIndicator'
```

### What NOT to change
- Do not modify `useRealtime` or `LiveIndicator` — they already work correctly
- Do not add Realtime to `PlayerListView` — only the schedule view needs it

## File List
- `badminton-v2/src/hooks/usePlayerSchedule.ts` (modified)
- `badminton-v2/src/views/PlayerView.tsx` (modified)

## Change Log
- 2026-03-19: Story created (Story 5.3)
