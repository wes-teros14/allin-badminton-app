# Story 2.4: Roster Management & Registration Close

Status: review

## Story

As an admin,
I want to view the registered player list, manually adjust it, and close registration when ready,
So that I have full control over the final roster before generating the schedule.

## Acceptance Criteria

1. **Given** players have registered for a session
   **When** the admin views the roster panel
   **Then** all registered players are listed with their display names (`name_slug`)
   **And** the list updates in real time as new players register

2. **Given** the admin views the roster
   **When** they tap "Add Player" and select a player from the unregistered players list
   **Then** a row is inserted into `session_registrations` for that player

3. **Given** the admin views the roster
   **When** they tap "Remove" next to a player's name
   **Then** that player's `session_registrations` row is deleted
   **And** the list updates immediately

4. **Given** registration is open and the admin taps "Close Registration"
   **When** they confirm via the destructive 2-tap pattern (first tap → "Confirm Close?", second tap within 5s executes)
   **Then** `session_invitations.is_active` is set to `false` for the current token
   **And** the session `status` updates to `'registration_closed'`
   **And** subsequent visits to the old registration URL show the "Registration closed" error

5. **Given** the admin taps "Close Registration" then taps elsewhere (or waits 5s)
   **When** the auto-cancel fires
   **Then** the button reverts to "Close Registration" — no action taken

## Tasks / Subtasks

