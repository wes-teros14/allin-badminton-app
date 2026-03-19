# Story 2.3: Player Registration via OAuth Link

Status: review

## Story

As a player,
I want to register for a session by clicking the link the admin shared,
So that I appear on the roster and my attendance is recorded.

## Acceptance Criteria

1. **Given** a player receives the registration URL with a valid token
   **When** they open it and are not signed into Google
   **Then** they see a "Sign in with Google" button
   **And** after signing in, they land back on the registration page with the token preserved
   **And** they can then tap "Register" to complete registration

2. **Given** a player is signed in and visits a URL with a valid, active token
   **When** they tap "Register"
   **Then** a row is inserted into `session_registrations` (`player_id`, `session_id`, `registered_at`)
   **And** they see a "You're already registered" confirmation

3. **Given** a player visits a URL where `is_active = false` (or token is invalid/missing)
   **When** the registration page loads
   **Then** they see: "Registration is closed. Contact the admin."
   **And** no registration action is possible

4. **Given** a player is already registered for the session
   **When** they visit the registration URL again
   **Then** they see a confirmation that they are already registered — no duplicate row is created

5. **Given** registration is open
   **When** the admin views `RegistrationURLCard` on `/admin`
   **Then** the real registered player count is shown (wired from `session_registrations`)

## Tasks / Subtasks

