# INTEGRATIONS.md — External Services & APIs

## Supabase

**Primary backend** — handles database, auth, and real-time events.

### Database (PostgreSQL)
- Typed via generated `src/types/database.ts`
- Client: `src/lib/supabase.ts`
  ```ts
  export const supabase = createClient<Database>(url, anonKey, { auth: { flowType: 'pkce' } })
  ```
- **Tables (44 migrations):**
  - `profiles` — player profiles with role, gender, skill level
  - `sessions` — badminton sessions with status, venue, timing, price, generator settings
  - `session_invitations` — per-session registration links with max player limits
  - `session_registrations` — player registration per session (source, paid, overrides)
  - `matches` — generated court matches with status, duration
  - `player_stats` — aggregate player performance stats
  - `notifications` — in-app notifications
  - `announcements` — admin broadcasts
  - `cheers` — player appreciation system (6 types: offense, defense, technique, movement, good_sport, solid_effort)

### Row-Level Security (RLS)
- Extensive RLS policies across all tables
- Anonymous read access on `players` view (migration `008`)
- Session registrations: read-all, update/delete granted (migrations `009`, `012`)
- Authenticated read-all on profiles (migration `037`)
- Admin update on profiles (migration `043`)
- Registration opens_at gating (migration `034`)

### Auth
- **Flow:** PKCE (configured in supabase client)
- **Provider:** Google OAuth for admin users
  ```ts
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${VITE_APP_URL}/admin` }
  })
  ```
- **Roles:** `admin` | `player` — read from `profiles.role` via `AuthContext`
- **Admin gate:** `AdminRoute` component in `App.tsx` — redirects non-admins to `/`

### Realtime
- Tables configured with replica identity (migration `010`)
- Realtime enabled for `player_stats` (migration `017`), `notifications` (migration `041`)
- Hook: `useRealtime.ts` — subscribes to live session/match updates
- Context: `NotificationContext.tsx` — subscribes to user notifications channel

### Supabase CLI
- Linked to dev project: `npx supabase link --project-ref tsvetqzkullivprbjtli`
- Linked to prod project: `npx supabase link --project-ref ensdfitpeyreunihkqkh`

## Vercel

- **Hosting:** Static SPA deployment
- **Config:** `badminton-v2/vercel.json`
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- Handles all client-side routing (no 404s on deep-links)

## Google OAuth

- Used exclusively for admin sign-in
- Configured as Supabase OAuth provider
- Redirect URI: `{VITE_APP_URL}/admin` or `window.location.origin/admin`

## No Other External APIs

As of the current codebase, there are no integrations with:
- Payment processors
- Email services (notifications are in-app only)
- Analytics platforms
- Push notification services
- CDN or asset pipelines beyond Vercel
