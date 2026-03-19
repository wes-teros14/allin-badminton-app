# Story 5.2: Personal Match Schedule Display

## Status: review

## Story

As a player,
I want to see all my matches for the session with their status,
So that I can quickly find my next game and know who I'm playing.

## Acceptance Criteria

- **AC1**: Given a player navigates to `/player/:nameSlug`, a `<PlayerScheduleHeader>` shows the player's `nameSlug` and total game count in a purple header bar.
- **AC2**: Given matches are loaded, each `<GameCard>` shows: game number (hero size), partner name, vs opponent names.
- **AC3**: Given a match has `status = 'complete'`, the `<GameCard>` shows muted opacity, strikethrough game number, and a success checkmark.
- **AC4**: Given a match has `status = 'playing'`, the `<GameCard>` shows a `primary-subtle` tint background and a `<StatusChip>` showing "Playing".
- **AC5**: Given a match has `status = 'queued'`, the `<GameCard>` shows neutral styling; the immediately next queued match shows "Up Next" chip, the rest show "Queued".
- **AC6**: Given the schedule is loading for the first time, 3 skeleton `<GameCard>` placeholders render — no blank screen flash.
- **AC7**: Given the player's `nameSlug` is not found in profiles, a centred "Player not found" message renders.

## Tasks / Subtasks

- [x] Task 1: Create `usePlayerSchedule.ts` hook
- [x] Task 2: Create `<StatusChip>` component
- [x] Task 3: Create `<GameCard>` component
- [x] Task 4: Create `<PlayerScheduleHeader>` component
- [x] Task 5: Wire `ScheduleView` in `PlayerView.tsx` to use real components
- [x] Task 6: Build & lint pass clean

## Dev Notes

### Hook: `usePlayerSchedule`

**File:** `src/hooks/usePlayerSchedule.ts`

**Inputs:** `nameSlug: string`

**Returns:**
```typescript
{
  matches: PlayerMatch[]
  playerDisplayName: string    // same as nameSlug for now
  sessionName: string
  isLoading: boolean
  notFound: boolean            // true if nameSlug not in profiles
}
```

**`PlayerMatch` shape:**
```typescript
interface PlayerMatch {
  id: string
  gameNumber: number           // queue_position
  status: 'queued' | 'playing' | 'complete'
  partnerNameSlug: string
  opp1NameSlug: string
  opp2NameSlug: string
}
```

**Logic:**
1. Query `profiles` `.select('id, name_slug').eq('name_slug', nameSlug).maybeSingle()`
   - If null → set `notFound = true`, return early
2. Find active session: same query as `useCourtState` — `.in('status', ['schedule_locked', 'in_progress'])`
3. Query `matches` where `session_id = sid` AND player appears in any of the 4 player columns:
   ```typescript
   .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`)
   .order('queue_position')
   ```
4. Collect all unique player IDs from results → fetch profiles for name resolution
5. For each match, determine who is the partner and who are the opponents relative to the current player:
   - If player is on team1: partner = other team1 player, opponents = team2 players
   - If player is on team2: partner = other team2 player, opponents = team1 players
6. Fetch `sessions` name field for `sessionName`
7. Return sorted matches, sessionName, playerDisplayName = nameSlug

**No Realtime in this hook** — that is Story 5-3.

### Component: `<StatusChip>`

**File:** `src/components/StatusChip.tsx`

**Props:** `status: 'playing' | 'up-next' | 'queued' | 'done'`

Use `shadcn/ui` Badge or a simple `<span>` — **do not install new packages**. Style with Tailwind:
- `playing` → `bg-primary text-primary-foreground` (purple)
- `up-next` → `bg-muted-foreground/20 text-muted-foreground` (visible but muted)
- `queued` → `bg-muted/50 text-muted-foreground` (recedes)
- `done` → `bg-[var(--success)]/20 text-[var(--success)]` (green tint)

### Component: `<GameCard>`

**File:** `src/components/GameCard.tsx`

**Props:**
```typescript
interface GameCardProps {
  gameNumber: number
  partnerNameSlug: string
  opp1NameSlug: string
  opp2NameSlug: string
  status: 'queued' | 'playing' | 'complete'
  isNextUp: boolean      // controls "Up Next" vs "Queued" chip
  isLoading?: boolean    // skeleton mode
}
```

**Skeleton mode** (`isLoading = true`): render `animate-pulse` placeholder bars matching card height.

**Visual variants:**
- `complete`: `opacity-50`, game number with `line-through`, green checkmark (`✓`) instead of StatusChip
- `playing`: `bg-[var(--primary-subtle)]` background, purple border `border-primary/30`
- `queued`: default border `border-border`

**Layout (mobile-first, single card):**
```
┌─────────────────────────────────────┐
│  [GameNumber]  [StatusChip]         │
│  With: partnerNameSlug              │
│  vs opp1NameSlug & opp2NameSlug     │
└─────────────────────────────────────┘
```
Game number: `text-4xl font-bold` (NOT `game-hero` — that's for the kiosk). This is mobile, smaller.

### Component: `<PlayerScheduleHeader>`

**File:** `src/components/PlayerScheduleHeader.tsx`

**Props:** `nameSlug: string`, `sessionName: string`, `gameCount: number`

Purple header bar (`bg-primary text-primary-foreground`), padding `px-4 py-5`:
- Large bold player name `text-2xl font-bold`
- Small session name and game count below in `text-sm opacity-80`

### Wiring in `PlayerView.tsx`

Replace the `ScheduleView` stub with real implementation using the hook and components. `ScheduleView` is already a separate function inside `PlayerView.tsx` — just replace its body.

**"Up Next" logic:** the first match in the returned array with `status = 'queued'` gets `isNextUp = true`.

**Not found state:** if `notFound = true`, render centred "Player not found" message.

### Import patterns
```typescript
import { Link, useParams } from 'react-router'   // NOT react-router-dom
import { supabase } from '@/lib/supabase'
```

### What NOT to build
- No Realtime subscription (Story 5-3)
- No court number display (intentionally omitted per UX spec)
- No `LiveIndicator` (Story 5-3)

## Dev Agent Record

### Completion Notes
All tasks implemented. `usePlayerSchedule` resolves nameSlug → playerId, finds active session, queries matches where player appears in any team column, resolves partner/opponents relative to current player. `GameCard` handles all 3 status variants + skeleton. Build and lint pass clean.

## File List
- `badminton-v2/src/hooks/usePlayerSchedule.ts` (new)
- `badminton-v2/src/components/StatusChip.tsx` (new)
- `badminton-v2/src/components/GameCard.tsx` (new)
- `badminton-v2/src/components/PlayerScheduleHeader.tsx` (new)
- `badminton-v2/src/views/PlayerView.tsx` (modified)

## Change Log
- 2026-03-19: Story created (Story 5.2)
