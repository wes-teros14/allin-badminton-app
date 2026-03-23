---
title: 'Cheers System'
slug: 'cheers-system'
created: '2026-03-23'
status: 'Implementation Complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React', 'TypeScript', 'React Router v7', 'Tailwind CSS v4', 'Supabase', 'shadcn/ui']
files_to_modify:
  - badminton-v2/supabase/migrations/021_add_sessions_completed_at.sql (new)
  - badminton-v2/supabase/migrations/022_create_cheer_system.sql (new)
  - badminton-v2/src/types/database.ts
  - badminton-v2/src/types/app.ts
  - badminton-v2/src/hooks/useSessionCheers.ts (new)
  - badminton-v2/src/components/CheersPanel.tsx (new)
  - badminton-v2/src/views/SessionPlayerDetailView.tsx
  - badminton-v2/src/views/ProfileView.tsx
  - badminton-v2/src/views/LeaderboardView.tsx
code_patterns: []
test_patterns: []
---

# Tech-Spec: Cheers System

**Created:** 2026-03-23

## Overview

### Problem Statement

Players have no way to recognise each other's contributions after a session. There is no social recognition layer in the app — only win/loss stats, which don't capture good sportsmanship, technique, or energy.

### Solution

Add a peer-to-peer Cheers system. After a session ends, players have 24 hours to give one cheer to each fellow session participant. Cheers are predefined types (Offense, Defense, Technique, Movement, Good Sport). Cumulative all-time cheer counts surface on player profiles and a new Cheers leaderboard.

### Scope

**In Scope:**
- 5 predefined cheer types seeded in DB
- Players can give 1 cheer per fellow session participant (within 24hrs of session completing)
- Cheers UI tab in `SessionPlayerDetailView` (alongside Schedule + Leaderboard tabs)
- `player_cheer_stats` aggregation table updated by DB trigger
- Cheers section on `ProfileView` (cheers received, breakdown by type)
- Cheers tab on `LeaderboardView` (most cheers given, most received, most per type)

**Out of Scope:**
- Push notifications for received cheers
- Editing or revoking a cheer after submission
- Custom/admin-created cheer types
- Cheer history feed

---

## Context for Development

### Codebase Patterns

- **Migrations**: Sequential numbered SQL files in `badminton-v2/supabase/migrations/`. Next available: `021`, `022`.
- **RLS pattern**: Reads via policies; writes via `SECURITY DEFINER` triggers (see `013_player_stats_tables.sql`). Stat tables are insert-protected — only triggers write to them.
- **Aggregation tables**: App uses `player_stats` / `player_pair_stats` as denormalised counters, updated by triggers on source table inserts. Follow same pattern for `player_cheer_stats`.
- **Custom hooks**: Each data concern has its own hook in `src/hooks/`. Hook queries Supabase directly. No Redux or global store — local state via `useState`/`useCallback`.
- **Tab pattern**: `SessionPlayerDetailView` uses a `type Tab = 'schedule' | 'leaderboard'` union + `useState<Tab>` for tab switching. Extend this for 'cheers'.
- **Supabase client**: Imported from `@/lib/supabase`.
- **Types**: `src/types/database.ts` is auto-generated (hand-edit carefully, note the comment). `src/types/app.ts` is hand-written domain types.
- **UI**: shadcn/ui `Card`/`CardContent` for stat cards. Tailwind CSS v4. No external icon lib — use emoji.
- **Toast**: `sonner` via `toast.success()` / `toast.error()`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `badminton-v2/supabase/migrations/013_player_stats_tables.sql` | Pattern for aggregation tables + SECURITY DEFINER triggers + RLS |
| `badminton-v2/src/views/SessionPlayerDetailView.tsx` | Where Cheers tab is added; existing Tab pattern to follow |
| `badminton-v2/src/views/ProfileView.tsx` | Where cheers received section is added |
| `badminton-v2/src/views/LeaderboardView.tsx` | Where Cheers tab is added |
| `badminton-v2/src/types/database.ts` | Must be updated with new table types |
| `badminton-v2/src/hooks/useProfileStats.ts` | Pattern for profile data hooks |

### Technical Decisions

1. **`sessions.completed_at`**: Add a `TIMESTAMPTZ` column via migration 021. A trigger fires on `sessions` UPDATE when `status` changes to `'complete'` and sets `completed_at = now()`. The 24-hour cheer window is enforced as `completed_at + interval '24 hours' > now()`.

