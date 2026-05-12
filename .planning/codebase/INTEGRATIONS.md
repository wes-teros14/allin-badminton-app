# External Integrations

**Analysis Date:** 2026-05-12

## APIs & External Services

**Backend Platform:**
- Supabase - Primary backend for auth, Postgres data access, realtime subscriptions, and RPC
  - SDK/Client: `@supabase/supabase-js`
  - Auth: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Implementation: `badminton-v2/src/lib/supabase.ts`, `badminton-v2/src/contexts/AuthContext.tsx`, `badminton-v2/src/hooks/`

**Authentication Provider:**
- Google OAuth via Supabase Auth - End-user sign-in path for public and admin entry points
  - SDK/Client: `@supabase/supabase-js`
  - Auth: Supabase project OAuth configuration plus `VITE_APP_URL`
  - Entry points: `badminton-v2/src/App.tsx`, `badminton-v2/src/views/HomeView.tsx`, `badminton-v2/src/hooks/useRegistration.ts`

**Realtime:**
- Supabase Realtime - Live UI updates for matches, player stats, cheers, rosters, notifications, and leaderboard views
  - SDK/Client: `@supabase/supabase-js`
  - Publication setup: `badminton-v2/supabase/migrations/010_realtime_replica_identity.sql`, `badminton-v2/supabase/migrations/017_player_stats_realtime.sql`, `badminton-v2/supabase/migrations/041_notifications_realtime.sql`
  - Subscribers: `badminton-v2/src/contexts/NotificationContext.tsx`, `badminton-v2/src/hooks/useRealtime.ts`, `badminton-v2/src/hooks/useMatchCheers.ts`, `badminton-v2/src/hooks/useRoster.ts`, `badminton-v2/src/views/ProfileView.tsx`, `badminton-v2/src/views/TodayView.tsx`, `badminton-v2/src/views/SessionPlayerDetailView.tsx`

## Data Storage

**Databases:**
- Supabase Postgres
  - Connection: Client-side app uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  - Admin/script access: `SUPABASE_SERVICE_ROLE_KEY`
  - Client: `@supabase/supabase-js`
  - Schema source: `badminton-v2/supabase/migrations/`
  - Generated types: `badminton-v2/src/types/database.ts`

**File Storage:**
- Local filesystem only detected in the repo
- No `supabase.storage` or other object-storage client usage detected in `badminton-v2/src/`, `badminton-v2/scripts/`, or `badminton-v2/tests/`

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: PKCE client flow in `badminton-v2/src/lib/supabase.ts`, session listeners in `badminton-v2/src/contexts/AuthContext.tsx` and `badminton-v2/src/hooks/useRegistration.ts`, role lookup from `public.profiles`

**Identity Sources:**
- Google OAuth for production/user-facing sign-in in `badminton-v2/src/App.tsx`, `badminton-v2/src/views/HomeView.tsx`, and `badminton-v2/src/hooks/useRegistration.ts`
- Email/password sign-in for local dev test accounts in `badminton-v2/src/components/DevLoginPanel.tsx`
- Supabase Admin API for provisioning test and copied users in `badminton-v2/scripts/seed-test-users.ts`, `badminton-v2/scripts/seed-extra-users.ts`, and `badminton-v2/scripts/copy-prod-profiles-to-dev.ts`

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Browser console and script stdout/stderr only
- Examples: `console.error` in `badminton-v2/scripts/seed-test-users.ts` and `badminton-v2/scripts/copy-prod-profiles-to-dev.ts`, `console.error` in `badminton-v2/src/hooks/useRegistration.ts`

## CI/CD & Deployment

**Hosting:**
- Vercel static deployment with SPA rewrites in `badminton-v2/vercel.json`
- Generated output present under `badminton-v2/.vercel/output/`

**CI Pipeline:**
- Not detected

## Environment Configuration

**Required env vars:**
- `VITE_APP_URL` - OAuth redirect base used in `badminton-v2/src/App.tsx` and `badminton-v2/src/views/HomeView.tsx`
- `VITE_SUPABASE_URL` - Supabase project URL for app and scripts
- `VITE_SUPABASE_ANON_KEY` - Public client key for browser auth/data access
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key for scripts and DB-prep E2E flows in `badminton-v2/scripts/` and `badminton-v2/tests/registration-limit.spec.ts`

**Secrets location:**
- Local env files under `badminton-v2/.env*`
- Vercel preview-local env file exists at `badminton-v2/.vercel/.env.preview.local`
- Supabase-side secrets/config are implied by migration comments and project setup, but no local edge-function source is present in `badminton-v2/supabase/`

## Webhooks & Callbacks

**Incoming:**
- OAuth redirect callbacks handled by the SPA routes `/`, `/admin`, and `/register` in `badminton-v2/src/App.tsx`, `badminton-v2/src/views/HomeView.tsx`, and `badminton-v2/src/hooks/useRegistration.ts`
- No standalone HTTP webhook endpoints are implemented in this repo

**Outgoing:**
- None active in current repo code
- Historical outbound email/edge-function design exists only in Supabase migration history `badminton-v2/supabase/migrations/045_enable_pgnet_email_logs.sql` through `badminton-v2/supabase/migrations/050_rollback_email_system.sql`; the rollback migration indicates that path is not current runtime behavior

---

*Integration audit: 2026-05-12*
