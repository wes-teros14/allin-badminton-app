---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-18'
inputDocuments: ['prd.md', 'ux-design-specification.md']
workflowType: 'architecture'
project_name: 'badminton_v2'
user_name: 'Wes'
date: '2026-03-18'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
35 FRs across 8 capability areas: Authentication & Identity (FR1–6), Player Registration (FR7–10), Match Generation & Schedule Management (FR11–15), Session Execution — Kiosk (FR16–19), Session Execution — Player View (FR20–22), Real-Time Sync (FR23–25), Admin Session Management (FR26–28), Player Statistics & Attendance (FR29–35).

Architecturally significant FRs:
- FR5/FR6: Time-limited registration URL — requires invitation/token table with invalidation
- FR11–15: Match generation algorithm — 10–30 players, ≤5s, fair rotation, no repeat pairings
- FR17: Kiosk Finish action — must capture game outcome (win/loss) for FR29 stats tracking
- FR18/FR21/FR24: ≤2s real-time updates across all three views simultaneously
- FR29–FR35: Win/loss and attendance statistics — requires outcome field on match results

**Non-Functional Requirements:**
- Performance: Kiosk updates ≤2s; user interactions within 500ms (95th percentile); match generation within 5s
- Security: Supabase RLS enforces role boundaries server-side; registration URLs expire on close
- Reliability: App functional for full 2–4 hour session; real-time failure must not stop session
- Scalability: 10–30 concurrent users within Supabase free-tier limits (200 connections max)

**Scale & Complexity:**
- Complexity level: Low — single-tenant, fixed small user base, no regulatory requirements
- Primary domain: Full-stack React SPA + Supabase BaaS
- Estimated architectural components: 6 (Auth, Session, Match Generation, Realtime, Stats, Admin CRUD)

### Technical Constraints & Dependencies

- **Stack is fixed:** React (Vite) + Supabase (PostgreSQL + Realtime + Auth) — no alternatives
- **Free-tier ceiling:** 500MB DB, 2GB bandwidth/month, 200 concurrent Realtime connections
- **Google OAuth only:** No email/password auth; player identity = Google account
- **Brownfield context:** Replacing Streamlit + Firestore app — no data migration required (v2 starts fresh; v1 continues until v2 is ready)
- **Solo developer:** Architecture must minimise operational complexity

### Cross-Cutting Concerns Identified

1. **Real-time subscription management** — Three views subscribing to overlapping session data; channel design and subscription lifecycle must be defined
2. **Session state machine** — States gate many FRs; must be modelled explicitly in DB and enforced in both RLS policies and client logic
3. **RLS policy design** — Security boundary for all three roles; must be designed alongside schema, not after
4. **Match generation algorithm** — Non-trivial scheduling logic; placement decision (client vs. Edge Function) affects architecture
5. **Win/loss outcome capture** — FR17 (Finish) must record outcome for FR29 stats; kiosk UX needs an outcome selection mechanism not currently specified

## Starter Template Evaluation

### Primary Technology Domain

React SPA (Vite) + Supabase BaaS — stack fixed by PRD; no alternatives considered.

### Starter Options Considered

No maintained community starter combines all four required tools (Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui + Supabase). Options evaluated:

| Approach | Stack Coverage | Verdict |
|---|---|---|
| `npm create vite@latest --template react-ts` + manual layering | All tools, current versions | **Selected** |
| `doinel1a/vite-react-ts-shadcn-ui` | React 19 + TS + shadcn + Tailwind 4 + Vite 7 — no Supabase | Close but outdated Vite and no Supabase |
| `chunxchun/erp-starter` | Vite + React + Tailwind + shadcn + Supabase | Includes Supabase but low maintenance activity |

### Selected Approach: Official Vite React-TS + Manual Tool Layering

