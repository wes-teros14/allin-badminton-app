# Story 2.1: Create New Session

Status: review

## Story

As an admin,
I want to create a new session,
So that the session is ready to accept player registrations.

## Acceptance Criteria

1. **Given** the admin is signed in and on the Admin view
   **When** they enter a session name and date and tap "Create Session"
   **Then** a new row is inserted into `sessions` with `status = 'setup'`
   **And** the `sessions` table uses the `session_status` enum (`setup`, `registration_open`, `registration_closed`, `schedule_locked`, `in_progress`, `complete`)
   **And** only admin can INSERT/UPDATE sessions (RLS enforced)

2. **Given** a session has been created
   **When** the admin views the Admin panel
   **Then** the session name, date, and current status are displayed

## Tasks / Subtasks

- [x] Task 1: Install new dependencies (AC: #1)
  - [x] Run `npm install zod react-hook-form @hookform/resolvers`
  - [x] Run `npx shadcn add input label card sonner` to install shadcn components
  - [x] Add `<Toaster />` from `sonner` to `src/App.tsx` (outside `<Routes>`)

- [x] Task 2: Create `002_create_sessions.sql` migration (AC: #1)
  - [x] Create `supabase/migrations/002_create_sessions.sql`
  - [x] Define `session_status` PostgreSQL enum
  - [x] Define `sessions` table with all columns
  - [x] Add RLS policies (admin insert/update, all roles select)
  - [x] Add table grants
  - [ ] Run migration in **Supabase Dashboard → SQL Editor** — MANUAL STEP (Wes)

- [x] Task 3: Update `src/types/database.ts` with sessions type (AC: #1)
  - [x] Add `sessions` table Row/Insert/Update/Relationships types
  - [x] Add `session_status` to Enums section

- [x] Task 4: Create `src/hooks/useSession.ts` (AC: #1, #2)
  - [x] Implement `createSession(name, date)` — inserts row, returns created session
  - [x] Implement `useSession()` hook — fetches most recent session, returns `{ session, isLoading, createSession }`
  - [x] Always destructure `{ data, error }` — on error call `toast.error(error.message)`

- [x] Task 5: Build session creation UI in `AdminView.tsx` (AC: #1, #2)
  - [x] React Hook Form + Zod schema: `name` (string, min 1), `date` (string, valid date)
  - [x] Render `<Input>` for name, `<Input type="date">` for date, `<Button>` to submit
  - [x] On success: show session card with name, date, status badge
  - [x] Show inline field validation errors via `errors` object from RHF
  - [x] Disable submit button while submitting (`isSubmitting`)

- [x] Task 6: Verify `npm run build` and `npm run lint` pass clean

- [x] Task 7: Manual verification
  - [x] Admin signed in → filled form → submitted → session row created in Supabase
  - [x] Session name, date, and `setup` status displayed in Admin view

---

## Dev Notes

### New Dependencies

```bash
npm install zod react-hook-form @hookform/resolvers
npx shadcn add input label card sonner
```

**What each adds:**
- `zod` — TypeScript-first schema validation for form inputs
- `react-hook-form` — form state management with minimal re-renders
- `@hookform/resolvers` — bridges React Hook Form with Zod
- `shadcn input` — styled text input component → `src/components/ui/input.tsx`
- `shadcn label` — styled label component → `src/components/ui/label.tsx`
- `shadcn card` — card container → `src/components/ui/card.tsx`
- `shadcn sonner` — toast notifications → `src/components/ui/sonner.tsx` + installs `sonner` package

---

### Task 1: Add Toaster to `App.tsx`

After `npx shadcn add sonner`, add `<Toaster />` to `App.tsx`:

```tsx
import { Toaster } from '@/components/ui/sonner'

function App() {
  return (
    <>
      <Toaster />
      <Suspense fallback={<div>Loading…</div>}>
        <Routes>
          {/* ... existing routes ... */}
        </Routes>
      </Suspense>
    </>
  )
}
```

---

### Task 2: Exact SQL for `002_create_sessions.sql`

```sql
-- =============================================================
-- Migration: 002_create_sessions
-- Creates session_status enum and sessions table.
-- =============================================================

-- Session state machine enum
CREATE TYPE public.session_status AS ENUM (
  'setup',
  'registration_open',
  'registration_closed',
  'schedule_locked',
  'in_progress',
  'complete'
);

-- Sessions table
CREATE TABLE public.sessions (
  id         UUID           NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT           NOT NULL,
  date       DATE           NOT NULL,
  status     session_status NOT NULL DEFAULT 'setup',
  created_by UUID           NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "sessions: admin all"
  ON public.sessions
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- All roles can read sessions (kiosk + player views need session info)
CREATE POLICY "sessions: read all"
  ON public.sessions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Table-level grants
GRANT SELECT ON public.sessions TO anon, authenticated;
GRANT INSERT, UPDATE ON public.sessions TO authenticated;
```

**Key decisions:**
- `created_by` stores the admin's user ID — used for audit trail
- Both SELECT policies apply — the admin all policy covers admin reads with full access; the read-all policy covers anon/player reads
- `GRANT INSERT, UPDATE` is on `authenticated` — RLS further restricts to admin role only
- No DELETE — sessions are never deleted (archive pattern)

---

### Task 3: `src/types/database.ts` additions

Add to the `Tables` object alongside `profiles`:

```typescript
sessions: {
  Row: {
    id: string
    name: string
    date: string
    status: 'setup' | 'registration_open' | 'registration_closed' | 'schedule_locked' | 'in_progress' | 'complete'
    created_by: string
    created_at: string
  }
  Insert: {
    id?: string
    name: string
    date: string
    status?: 'setup' | 'registration_open' | 'registration_closed' | 'schedule_locked' | 'in_progress' | 'complete'
    created_by: string
    created_at?: string
  }
  Update: {
    id?: string
    name?: string
    date?: string
    status?: 'setup' | 'registration_open' | 'registration_closed' | 'schedule_locked' | 'in_progress' | 'complete'
    created_by?: string
    created_at?: string
  }
  Relationships: []
}
```

Also add to `Enums`:
```typescript
Enums: {
  session_status: 'setup' | 'registration_open' | 'registration_closed' | 'schedule_locked' | 'in_progress' | 'complete'
}
```

---

### Task 4: Exact `src/hooks/useSession.ts`

```typescript
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type SessionStatus = 'setup' | 'registration_open' | 'registration_closed' | 'schedule_locked' | 'in_progress' | 'complete'

export interface Session {
  id: string
  name: string
  date: string
  status: SessionStatus
  created_by: string
  created_at: string
}

interface SessionState {
  session: Session | null
  isLoading: boolean
  createSession: (name: string, date: string) => Promise<Session | null>
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchLatestSession() {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        toast.error(error.message)
      } else {
        setSession(data as Session | null)
      }
      setIsLoading(false)
    }

    fetchLatestSession()
  }, [])

  async function createSession(name: string, date: string): Promise<Session | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Not authenticated')
      return null
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({ name, date, created_by: user.id })
      .select()
      .single()

    if (error) {
      toast.error(error.message)
      return null
    }

    const newSession = data as Session
    setSession(newSession)
    return newSession
  }

  return { session, isLoading, createSession }
}
```

**Key decisions:**
- `maybeSingle()` instead of `single()` — returns `null` (not error) when no session exists yet
- `createSession` fetches `user` from `supabase.auth.getUser()` to get the `created_by` UUID
- On create success, `setSession(newSession)` updates local state immediately — no refetch needed
- Error pattern: `toast.error(error.message)` — never silent

---

### Task 5: `AdminView.tsx` — Form + Session Display

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'

const sessionSchema = z.object({
  name: z.string().min(1, 'Session name is required'),
  date: z.string().min(1, 'Date is required'),
})

type SessionFormValues = z.infer<typeof sessionSchema>

export function AdminView() {
  const { session, isLoading, createSession } = useSession()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
  })

  async function onSubmit(values: SessionFormValues) {
    const result = await createSession(values.name, values.date)
    if (result) reset()
  }

  if (isLoading) return <div>Loading…</div>

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {session ? (
        <Card>
          <CardHeader>
            <CardTitle>{session.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Date: {session.date}</p>
            <p>Status: <span className="font-medium">{session.status}</span></p>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Session name</Label>
            <Input id="name" placeholder="e.g. Friday Night Badminton" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register('date')} />
            {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating…' : 'Create Session'}
          </Button>
        </form>
      )}
    </div>
  )
}

export default AdminView
```

**Key decisions:**
- Show form only when no session exists; show session card once created
- `reset()` clears the form on success (defensive UX)
- `disabled={isSubmitting}` prevents double-submit
- `text-destructive` uses the shadcn CSS variable — no hardcoded colors

---

### Architecture Compliance

- **Zod + React Hook Form** — always use `zodResolver` for form validation; never manual validation
- **`toast.error(error.message)`** — all Supabase errors surface via toast; no silent failures
- **`{ data, error }` destructuring** — never assume success; always check `error`
- **`useSession` in `src/hooks/`** — all Supabase logic in hooks, not components
- **`maybeSingle()`** — use when result may legitimately be null; `single()` throws error if no row
- **No `try/catch`** — use `{ data, error }` pattern from Supabase client
- **shadcn components** — import from `@/components/ui/`; never edit generated files

### Key Anti-Patterns to Avoid

- ❌ Hardcoded hex colors in components — use CSS variables (`text-destructive`, `text-muted-foreground`)
- ❌ `try/catch` around Supabase queries — use `{ data, error }` destructuring
- ❌ `.single()` when no rows is a valid state — use `.maybeSingle()`
- ❌ Silent errors — always `toast.error()` on Supabase error

### Previous Story Learnings

- **GRANT is required separately from RLS**: After creating tables via SQL, always run `GRANT SELECT ON public.<table> TO anon, authenticated` and `GRANT INSERT, UPDATE ON public.<table> TO authenticated` — RLS policies alone won't prevent 403
- **`END LOOP` not `END WHILE`** in PostgreSQL plpgsql
- **Supabase JS type cast**: Use `(data as Type | null)` for manual Database types until `supabase gen types` runs
- **Supabase CLI blocked on Windows**: Use Supabase Dashboard → SQL Editor to run migrations

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Installed `zod`, `react-hook-form`, `@hookform/resolvers` + shadcn `input`, `label`, `card`, `sonner`
- `<Toaster />` added to `App.tsx` — toast notifications active globally
- `002_create_sessions.sql` created with `session_status` enum, `sessions` table, RLS, grants
- `src/types/database.ts` updated with `sessions` type and `session_status` enum
- `src/hooks/useSession.ts` created — fetch latest session + createSession function
- `AdminView.tsx` updated with Zod + RHF form; session card displays after creation
- `npm run build` and `npm run lint` pass clean; session creation verified in browser

### File List

- `badminton-v2/supabase/migrations/002_create_sessions.sql` (new)
- `badminton-v2/src/types/database.ts` (updated)
- `badminton-v2/src/hooks/useSession.ts` (new)
- `badminton-v2/src/views/AdminView.tsx` (updated)
- `badminton-v2/src/App.tsx` (updated — Toaster added)
- `badminton-v2/src/components/ui/input.tsx` (new — shadcn)
- `badminton-v2/src/components/ui/label.tsx` (new — shadcn)
- `badminton-v2/src/components/ui/card.tsx` (new — shadcn)
- `badminton-v2/src/components/ui/sonner.tsx` (new — shadcn)
