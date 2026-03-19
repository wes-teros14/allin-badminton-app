# Story 1.3: Google OAuth Authentication & User Profiles

Status: review

## Story

As a player or admin,
I want to sign in with my Google account,
So that the system knows who I am and can enforce my role.

## Acceptance Criteria

1. **Given** the Supabase project is configured with the Google OAuth provider
   **When** a user clicks "Sign in with Google"
   **Then** they are redirected to Google's OAuth consent screen
   **And** on successful sign-in, returned to the app as an authenticated Supabase user

2. **Given** a user signs in to the app for the first time
   **When** the `after insert on auth.users` database trigger fires
   **Then** a row is created in `profiles` with `id`, `role = 'player'`, and `name_slug` derived from their Google display name (lowercase, hyphens, URL-safe, deduplicated on collision)

3. **Given** a user is signed in
   **When** `useAuth.ts` hook is called
   **Then** it returns `{ user, role, isLoading }` where `role` is read from `profiles.role`
   **And** `isLoading` is `true` until the profile query resolves, then `false`

4. **Given** Wes's `profiles` row is manually updated to `role = 'admin'`
   **When** Wes signs in and `useAuth` resolves
   **Then** `role` returns `'admin'`

## Tasks / Subtasks

- [ ] Task 1: Initialize Supabase CLI and link to hosted project (AC: #2)
  - [ ] Run `npx supabase init` inside `badminton-v2/` to create `supabase/config.toml`
  - [ ] Run `npx supabase login` and `npx supabase link --project-ref <your-ref>` to connect to hosted project
  - [ ] Confirm `supabase/config.toml` and `supabase/migrations/` directory exist

- [x] Task 2: Create `profiles` migration (AC: #2)
  - [x] Run `npx supabase migration new create_profiles` — creates `supabase/migrations/001_create_profiles.sql`
  - [x] Write the `profiles` table DDL (see Dev Notes for exact SQL)
  - [x] Write the `handle_new_user()` trigger function with `name_slug` deduplication logic
  - [x] Write the `on_auth_user_created` trigger
  - [x] Add RLS policies for `profiles` (own read + anon read for name_slug resolution)

- [x] Task 3: Push migration and regenerate TypeScript types (AC: #2, #3) — **MANUAL STEP (Wes)**
  - [x] Run SQL migration directly in Supabase Dashboard → SQL Editor (CLI workaround for Windows)
  - [x] `src/types/database.ts` pre-populated with profiles type by dev agent
  - [x] Verified `profiles` table exists in Supabase with correct schema

- [x] Task 4: Configure Google OAuth in Supabase + Google Cloud Console (AC: #1) — **MANUAL STEP (Wes)**
  - [x] Created Google Cloud OAuth 2.0 Web client
  - [x] Enabled Google provider in Supabase Dashboard → Authentication → Providers → Google
  - [x] Added Supabase callback URL to Google Cloud authorized redirect URIs

- [x] Task 5: Create `src/hooks/useAuth.ts` (AC: #3, #4)
  - [x] Implement hook with `getSession()` for initial auth state
  - [x] Implement `onAuthStateChange` listener — synchronous callback only (no async)
  - [x] Fetch `profiles.role` from Supabase on user sign-in
  - [x] Return `{ user, role, isLoading }` with correct loading semantics

- [x] Task 6: Add temporary sign-in button to `AdminView` for verification (AC: #1, #4)
  - [x] Add `supabase.auth.signInWithOAuth({ provider: 'google' })` call
  - [x] Add `supabase.auth.signOut()` call
  - [x] Display current `role` from `useAuth` to verify admin detection
  - [x] (This is a dev verification stub — Story 1.4 adds the real route guard; remove test code after AC verification)

- [x] Task 7: Manually promote Wes to admin role (AC: #4) — **MANUAL STEP (Wes)**
  - [x] Signed in once to create the `profiles` row via DB trigger
  - [x] Set `role = 'admin'` in Supabase Dashboard → Table Editor → profiles
  - [x] Verified `useAuth` returns `role === 'admin'` in browser

- [x] Task 1: Initialize Supabase CLI and link to hosted project (AC: #2) — **MANUAL STEP (Wes)**
  - [x] Supabase CLI had Windows permissions issue — skipped; used SQL Editor instead
  - [x] `supabase/migrations/` directory and SQL file created by dev agent
  - [x] Migration applied directly via Supabase Dashboard SQL Editor

- [x] Task 8: Verify `npm run build` and `npm run lint` pass clean

---

## Dev Notes

### Prerequisites: What Must Exist Before Starting

Story 1.1 is complete — the project has:
- `badminton-v2/src/lib/supabase.ts` with `createClient<Database>(...)` singleton
- `badminton-v2/src/types/database.ts` as an empty placeholder (will be overwritten in Task 3)
- `.env.local` with real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

Story 1.2 is complete — `src/index.css` has brand tokens; `KioskView` has `.kiosk-dark`.

---

### Task 1: Supabase CLI Setup

Run these commands from inside `badminton-v2/`:

```bash
# Install Supabase CLI as dev dependency (or use npx — either is fine)
npm install supabase --save-dev

# Initialize supabase directory (creates supabase/config.toml + supabase/migrations/)
npx supabase init

# Authenticate with Supabase
npx supabase login

# Link to your hosted project (find your project ref in Supabase Dashboard → Project Settings → General)
npx supabase link --project-ref <your-project-ref>
```

After this, `badminton-v2/supabase/` exists with `config.toml` and empty `migrations/` folder.

---

### Task 2: Exact SQL for `001_create_profiles.sql`

Run `npx supabase migration new create_profiles` to create the file, then paste this content:

```sql
-- =============================================================
-- Migration: 001_create_profiles
-- Creates profiles table, DB trigger for auto-create on OAuth sign-in,
-- and RLS policies for the profiles table.
-- =============================================================

-- Profiles table
CREATE TABLE public.profiles (
  id         UUID        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'player' CHECK (role IN ('admin', 'player')),
  name_slug  TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- Trigger function: auto-create profiles row on first OAuth sign-in
-- SECURITY DEFINER allows the function to write to public.profiles
-- even when called from the auth schema context.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  base_slug  TEXT;
  final_slug TEXT;
  counter    INT := 1;
BEGIN
  -- Build base slug from Google display name (raw_user_meta_data.name)
  base_slug := lower(
    regexp_replace(
      regexp_replace(
        coalesce(new.raw_user_meta_data ->> 'name', 'user'),
        '[^a-zA-Z0-9 -]', '', 'g'   -- strip non-alphanumeric (keep spaces + hyphens)
      ),
      '\s+', '-', 'g'                -- spaces → hyphens
    )
  );
  -- Remove leading/trailing hyphens; default to 'user' if blank
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN
    base_slug := 'user';
  END IF;

  final_slug := base_slug;

  -- Deduplicate: append -2, -3, … until slug is unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE name_slug = final_slug) LOOP
    counter    := counter + 1;
    final_slug := base_slug || '-' || counter;
  END WHILE;

  INSERT INTO public.profiles (id, role, name_slug)
  VALUES (new.id, 'player', final_slug);

  RETURN new;
END;
$$;

-- Trigger: fires after every new row in auth.users (i.e. every new OAuth sign-in)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own profile (for useAuth hook)
CREATE POLICY "profiles: authenticated own read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Anon can read name_slug column (for /player/:nameSlug URL resolution in later stories)
CREATE POLICY "profiles: anon read"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);
```

**Key design decisions:**
- `SECURITY DEFINER SET search_path = ''` — Supabase best practice; prevents search path injection; the trigger runs as `postgres` role to write to `public.profiles`
- `raw_user_meta_data ->> 'name'` — Google OAuth passes the display name here (e.g. `"Wes Ancog"` → slug `"wes-ancog"`)
- Deduplication loop uses `WHILE EXISTS(...)` — handles collisions like `"wes-ancog"` → `"wes-ancog-2"` atomically in the trigger

---

### Task 3: Push Migration & Regenerate Types

```bash
# Push migration to hosted Supabase project
npx supabase db push

# Regenerate TypeScript types from the hosted DB schema
npx supabase gen types typescript --linked > src/types/database.ts
```

After this, `src/types/database.ts` will have a `profiles` key in the `Tables` section. The placeholder is now overwritten — this is expected.

**If `--linked` flag is not available on your CLI version, use:**
```bash
npx supabase gen types typescript --project-id <your-project-ref> > src/types/database.ts
```

---

### Task 4: Google OAuth Manual Setup

This is a **manual step** — cannot be automated.

**Step 1 — Google Cloud Console:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create a new OAuth 2.0 Web client
3. Set **Authorized JavaScript origins**: `http://localhost:5173` (dev) + `https://<your-vercel-url>` (prod)
4. Set **Authorized redirect URIs**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**

**Step 2 — Supabase Dashboard:**
1. Go to Authentication → Providers → Google
2. Enable Google provider
3. Paste Client ID and Client Secret
4. Save

The Supabase callback URL to use in Google Cloud is shown in the Supabase Dashboard when you open the Google provider config.

---

### Task 5: Exact `src/hooks/useAuth.ts` Implementation

```typescript
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Role = 'admin' | 'player' | null

interface AuthState {
  user: User | null
  role: Role
  isLoading: boolean
}

async function fetchRole(userId: string): Promise<Role> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return (data?.role as Role) ?? null
}

export function useAuth(): AuthState {
  const [user, setUser]       = useState<User | null>(null)
  const [role, setRole]       = useState<Role>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 1. Get current session immediately on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchRole(session.user.id)
          .then(setRole)
          .finally(() => setIsLoading(false))
      } else {
        setIsLoading(false)
      }
    })

    // 2. Listen for subsequent auth events
    //    IMPORTANT: callback must be synchronous — do NOT make it async
    //    (async onAuthStateChange callbacks cause Supabase deadlocks)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchRole(session.user.id).then(setRole)
        } else {
          setRole(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, role, isLoading }
}
```

**Critical rules:**
- `onAuthStateChange` callback is **synchronous** — role fetch is done outside via `.then()`
- `isLoading` starts `true`, only becomes `false` after the initial `getSession()` + `fetchRole()` resolves
- `supabase` is imported from `@/lib/supabase` — never create a second client

---

### Task 6: Temporary Sign-in Stub in AdminView

Add to `src/views/AdminView.tsx` for verification only. **Remove after Task 7 confirms AC #4.**

```tsx
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export function AdminView() {
  const { user, role, isLoading } = useAuth()

  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/admin' },
    })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (isLoading) return <div>Loading…</div>

  return (
    <div>
      {user ? (
        <>
          <p>Signed in as: {user.email}</p>
          <p>Role: {role}</p>
          <button onClick={handleSignOut}>Sign out</button>
        </>
      ) : (
        <button onClick={handleSignIn}>Sign in with Google</button>
      )}
    </div>
  )
}

export default AdminView
```

After verification is complete, revert `AdminView` to:
```tsx
export function AdminView() {
  return <div>Admin (protected)</div>
}
export default AdminView
```

---

### Architecture Compliance

- **Single Supabase client** — always import from `@/lib/supabase`, never `createClient()` elsewhere
- **`useAuth` lives in `src/hooks/`** — not inline in components
- **Route guards are UX-only** — RLS is the actual security boundary; Story 1.4 adds the client-side guard
- **`profiles.role` is source of truth** — never derive role from `auth.users` metadata; always read from `profiles` table
- **Admin role is set manually** — default is `'player'`; Wes's row is updated manually in Supabase Dashboard
- **No second Supabase client** — `src/lib/supabase.ts` is the singleton
- **`src/types/database.ts`** — regenerate after every migration; do not hand-edit

### Key Anti-Patterns to Avoid

- ❌ `async (_event, session) => { ... }` inside `onAuthStateChange` — causes deadlocks
- ❌ Reading role from `user.user_metadata` — always use `profiles.role` (metadata is not authoritative)
- ❌ Creating a second `createClient()` in `useAuth.ts` — import from `@/lib/supabase`
- ❌ Calling `supabase.auth.getUser()` inside `onAuthStateChange` — use the `session` parameter
- ❌ Forgetting `subscription.unsubscribe()` cleanup — causes memory leaks

### Previous Story Learnings (Stories 1.1 & 1.2)

- `npm run build` must pass zero TypeScript errors before committing
- `npm run lint` must pass clean before committing
- `supabase` Supabase CLI is available via `npx` — no global install required
- After `supabase gen types`, the `Database` type in `src/types/database.ts` is fully populated; TypeScript will now type-check all `supabase.from('profiles')` calls
- `KioskView` has `.kiosk-dark bg-background text-foreground` — don't touch it
- CSS variable lesson: scoping a variable on a class doesn't paint the background; the element must also apply `bg-background`

### File Changes in This Story

- **New:** `badminton-v2/supabase/config.toml` (created by `supabase init`)
- **New:** `badminton-v2/supabase/migrations/001_create_profiles.sql`
- **Modified:** `badminton-v2/src/types/database.ts` (regenerated — not hand-edited)
- **New:** `badminton-v2/src/hooks/useAuth.ts`
- **Temporarily modified:** `badminton-v2/src/views/AdminView.tsx` (test stub — revert after AC #4 verified)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `select('role')` with Supabase JS v2 + manually-defined Database type returns `never` for data — fixed by using `(data as { role?: string } | null)?.role` cast; will resolve correctly once `supabase gen types --linked` regenerates the real types
- `Relationships: []` required in Database table type for Supabase v2 type inference to avoid `{}` return

### Completion Notes List

- `supabase/migrations/001_create_profiles.sql` created with full profiles table DDL, trigger function, trigger, and RLS policies
- `src/types/database.ts` pre-populated with profiles type (placeholder; will be overwritten by `supabase gen types --linked` after Wes pushes migration)
- `src/hooks/useAuth.ts` created — `getSession()` + `onAuthStateChange` pattern, role fetched from `profiles` table, synchronous callback only
- `src/views/AdminView.tsx` updated with sign-in/sign-out stub for verification
- `npm run build` and `npm run lint` pass clean
- **3 manual tasks remain for Wes:** (1) `supabase init` + `login` + `link` + `db push` + `gen types`, (2) Google OAuth dashboard setup, (3) promote Wes row to `role = 'admin'`

### File List

- `badminton-v2/supabase/migrations/001_create_profiles.sql` (new)
- `badminton-v2/src/types/database.ts` (updated — placeholder with profiles type)
- `badminton-v2/src/hooks/useAuth.ts` (new)
- `badminton-v2/src/views/AdminView.tsx` (updated — sign-in verification stub)