2. **Cheer window enforcement**: RLS INSERT policy on `cheers` checks: (a) `giver_id = auth.uid()`, (b) session is `complete`, (c) `completed_at + 24h > now()`, (d) receiver is a session participant, (e) giver is a session participant. The UNIQUE constraint `(session_id, giver_id, receiver_id)` enforces one-cheer-per-pair-per-session at DB level.

3. **`player_cheer_stats` columns**: Fixed columns for each cheer type (not dynamic). Cheer types are fixed/predefined so this is safe. Columns: `cheers_received`, `cheers_given`, `offense_received`, `defense_received`, `technique_received`, `movement_received`, `good_sport_received`.

4. **Cheer types identified by `slug`**: `cheer_types` table has a `slug` TEXT column (`offense`, `defense`, `technique`, `movement`, `good_sport`) used as the FK reference in trigger logic for updating the right column in `player_cheer_stats`.

5. **Cheers UI location**: A third tab `'cheers'` added to `SessionPlayerDetailView`. Only shown when session status is `'complete'`. When window is open: shows fellow participants + cheer picker. When window closed or already cheered everyone: shows summary of cheers given/received for that session.

---

## Implementation Plan

### Tasks

Execute in this exact order (each task depends on the previous):

#### Task 1 — Migration 021: Add `completed_at` to sessions

**File:** `badminton-v2/supabase/migrations/021_add_sessions_completed_at.sql` (new)

```sql
-- Add completed_at to sessions; auto-set by trigger when status → 'complete'

ALTER TABLE public.sessions
  ADD COLUMN completed_at TIMESTAMPTZ;

-- Trigger function
CREATE OR REPLACE FUNCTION public.set_session_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS DISTINCT FROM 'complete') THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_session_complete
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_session_completed_at();

-- Backfill existing completed sessions (use date as approximation)
UPDATE public.sessions
SET completed_at = (date || ' 23:59:00')::timestamptz
WHERE status = 'complete' AND completed_at IS NULL;
```

---

#### Task 2 — Migration 022: Create Cheer System tables

**File:** `badminton-v2/supabase/migrations/022_create_cheer_system.sql` (new)