- [x] Task 1: Create `004_create_session_registrations.sql` migration (AC: #2, #4)
  - [x] Define `session_registrations` table: `id` (UUID PK), `session_id` (FK sessions), `player_id` (FK auth.users), `registered_at`, UNIQUE(session_id, player_id)
  - [x] Add RLS: admin all; player INSERT own; player SELECT own
  - [x] Add table grants
  - [ ] Run in **Supabase Dashboard → SQL Editor** — MANUAL STEP (Wes)

- [x] Task 2: Update `src/types/database.ts` with `session_registrations` type (AC: #2)

- [x] Task 3: Create `src/hooks/useRegistration.ts` (AC: #1, #2, #3, #4)
  - [x] Auth state listener (same pattern as `useAuth` — two separate effects)
  - [x] Token validation: fetch `session_invitations` where `id = token` and `is_active = true` (anon read allowed)
  - [x] Duplicate check: fetch `session_registrations` where `session_id + player_id` match
  - [x] `signIn()`: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })`
  - [x] `register()`: insert into `session_registrations`; set `isAlreadyRegistered = true` on success
  - [x] Return `{ user, isLoading, isValidToken, isAlreadyRegistered, signIn, register }`

- [x] Task 4: Create `src/views/RegisterView.tsx` (AC: #1, #2, #3, #4)
  - [x] Read `token` from `useSearchParams()`
  - [x] Show loading state
  - [x] If `!isValidToken`: show "Registration is closed. Contact the admin."
  - [x] If `!user`: show "Sign in with Google" button (calls `signIn()`)
  - [x] If `isAlreadyRegistered`: show "You're already registered for this session."
  - [x] Default: show "Register" button with `user.email` displayed; on click calls `register()`

- [x] Task 5: Update `App.tsx` — add `/register` route (no auth guard needed) (AC: #1)

- [x] Task 6: Wire real player count into `RegistrationURLCard` (AC: #5)
  - [x] Add `playerCount` state to `useSession.ts` (default 0)
  - [x] After fetching invitation on mount, also fetch `session_registrations` count for the session
  - [x] Return `playerCount` from `useSession`
  - [x] Update `AdminView.tsx` to pass `playerCount` from hook into `<RegistrationURLCard>`

- [x] Task 7: Verify `npm run build` and `npm run lint` pass clean

- [x] Task 8: Manual verification — MANUAL STEP (Wes)
  - [x] Open registration URL in incognito → sees "Sign in with Google"
  - [x] Sign in → redirected back to registration page with token preserved
  - [x] Tap "Register" → success confirmation shown
  - [x] Visit URL again → "You're already registered" shown; no duplicate in Supabase
  - [ ] Use an old/invalid token → "Registration is closed" shown
  - [ ] Admin view `/admin` → player count increments correctly in RegistrationURLCard

---

## Dev Notes

### Task 1: Exact SQL for `004_create_session_registrations.sql`

```sql
-- =============================================================
-- Migration: 004_create_session_registrations
-- Creates session_registrations table for player attendance.
-- =============================================================

CREATE TABLE public.session_registrations (
  id            UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);

ALTER TABLE public.session_registrations ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "session_registrations: admin all"
  ON public.session_registrations
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Player can insert their own registration
CREATE POLICY "session_registrations: player insert own"
  ON public.session_registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

-- Player can read their own registration (for duplicate check)
CREATE POLICY "session_registrations: player read own"
  ON public.session_registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

-- Table-level grants
GRANT SELECT ON public.session_registrations TO authenticated;
GRANT INSERT ON public.session_registrations TO authenticated;
```

**Key decisions:**
- `UNIQUE (session_id, player_id)` — DB-level deduplication safety net
- Anon gets NO grants — unauthenticated players can't register
- Player SELECT policy uses `USING (auth.uid() = player_id)` — player can only see their own rows
- Admin gets a separate broad policy for roster management in Story 2.4

---

### Task 2: `src/types/database.ts` addition

Add to the `Tables` object (after `session_invitations`):

```typescript
session_registrations: {
  Row: {
    id: string
    session_id: string
    player_id: string
    registered_at: string
  }
  Insert: {
    id?: string
    session_id: string
    player_id: string
    registered_at?: string
  }
  Update: {
    id?: string
    session_id?: string
    player_id?: string
    registered_at?: string
  }
  Relationships: []
}
```

---

### Task 3: `src/hooks/useRegistration.ts`

```typescript
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface RegistrationState {
  user: User | null
  isLoading: boolean
  isValidToken: boolean
  isAlreadyRegistered: boolean
  signIn: () => Promise<void>
  register: () => Promise<void>
}

export function useRegistration(token: string | null): RegistrationState {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidToken, setIsValidToken] = useState(false)
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [tokenChecked, setTokenChecked] = useState(false)

  // Auth listener — same two-effect pattern as useAuth to avoid JWT race condition
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Validate token (anon can read session_invitations — policy allows it)
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setIsValidToken(false)
        setTokenChecked(true)
        return
      }

      const { data } = await supabase
        .from('session_invitations')
        .select('session_id, is_active')
        .eq('id', token)
        .maybeSingle()

      if (!data || !data.is_active) {
        setIsValidToken(false)
      } else {
        setIsValidToken(true)
        setSessionId((data as { session_id: string; is_active: boolean }).session_id)
      }
      setTokenChecked(true)
    }

    validateToken()
  }, [token])

  // Check duplicate registration — only when auth + token both resolved
  useEffect(() => {
    async function checkRegistration() {
      if (!tokenChecked) return
      if (!isValidToken || !sessionId) {
        setIsLoading(false)
        return
      }
      if (!user) {
        setIsLoading(false)
        return
      }

      const { data } = await supabase
        .from('session_registrations')
        .select('id')
        .eq('session_id', sessionId)
        .eq('player_id', user.id)
        .maybeSingle()

      setIsAlreadyRegistered(!!data)
      setIsLoading(false)
    }

    checkRegistration()
  }, [user, sessionId, isValidToken, tokenChecked])

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    })
  }

  async function register() {
    if (!user || !sessionId) return

    const { error } = await supabase
      .from('session_registrations')
      .insert({ session_id: sessionId, player_id: user.id })

    if (error) {
      toast.error(error.message)
      return
    }

    setIsAlreadyRegistered(true)
  }

  return { user, isLoading, isValidToken, isAlreadyRegistered, signIn, register }
}
```

**Key decisions:**
- `tokenChecked` flag gates the registration check — ensures we don't flip `isLoading` false prematurely
- Token validation runs regardless of auth state (anon read is allowed on `session_invitations`)
- `redirectTo: window.location.href` — preserves `?token=xxx` through OAuth redirect
- No `try/catch` — use `{ data, error }` pattern

---

### Task 4: `src/views/RegisterView.tsx`

```tsx
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRegistration } from '@/hooks/useRegistration'

export function RegisterView() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { user, isLoading, isValidToken, isAlreadyRegistered, signIn, register } =
    useRegistration(token)

  if (isLoading) return <div className="p-6">Loading…</div>

  if (!isValidToken) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Registration Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Registration is closed. Contact the admin.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Sign in to Register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in with Google to register for this session.
            </p>
            <Button onClick={signIn} className="w-full">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isAlreadyRegistered) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Already Registered</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You're already registered for this session.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-sm mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Register for Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Signed in as: {user.email}</p>
          <Button onClick={register} className="w-full">
            Register
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default RegisterView
```

---

### Task 5: `App.tsx` update

Add the import and route (no auth guard — `useRegistration` handles its own auth):

```tsx
const RegisterView = lazy(() => import('@/views/RegisterView'))

