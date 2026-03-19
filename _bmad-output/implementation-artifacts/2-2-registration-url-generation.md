# Story 2.2: Registration URL Generation

Status: review

## Story

As an admin,
I want to generate a unique registration URL for a session,
So that I can share it with players and they can self-register.

## Acceptance Criteria

1. **Given** a session exists with `status = 'setup'`
   **When** the admin taps "Open Registration"
   **Then** a UUID token is inserted into `session_invitations` with `session_id`, `is_active = true`, `created_at`
   **And** the session `status` updates to `'registration_open'`

2. **Given** an active invitation token exists
   **When** the `<RegistrationURLCard>` component renders
   **Then** the full registration URL (`/register?token={uuid}`) is displayed
   **And** a copy button is present; tapping it changes the label to "Copied!" for 2 seconds then reverts (no toast)
   **And** the current registered player count is shown (shows 0 — wired in Story 2.3)

3. **Given** the admin has already opened registration
   **When** they view the RegistrationURLCard
   **Then** only one active token exists per session at any time

## Tasks / Subtasks

- [x] Task 1: Create `003_create_session_invitations.sql` migration (AC: #1, #3)
  - [x] Define `session_invitations` table with `id` (UUID PK = the shareable token), `session_id`, `is_active`, `created_at`
  - [x] Add RLS: admin all, anon SELECT (for token validation during registration in Story 2.3)
  - [x] Add table grants
  - [ ] Run in **Supabase Dashboard → SQL Editor** — MANUAL STEP (Wes)

- [x] Task 2: Update `src/types/database.ts` with `session_invitations` type (AC: #1)

- [x] Task 3: Extend `src/hooks/useSession.ts` with invitation support (AC: #1, #2, #3)
  - [x] Add `invitation` state (the active `session_invitations` row or null)
  - [x] Fetch active invitation when session status is `registration_open` on mount
  - [x] Add `openRegistration()` function: inserts invitation row, updates session status
  - [x] Return `{ session, invitation, isLoading, createSession, openRegistration }`

- [x] Task 4: Create `src/components/RegistrationURLCard.tsx` (AC: #2)
  - [x] Display full registration URL: `window.location.origin + '/register?token=' + invitation.id`
  - [x] Copy button: `navigator.clipboard.writeText(url)` — label changes to "Copied!" for 2s then reverts
  - [x] Show player count as `0 players registered` (placeholder — wired to real count in Story 2.3)

- [x] Task 5: Update `AdminView.tsx` to show "Open Registration" button and `RegistrationURLCard` (AC: #1, #2)
  - [x] When `session.status === 'setup'`: show session card + "Open Registration" button
  - [x] When `session.status === 'registration_open'`: show `<RegistrationURLCard>`

- [x] Task 6: Verify `npm run build` and `npm run lint` pass clean

- [x] Task 7: Manual verification — MANUAL STEP (Wes)
  - [x] Admin on `/admin` with `setup` session → sees "Open Registration" button
  - [x] Click → status updates to `registration_open`, RegistrationURLCard appears with URL
  - [x] Copy button → label changes to "Copied!" → reverts after 2s
  - [x] Supabase Table Editor → `session_invitations` → 1 active row exists

---

## Dev Notes

### Task 1: Exact SQL for `003_create_session_invitations.sql`

```sql
-- =============================================================
-- Migration: 003_create_session_invitations
-- Creates session_invitations table for registration URL tokens.
-- =============================================================

CREATE TABLE public.session_invitations (
  id         UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_invitations ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "session_invitations: admin all"
  ON public.session_invitations
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Anon can read (for token validation on registration page in Story 2.3)
CREATE POLICY "session_invitations: anon read"
  ON public.session_invitations FOR SELECT
  TO anon
  USING (true);

-- Table-level grants
GRANT SELECT ON public.session_invitations TO anon, authenticated;
GRANT INSERT, UPDATE ON public.session_invitations TO authenticated;
```

**Note:** The `id` UUID is the shareable token used in the registration URL. No separate `token` column needed — the PK is the token.

---

### Task 2: `src/types/database.ts` addition

Add to the `Tables` object:

```typescript
session_invitations: {
  Row: {
    id: string
    session_id: string
    is_active: boolean
    created_at: string
  }
  Insert: {
    id?: string
    session_id: string
    is_active?: boolean
    created_at?: string
  }
  Update: {
    id?: string
    session_id?: string
    is_active?: boolean
    created_at?: string
  }
  Relationships: []
}
```

---

### Task 3: Extended `src/hooks/useSession.ts`

Add `Invitation` type and extend the hook:

```typescript
export interface Invitation {
  id: string
  session_id: string
  is_active: boolean
  created_at: string
}

interface SessionState {
  session: Session | null
  invitation: Invitation | null
  isLoading: boolean
  createSession: (name: string, date: string) => Promise<Session | null>
  openRegistration: () => Promise<void>
}
```

**Fetch invitation on mount** (add inside the existing `useEffect`):

```typescript
// After fetching session, if status is registration_open, fetch active invitation
if (data && (data as Session).status === 'registration_open') {
  const { data: inv } = await supabase
    .from('session_invitations')
    .select('*')
    .eq('session_id', (data as Session).id)
    .eq('is_active', true)
    .maybeSingle()
  setInvitation(inv as Invitation | null)
}
```

**`openRegistration` function:**

```typescript
async function openRegistration(): Promise<void> {
  if (!session) return

  // 1. Insert invitation row (id = the shareable UUID token)
  const { data: inv, error: invError } = await supabase
    .from('session_invitations')
    .insert({ session_id: session.id })
    .select()
    .single()

  if (invError) {
    toast.error(invError.message)
    return
  }

  // 2. Update session status to registration_open
  const { data: updated, error: sessionError } = await supabase
    .from('sessions')
    .update({ status: 'registration_open' })
    .eq('id', session.id)
    .select()
    .single()

  if (sessionError) {
    toast.error(sessionError.message)
    return
  }

  setInvitation(inv as Invitation)
  setSession(updated as Session)
}
```

---

### Task 4: `src/components/RegistrationURLCard.tsx`

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Invitation } from '@/hooks/useSession'

interface Props {
  invitation: Invitation
  playerCount?: number
}

export function RegistrationURLCard({ invitation, playerCount = 0 }: Props) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/register?token=${invitation.id}`

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Open</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground break-all">{url}</p>
        <Button variant="outline" onClick={handleCopy} className="w-full">
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
        <p className="text-sm text-muted-foreground">{playerCount} players registered</p>
      </CardContent>
    </Card>
  )
}
```

---

### Task 5: Updated `AdminView.tsx`

```tsx
// When session.status === 'setup':
<Card>
  <CardHeader><CardTitle>{session.name}</CardTitle></CardHeader>
  <CardContent className="space-y-3 text-sm">
    <p>Date: {session.date}</p>
    <p>Status: <span className="font-medium">{session.status}</span></p>
    <Button onClick={openRegistration} className="w-full">
      Open Registration
    </Button>
  </CardContent>
</Card>

// When session.status === 'registration_open' and invitation exists:
<RegistrationURLCard invitation={invitation} playerCount={0} />
```

---

### Architecture Compliance

- **Domain components in `src/components/`** (not `src/components/ui/`) — `RegistrationURLCard` is a domain component
- **Hooks own all Supabase logic** — `openRegistration` lives in `useSession`, not `AdminView`
- **Copy feedback is local state** — no toast for copy, just 2s label change (per AC)
- **`maybeSingle()`** for invitation fetch — valid to have no invitation yet
- **Sequential writes (insert + update)** — acceptable for this scale; no transaction needed

### Previous Story Learnings

- **GRANT required separately from RLS** — include in every migration
- **`END LOOP` not `END WHILE`** in plpgsql
- **Supabase CLI blocked on Windows** — use Dashboard SQL Editor
- **Pre-populate `database.ts`** with table types — cast with `as Type | null` until gen types runs

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `003_create_session_invitations.sql` created — `session_invitations` table with UUID PK as shareable token, RLS (admin all + anon read), grants
- `src/types/database.ts` updated — added `session_invitations` Row/Insert/Update types
- `src/hooks/useSession.ts` extended — added `Invitation` interface, `invitation` state, fetch on mount when `registration_open`, `openRegistration()` function
- `src/components/RegistrationURLCard.tsx` created — displays URL, copy button with 2s "Copied!" label, player count placeholder
- `AdminView.tsx` updated — 3-state render: no session (form), setup (session card + Open Registration button), registration_open (RegistrationURLCard)
- `npm run build` and `npm run lint` pass clean
- Task 1 SQL migration requires manual run in Supabase Dashboard → SQL Editor (Supabase CLI blocked on Windows)

### File List

- `badminton-v2/supabase/migrations/003_create_session_invitations.sql` (new)
- `badminton-v2/src/types/database.ts` (updated)
- `badminton-v2/src/hooks/useSession.ts` (updated)
- `badminton-v2/src/components/RegistrationURLCard.tsx` (new)
- `badminton-v2/src/views/AdminView.tsx` (updated)
