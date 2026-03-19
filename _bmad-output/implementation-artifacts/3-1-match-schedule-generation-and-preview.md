# Story 3.1: Match Schedule Generation & Preview

Status: review

## Story

As an admin,
I want to generate a full match schedule from the confirmed roster and review it before saving,
So that I can verify the schedule is fair before locking it in.

## Acceptance Criteria

1. **Given** a session has `status = 'registration_closed'` with ≥ 4 registered players
   **When** the admin taps "Generate Schedule" in `<MatchGeneratorPanel>`
   **Then** `lib/matchGenerator.ts` runs client-side and produces a list of doubles matches
   **And** the algorithm completes within 5 seconds for 10–30 players
   **And** the schedule is displayed in the `preview` stage — not yet saved to DB

2. **Given** the preview is displayed
   **When** the admin reviews it
   **Then** each match shows: game number, player 1 + player 2 vs player 3 + player 4 (name slugs)
   **And** all registered players appear across the schedule with fair rotation (no player sits out consecutively)

3. **Given** the admin views the preview
   **When** they tap "Generate Again"
   **Then** a new schedule is generated and replaces the preview — still not saved to DB

## Tasks / Subtasks

- [x] Task 1: Create `005_create_matches.sql` migration (needed for Story 3-2 lock step)
  - [x] Define `match_status` enum: `queued`, `playing`, `complete`
  - [x] Define `matches` table: `id`, `session_id`, `queue_position`, `team1_player1_id`, `team1_player2_id`, `team2_player1_id`, `team2_player2_id`, `status`, `created_at`; UNIQUE(`session_id`, `queue_position`)
  - [x] Add RLS: admin all; authenticated + anon SELECT
  - [x] Add table grants
  - [ ] Run in **Supabase Dashboard → SQL Editor** — MANUAL STEP (Wes)

