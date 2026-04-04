---
title: 'Match-Scoped Cheers System Redesign'
slug: 'match-scoped-cheers'
created: '2026-04-01'
status: 'in-progress'
stepsCompleted: [1, 2, 3]
tech_stack: ['React', 'TypeScript', 'Supabase', 'Tailwind CSS v4']
files_to_modify:
  - badminton-v2/supabase/migrations/036_match_scoped_cheers.sql
  - badminton-v2/src/types/database.ts
  - badminton-v2/src/types/app.ts
  - badminton-v2/src/hooks/useMatchCheers.ts (new, replaces useSessionCheers)
  - badminton-v2/src/components/CheersPanel.tsx
  - badminton-v2/src/views/SessionPlayerDetailView.tsx
  - badminton-v2/src/views/MySessionsView.tsx
  - badminton-v2/src/hooks/usePlayerSessions.ts
  - badminton-v2/src/contexts/NotificationContext.tsx
code_patterns: []
test_patterns: []
---

# Tech-Spec: Match-Scoped Cheers System Redesign

**Created:** 2026-04-01

## Overview

### Problem Statement

The current cheers system is session-scoped: players can only give cheers after an admin closes the entire session, within a 24-hour window. This disconnects the cheer from the emotional moment — a player finishes a match and can't give kudos until hours later. Additionally, the 24-hour timer creates friction before sessions can be fully closed out.

### Solution

Redesign cheers to be match-scoped. When a match completes (via kiosk or admin), the 4 players in that match must give 3 cheers each (to the other 3 players) before they can view the Schedule tab. The cheers gate appears inline in the Schedule tab area, blocking schedule visibility until cheers are given. Reuse existing cheer categories and card UI. Remove all session-end cheers infrastructure (24hr wait, post-session prompt, summary screen, cheers tab highlighting).

### Scope

**In Scope:**
- Add `match_id` column to `cheers` table; drop `session_id` dependency
- New unique constraint: `(match_id, giver_id, receiver_id)`
- Cheers gate: block Schedule tab content until pending cheers are given
- New `useMatchCheers` hook replacing `useSessionCheers`
- Remove: 24hr window logic, post-session cheers prompt, cheers summary screen, cheers tab/button highlighting, `Cheers` tab entirely
- Remove multiplier concept (each match = exactly 1 cheer per co-player)
- Update RLS policies for match-scoped cheers
- Update cheer stats trigger (no multiplier, just +1 per cheer)

**Out of Scope:**
- Changing cheer types/categories
- Changing `player_cheer_stats` table structure
- Changing Profile/Leaderboard cheer stats display
- Changing notification system for cheer receipts
- Awards system changes

## Context for Development

### Codebase Patterns