```sql
-- =============================================================
-- Migration: 022_create_cheer_system
-- Creates cheer_types (seeded), cheers, player_cheer_stats tables
-- with RLS and aggregation trigger.
-- =============================================================

-- ---------------------------------------------------------------------------
-- cheer_types: predefined catalog
-- ---------------------------------------------------------------------------
CREATE TABLE public.cheer_types (
  id         UUID    NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  emoji      TEXT    NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.cheer_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cheer_types: read all authenticated"
  ON public.cheer_types FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.cheer_types TO authenticated;

-- Seed cheer types
INSERT INTO public.cheer_types (slug, name, emoji) VALUES
  ('offense',    'Offense',    '⚔️'),
  ('defense',    'Defense',    '🛡️'),
  ('technique',  'Technique',  '🎯'),
  ('movement',   'Movement',   '💨'),
  ('good_sport', 'Good Sport', '🤝');

-- ---------------------------------------------------------------------------
-- cheers: peer-to-peer awards
-- ---------------------------------------------------------------------------
CREATE TABLE public.cheers (
  id             UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  giver_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cheer_type_id  UUID        NOT NULL REFERENCES public.cheer_types(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, giver_id, receiver_id),
  CHECK (giver_id <> receiver_id)
);

ALTER TABLE public.cheers ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (needed for session cheer summaries)
CREATE POLICY "cheers: read all authenticated"
  ON public.cheers FOR SELECT
  TO authenticated
  USING (true);

-- Insert: giver must be auth.uid(), session must be complete + within 24hr window,
-- both giver and receiver must be session participants
CREATE POLICY "cheers: insert own"
  ON public.cheers FOR INSERT
  TO authenticated
  WITH CHECK (
    giver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id
        AND s.status = 'complete'
        AND s.completed_at IS NOT NULL
        AND s.completed_at + interval '24 hours' > now()
    )
    AND EXISTS (
      SELECT 1 FROM public.session_registrations
      WHERE session_id = cheers.session_id AND player_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.session_registrations
      WHERE session_id = cheers.session_id AND player_id = receiver_id
    )
  );

GRANT SELECT, INSERT ON public.cheers TO authenticated;

-- ---------------------------------------------------------------------------
-- player_cheer_stats: aggregated all-time counts
-- ---------------------------------------------------------------------------
CREATE TABLE public.player_cheer_stats (
  player_id           UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cheers_received     INT  NOT NULL DEFAULT 0,
  cheers_given        INT  NOT NULL DEFAULT 0,
  offense_received    INT  NOT NULL DEFAULT 0,
  defense_received    INT  NOT NULL DEFAULT 0,
  technique_received  INT  NOT NULL DEFAULT 0,
  movement_received   INT  NOT NULL DEFAULT 0,
  good_sport_received INT  NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_cheer_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_cheer_stats: read all authenticated"
  ON public.player_cheer_stats FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.player_cheer_stats TO authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: update player_cheer_stats on cheer INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_cheer_stats_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
BEGIN
  SELECT slug INTO v_slug FROM public.cheer_types WHERE id = NEW.cheer_type_id;

  -- Update giver's given count
  INSERT INTO public.player_cheer_stats (player_id, cheers_given)
  VALUES (NEW.giver_id, 1)
  ON CONFLICT (player_id) DO UPDATE SET
    cheers_given = player_cheer_stats.cheers_given + 1,
    updated_at   = now();

  -- Update receiver's received count + type-specific column
  INSERT INTO public.player_cheer_stats (
    player_id, cheers_received,
    offense_received, defense_received, technique_received,
    movement_received, good_sport_received
  )
  VALUES (
    NEW.receiver_id, 1,
    CASE WHEN v_slug = 'offense'    THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'defense'    THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'technique'  THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'movement'   THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'good_sport' THEN 1 ELSE 0 END
  )
  ON CONFLICT (player_id) DO UPDATE SET
    cheers_received     = player_cheer_stats.cheers_received + 1,
    offense_received    = player_cheer_stats.offense_received    + EXCLUDED.offense_received,
    defense_received    = player_cheer_stats.defense_received    + EXCLUDED.defense_received,
    technique_received  = player_cheer_stats.technique_received  + EXCLUDED.technique_received,
    movement_received   = player_cheer_stats.movement_received   + EXCLUDED.movement_received,
    good_sport_received = player_cheer_stats.good_sport_received + EXCLUDED.good_sport_received,
    updated_at          = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_cheer_insert
  AFTER INSERT ON public.cheers
  FOR EACH ROW EXECUTE FUNCTION public.update_cheer_stats_on_insert();
```

---

#### Task 3 — Update `src/types/database.ts`

Add the three new tables to the `Database` type. Append inside `Tables: { ... }`:

```typescript
cheer_types: {
  Row: {
    id: string
    slug: string
    name: string
    emoji: string
    is_active: boolean
  }
  Insert: {
    id?: string
    slug: string
    name: string
    emoji: string
    is_active?: boolean
  }
  Update: {
    id?: string
    slug?: string
    name?: string
    emoji?: string
    is_active?: boolean
  }
  Relationships: []
}
cheers: {
  Row: {
    id: string
    session_id: string
    giver_id: string
    receiver_id: string
    cheer_type_id: string
    created_at: string
  }
  Insert: {
    id?: string
    session_id: string
    giver_id: string
    receiver_id: string
    cheer_type_id: string
    created_at?: string
  }
  Update: {
    id?: string
    session_id?: string
    giver_id?: string
    receiver_id?: string
    cheer_type_id?: string
    created_at?: string
  }
  Relationships: []
}
player_cheer_stats: {
  Row: {
    player_id: string
    cheers_received: number
    cheers_given: number
    offense_received: number
    defense_received: number
    technique_received: number
    movement_received: number
    good_sport_received: number
    updated_at: string
  }
  Insert: {
    player_id: string
    cheers_received?: number
    cheers_given?: number
    offense_received?: number
    defense_received?: number
    technique_received?: number
    movement_received?: number
    good_sport_received?: number
    updated_at?: string
  }
  Update: {
    player_id?: string
    cheers_received?: number
    cheers_given?: number
    offense_received?: number
    defense_received?: number
    technique_received?: number
    movement_received?: number
    good_sport_received?: number
    updated_at?: string
  }
  Relationships: []
}
```