**Rationale:** The official Vite scaffold with `react-ts` template is the most current and lowest-risk base. Each additional tool (Tailwind CSS v4, shadcn/ui, Supabase JS) has a well-defined installation path. Community starters add maintenance risk for a solo-developer project.

**Initialization Sequence:**

```bash
npm create vite@latest badminton-v2 -- --template react-ts
cd badminton-v2
npm install
npm install @supabase/supabase-js
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init
```

**Architectural Decisions Provided by This Setup:**

**Language & Runtime:** TypeScript strict mode (via `react-ts` template). All source files `.tsx`/`.ts`. `tsconfig.json` pre-configured with path aliases after `shadcn@latest init`.

**Styling Solution:** Tailwind CSS v4 via `@tailwindcss/vite` Vite plugin — no `tailwind.config.js` needed; CSS variables defined in global CSS. shadcn/ui wires up `components.json` and generates component files into `src/components/ui/`. Custom design tokens (`--primary: #9C51B6`) live in CSS variables.

**Build Tooling:** Vite 8.0 with Rolldown (Rust-based bundler, replaces esbuild + Rollup split). `vite.config.ts` + `@tailwindcss/vite` plugin. HMR out of the box.

**Testing Framework:** Not included in scaffold — to be added in implementation phase (Vitest recommended for Vite alignment).

**Code Organization:** `src/` layout; routing, views, and component directories established in story 1 (project init). shadcn/ui components land in `src/components/ui/`.

**Development Experience:** Hot reloading via Vite HMR; TypeScript IDE support; ESLint baseline from Vite template; `.env.local` for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Note:** Project initialization using this sequence is the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Admin role determination via `profiles` table with `role` column
- Registration token pattern via `session_invitations` table
- Match generation placement: client-side TypeScript
- Routing library: React Router v7
- State management: useState + custom Supabase hooks

**Important Decisions (Shape Architecture):**
- Migration tooling: Supabase CLI
- Client validation: Zod
- Error handling: `{ data, error }` destructuring + shadcn toast
- Route-level code splitting via React.lazy + Suspense
- Hosting: Vercel with git auto-deploy

**Deferred Decisions (Post-MVP):**
- Testing framework (Vitest) — add in implementation phase, not blocking story 1
- CI/CD pipeline beyond Vercel git integration — not needed at this scale

---

### Data Architecture

**Migration Tooling:** Supabase CLI (`supabase migration new` / `supabase db push`). Schema managed as versioned SQL files in `supabase/migrations/`. Provides version-controlled schema history alongside application code.

**Client-Side Validation:** Zod. TypeScript-native schema validation for all form inputs and data payloads before Supabase writes. Pairs with React Hook Form via `@hookform/resolvers/zod`.

**Caching Strategy:** None beyond Supabase Realtime. Live session data is pushed via Realtime subscriptions; no additional cache layer needed at 10–30 concurrent users.

**Registration Token Storage:** Dedicated `session_invitations` table with columns `token` (UUID), `session_id`, `is_active` (boolean), `created_at`. Admin generates token on demand; players use it to self-register; admin invalidates by setting `is_active = false` (FR5/FR6).

---

### Authentication & Security

**Auth Provider:** Supabase Auth with Google OAuth only. No email/password. Player identity is their Google account.

**Role Determination:** `profiles` table with `role` column (`'admin' | 'player'`). Created on first sign-in via Supabase Auth trigger or `onAuthStateChange` handler. RLS policies reference `profiles.role` to enforce access boundaries server-side.

**Authorization Model:** Supabase Row-Level Security (RLS) is the sole security boundary. All role enforcement lives in PostgreSQL policies, not client-side guards. Client routing guards are UX convenience only — they do not replace RLS.

**Unauthenticated Access:** Kiosk (`/kiosk`) and Player (`/player/:playerId`) views are public. No Supabase session required. RLS policies use `auth.role() = 'anon'` for these read paths.

---

### API & Communication Patterns