- [x] Task 2: Update `src/types/database.ts` with `matches` type and `match_status` enum (AC: #1)

- [x] Task 3: Create `src/lib/matchGenerator.ts` — pure scheduling algorithm (AC: #1, #2)
  - [x] Input: `playerIds: string[]`; Output: `GeneratedMatch[]`
  - [x] Algorithm: greedy rotation — each match picks the 4 players with fewest games played, breaking ties by longest bench time
  - [x] Target: each player plays ≈ 8 matches (`ceil(n * 8 / 4)` total matches)
  - [x] Export `GeneratedMatch` interface: `{ gameNumber, team1Player1, team1Player2, team2Player1, team2Player2 }` (all string player IDs)
  - [x] Pure function — no side effects, no Supabase calls

- [x] Task 4: Create `src/hooks/useRegisteredPlayers.ts` (AC: #1)
  - [x] Fetch `session_registrations` + `profiles` for a session (same two-query pattern as useRoster)
  - [x] Return `{ players: { id: string, nameSlug: string }[], isLoading: boolean }`

- [x] Task 5: Create `src/components/MatchGeneratorPanel.tsx` (AC: #1, #2, #3)
  - [x] Use `useRegisteredPlayers(sessionId)` to get player list
  - [x] State: `stage: 'idle' | 'preview'`, `matches: GeneratedMatch[]`
  - [x] `idle` stage: show player count + "Generate Schedule" button (disabled if < 4 players)
  - [x] On generate: call `generateSchedule(players.map(p => p.id))`, set `stage = 'preview'`
  - [x] `preview` stage: scrollable list of matches — each row: `{n}. {slug1} & {slug2} vs {slug3} & {slug4}`
  - [x] "Generate Again" button re-runs algorithm, replaces matches

- [x] Task 6: Update `AdminView.tsx` — show `<MatchGeneratorPanel>` when `session.status === 'registration_closed'` (AC: #1)

- [x] Task 7: Verify `npm run build` and `npm run lint` pass clean

- [ ] Task 8: Manual verification — MANUAL STEP (Wes)
  - [ ] Close registration → admin sees MatchGeneratorPanel with player count
  - [ ] Tap "Generate Schedule" → preview appears with numbered matches
  - [ ] Each match shows 4 player name_slugs in correct format
  - [ ] Tap "Generate Again" → new schedule replaces previous
  - [ ] Supabase `matches` table is empty (nothing saved yet)

---

## Dev Notes

### Task 1: Exact SQL for `005_create_matches.sql`

```sql
-- =============================================================
-- Migration: 005_create_matches
-- Creates match_status enum and matches table for the session queue.
-- =============================================================

CREATE TYPE public.match_status AS ENUM ('queued', 'playing', 'complete');

CREATE TABLE public.matches (
  id                UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID         NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  queue_position    INTEGER      NOT NULL,
  team1_player1_id  UUID         NOT NULL REFERENCES auth.users(id),
  team1_player2_id  UUID         NOT NULL REFERENCES auth.users(id),
  team2_player1_id  UUID         NOT NULL REFERENCES auth.users(id),
  team2_player2_id  UUID         NOT NULL REFERENCES auth.users(id),
  status            match_status NOT NULL DEFAULT 'queued',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (session_id, queue_position)
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "matches: admin all"
  ON public.matches
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- All roles can read matches (kiosk + player views need them)
CREATE POLICY "matches: read all"
  ON public.matches FOR SELECT
  TO anon, authenticated
  USING (true);

-- Table-level grants
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.matches TO authenticated;
```

---

### Task 2: `src/types/database.ts` addition

Add to `Tables`:

```typescript
matches: {
  Row: {
    id: string
    session_id: string
    queue_position: number
    team1_player1_id: string
    team1_player2_id: string
    team2_player1_id: string
    team2_player2_id: string
    status: 'queued' | 'playing' | 'complete'
    created_at: string
  }
  Insert: {
    id?: string
    session_id: string
    queue_position: number
    team1_player1_id: string
    team1_player2_id: string
    team2_player1_id: string
    team2_player2_id: string
    status?: 'queued' | 'playing' | 'complete'
    created_at?: string
  }
  Update: {
    id?: string
    session_id?: string
    queue_position?: number
    team1_player1_id?: string
    team1_player2_id?: string
    team2_player1_id?: string
    team2_player2_id?: string
    status?: 'queued' | 'playing' | 'complete'
    created_at?: string
  }
  Relationships: []
}
```

Add to `Enums`:
```typescript
match_status: 'queued' | 'playing' | 'complete'
```

---

### Task 3: `src/lib/matchGenerator.ts`

```typescript
export interface GeneratedMatch {
  gameNumber: number
  team1Player1: string
  team1Player2: string
  team2Player1: string
  team2Player2: string
}

/**
 * Pure function — generates a doubles match schedule for a given list of player IDs.
 * Algorithm: greedy rotation — each match picks the 4 players with fewest games played,
 * breaking ties by longest bench time (smallest lastPlayed index).
 * Guarantees no player sits out consecutively.
 */
export function generateSchedule(playerIds: string[]): GeneratedMatch[] {
  const n = playerIds.length
  if (n < 4) return []

  const matches: GeneratedMatch[] = []
  const played = new Map<string, number>(playerIds.map((id) => [id, 0]))
  const lastPlayed = new Map<string, number>(playerIds.map((id) => [id, -1]))

  // Target total matches: each player plays approximately 8 games
  const totalMatches = Math.ceil((n * 8) / 4)

  for (let i = 0; i < totalMatches; i++) {
    // Sort: fewest played first; ties broken by longest bench (smallest lastPlayed index)
    const sorted = [...playerIds].sort((a, b) => {
      const diff = (played.get(a) ?? 0) - (played.get(b) ?? 0)
      return diff !== 0 ? diff : (lastPlayed.get(a) ?? -1) - (lastPlayed.get(b) ?? -1)
    })

    const [p1, p2, p3, p4] = sorted

    matches.push({
      gameNumber: i + 1,
      team1Player1: p1,
      team1Player2: p2,
      team2Player1: p3,
      team2Player2: p4,
    })

    // Update tracking for the 4 players who just played
    ;[p1, p2, p3, p4].forEach((id) => {
      played.set(id, (played.get(id) ?? 0) + 1)
      lastPlayed.set(id, i + 1)
    })
  }

  return matches
}
```

**Key decisions:**
- Pure function with no side effects — easily unit testable
- `totalMatches = ceil(n * 8 / 4)` — scales linearly with player count; 10 players → 20 matches, 30 players → 60 matches
- Players are sorted in-place per match — O(n log n) per match, well within 5s for 30 players
- No shuffling needed — deterministic but fair (same input → same output; admin can "Generate Again" for variety if needed)

---

### Task 4: `src/hooks/useRegisteredPlayers.ts`

```typescript
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export interface RegisteredPlayer {
  id: string
  nameSlug: string
}

interface RegisteredPlayersState {
  players: RegisteredPlayer[]
  isLoading: boolean
}

export function useRegisteredPlayers(sessionId: string | undefined): RegisteredPlayersState {
  const [players, setPlayers] = useState<RegisteredPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      if (!sessionId) return

      const { data: regs, error: regsError } = await supabase
        .from('session_registrations')
        .select('player_id')
        .eq('session_id', sessionId)

      if (regsError) {
        toast.error(regsError.message)
        setIsLoading(false)
        return
      }

      const playerIds = (regs ?? []).map((r) => (r as { player_id: string }).player_id)

      if (playerIds.length === 0) {
        setPlayers([])
        setIsLoading(false)
        return
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name_slug')
        .in('id', playerIds)

      if (profilesError) {
        toast.error(profilesError.message)
        setIsLoading(false)
        return
      }

      const result = (profiles ?? []).map((p) => {
        const profile = p as { id: string; name_slug: string }
        return { id: profile.id, nameSlug: profile.name_slug }
      })

      setPlayers(result)
      setIsLoading(false)
    }

    fetch()
  }, [sessionId])

  return { players, isLoading }
}
```

---

### Task 5: `src/components/MatchGeneratorPanel.tsx`

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRegisteredPlayers } from '@/hooks/useRegisteredPlayers'
import { generateSchedule, type GeneratedMatch } from '@/lib/matchGenerator'

interface Props {
  sessionId: string
}

export function MatchGeneratorPanel({ sessionId }: Props) {
  const { players, isLoading } = useRegisteredPlayers(sessionId)
  const [stage, setStage] = useState<'idle' | 'preview'>('idle')
  const [matches, setMatches] = useState<GeneratedMatch[]>([])

  function handleGenerate() {
    const schedule = generateSchedule(players.map((p) => p.id))
    setMatches(schedule)
    setStage('preview')
  }

  // Resolve player ID to name slug for display
  const nameMap = new Map(players.map((p) => [p.id, p.nameSlug]))
  function name(id: string) {
    return nameMap.get(id) ?? id
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading players…</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{players.length} players registered</p>

        {stage === 'idle' ? (
          <Button
            onClick={handleGenerate}
            disabled={players.length < 4}
            className="w-full"
          >
            Generate Schedule
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={handleGenerate} className="w-full">
              Generate Again
            </Button>
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {matches.map((m) => (
                <li key={m.gameNumber} className="text-sm py-1 border-b last:border-0">
                  <span className="font-medium text-muted-foreground mr-2">{m.gameNumber}.</span>
                  {name(m.team1Player1)} &amp; {name(m.team1Player2)}
                  <span className="text-muted-foreground mx-2">vs</span>
                  {name(m.team2Player1)} &amp; {name(m.team2Player2)}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

---

### Task 6: `AdminView.tsx` update

Add import:
```tsx
import { MatchGeneratorPanel } from '@/components/MatchGeneratorPanel'
```

Add branch in the JSX (after the `registration_closed` fallback card):

```tsx
) : session.status === 'registration_closed' ? (
  <MatchGeneratorPanel sessionId={session.id} />
```

Place this branch BEFORE the generic fallback `<Card>` (the one that just shows name + date + status). The updated status ladder:
1. `!session` → form
2. `setup` → session card + Open Registration
3. `registration_open && invitation` → RegistrationURLCard + RosterPanel + Close button
4. `registration_closed` → MatchGeneratorPanel  ← new
5. fallback → session card (read-only)

---

### Architecture Compliance

- **`matchGenerator.ts` is a pure function in `src/lib/`** — no Supabase, no React, no side effects; matches the architecture spec
- **Hooks own all Supabase queries** — `useRegisteredPlayers` fetches data; `MatchGeneratorPanel` stays presentational
- **Two-query pattern for roster** — same as `useRoster`: `session_registrations` + `profiles` merged client-side (FK to auth.users prevents PostgREST join)
- **Preview only — no DB writes in this story** — save/lock is Story 3-2
- **`matches` table created in this story** — needed for Story 3-2 to insert into; create now so the type system is ready

### Previous Story Learnings

- **GRANT required separately from RLS** — include in every migration (anon + authenticated SELECT, authenticated INSERT/UPDATE/DELETE)
- **Supabase CLI blocked on Windows** — use Dashboard SQL Editor
- **Pre-populate `database.ts`** with table types — cast with `as Type | null`
- **Authenticated users need their own SELECT policy** — don't rely on `TO anon` for users who may be signed in (lesson from Story 2.3)
- **Two-query pattern** — `player_id` FK references `auth.users` not `public.profiles`; must do two queries and merge client-side

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `supabase/migrations/005_create_matches.sql` created — match_status enum, matches table, RLS (admin all + read all), grants; run manually in Supabase Dashboard
- `src/types/database.ts` updated — added `matches` table types (Row/Insert/Update) and `match_status` enum
- `src/lib/matchGenerator.ts` created — pure greedy rotation algorithm; `ceil(n*8/4)` total matches; deterministic, no side effects
- `src/hooks/useRegisteredPlayers.ts` created — two-query pattern (session_registrations + profiles), returns `{ players, isLoading }`
- `src/components/MatchGeneratorPanel.tsx` created — idle/preview state machine, Generate + Generate Again buttons, scrollable match list with name_slug display
- `src/views/AdminView.tsx` updated — `registration_closed` branch added showing MatchGeneratorPanel
- `npm run build` and `npm run lint` pass clean

### File List

- `badminton-v2/supabase/migrations/005_create_matches.sql` (new)
- `badminton-v2/src/types/database.ts` (updated — matches table + match_status enum)
- `badminton-v2/src/lib/matchGenerator.ts` (new)
- `badminton-v2/src/hooks/useRegisteredPlayers.ts` (new)
- `badminton-v2/src/components/MatchGeneratorPanel.tsx` (new)
- `badminton-v2/src/views/AdminView.tsx` (updated — registration_closed branch)