- Supabase client at `src/lib/supabase.ts`, typed via `src/types/database.ts`
- Hooks pattern: custom hooks in `src/hooks/` return data + loading + actions
- Real-time: `supabase.channel().on('postgres_changes', ...).subscribe()`
- Match status FSM: `queued` → `playing` → `complete`
- Match completion via `useAdminActions.markDone()` at `src/hooks/useAdminActions.ts:89`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/views/SessionPlayerDetailView.tsx` | Main view with tabs — Schedule, Leaderboard, (currently Cheers). Gate goes here. |
| `src/components/CheersPanel.tsx` | Existing cheer card UI — reuse for match cheers, simplify. |
| `src/hooks/useSessionCheers.ts` | Current session-scoped hook — replace with `useMatchCheers`. |
| `src/hooks/useAdminActions.ts` | `markDone()` function that completes matches (line 89). |
| `src/views/MySessionsView.tsx` | Shows "Give Cheers" badge — remove cheer-related badges. |
| `src/hooks/usePlayerSessions.ts` | 24hr window logic (lines 76-80) — remove. |
| `src/hooks/usePlayerSchedule.ts` | Player's match list — used to detect completed matches for gate. |
| `supabase/migrations/022_create_cheer_system.sql` | Original cheers schema — reference for understanding. |
| `supabase/migrations/024_cheers_multiplier.sql` | Multiplier logic — being removed. |
| `supabase/migrations/027_revert_cheers_given_count.sql` | Current trigger — being replaced. |
| `supabase/migrations/031_add_solid_effort_cheer.sql` | Added solid_effort — keep the type, update trigger. |

### Technical Decisions

1. **Drop multiplier:** Each match produces exactly 1 cheer per co-player. No multiplier needed — the frequency of games naturally weights the stats (more games together = more cheers exchanged).
2. **Gate in Schedule tab area, not a separate tab:** Remove the `Cheers` tab entirely. Cheers cards appear inside the Schedule tab area, blocking schedule view until given.
3. **Keep `session_id` on cheers table** as nullable for backwards compat with existing data, but new cheers use `match_id`.
4. **Per-match gate check:** Query "does this player have any completed match (in this session) where they haven't given all 3 cheers?" If yes, show the oldest ungated match's cheers first.

## Implementation Plan

### Task 1: Database Migration (036_match_scoped_cheers.sql)

**File:** `badminton-v2/supabase/migrations/036_match_scoped_cheers.sql`

```sql
-- 1. Add match_id column to cheers
ALTER TABLE public.cheers ADD COLUMN match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE;

-- 2. Drop old unique constraint (session_id, giver_id, receiver_id)
ALTER TABLE public.cheers DROP CONSTRAINT IF EXISTS cheers_session_id_giver_id_receiver_id_key;

-- 3. Add new unique constraint
ALTER TABLE public.cheers ADD CONSTRAINT cheers_match_giver_receiver_unique
  UNIQUE (match_id, giver_id, receiver_id);

-- 4. Drop multiplier column (no longer needed)
ALTER TABLE public.cheers DROP COLUMN IF EXISTS multiplier;

-- 5. Drop old RLS INSERT policy (session-scoped 24hr window)
DROP POLICY IF EXISTS "cheers: authenticated insert" ON public.cheers;

-- 6. New RLS INSERT policy (match-scoped)
CREATE POLICY "cheers: match-scoped insert" ON public.cheers
  FOR INSERT TO authenticated
  WITH CHECK (
    giver_id = auth.uid()
    AND match_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND m.status = 'complete'
        AND (
          m.team1_player1_id = auth.uid() OR m.team1_player2_id = auth.uid()
          OR m.team2_player1_id = auth.uid() OR m.team2_player2_id = auth.uid()
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (
          m.team1_player1_id = receiver_id OR m.team1_player2_id = receiver_id
          OR m.team2_player1_id = receiver_id OR m.team2_player2_id = receiver_id
        )
    )
  );

-- 7. Replace trigger: remove multiplier, just +1
CREATE OR REPLACE FUNCTION update_cheer_stats_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_slug TEXT;
BEGIN
  SELECT slug INTO v_slug FROM public.cheer_types WHERE id = NEW.cheer_type_id;

  -- Upsert giver stats
  INSERT INTO public.player_cheer_stats (player_id, cheers_given)
  VALUES (NEW.giver_id, 1)
  ON CONFLICT (player_id)
  DO UPDATE SET cheers_given = player_cheer_stats.cheers_given + 1,
                updated_at = now();

  -- Upsert receiver stats
  INSERT INTO public.player_cheer_stats (
    player_id, cheers_received,
    offense_received, defense_received, technique_received,
    movement_received, good_sport_received, solid_effort_received
  ) VALUES (
    NEW.receiver_id, 1,
    CASE WHEN v_slug = 'offense' THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'defense' THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'technique' THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'movement' THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'good_sport' THEN 1 ELSE 0 END,
    CASE WHEN v_slug = 'solid_effort' THEN 1 ELSE 0 END
  )
  ON CONFLICT (player_id)
  DO UPDATE SET
    cheers_received = player_cheer_stats.cheers_received + 1,
    offense_received = player_cheer_stats.offense_received + CASE WHEN v_slug = 'offense' THEN 1 ELSE 0 END,
    defense_received = player_cheer_stats.defense_received + CASE WHEN v_slug = 'defense' THEN 1 ELSE 0 END,
    technique_received = player_cheer_stats.technique_received + CASE WHEN v_slug = 'technique' THEN 1 ELSE 0 END,
    movement_received = player_cheer_stats.movement_received + CASE WHEN v_slug = 'movement' THEN 1 ELSE 0 END,
    good_sport_received = player_cheer_stats.good_sport_received + CASE WHEN v_slug = 'good_sport' THEN 1 ELSE 0 END,
    solid_effort_received = player_cheer_stats.solid_effort_received + CASE WHEN v_slug = 'solid_effort' THEN 1 ELSE 0 END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Task 2: Update TypeScript Types

