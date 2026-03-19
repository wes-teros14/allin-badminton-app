# Story 5.1: Player List & Personal Schedule Navigation

## Status: review

## Story

As a player,
I want to open one shared link and find my name to see my schedule,
So that I can check my games without needing a personal link or login.

## Acceptance Criteria

- **AC1**: Given `/player` is opened with no login, when an active session exists, the page lists all registered players sorted alphabetically — each name is a tappable link to `/player/:nameSlug`.
- **AC2**: Given a player taps their name, the URL updates to `/player/:nameSlug` and that route loads without error.
- **AC3**: Given a player bookmarks `/player/:nameSlug` directly, when they return, it loads directly — no list navigation needed.
- **AC4**: Given no active session exists, when `/player` loads, a centred "No active session" message shows — no player list rendered.
- **AC5**: Given the list is loading for the first time, skeleton placeholders render — no blank screen flash.

## Tasks / Subtasks

- [x] Task 1: Create `usePlayerList.ts` hook
- [x] Task 2: Build player list UI inside `PlayerView.tsx` (no nameSlug state)
- [x] Task 3: Stub the `/player/:nameSlug` state in `PlayerView.tsx` (placeholder for Story 5-2)
- [x] Task 4: Build & lint pass clean

## Dev Notes

### Routing
Both `/player` and `/player/:nameSlug` already route to `PlayerView` in `App.tsx` — do not change routing.

Use `useParams<{ nameSlug?: string }>()` from `react-router` inside `PlayerView` to determine which state to render:
- No `nameSlug` → show player list
- `nameSlug` present → show schedule (placeholder `<div>` for Story 5-2)

### Hook: `usePlayerList`

**File:** `src/hooks/usePlayerList.ts`

**Returns:**
```typescript
{
  players: Array<{ id: string; nameSlug: string }>
  isLoading: boolean
  hasSession: boolean
}
```

**Logic:**
1. Query `sessions` with `.in('status', ['schedule_locked', 'in_progress'])`, `.order('created_at', { ascending: false })`, `.limit(1).maybeSingle()` — same pattern as `useCourtState`
2. If no session → return `{ players: [], isLoading: false, hasSession: false }`
3. Query `session_registrations` `.select('player_id').eq('session_id', sessionId)`
4. Extract `playerIds` from result
5. Query `profiles` `.select('id, name_slug').in('id', playerIds)`
6. Sort by `name_slug` alphabetically
7. Return sorted array

**Anon access**: All three tables are already readable by `anon` (used by kiosk). No new RLS needed.

### PlayerView structure

**File:** `src/views/PlayerView.tsx`

```
/player          → player list (nameSlug undefined)
/player/:nameSlug → schedule stub (nameSlug defined)
```

**List layout (mobile-first, single column):**
- Max width `max-w-sm mx-auto` with `px-4 py-8`
- Header: `"Who are you?"` or `"Find your name"` in `h1` style
- List of `<Link>` buttons, each full-width, showing `nameSlug`
- Skeleton: 5 placeholder bars while loading

**No active session state:** centred `"No active session"` in `text-muted-foreground`

### Skeleton pattern (matches existing codebase)
```tsx
<div className="h-12 bg-muted rounded-lg animate-pulse" />
```
Render 5 of these while `isLoading`.

### Import patterns (match existing code)
```typescript
import { supabase } from '@/lib/supabase'
import { Link, useParams } from 'react-router'  // NOT react-router-dom
```

### What NOT to build in this story
- No `GameCard`, `PlayerScheduleHeader`, `StatusChip`, `usePlayerSchedule` — those are Story 5-2
- No Realtime subscription — that is Story 5-3
- The `/player/:nameSlug` branch just needs to render without crashing (a simple `<div>` is fine)

## Dev Agent Record

### Completion Notes
All tasks implemented. `usePlayerList` fetches active session → session_registrations → profiles, sorted alphabetically. `PlayerView` uses `useParams` to branch between list view and schedule stub. Build and lint pass clean.

## File List
- `badminton-v2/src/hooks/usePlayerList.ts` (new)
- `badminton-v2/src/views/PlayerView.tsx` (modified)

## Change Log
- 2026-03-19: Story created (Story 5.1)