// Inside <Routes>:
<Route path="/register" element={<RegisterView />} />
```

Place it before the `<Route path="*" ...>` catch-all.

---

### Task 6: Wire real player count in `useSession.ts`

Add `playerCount` state. After fetching invitation on mount, also fetch the count:

```typescript
// In useSession.ts, add state:
const [playerCount, setPlayerCount] = useState(0)

// Inside fetchLatestSession(), after fetching invitation:
const { count } = await supabase
  .from('session_registrations')
  .select('*', { count: 'exact', head: true })
  .eq('session_id', (data as Session).id)
setPlayerCount(count ?? 0)

// Return:
return { session, invitation, playerCount, isLoading, createSession, openRegistration }
```

Update `SessionState` interface to include `playerCount: number`.

In `AdminView.tsx`, use `playerCount` from the hook:

```tsx
const { session, invitation, playerCount, isLoading, createSession, openRegistration } = useSession()

// Pass to RegistrationURLCard:
<RegistrationURLCard invitation={invitation} playerCount={playerCount} />
```

---

### Architecture Compliance

- **`/register` route has no auth guard** — `useRegistration` manages its own auth state internally; the page must be accessible to unauthenticated users to show the sign-in flow
- **OAuth redirect preserves token** — `redirectTo: window.location.href` passes the full URL including `?token=xxx` back to Supabase; after Google auth, Supabase redirects back with that URL
- **Two-effect auth pattern** — must use the same pattern as `useAuth.ts` (separate effects for auth listener and role/data fetch) to avoid JWT race condition
- **`maybeSingle()` for all optional fetches** — token lookup and duplicate check both return null gracefully
- **`count: 'exact', head: true`** — efficient row count without fetching data rows
- **No anon grants on `session_registrations`** — anon users see the sign-in page, not an error from Supabase
- **Domain component** — `RegisterView` is a view, not a UI component; lives in `src/views/`

### Debug Fixes Applied

- **`session_invitations` needed authenticated read policy**: After OAuth, user is `authenticated` not `anon` — the `anon read` policy no longer applies. Added `"session_invitations: authenticated read" TO authenticated USING (true)` via Supabase Dashboard.
- **OAuth redirect drops `?token=` query param**: Fixed by saving token to `sessionStorage` before `signInWithOAuth`, restoring it via `searchParams.get('token') ?? sessionStorage.getItem('registration_token')` in `RegisterView`.

### Previous Story Learnings

- **GRANT required separately from RLS** — include in every migration
- **Supabase CLI blocked on Windows** — use Dashboard SQL Editor
- **Pre-populate `database.ts`** with table types — cast with `as Type | null`
- **`onAuthStateChange` callback must be synchronous** — do NOT make it `async`
- **Two-effect auth pattern** — auth listener + role/data fetch in separate `useEffect([user])` avoids JWT race condition (critical for this story's registration check)
- **`maybeSingle()`** — use when no rows is a valid state; `single()` throws on empty

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `004_create_session_registrations.sql` created — `session_registrations` table with UNIQUE(session_id, player_id), RLS (admin all + player insert own + player read own), grants
- `src/types/database.ts` updated — added `session_registrations` Row/Insert/Update types
- `src/hooks/useRegistration.ts` created — token validation, OAuth sign-in with `redirectTo`, duplicate check, register function
- `src/views/RegisterView.tsx` created — 4-state UI: loading / closed / sign-in / registered
- `App.tsx` updated — `/register` route added (no auth guard)
- `src/hooks/useSession.ts` updated — `playerCount` state added; fetches real count from `session_registrations` on mount
- `src/views/AdminView.tsx` updated — passes real `playerCount` to `RegistrationURLCard`
- `npm run build` and `npm run lint` pass clean
- Task 1 SQL migration requires manual run in Supabase Dashboard → SQL Editor

### File List

- `badminton-v2/supabase/migrations/004_create_session_registrations.sql` (new)
- `badminton-v2/src/types/database.ts` (updated)
- `badminton-v2/src/hooks/useRegistration.ts` (new)
- `badminton-v2/src/hooks/useSession.ts` (updated — playerCount added)
- `badminton-v2/src/views/RegisterView.tsx` (new)
- `badminton-v2/src/views/AdminView.tsx` (updated — real playerCount)
- `badminton-v2/src/App.tsx` (updated — /register route)