Also add `completed_at` to the `sessions` table Row/Insert/Update:
```typescript
// In sessions.Row, sessions.Insert, sessions.Update — add:
completed_at: string | null   // Row and Update
completed_at?: string | null  // Insert
```

---

#### Task 4 — Update `src/types/app.ts`

Add cheer domain types:

```typescript
export type CheerTypeSlug = 'offense' | 'defense' | 'technique' | 'movement' | 'good_sport'

export interface CheerType {
  id: string
  slug: CheerTypeSlug
  name: string
  emoji: string
}

export interface CheerEntry {
  id: string
  giverId: string
  receiverId: string
  cheerTypeId: string
  cheerTypeSlug: CheerTypeSlug
  cheerTypeName: string
  cheerTypeEmoji: string
  createdAt: string
}
```

---

#### Task 5 — Create `src/hooks/useSessionCheers.ts`

New hook. Responsibilities:
- Fetch all cheer types (`cheer_types` table, `is_active = true`)
- Fetch session participants (from `session_registrations` + `profiles` for display names)
- Fetch cheers already given by current user in this session (from `cheers` where `giver_id = user.id`)
- Fetch cheers received by current user in this session
- Expose `submitCheer(receiverId: string, cheerTypeId: string): Promise<void>`
- Expose `isWindowOpen: boolean` (computed from `session.completed_at + 24h > now()`)
- Expose `sessionStatus: string`

```typescript
// src/hooks/useSessionCheers.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CheerType, CheerEntry } from '@/types/app'

interface SessionParticipant {
  playerId: string
  displayName: string
}

interface UseSessionCheersResult {
  cheerTypes: CheerType[]
  participants: SessionParticipant[]          // fellow participants (excludes self)
  cheersGiven: CheerEntry[]                   // cheers I gave this session
  cheersReceived: CheerEntry[]                // cheers I received this session
  isWindowOpen: boolean
  sessionStatus: string | null
  isLoading: boolean
  submitCheer: (receiverId: string, cheerTypeId: string) => Promise<void>
  refresh: () => void
}

export function useSessionCheers(sessionId: string | undefined): UseSessionCheersResult {
  const { user } = useAuth()
  const [cheerTypes, setCheerTypes] = useState<CheerType[]>([])
  const [participants, setParticipants] = useState<SessionParticipant[]>([])
  const [cheersGiven, setCheersGiven] = useState<CheerEntry[]>([])
  const [cheersReceived, setCheersReceived] = useState<CheerEntry[]>([])
  const [isWindowOpen, setIsWindowOpen] = useState(false)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!sessionId || !user) { setIsLoading(false); return }
    setIsLoading(true)
    try {
      // Fetch cheer types, session info, registrations, cheers in parallel
      const [typesRes, sessionRes, regsRes, givenRes, receivedRes] = await Promise.all([
        supabase.from('cheer_types').select('id, slug, name, emoji').eq('is_active', true),
        supabase.from('sessions').select('status, completed_at').eq('id', sessionId).maybeSingle(),
        supabase.from('session_registrations').select('player_id').eq('session_id', sessionId),
        supabase.from('cheers')
          .select('id, receiver_id, cheer_type_id, created_at, cheer_types(slug, name, emoji)')
          .eq('session_id', sessionId)
          .eq('giver_id', user.id),
        supabase.from('cheers')
          .select('id, giver_id, cheer_type_id, created_at, cheer_types(slug, name, emoji)')
          .eq('session_id', sessionId)
          .eq('receiver_id', user.id),
      ])

      // Cheer types
      const types = (typesRes.data ?? []) as CheerType[]
      setCheerTypes(types)

      // Session window
      const session = sessionRes.data as { status: string; completed_at: string | null } | null
      setSessionStatus(session?.status ?? null)
      if (session?.completed_at) {
        const windowClose = new Date(session.completed_at).getTime() + 24 * 60 * 60 * 1000
        setIsWindowOpen(Date.now() < windowClose)
      } else {
        setIsWindowOpen(false)
      }

      // Participants (exclude self)
      const playerIds = ((regsRes.data ?? []) as Array<{ player_id: string }>)
        .map(r => r.player_id)
        .filter(id => id !== user.id)

      if (playerIds.length > 0) {
        const profilesRes = await supabase
          .from('profiles')
          .select('id, nickname, name_slug')
          .in('id', playerIds)
        const profiles = (profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>
        setParticipants(profiles.map(p => ({
          playerId: p.id,
          displayName: p.nickname ?? p.name_slug,
        })))
      } else {
        setParticipants([])
      }

      // Cheers given
      const typeMap = new Map(types.map(t => [t.id, t]))
      setCheersGiven(
        ((givenRes.data ?? []) as any[]).map(c => ({
          id: c.id,
          giverId: user.id,
          receiverId: c.receiver_id,
          cheerTypeId: c.cheer_type_id,
          cheerTypeSlug: c.cheer_types?.slug ?? '',
          cheerTypeName: c.cheer_types?.name ?? '',
          cheerTypeEmoji: c.cheer_types?.emoji ?? '',
          createdAt: c.created_at,
        }))
      )

      // Cheers received
      setCheersReceived(
        ((receivedRes.data ?? []) as any[]).map(c => ({
          id: c.id,
          giverId: c.giver_id,
          receiverId: user.id,
          cheerTypeId: c.cheer_type_id,
          cheerTypeSlug: c.cheer_types?.slug ?? '',
          cheerTypeName: c.cheer_types?.name ?? '',
          cheerTypeEmoji: c.cheer_types?.emoji ?? '',
          createdAt: c.created_at,
        }))
      )
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, user])

  useEffect(() => { load() }, [load])

  const submitCheer = useCallback(async (receiverId: string, cheerTypeId: string) => {
    if (!sessionId || !user) return
    const { error } = await supabase.from('cheers').insert({
      session_id: sessionId,
      giver_id: user.id,
      receiver_id: receiverId,
      cheer_type_id: cheerTypeId,
    })
    if (error) throw error
    await load()
  }, [sessionId, user, load])

  return { cheerTypes, participants, cheersGiven, cheersReceived, isWindowOpen, sessionStatus, isLoading, submitCheer, refresh: load }
}
```