- [x] Task 1: Run supplemental SQL to grant DELETE on `session_registrations` (AC: #3)
  - [ ] Run in **Supabase Dashboard → SQL Editor** — MANUAL STEP (Wes)

- [x] Task 2: Create `src/hooks/useRoster.ts` (AC: #1, #2, #3)
  - [x] Fetch registered players: `session_registrations` joined with `profiles` via two queries + client-side merge
  - [x] Fetch all players: all `profiles` with `role = 'player'`, filter out already registered (for Add Player list)
  - [x] Real-time subscription on `session_registrations` filtered by `session_id` → refetch on any change
  - [x] `addPlayer(playerId)`: insert into `session_registrations` as admin (no player_id restriction)
  - [x] `removePlayer(registrationId)`: delete from `session_registrations` by id
  - [x] Return `{ players, unregisteredPlayers, isLoading, addPlayer, removePlayer }`

- [x] Task 3: Create `src/components/RosterPanel.tsx` (AC: #1, #2, #3)
  - [x] List registered players with "Remove" button per row
  - [x] "Add Player" section: shows unregistered players list with "Add" button per row
  - [x] Empty state: "No players registered yet"

- [x] Task 4: Extend `src/hooks/useSession.ts` with `closeRegistration()` (AC: #4)
  - [x] Update `session_invitations.is_active = false` for current invitation
  - [x] Update session `status = 'registration_closed'`
  - [x] Set local `session` state to updated session; set `invitation` to null
  - [x] Add `closeRegistration` to `SessionState` interface and return value

- [x] Task 5: Update `AdminView.tsx` for `registration_open` state (AC: #1, #2, #3, #4, #5)
  - [x] Add `useRef` timer + `confirmingClose` state for 2-tap pattern
  - [x] `handleCloseRegistration()`: first call → `setConfirmingClose(true)` + start 5s timer; second call → clear timer + call `closeRegistration()`
  - [x] `useEffect` cleanup to clear timer on unmount
  - [x] When `registration_open`: render `<RegistrationURLCard>` (with `players.length`), `<RosterPanel>`, and Close Registration button
  - [x] Button: `variant="destructive"` when confirming, `variant="outline"` otherwise

- [x] Task 6: Verify `npm run build` and `npm run lint` pass clean

- [x] Task 7: Manual verification — MANUAL STEP (Wes)
  - [x] Admin `/admin` with `registration_open` → sees roster panel + close button
  - [x] Roster shows registered players with name_slug and player count
  - [x] Close Registration (2-tap) → session status updates to `registration_closed`
  - [ ] Add a player via "Add Player" → appears in roster immediately (deferred — no unregistered players in test env)
  - [ ] Remove a player → disappears immediately (deferred — same reason)
  - [ ] Register a new player via `/register` URL → appears in admin roster in real time (deferred)
  - [ ] Tap "Close Registration", wait 5s → button reverts without action (deferred)

---

## Dev Notes

### Task 1: Supplemental SQL — DELETE grant

The `004_create_session_registrations.sql` migration was missing a DELETE grant. Run this in Supabase Dashboard → SQL Editor:

```sql
-- Fix: grant DELETE on session_registrations so admin can remove players
GRANT DELETE ON public.session_registrations TO authenticated;
```

The admin RLS policy already allows DELETE (`admin all`), but PostgreSQL requires the table-level GRANT separately.

---

### Task 2: `src/hooks/useRoster.ts`

```typescript
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export interface RosterPlayer {
  registrationId: string
  playerId: string
  nameSlug: string
}

export interface UnregisteredPlayer {
  id: string
  nameSlug: string
}

interface RosterState {
  players: RosterPlayer[]
  unregisteredPlayers: UnregisteredPlayer[]
  isLoading: boolean
  addPlayer: (playerId: string) => Promise<void>
  removePlayer: (registrationId: string) => Promise<void>
}

export function useRoster(sessionId: string | undefined): RosterState {
  const [players, setPlayers] = useState<RosterPlayer[]>([])
  const [unregisteredPlayers, setUnregisteredPlayers] = useState<UnregisteredPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function fetchRoster() {
    if (!sessionId) return

    // 1. Fetch session_registrations rows
    const { data: regs, error: regsError } = await supabase
      .from('session_registrations')
      .select('id, player_id')
      .eq('session_id', sessionId)

    if (regsError) {
      toast.error(regsError.message)
      return
    }

    const registeredIds = (regs ?? []).map((r) => (r as { id: string; player_id: string }).player_id)

    // 2. Fetch all player profiles
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name_slug')
      .eq('role', 'player')

    if (profilesError) {
      toast.error(profilesError.message)
      return
    }

    const profiles = (allProfiles ?? []) as { id: string; name_slug: string }[]

    // 3. Merge: registered players with their name_slug
    const rosterPlayers: RosterPlayer[] = (regs ?? []).map((r) => {
      const reg = r as { id: string; player_id: string }
      const profile = profiles.find((p) => p.id === reg.player_id)
      return {
        registrationId: reg.id,
        playerId: reg.player_id,
        nameSlug: profile?.name_slug ?? reg.player_id,
      }
    })

    // 4. Unregistered players = all players not in registeredIds
    const unregistered: UnregisteredPlayer[] = profiles
      .filter((p) => !registeredIds.includes(p.id))
      .map((p) => ({ id: p.id, nameSlug: p.name_slug }))

    setPlayers(rosterPlayers)
    setUnregisteredPlayers(unregistered)
    setIsLoading(false)
  }

  // Initial fetch
  useEffect(() => {
    fetchRoster()
  }, [sessionId])

  // Real-time subscription — refetch on any change to session_registrations for this session
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`roster:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_registrations',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchRoster()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  async function addPlayer(playerId: string) {
    if (!sessionId) return

    const { error } = await supabase
      .from('session_registrations')
      .insert({ session_id: sessionId, player_id: playerId })

    if (error) {
      toast.error(error.message)
    }
    // Real-time subscription will trigger fetchRoster automatically
  }

  async function removePlayer(registrationId: string) {
    const { error } = await supabase
      .from('session_registrations')
      .delete()
      .eq('id', registrationId)

    if (error) {
      toast.error(error.message)
    }
    // Real-time subscription will trigger fetchRoster automatically
  }

  return { players, unregisteredPlayers, isLoading, addPlayer, removePlayer }
}
```

**Key decisions:**
- Two-query approach: `session_registrations` + `profiles` merged client-side (player_id → auth.users FK not joinable via PostgREST)
- Real-time subscription uses `filter: session_id=eq.${sessionId}` to scope events
- `addPlayer` / `removePlayer` rely on real-time callback to refresh — no manual state mutation
- `nameSlug` fallback to `playerId` if profile not found (defensive)
- `fetchRoster` defined outside effects so real-time callback can call it

---

### Task 3: `src/components/RosterPanel.tsx`

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRoster } from '@/hooks/useRoster'

interface Props {
  sessionId: string
}

export function RosterPanel({ sessionId }: Props) {
  const { players, unregisteredPlayers, isLoading, addPlayer, removePlayer } =
    useRoster(sessionId)

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading roster…</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roster ({players.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Registered players */}
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players registered yet.</p>
        ) : (
          <ul className="space-y-2">
            {players.map((player) => (
              <li key={player.registrationId} className="flex items-center justify-between text-sm">
                <span>{player.nameSlug}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePlayer(player.registrationId)}
                  className="text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Add Player section */}
        {unregisteredPlayers.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">Add player:</p>
            <ul className="space-y-1">
              {unregisteredPlayers.map((player) => (
                <li key={player.id} className="flex items-center justify-between text-sm">
                  <span>{player.nameSlug}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addPlayer(player.id)}
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

### Task 4: Extend `useSession.ts`

Add `closeRegistration` to the `SessionState` interface:

```typescript
interface SessionState {
  session: Session | null
  invitation: Invitation | null
  playerCount: number
  isLoading: boolean
  createSession: (name: string, date: string) => Promise<Session | null>
  openRegistration: () => Promise<void>
  closeRegistration: () => Promise<void>
}
```

Add the function (place after `openRegistration`):

```typescript
async function closeRegistration(): Promise<void> {
  if (!session || !invitation) return

  // 1. Deactivate the invitation token
  const { error: invError } = await supabase
    .from('session_invitations')
    .update({ is_active: false })
    .eq('id', invitation.id)

  if (invError) {
    toast.error(invError.message)
    return
  }

  // 2. Update session status to registration_closed
  const { data: updated, error: sessionError } = await supabase
    .from('sessions')
    .update({ status: 'registration_closed' })
    .eq('id', session.id)
    .select()
    .single()

  if (sessionError) {
    toast.error(sessionError.message)
    return
  }

  setSession(updated as Session)
  setInvitation(null)
}
```

Update return statement:
```typescript
return { session, invitation, playerCount, isLoading, createSession, openRegistration, closeRegistration }
```

---

### Task 5: Updated `AdminView.tsx` — `registration_open` state

Add imports and hooks at the top:

```tsx
import { useRef, useState, useEffect } from 'react'
import { RosterPanel } from '@/components/RosterPanel'
```

Destructure `closeRegistration` from `useSession`:

```tsx
const { session, invitation, playerCount, isLoading, createSession, openRegistration, closeRegistration } = useSession()
```

Add 2-tap close state (inside the component):

```tsx
const [confirmingClose, setConfirmingClose] = useState(false)
const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

useEffect(() => {
  return () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }
}, [])

function handleCloseRegistration() {
  if (!confirmingClose) {
    setConfirmingClose(true)
    closeTimerRef.current = setTimeout(() => setConfirmingClose(false), 5000)
  } else {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setConfirmingClose(false)
    closeRegistration()
  }
}
```

Replace the `registration_open` branch in the JSX:

```tsx
) : session.status === 'registration_open' && invitation ? (
  <div className="space-y-4">
    <RegistrationURLCard invitation={invitation} playerCount={playerCount} />
    <RosterPanel sessionId={session.id} />
    <Button
      variant={confirmingClose ? 'destructive' : 'outline'}
      onClick={handleCloseRegistration}
      className="w-full"
    >
      {confirmingClose ? 'Confirm Close?' : 'Close Registration'}
    </Button>
  </div>
```

---

### Architecture Compliance

- **Real-time subscription scoped by session** — `filter: session_id=eq.${sessionId}` prevents listening to other sessions' changes
- **Channel cleanup on unmount** — `supabase.removeChannel(channel)` in effect return
- **Admin DELETE RLS** — covered by `admin all` policy; requires separate `GRANT DELETE` (Task 1)
- **Two-query roster fetch** — `player_id` FK references `auth.users` (different schema) so PostgREST can't join; merge client-side
- **2-tap pattern uses `useRef` for timer** — ref avoids stale closure issues; `useEffect` cleanup prevents memory leaks
- **`playerCount` vs `players.length`** — `useSession.playerCount` is used for initial load; `RosterPanel` manages its own real-time state. `RegistrationURLCard` in AdminView uses `playerCount` from `useSession` (sufficient for the URL card display — not the roster itself)
- **No `try/catch`** — use `{ data, error }` Supabase pattern

### Previous Story Learnings

- **GRANT required separately from RLS** — DELETE grant was missing from migration 004; fixed in Task 1
- **Supabase CLI blocked on Windows** — use Dashboard SQL Editor
- **`maybeSingle()`** when no rows is valid
- **Two-effect auth pattern** — not needed in `useRoster` (no auth state — roster is admin-only and always authenticated)
- **Real-time channel naming** — use descriptive names like `roster:${sessionId}` to avoid collisions

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `src/hooks/useRoster.ts` created — two-query fetch (registrations + profiles), client-side merge, real-time subscription, addPlayer, removePlayer
- `src/components/RosterPanel.tsx` created — registered list with Remove buttons, unregistered list with Add buttons, empty state
- `src/hooks/useSession.ts` extended — `closeRegistration()` deactivates invitation + sets session to `registration_closed`
- `AdminView.tsx` updated — `registration_open` state now shows RegistrationURLCard + RosterPanel + 2-tap Close Registration button
- `npm run build` and `npm run lint` pass clean
- Task 1 (DELETE grant SQL) requires manual run in Supabase Dashboard

### File List

- `badminton-v2/src/hooks/useRoster.ts` (new)
- `badminton-v2/src/components/RosterPanel.tsx` (new)
- `badminton-v2/src/hooks/useSession.ts` (updated — closeRegistration added)
- `badminton-v2/src/views/AdminView.tsx` (updated — RosterPanel + 2-tap close)