**Data Access:** Supabase JS client (`@supabase/supabase-js`) for all DB reads/writes. No custom REST API layer. Queries use the Supabase query builder directly in custom hooks.

**Match Generation:** Client-side TypeScript algorithm. Runs in the browser; no Edge Function. Rationale: 10–30 players is not computationally heavy; avoids cold-start latency and Edge Function deployment complexity for a solo-developer project. Algorithm is unit-testable with Vitest.

**Real-Time Communication:** Supabase Realtime `postgres_changes` subscriptions. Channel-per-view pattern (see Cross-Cutting Concern #1). Subscription lifecycle managed in custom hooks with cleanup on unmount.

**Error Handling Standard:** All Supabase calls destructure `{ data, error }`. Errors surface to the user via shadcn/ui toast notifications. No silent failures. Network/Realtime errors on the kiosk trigger the FR25 manual refresh fallback.

---

### Frontend Architecture

**Routing:** React Router v7. Three top-level routes: `/kiosk`, `/player/:playerId`, `/admin`. Protected admin route checks `profiles.role`; redirects to `/` if not admin. Kiosk and Player routes are public.

**State Management:** useState + custom hooks per view. No global state library. Custom hooks encapsulate Supabase subscriptions and queries:
- `useSession(sessionId)` — session state machine state
- `useMatchQueue(courtId)` — per-court ordered match queue
- `useCourtState(sessionId)` — all courts + current/next match
- `usePlayerSchedule(playerId, sessionId)` — player's personal match list
- `useAdminSession(sessionId)` — full admin view state

**Component Architecture:** Three view-level page components (`KioskView`, `PlayerView`, `AdminView`), each composed from 8 custom components defined in the UX spec (`CourtCard`, `GameCard`, `StatusChip`, `LiveIndicator`, `PlayerScheduleHeader`, `RegistrationURLCard`, `MatchGeneratorPanel`, `CourtTabs`) plus shadcn/ui primitives in `src/components/ui/`.

**Code Splitting:** React.lazy + Suspense per route. Each view bundle loads independently. Kiosk does not load Admin bundle; Player does not load Kiosk bundle.

---

### Infrastructure & Deployment

**Hosting:** Vercel. Free tier, native Vite/React SPA support, automatic HTTPS, global CDN. No configuration needed beyond `vercel.json` for SPA fallback routing.

**CI/CD:** Vercel git integration — auto-deploy on push to `main`. No GitHub Actions pipeline at this stage.

**Environment Configuration:** `.env.local` for development (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Vercel environment variables for production. Vite exposes `VITE_` prefixed vars to the client bundle only.

**Monitoring:** None beyond Vercel deployment logs and Supabase dashboard. Acceptable for a private tool with a known user base.

---

### Decision Impact Analysis

**Implementation Sequence:**
1. Project scaffold (Vite + Tailwind + shadcn + Supabase client)
2. Supabase project setup + `profiles` table + Google OAuth config
3. `session_invitations` table + RLS policies
4. Session state machine schema + core tables
5. Match generation algorithm (client-side TypeScript, unit-tested)
6. Realtime subscription hooks
7. View implementations (Kiosk → Player → Admin)
8. Stats/attendance recording

**Cross-Component Dependencies:**
- RLS policies depend on `profiles.role` — must be designed before any authenticated feature
- Realtime hooks depend on channel design — must be defined before Kiosk and Player views
- Match generation algorithm must be complete before Kiosk Finish flow (FR17) and stats recording (FR29)
- `session_invitations` table must exist before registration URL feature (FR5/FR6)

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case` plural — `sessions`, `matches`, `profiles`, `session_invitations`, `match_results`, `court_queues`
- Columns: `snake_case` — `player_id`, `session_id`, `created_at`, `is_active`, `court_number`
- Foreign keys: `{referenced_table_singular}_id` — `session_id`, `player_id`
- Boolean columns: `is_` prefix — `is_active`, `is_complete`
- Timestamp columns: `_at` suffix — `created_at`, `finished_at`, `registered_at`

**Code Naming Conventions:**
- React components: `PascalCase` function + `PascalCase` filename — `CourtCard.tsx`, `export function CourtCard`
- Custom hooks: `use` prefix + `camelCase` — `useSession`, `useMatchQueue`, `useCourtState`
- Utility functions: `camelCase` verbs — `generateMatchSchedule`, `formatPlayerName`, `advanceCourtQueue`
- TypeScript types/interfaces: `PascalCase` — `Session`, `Match`, `MatchResult`, `CourtState`
- Constants: `SCREAMING_SNAKE_CASE` — `SESSION_STATES`, `MAX_COURTS`
- Route params: `camelCase` in React Router — `:playerId`, `:sessionId`

**CSS Variable Naming:** `--kebab-case` per Tailwind CSS v4 convention — `--primary`, `--primary-hover`, `--success`, `--background`

---

### Structure Patterns

**Project Layout:**

```
src/
  components/
    ui/                    # shadcn/ui generated — never edit directly
    CourtCard.tsx          # domain components at root of components/
    GameCard.tsx
    StatusChip.tsx
    LiveIndicator.tsx
    PlayerScheduleHeader.tsx
    RegistrationURLCard.tsx
    MatchGeneratorPanel.tsx
    CourtTabs.tsx
  views/
    KioskView.tsx
    PlayerView.tsx
    AdminView.tsx
  hooks/
    useSession.ts
    useMatchQueue.ts
    useCourtState.ts
    usePlayerSchedule.ts
    useAdminSession.ts
  lib/
    supabase.ts            # Supabase client singleton — single export
    matchGenerator.ts      # match generation algorithm
    utils.ts               # shared pure utility functions
  types/
    database.ts            # Supabase CLI-generated DB row types
    app.ts                 # app-level domain types
  App.tsx
  main.tsx
```

**File Organisation Rules:**
- shadcn/ui components live only in `src/components/ui/` — never mix domain components there
- One component per file — no barrel exports for domain components
- Types in `src/types/` — not inline in component files
- Tests co-located: `CourtCard.test.tsx` next to `CourtCard.tsx`

---

### Format Patterns

**Supabase Data Format:**
- DB columns stay `snake_case` through to TypeScript types — no camelCase mapping layer
- Use Supabase CLI-generated types (`database.ts`) for all table row types
- Dates stored as `timestamptz` in DB; displayed using `Intl.DateTimeFormat` in UI — never raw ISO strings in UI

**Supabase Client Pattern:**

```typescript
// src/lib/supabase.ts — single source of truth
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

All files import `supabase` from `@/lib/supabase` — never create a second client instance.

**Query Response Pattern:**

```typescript
// Always destructure { data, error } — never assume success
const { data, error } = await supabase.from('sessions').select('*')
if (error) {
  toast.error(error.message)
  return
}
// use data here
```

---

### Communication Patterns

**Realtime Subscription Rules:**
- One Supabase Realtime channel per view, not per component
- Channel naming: `kiosk-{sessionId}`, `player-{playerId}-{sessionId}`, `admin-{sessionId}`
- Subscriptions managed exclusively inside custom hooks — never directly in components
- Always return cleanup in `useEffect`: `return () => { supabase.removeChannel(channel) }`
- On Realtime disconnect: set `isConnected = false` in hook state; surface `LiveIndicator` error state + manual refresh button (FR25)

**Hook State Shape:**

```typescript
// Standard hook return shape
return {
  data,          // the actual data
  isLoading,     // boolean — true until first data arrives
  isConnected,   // boolean — Realtime connection status
  error,         // string | null — last error message
  refetch,       // () => void — manual refresh fallback
}
```

---

### Process Patterns

**Error Handling:**
- All Supabase query errors: `toast.error(error.message)` — no silent failures
- Realtime errors: set `isConnected = false`, show manual refresh UI — do not crash the view
- Form validation errors: Zod schema + React Hook Form `errors` object — inline field errors
- Never use `try/catch` around Supabase queries — use `{ data, error }` destructuring instead

**Loading State:**
- Every hook exposes `isLoading: boolean`
- Show shadcn/ui `<Skeleton>` components while `isLoading === true`
- Never render empty state (`"No matches found"`) until `isLoading === false`
- Kiosk and Player views must render a loading skeleton on first mount — no blank screen flash

**Import Style:**
- Always use `@/` alias for internal imports — configured by `shadcn@latest init`
- ✅ `import { CourtCard } from '@/components/CourtCard'`
- ❌ `import { CourtCard } from '../../components/CourtCard'`

---

### Enforcement Guidelines

**All AI Agents MUST:**
- Use `snake_case` for all DB table and column names — never `camelCase` in migrations
- Import Supabase client only from `@/lib/supabase` — never instantiate a second client
- Manage Realtime subscriptions only inside custom hooks — never in component bodies
- Destructure `{ data, error }` on every Supabase call — never assume `.data` is non-null
- Use `@/` absolute imports — never relative imports crossing directory boundaries
- Place new domain components in `src/components/` — never inside `src/components/ui/`

**Anti-Patterns to Avoid:**
- ❌ `const client = createClient(...)` inside a component or hook — use the singleton
- ❌ `.from('Sessions')` — tables are lowercase `snake_case`
- ❌ `if (data.length === 0)` without checking `error` first
- ❌ Subscribing to Realtime inside a `useEffect` directly in a view — delegate to a hook
- ❌ Editing any file under `src/components/ui/` — shadcn regenerates these

## Project Structure & Boundaries

### Complete Project Directory Structure

```
badminton-v2/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── components.json              # shadcn/ui config
├── vercel.json                  # SPA fallback routing
├── .env.local                   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (gitignored)
├── .env.example                 # template for .env.local
├── .gitignore
│
├── supabase/                    # backend schema (Supabase CLI managed)
│   ├── config.toml
│   └── migrations/
│       ├── 001_create_profiles.sql          # FR1-2: user roles
│       ├── 002_create_sessions.sql          # FR26: session + state machine
│       ├── 003_create_session_invitations.sql  # FR5-6: registration URL tokens
│       ├── 004_create_matches.sql           # FR11-15: match schedule
│       ├── 005_create_court_queues.sql      # FR15-16: per-court ordered queue
│       ├── 006_create_match_results.sql     # FR17, FR29-35: outcomes + stats
│       └── 007_rls_policies.sql             # security: all three roles
│
└── src/
    ├── main.tsx                 # React entry point, BrowserRouter
    ├── App.tsx                  # route definitions, React.lazy views
    ├── index.css                # Tailwind directives, CSS variable tokens
    │
    ├── views/                   # one file per role view
    │   ├── KioskView.tsx        # FR16-19, FR23-25 — landscape tablet
    │   ├── PlayerView.tsx       # FR20-22, FR31, FR35 — mobile, public
    │   └── AdminView.tsx        # FR1-2, FR5-15, FR19, FR26-35 — desktop + mobile
    │
    ├── components/
    │   ├── ui/                  # shadcn/ui generated — never edit directly
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── badge.tsx
    │   │   ├── skeleton.tsx
    │   │   ├── sonner.tsx       # toast notifications
    │   │   ├── dialog.tsx
    │   │   ├── input.tsx
    │   │   ├── label.tsx
    │   │   └── select.tsx
    │   │
    │   ├── CourtCard.tsx        # FR16: single court panel (current + next game)
    │   ├── GameCard.tsx         # game display used by kiosk + player views
    │   ├── StatusChip.tsx       # match status badge (playing / up next / waiting)
    │   ├── LiveIndicator.tsx    # FR18/FR21/FR25: realtime connection dot + fallback
    │   ├── PlayerScheduleHeader.tsx  # FR20: player name + session context header
    │   ├── RegistrationURLCard.tsx   # FR5-6: URL display + copy + close controls
    │   ├── MatchGeneratorPanel.tsx   # FR11-13: roster review + generate + lock
    │   └── CourtTabs.tsx        # FR28: admin court switching tabs
    │
    ├── hooks/                   # all Supabase queries and Realtime subscriptions
    │   ├── useAuth.ts           # FR1-2: session user, role lookup from profiles
    │   ├── useSession.ts        # FR26: active session + state machine transitions
    │   ├── useMatchQueue.ts     # FR15, FR17: per-court ordered queue + advance
    │   ├── useCourtState.ts     # FR16, FR28: all courts with current/next match
    │   ├── usePlayerSchedule.ts # FR20-22: player's full match list + completed state
    │   ├── useAdminSession.ts   # FR9-15, FR26-28: full admin session state
    │   └── useRealtime.ts       # FR18, FR21, FR23-25: connection status + channel mgmt
    │
    ├── lib/
    │   ├── supabase.ts          # singleton client, typed with Database
    │   ├── matchGenerator.ts    # FR11: pure algorithm — player list → match schedule
    │   └── utils.ts             # shared helpers (date formatting, etc.)
    │
    └── types/
        ├── database.ts          # auto-generated by: supabase gen types typescript
        └── app.ts               # Session, Match, CourtState, PlayerSchedule, MatchResult
```

---

### Architectural Boundaries

**Auth Boundary:**
- Supabase Auth handles Google OAuth flow
- `useAuth.ts` exposes `{ user, role, isLoading }` — role resolved by querying `profiles` table
- `App.tsx` wraps `/admin` in a route guard that redirects to `/` if `role !== 'admin'`
- Route guards are UX-only; all data operations are protected by RLS independent of client guards

**Data Access Boundary:**
- All Supabase reads/writes flow through the singleton in `src/lib/supabase.ts`
- No component makes direct Supabase calls — all data access is via hooks
- Hooks own the query + subscription lifecycle; views are purely presentational

**Realtime Boundary:**
- `useRealtime.ts` manages channel creation and `isConnected` state
- Each view-level hook calls `useRealtime` internally — views never touch `supabase.channel()` directly
- On disconnect: `LiveIndicator` changes to error state; `refetch()` becomes the manual fallback (FR25)

**Match Generation Boundary:**
- `lib/matchGenerator.ts` is a pure function: `generateSchedule(players: Player[]) → Match[]`
- No Supabase calls inside the algorithm — caller in `MatchGeneratorPanel` handles save
- Fully unit-testable in isolation with Vitest

**Schema Boundary:**
- `supabase/migrations/` is the single source of truth for DB structure
- TypeScript types derived from DB via `supabase gen types typescript --local > src/types/database.ts`
- Never hand-write `database.ts` — always regenerate from migrations

---

### Requirements to Structure Mapping

| FR Group | Files |
|---|---|
| FR1–2 Auth & Admin identity | `hooks/useAuth.ts`, `migrations/001_create_profiles.sql`, `migrations/007_rls_policies.sql` |
| FR3–4 Public view access | `App.tsx` (public routes), `views/KioskView.tsx`, `views/PlayerView.tsx` |
| FR5–6 Registration URL | `components/RegistrationURLCard.tsx`, `migrations/003_create_session_invitations.sql` |
| FR7–10 Player registration | `views/AdminView.tsx` (roster section), `migrations/003_create_session_invitations.sql` |
| FR11–15 Match generation | `components/MatchGeneratorPanel.tsx`, `lib/matchGenerator.ts`, `migrations/004_create_matches.sql` |
| FR15 Court queue | `migrations/005_create_court_queues.sql`, `hooks/useMatchQueue.ts` |
| FR16–19 Kiosk execution | `views/KioskView.tsx`, `components/CourtCard.tsx`, `components/GameCard.tsx`, `hooks/useCourtState.ts` |
| FR17 Finish + outcome | `components/CourtCard.tsx` (Finish + winner selection), `migrations/006_create_match_results.sql` |
| FR20–22 Player view | `views/PlayerView.tsx`, `components/PlayerScheduleHeader.tsx`, `hooks/usePlayerSchedule.ts` |
| FR23–25 Realtime sync | `hooks/useRealtime.ts`, `components/LiveIndicator.tsx` (all three views) |
| FR26–28 Admin session mgmt | `views/AdminView.tsx`, `components/CourtTabs.tsx`, `hooks/useAdminSession.ts` |
| FR29–35 Stats & attendance | `views/AdminView.tsx` (stats section), `views/PlayerView.tsx` (stats section), `migrations/006_create_match_results.sql` |

---

### Integration Points

**Internal Communication:**
- Views → Hooks (data + state)
- Hooks → `lib/supabase.ts` (DB queries + Realtime)
- `MatchGeneratorPanel` → `lib/matchGenerator.ts` → Supabase write (on lock)

**External Integrations:**
- **Supabase Auth** — Google OAuth redirect flow; `onAuthStateChange` in `useAuth.ts`
- **Supabase Realtime** — `postgres_changes` on `matches`, `court_queues`, `sessions` tables
- **Vercel** — hosts compiled `dist/` output; `vercel.json` rewrites all paths to `index.html`

**Data Flow:**

```
Admin action (e.g., generate schedule)
  → MatchGeneratorPanel
    → matchGenerator.ts (pure compute)
      → supabase.from('matches').insert(...)
        → Supabase DB
          → Realtime postgres_changes event
            → useCourtState / usePlayerSchedule / useAdminSession (all three views)
              → KioskView + PlayerView + AdminView re-render within ≤2s
```

---

### Development Workflow

**Dev server:** `npm run dev` → Vite 8 at `localhost:5173`

**Schema changes:** `supabase migration new <name>` → edit SQL → `supabase db push` → `supabase gen types typescript --local > src/types/database.ts`

**Production deploy:** Push to `main` → Vercel auto-deploys from git

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices are mutually compatible.
- Vite 8 + `@tailwindcss/vite` (official Tailwind v4 plugin) ✅
- shadcn/ui + Tailwind CSS v4 ✅
- `@supabase/supabase-js` v2 + React hooks ✅
- React Router v7 + React.lazy code splitting ✅
- Zod + React Hook Form via `@hookform/resolvers/zod` ✅

**Pattern Consistency:** Supabase CLI generates `snake_case` types by default — consistent with DB naming convention. `{ data, error }` destructuring is native supabase-js v2. Custom hook return shape is consistent across all 7 hooks.

**Structure Alignment:** All 8 UX-spec components are mapped to files. All 7 hooks are defined. All 35 FRs map to specific files.

---

### Requirements Coverage Validation ✅

All 35 FRs and 4 NFR groups are architecturally supported. Four gaps identified and resolved during validation.

**Non-Functional Requirements:**
- Performance ≤2s: Supabase Realtime `postgres_changes` subscriptions ✅
- Performance 500ms: Direct supabase-js queries (no custom API layer) ✅
- Performance ≤5s match gen: Client-side TypeScript, ~30 players ✅
- Security: RLS on all tables; admin enforced server-side ✅
- Reliability: Realtime fallback via `refetch()` + `LiveIndicator` (FR25) ✅
- Scalability: One Realtime channel per view (not per user) — stays well within 200-connection free-tier limit ✅

---

### Gap Analysis & Resolutions

**Gap 1 — Session State Machine (Resolved)**

States and transitions are now explicit:

```
setup → registration_open → registration_closed → schedule_locked → in_progress → complete
```

- `sessions` table has a `status` column of type PostgreSQL enum `session_status`
- Transitions are admin-only writes; RLS enforces that only `profiles.role = 'admin'` can UPDATE `sessions.status`
- Client-side `useSession.ts` reads current status and exposes transition actions

**Gap 2 — Player URL (Resolved — design changed)**

Original: `/player/:playerId` (UUID) — not shareable.

**Revised:** `/player` is the single shareable link (admin sends to WhatsApp group). Players see all registered players for the active session and tap their name to view their personal schedule. Optional bookmark URL: `/player/:nameSlug`.

- `profiles` table gains a `name_slug` column (URL-safe display name, e.g., `marco-santos`)
- Generated on first sign-in from Google display name; deduplicated on collision
- `usePlayerSchedule` accepts `nameSlug` resolved from URL param or player selection
- `KioskView` and `PlayerView` routes updated: `/kiosk`, `/player`, `/player/:nameSlug`, `/admin`

**Gap 3 — Profiles Row Creation (Resolved)**

Definitive choice: **Supabase DB trigger** (`after insert on auth.users`) creates the `profiles` row. Runs server-side, atomic with OAuth sign-in, cannot be skipped by client bugs. Trigger sets `role = 'player'` by default; admin role set manually in DB for Wes.

**Gap 4 — Win/Loss Outcome Capture (Resolved)**

`CourtCard.tsx` Finish flow: after tapping Finish, display two buttons — one per pair — showing player names. Tapping a pair records them as winners. `match_results` table stores `winning_pair_index` (1 or 2), from which win/loss per player is derived for FR29–35 stats.

---

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] All 35 FRs analysed for architectural significance
- [x] Scale and complexity assessed (low complexity, free-tier ceiling)
- [x] Technical constraints identified (fixed stack, Google OAuth, 200-connection limit)
- [x] 5 cross-cutting concerns mapped and resolved

**✅ Architectural Decisions**
- [x] Critical decisions documented (routing, state, auth, match gen, deployment)
- [x] Technology stack fully specified with versions
- [x] Integration patterns defined (Supabase JS, Realtime channels, RLS)
- [x] Performance constraints addressed architecturally

**✅ Implementation Patterns**
- [x] Naming conventions: DB snake_case, code PascalCase/camelCase, CSS --kebab-case
- [x] Structure patterns: one component per file, hooks own subscriptions, `@/` imports
- [x] Communication patterns: channel-per-view, standard hook shape, cleanup on unmount
- [x] Process patterns: `{ data, error }` destructuring, Skeleton loading, toast errors

**✅ Project Structure**
- [x] Complete directory tree with all files
- [x] All component boundaries established
- [x] All integration points mapped
- [x] All 35 FRs traced to specific files

---

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level: High** — stack is fixed and well-understood; all 35 FRs have a clear implementation home; patterns prevent agent conflicts; gaps resolved before handoff.

**Key Strengths:**
- Fixed stack eliminates technology decision fatigue during implementation
- Channel-per-view Realtime pattern keeps free-tier connection count minimal
- Client-side match generation avoids Edge Function cold-start complexity
- RLS-first security model means server enforces all role boundaries regardless of client state
- Single shareable `/player` URL simplifies the player onboarding flow

**Areas for Future Enhancement (Post-Phase 2):**
- Vitest unit tests for `matchGenerator.ts` (deferred from story 1)
- Kiosk portrait orientation guard (`screen.orientation` check in `KioskView.tsx`)
- Player notification system (Phase 3 from PRD)
- Historical session archive (Phase 3 from PRD)

---

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and component boundaries
- Refer to this document for all architectural questions
- Never bypass RLS via service-role key in client code

**First Implementation Story:**
```bash
npm create vite@latest badminton-v2 -- --template react-ts
cd badminton-v2
npm install
npm install @supabase/supabase-js
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init
```