---

#### Task 6 — Create `src/components/CheersPanel.tsx`

New component. Displayed inside the 'cheers' tab of `SessionPlayerDetailView`.

UI behaviour:
- If `isLoading`: show skeleton (3 rows of `h-14 bg-muted rounded-xl animate-pulse`)
- If session not complete: show "Cheers open after the session ends." message
- If window closed: show "Cheer window has closed." + summary of cheers received this session
- If window open:
  - For each participant: show their display name + a row of 5 cheer type buttons (emoji + name)
  - If already cheered this participant (found in `cheersGiven` by `receiverId`): show the given cheer as a static badge, no buttons
  - On cheer button tap: call `submitCheer`, show toast.success('Cheer sent! 🎉'), optimistically disable
- Bottom section: "Cheers you received" — list of received cheers with emoji + type name + "from [giver display name]" (giver display name resolved from `participants` list or fallback to 'A teammate')

```tsx
// src/components/CheersPanel.tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { CheerType, CheerEntry } from '@/types/app'

interface SessionParticipant {
  playerId: string
  displayName: string
}

interface CheersPanelProps {
  cheerTypes: CheerType[]
  participants: SessionParticipant[]
  cheersGiven: CheerEntry[]
  cheersReceived: CheerEntry[]
  isWindowOpen: boolean
  sessionStatus: string | null
  isLoading: boolean
  submitCheer: (receiverId: string, cheerTypeId: string) => Promise<void>
}

export function CheersPanel({
  cheerTypes, participants, cheersGiven, cheersReceived,
  isWindowOpen, sessionStatus, isLoading, submitCheer,
}: CheersPanelProps) {
  const [submitting, setSubmitting] = useState<string | null>(null) // receiverId being submitted

  const givenMap = new Map(cheersGiven.map(c => [c.receiverId, c]))

  async function handleCheer(receiverId: string, cheerTypeId: string) {
    setSubmitting(receiverId)
    try {
      await submitCheer(receiverId, cheerTypeId)
      toast.success('Cheer sent! 🎉')
    } catch {
      toast.error('Could not send cheer. Try again.')
    } finally {
      setSubmitting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (sessionStatus !== 'complete') {
    return (
      <div className="max-w-sm mx-auto px-4 pt-10 text-center text-muted-foreground text-sm">
        Cheers open after the session ends.
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-10 space-y-6">
      {/* Give cheers section */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          {isWindowOpen ? 'Give a Cheer' : 'Cheers Window Closed'}
        </h2>

        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other players in this session.</p>
        ) : (
          <div className="space-y-3">
            {participants.map((p) => {
              const given = givenMap.get(p.playerId)
              return (
                <div key={p.playerId} className="bg-card border border-border rounded-xl px-4 py-3 space-y-2">
                  <p className="font-medium text-sm">{p.displayName}</p>
                  {given ? (
                    <span className="inline-flex items-center gap-1 text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                      {given.cheerTypeEmoji} {given.cheerTypeName}
                    </span>
                  ) : isWindowOpen ? (
                    <div className="flex flex-wrap gap-2">
                      {cheerTypes.map((ct) => (
                        <button
                          key={ct.id}
                          disabled={submitting === p.playerId}
                          onClick={() => handleCheer(p.playerId, ct.id)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          {ct.emoji} {ct.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Window closed</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cheers received section */}
      {cheersReceived.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Cheers You Received
          </h2>
          <div className="space-y-2">
            {cheersReceived.map((c) => {
              const giver = participants.find(p => p.playerId === c.giverId)
              return (
                <div key={c.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                  <span className="text-xl">{c.cheerTypeEmoji}</span>
                  <div>
                    <p className="font-medium text-sm">{c.cheerTypeName}</p>
                    <p className="text-xs text-muted-foreground">from {giver?.displayName ?? 'A teammate'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

#### Task 7 — Update `src/views/SessionPlayerDetailView.tsx`

Add 'cheers' as a third tab. Changes:

1. Update `type Tab = 'schedule' | 'leaderboard' | 'cheers'`
2. Import `useSessionCheers` hook and `CheersPanel` component
3. Call `useSessionCheers(sessionId)` at the top of `SessionPlayerDetailView`
4. Add 'cheers' button to the tab bar (label: 'Cheers')
5. Add conditional render for `tab === 'cheers'`:
   ```tsx
   {tab === 'cheers' && sessionId && (
     <CheersPanel
       cheerTypes={cheerTypes}
       participants={participants}
       cheersGiven={cheersGiven}
       cheersReceived={cheersReceived}
       isWindowOpen={isWindowOpen}
       sessionStatus={sessionStatus}
       isLoading={cheerLoading}
       submitCheer={submitCheer}
     />
   )}
   ```

The `useSessionCheers` call:
```tsx
const {
  cheerTypes, participants, cheersGiven, cheersReceived,
  isWindowOpen, sessionStatus, isLoading: cheerLoading, submitCheer,
} = useSessionCheers(sessionId)
```

Tab label mapping in the loop:
```tsx
const TAB_LABELS: Record<Tab, string> = {
  schedule: 'My Schedule',
  leaderboard: 'Leaderboard',
  cheers: 'Cheers',
}
// Replace the inline ternary with: TAB_LABELS[t]
```

---

#### Task 8 — Update `src/views/ProfileView.tsx`

Add a "Cheers" section below the Stats section. Fetch from `player_cheer_stats` for the current user.

Add inside `ProfileView`, after the stats `</div>` closing tag:

1. Add a `cheerStats` state: fetch `player_cheer_stats` for `user.id` after component mounts (similar to how stats are fetched via hook).
2. Display a new section:

```tsx
{/* Cheers */}
{cheerStats && (
  <div>
    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Cheers</h2>
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Received" value={String(cheerStats.cheers_received)} />
      <StatCard label="Given" value={String(cheerStats.cheers_given)} />
      {/* Type breakdown — only show types with count > 0 */}
      {[
        { label: '⚔️ Offense',    val: cheerStats.offense_received },
        { label: '🛡️ Defense',    val: cheerStats.defense_received },
        { label: '🎯 Technique',  val: cheerStats.technique_received },
        { label: '💨 Movement',   val: cheerStats.movement_received },
        { label: '🤝 Good Sport', val: cheerStats.good_sport_received },
      ]
        .filter(t => t.val > 0)
        .map(t => (
          <StatCard key={t.label} label={t.label} value={String(t.val)} />
        ))
      }
    </div>
  </div>
)}
```

Fetch pattern (inline, mirroring existing nickname fetch):
```tsx
const [cheerStats, setCheerStats] = useState<{
  cheers_received: number; cheers_given: number;
  offense_received: number; defense_received: number;
  technique_received: number; movement_received: number; good_sport_received: number;
} | null>(null)