**File:** `src/types/database.ts` — Regenerate via `supabase gen types typescript --linked`

**File:** `src/types/app.ts` — Update `CheerEntry` interface:
- Remove `multiplier` field references
- Add `matchId` field
- Add `solid_effort` to `CheerTypeSlug` union (currently missing — bug fix)

### Task 3: Create useMatchCheers Hook (replaces useSessionCheers)

**File:** `src/hooks/useMatchCheers.ts` (new)

```typescript
interface PendingMatchCheer {
  matchId: string
  players: Array<{ playerId: string; displayName: string }>  // the 3 other players
  cheersGiven: string[]  // receiver IDs already cheered
}

interface UseMatchCheersResult {
  cheerTypes: CheerType[]
  pendingMatches: PendingMatchCheer[]  // matches needing cheers
  hasPendingCheers: boolean
  isLoading: boolean
  submitCheer: (matchId: string, receiverId: string, cheerTypeId: string) => Promise<void>
  refresh: () => void
}
```

**Logic:**
1. Fetch all `matches` in this session where `status = 'complete'` AND current user is one of the 4 players
2. Fetch all `cheers` where `giver_id = user.id` AND `match_id` in those match IDs
3. For each completed match, check if user has given 3 cheers (one to each other player)
4. If not, add to `pendingMatches`
5. `hasPendingCheers = pendingMatches.length > 0`
6. `submitCheer` inserts row with `match_id`, no multiplier
7. Real-time subscription on `matches` table for this session to detect new completions

### Task 4: Modify SessionPlayerDetailView — Gate + Remove Cheers Tab

**File:** `src/views/SessionPlayerDetailView.tsx`

**Changes:**
1. Remove `'cheers'` from `Tab` type — only `'schedule' | 'leaderboard'`
2. Remove `TAB_LABELS.cheers`, remove cheers tab button and all highlighting logic (lines 384-405)
3. Remove `useSessionCheers` import, replace with `useMatchCheers`
4. Remove `hasPendingCheers`, `allCheered`, `givenReceiverIds` session-cheers logic
5. Remove the session-complete realtime listener for cheers (lines 366-377)
6. In the Schedule tab rendering: if `hasPendingCheers` (from `useMatchCheers`), render `CheersPanel` instead of `ScheduleTab`

**Gate logic in JSX:**
```tsx
{tab === 'schedule' && (
  hasPendingCheers ? (
    <CheersPanel
      cheerTypes={cheerTypes}
      pendingMatch={pendingMatches[0]}  // show oldest first
      submitCheer={submitCheer}
      isLoading={cheerLoading}
      remainingCount={pendingMatches.length}
    />
  ) : (
    <ScheduleTab ... />
  )
)}
```

### Task 5: Simplify CheersPanel for Match-Scoped Cheers

**File:** `src/components/CheersPanel.tsx`

