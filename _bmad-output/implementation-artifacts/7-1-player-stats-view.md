# Story 7.1: Player Stats View

## Status: review

## Story

As a player,
I want to see my all-time win rate and attendance history,
So that I can track my performance across all sessions.

## Acceptance Criteria

- **AC1**: Below the match schedule on `/player/:nameSlug`, a Stats section shows the player's all-time win rate as "X / Y wins (Z%)" where Y = total completed games and X = wins. If Y is 0, show "No games recorded yet".
- **AC2**: Win is counted when `match_results.winning_pair_index` matches the pair the player was on (pair 1 = team1, pair 2 = team2).
- **AC3**: An Attendance section lists all sessions this player registered for (name + date), newest first.
- **AC4**: Stats load without blocking the schedule — if loading, show skeleton placeholders for both sections.
- **AC5**: No division-by-zero errors; no crashes when `match_results` is empty.

## Tasks / Subtasks

- [x] Task 1: Create `usePlayerStats.ts` hook
- [x] Task 2: Add Stats + Attendance UI to `ScheduleView` in `PlayerView.tsx`
- [x] Task 3: Build & lint pass clean

## Dev Notes

### Schema reference

```
matches: id, session_id, queue_position, status,
         team1_player1_id, team1_player2_id,
         team2_player1_id, team2_player2_id

match_results: id, match_id, winning_pair_index (1|2), completed_at

session_registrations: session_id, player_id

sessions: id, name, date, status
profiles: id, name_slug, role
```

`match_results` is only inserted on kiosk Finish (with winner chosen) — NOT on admin Mark Done (override, no stats). So `match_results.length > 0` reliably means a real game was played with a recorded result.

---

### Task 1 — `usePlayerStats.ts`

**File:** `src/hooks/usePlayerStats.ts`

**Export:**
```typescript
interface PlayerStats {
  wins: number
  totalGames: number
  sessions: { id: string; name: string; date: string }[]
}

interface UsePlayerStatsResult {
  stats: PlayerStats | null
  isLoading: boolean
}

export function usePlayerStats(nameSlug: string): UsePlayerStatsResult
```

**Logic:**

Step 1 — Resolve `nameSlug` → `playerId`:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('id')
  .eq('name_slug', nameSlug)
  .maybeSingle()
```
If not found → return `{ stats: { wins: 0, totalGames: 0, sessions: [] }, isLoading: false }`.

Step 2 — Fetch all matches where the player appeared **that have a result**, in a single query using Supabase nested select:
```typescript
const { data: matchRows } = await supabase
  .from('matches')
  .select('id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index)')
  .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`)
```

Step 3 — Calculate win rate:
```typescript
type MatchWithResult = {
  id: string
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  match_results: { winning_pair_index: number }[]
}

const rows = (matchRows ?? []) as MatchWithResult[]

let wins = 0
let totalGames = 0

for (const m of rows) {
  if (!m.match_results || m.match_results.length === 0) continue
  totalGames++
  const result = m.match_results[0]
  const onTeam1 =
    m.team1_player1_id === playerId || m.team1_player2_id === playerId
  const playerPairIndex = onTeam1 ? 1 : 2
  if (result.winning_pair_index === playerPairIndex) wins++
}
```

Step 4 — Fetch attendance sessions:
```typescript
const { data: regRows } = await supabase
  .from('session_registrations')
  .select('sessions(id, name, date)')
  .eq('player_id', playerId)
```

```typescript
type RegRow = { sessions: { id: string; name: string; date: string } | null }
const sessions = ((regRows ?? []) as RegRow[])
  .map((r) => r.sessions)
  .filter((s): s is { id: string; name: string; date: string } => s !== null)
  .sort((a, b) => b.date.localeCompare(a.date))  // newest first
```

Step 5 — Set state:
```typescript
setStats({ wins, totalGames, sessions })
```

**Error handling:** Use `{ data, error }` destructuring. On any error, log and leave stats as null.

**No Realtime needed** — stats don't change mid-session in a meaningful way (admin Mark Done doesn't write match_results). Keep it simple: load once on mount, no refresh key.

---

### Task 2 — Add Stats UI to `ScheduleView` in `PlayerView.tsx`

**Import:**
```typescript
import { usePlayerStats } from '@/hooks/usePlayerStats'
```

**Inside `ScheduleView`:** (already receives `nameSlug` prop)
```typescript
const { stats, isLoading: statsLoading } = usePlayerStats(nameSlug)
```

**Add below the game cards `<div>`:**

```tsx
{/* Stats section */}
<div className="mt-6 space-y-4">
  {/* Win Rate */}
  <div>
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
      Win Rate
    </p>
    {statsLoading ? (
      <div className="h-10 bg-muted rounded-lg animate-pulse" />
    ) : !stats || stats.totalGames === 0 ? (
      <p className="text-sm text-muted-foreground">No games recorded yet</p>
    ) : (
      <p className="text-2xl font-bold">
        {stats.wins} / {stats.totalGames}
        <span className="text-sm font-normal text-muted-foreground ml-2">
          ({Math.round((stats.wins / stats.totalGames) * 100)}%)
        </span>
      </p>
    )}
  </div>

  {/* Attendance */}
  <div>
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
      Sessions Attended
    </p>
    {statsLoading ? (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded animate-pulse" />
        ))}
      </div>
    ) : !stats || stats.sessions.length === 0 ? (
      <p className="text-sm text-muted-foreground">No sessions yet</p>
    ) : (
      <div className="divide-y divide-border">
        {stats.sessions.map((s) => (
          <div key={s.id} className="py-2 flex justify-between text-sm">
            <span className="font-medium">{s.name}</span>
            <span className="text-muted-foreground">{s.date}</span>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

**Placement:** The stats div goes after the closing `</div>` of the game cards list (the `max-w-sm mx-auto px-4 py-4 flex flex-col gap-3` div), INSIDE the outer `min-h-screen` div. Easiest: wrap both the game cards and stats in one `max-w-sm mx-auto px-4 py-4` container.

Actually, the cleanest approach is to include the stats inside the existing `max-w-sm mx-auto px-4 py-4 flex flex-col gap-3` div at the bottom, after the game cards `map`. Change `flex flex-col gap-3` to `flex flex-col gap-3 pb-8` for bottom padding.

---

### Key constraints

- **`match_results` nested select:** Supabase supports `select('..., match_results(winning_pair_index)')` for one-to-many. The result is an array on each match row — always check `m.match_results.length > 0`.
- **Admin Mark Done does NOT write to `match_results`** — only kiosk Finish does. So only matches with match_results rows count as "recorded games".
- **All-time stats** — query is NOT filtered by session_id. Stats are across all sessions ever.
- **RLS:** `match_results` has `"match_results: read all" TO anon, authenticated` so anon players can read. `session_registrations` has `"session_registrations: anon read" USING (true)` from migration 008. Both are accessible.
- **Do NOT add Realtime** to usePlayerStats — stats are a historical view, not live.
- **Do NOT add a new page** — stats go inline in the existing `/player/:nameSlug` schedule view.

---

## File List

- `badminton-v2/src/hooks/usePlayerStats.ts` (new)
- `badminton-v2/src/views/PlayerView.tsx` (modified — add usePlayerStats + stats UI to ScheduleView)

## Change Log

- 2026-03-19: Story created (Story 7.1)