useEffect(() => {
  if (!user?.id) return
  supabase.from('player_cheer_stats').select('*').eq('player_id', user.id).maybeSingle()
    .then(({ data }) => { if (data) setCheerStats(data as any) })
}, [user?.id])
```

---

#### Task 9 — Update `src/views/LeaderboardView.tsx`

Add a Cheers tab alongside the existing all-time win-rate leaderboard.

1. Add `type LeaderboardTab = 'wins' | 'cheers'` and `useState<LeaderboardTab>('wins')`
2. Add tab switcher UI (same pill button pattern as SessionPlayerDetailView)
3. Create `fetchCheerLeaderboard()` async function:

```typescript
async function fetchCheerLeaderboard() {
  const [statsRes, profilesRes] = await Promise.all([
    supabase.from('player_cheer_stats').select('*').gt('cheers_received', 0),
    supabase.from('profiles').select('id, nickname, name_slug'),
  ])
  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map(p => [p.id, p.nickname ?? p.name_slug])
  )
  return ((statsRes.data ?? []) as any[]).map(s => ({
    ...s,
    displayName: nameMap.get(s.player_id) ?? s.player_id,
  }))
}
```

4. Render cheer leaderboard when tab === 'cheers':
   - Section: "Most Cheers Received" — sorted by `cheers_received` desc, top 10
   - Section: "Most Cheers Given" — sorted by `cheers_given` desc, top 10
   - Section per type (Offense, Defense, Technique, Movement, Good Sport) — sorted by respective column desc, top 3

Each entry row: same style as existing leaderboard rows (`bg-card border border-border rounded-xl px-4 py-3`).

---

### Acceptance Criteria

**AC-1: Cheer window enforcement**
- Given a session with `status = 'complete'` and `completed_at` set
- When `completed_at + 24 hours > now()`
- Then the cheers tab shows the cheer picker for all session participants

**AC-2: One cheer per participant**
- Given a player gives a cheer to participant A
- When they view the cheers tab again
- Then participant A shows the given cheer as a static badge (no cheer buttons)

**AC-3: Only session participants can give/receive**
- Given a player is not registered in the session
- When they attempt to insert a cheer via the API
- Then the RLS policy rejects the insert with a permissions error

**AC-4: Window closed**
- Given `completed_at + 24 hours <= now()`
- When a player views the cheers tab
- Then "Cheer window has closed." is shown and no cheer buttons are visible

**AC-5: Cheers received section**
- Given player B gave player A an "Offense" cheer in a session
- When player A views the session's cheers tab
- Then "⚔️ Offense — from [B's display name]" appears in the "Cheers You Received" section

**AC-6: Profile stats update**
- Given a cheer is submitted
- When player views their profile
- Then `cheers_received` count increments and the correct type column (e.g. `offense_received`) increments

**AC-7: Leaderboard — Cheers tab**
- Given players have cheers recorded
- When a player opens the Leaderboard view and taps "Cheers"
- Then ranked lists for Most Received, Most Given, and per-type appear

**AC-8: Self-cheer prevention**
- Given a player views the cheers tab
- When they see the participants list
- Then they do not see themselves listed (self excluded from `participants`)

---

## Additional Context

### Dependencies

- Migration 021 must be applied before 022 (022 references `sessions.completed_at`)
- Both migrations must be applied before any frontend code is deployed

### Testing Strategy

- Manual: After applying migrations locally via Supabase CLI, create a test session, mark it complete, verify `completed_at` is set, then submit cheers via the UI and verify `player_cheer_stats` is updated.
- Check RLS: Attempt to insert a cheer as a non-participant (should fail with 403/RLS error).
- Check uniqueness: Attempt to give two cheers to the same person in the same session (should fail with unique violation).

### Notes

- The `completed_at` backfill in migration 021 uses `(date || ' 23:59:00')::timestamptz` as a reasonable approximation for existing completed sessions.
- `cheer_types` are read publicly (all authenticated users) since they are a static catalog.
- `player_cheer_stats` is readable by all authenticated users to support leaderboard queries.
- If a session's `completed_at` is null (e.g. old sessions before migration), the cheer window will be treated as closed (`isWindowOpen = false`).