**Changes:**
1. New props interface — receives a single `PendingMatchCheer` + `cheerTypes` + `submitCheer`
2. Remove: session status check, 24hr window check, summary screen, multiplier badges
3. Keep: 1-at-a-time flow showing each of 3 players, cheer type buttons, skip button
4. Show header: "Give cheers for Game #{gameNumber}" (need game number from match data)
5. Show progress: "1 of 3 players" then "2 of 3 players"
6. After all 3 cheers given for this match, auto-advance (parent re-renders, shows next pending match or schedule)
7. Show count of remaining matches needing cheers: "{remainingCount} games left to cheer"

### Task 6: Clean Up MySessionsView

**File:** `src/views/MySessionsView.tsx`

**Remove:**
- `isCheerWindowOpen()` function (lines 8-11)
- `cheerTimeLeft()` function (lines 13-24)
- `hasPendingCheers()` usage in `statusBadge()` — remove the "Give Cheers" badge (lines 27-48)
- Sort priority for cheers (lines 56-63) — simplify to just active > completed

### Task 7: Clean Up usePlayerSessions

**File:** `src/hooks/usePlayerSessions.ts`

**Remove:**
- `openWindowIds` calculation and 24hr window check (lines 76-80)
- Any `cheerWindowOpen` or `hasPendingCheers` fields from return type

### Task 8: Delete useSessionCheers

**File:** `src/hooks/useSessionCheers.ts` — Delete entirely (replaced by `useMatchCheers`)

### Task 9: Update Notification Context (minor)

**File:** `src/contexts/NotificationContext.tsx`

- Cheer notifications still work — they're triggered by the DB trigger on insert to `cheers`
- No changes needed IF the notification trigger doesn't reference `session_id`. Verify and update if needed.

### Acceptance Criteria

**AC1: Match completion triggers cheers gate**
- Given a match is marked complete (kiosk or admin)
- When a player in that match opens the Schedule tab
- Then they see cheers cards for the 3 other players instead of the schedule

**AC2: Cheers gate blocks schedule**
- Given a player has pending cheers for a completed match
- When they tap the Schedule tab
- Then they cannot see the schedule until all 3 cheers are given

**AC3: No gate without completed match**
- Given a player has not yet played any match in the session
- When they view the Schedule tab
- Then they see the schedule normally (no cheers gate)

**AC4: Multiple match cheers**
- Given a player completes match #1 and match #2 back-to-back
- When they open Schedule tab
- Then they see cheers for match #1 first, then match #2, then schedule unlocks

**AC5: Cheer submission works**
- Given a player is on the cheers gate screen
- When they select a cheer type for a co-player
- Then the cheer is saved with the correct `match_id`, `giver_id`, `receiver_id`, `cheer_type_id`
- And `player_cheer_stats` is updated (+1, no multiplier)

**AC6: Old cheers infrastructure removed**
- Given the session is complete
- Then there is no 24hr timer, no post-session cheers prompt, no cheers summary screen
- And there is no Cheers tab in the session detail view
- And MySessionsView does not show "Give Cheers" badges

**AC7: Real-time gate activation**
- Given a player is viewing their schedule
- When their match is marked complete by admin/kiosk
- Then the cheers gate appears in real-time without page refresh

## Additional Context

### Dependencies

- Migration must be pushed to dev database before testing
- `database.ts` must be regenerated after migration

### Testing Strategy

1. Push migration to dev: `npm run supabase:link:dev && npx supabase db push`
2. Regenerate types: `supabase gen types typescript --linked > src/types/database.ts`
3. Run `npm run dev` and log in as test user
4. Use admin account to create a session, add matches, mark a match complete
5. Switch to player account — verify cheers gate appears on Schedule tab
6. Give 3 cheers — verify schedule unlocks
7. Verify no Cheers tab exists
8. Verify MySessionsView has no "Give Cheers" badges
9. Verify cheer stats update in Profile view

### Notes

- Existing cheers data (session-scoped) will have `match_id = NULL`. This is fine — they're historical.
- The `session_id` column stays on `cheers` for backward compat but is no longer used for new cheers.
- Consider adding `match_id` index for query performance.
