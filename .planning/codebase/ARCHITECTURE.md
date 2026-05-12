<!-- refreshed: 2026-05-12 -->
# Architecture

**Analysis Date:** 2026-05-12

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                 Browser SPA / Route Shell                  │
├──────────────────┬──────────────────┬───────────────────────┤
│   Router/App     │   Layout/Auth    │   Lazy-loaded Views   │
│`badminton-v2/`   │`badminton-v2/`   │   `badminton-v2/`     │
│`src/main.tsx`    │`src/App.tsx`     │`src/views/*`          │
│`src/App.tsx`     │`src/layouts/`    │                       │
│                  │`src/contexts/`   │                       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Hook / Domain / Client Integration Layer        │
│ `badminton-v2/src/hooks/*`, `badminton-v2/src/lib/*`,      │
│ `badminton-v2/src/types/database.ts`                       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│            Supabase Auth + Postgres + Realtime             │
│ `badminton-v2/src/lib/supabase.ts`                         │
│ `badminton-v2/supabase/migrations/*.sql`                   │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `main.tsx` | Boots React, wraps the app in `BrowserRouter`, mounts the SPA | `badminton-v2/src/main.tsx` |
| `App.tsx` | Defines route graph, lazy-loads views, owns admin-only route guard, mounts global providers/toasts | `badminton-v2/src/App.tsx` |
| `AuthProvider` | Resolves Supabase session, loads profile role, exposes `user`, `role`, and loading state | `badminton-v2/src/contexts/AuthContext.tsx` |
| `PlayerLayout` | Wraps player/admin pages with top navigation, notification provider, and cheers gate | `badminton-v2/src/layouts/PlayerLayout.tsx` |
| `useSession` | Implements the admin session state machine across setup, registration, scheduling, and live play | `badminton-v2/src/hooks/useSession.ts` |
| `useRegistration` | Validates invitation tokens, ensures profile existence, and inserts registrations | `badminton-v2/src/hooks/useRegistration.ts` |
| `useRealtime` | Encapsulates Supabase channel subscription and connection status reporting | `badminton-v2/src/hooks/useRealtime.ts` |
| `matchGenerator` | Houses the match scheduling engine and scoring heuristics independent of React | `badminton-v2/src/lib/matchGenerator.ts` |

## Pattern Overview

**Overall:** Route-oriented React SPA with hook-based data access over a client-side Supabase integration.

**Key Characteristics:**
- Use route views in `badminton-v2/src/views/` as orchestration points, not as shared business-logic containers.
- Put Supabase reads, writes, and derived loading state in custom hooks under `badminton-v2/src/hooks/`.
- Keep pure domain logic separate from React in `badminton-v2/src/lib/` and type generated database surfaces in `badminton-v2/src/types/database.ts`.

## Layers

**App Shell and Routing:**
- Purpose: Start the client app, define routes, protect admin pages, and mount cross-cutting providers.
- Location: `badminton-v2/src/main.tsx`, `badminton-v2/src/App.tsx`
- Contains: `BrowserRouter`, `Routes`, lazy imports, `AdminRoute`, `AuthProvider`, `Toaster`
- Depends on: React, `react-router`, `AuthContext`, `PlayerLayout`, `supabase`
- Used by: Every runtime page

**Presentation Layer:**
- Purpose: Render screens and reusable UI for player, admin, finance, inventory, and live-board flows.
- Location: `badminton-v2/src/views/`, `badminton-v2/src/components/`, `badminton-v2/src/layouts/`
- Contains: Route views, cards, tables, panels, nav, dialog wrappers
- Depends on: Hooks, contexts, shared UI primitives in `badminton-v2/src/components/ui/`
- Used by: Route shell in `badminton-v2/src/App.tsx`

**Stateful Data Hooks:**
- Purpose: Fetch data, manage loading/error state, and expose domain actions to views.
- Location: `badminton-v2/src/hooks/`
- Contains: Session lifecycle hooks, registration hooks, player schedule hooks, finance/inventory hooks, realtime hooks
- Depends on: `badminton-v2/src/lib/supabase.ts`, `toast` from `sonner`, sometimes `AuthContext`
- Used by: Views, layout, notification provider

**Domain Utilities and Shared Helpers:**
- Purpose: Keep non-UI logic reusable and testable outside component trees.
- Location: `badminton-v2/src/lib/`, `badminton-v2/src/utils/`
- Contains: Match generation engine, `cn` helper, currency formatting, typed Supabase client
- Depends on: Local types and external libraries only
- Used by: Hooks, views, tests

**Persistence and Backend Contract:**
- Purpose: Provide authentication, database tables, SQL functions, and realtime tables consumed by the SPA.
- Location: `badminton-v2/src/lib/supabase.ts`, `badminton-v2/src/types/database.ts`, `badminton-v2/supabase/migrations/`
- Contains: Client initialization, generated DB typings, schema migrations such as `058_create_get_session_finance.sql`
- Depends on: Supabase project configuration and runtime env vars
- Used by: All data hooks and a few route views/components

## Data Flow

### Primary Request Path

1. The browser enters the app through `BrowserRouter` and `App` (`badminton-v2/src/main.tsx:7`, `badminton-v2/src/App.tsx:48`).
2. `App` resolves the matching route, wraps protected pages with `AdminRoute`, and lazy-loads the target view (`badminton-v2/src/App.tsx:10`, `badminton-v2/src/App.tsx:53`, `badminton-v2/src/App.tsx:74`).
3. The selected view calls a feature hook, which queries or mutates Supabase through the singleton client (`badminton-v2/src/views/AdminView.tsx:118`, `badminton-v2/src/hooks/useSessionList.ts:18`, `badminton-v2/src/lib/supabase.ts:4`).

### Session Lifecycle Flow

1. `/session/:sessionId` renders `SessionView`, which branches on `session.status` (`badminton-v2/src/App.tsx:77`, `badminton-v2/src/views/SessionView.tsx:256`).
2. `useSession` loads the session, invitation, and registration counts, then exposes actions such as `openRegistration`, `lockSchedule`, and `startSession` (`badminton-v2/src/hooks/useSession.ts:69`, `badminton-v2/src/hooks/useSession.ts:135`, `badminton-v2/src/hooks/useSession.ts:222`, `badminton-v2/src/hooks/useSession.ts:279`).
3. When a live session starts, `LiveSessionView` combines `useAdminSession` with `useRealtime` so changes in `matches` refresh the admin court state (`badminton-v2/src/views/SessionView.tsx:51`, `badminton-v2/src/hooks/useAdminSession.ts:57`, `badminton-v2/src/hooks/useRealtime.ts:27`).

### Public Registration Flow

1. `/register` renders `RegisterView`, restores the invitation token from query params or local storage, and gates in-app browsers (`badminton-v2/src/App.tsx:60`, `badminton-v2/src/views/RegisterView.tsx:12`, `badminton-v2/src/views/RegisterView.tsx:40`).
2. `useRegistration` waits for Supabase auth, validates the invitation row, ensures the profile exists, and checks duplicate/full registration state (`badminton-v2/src/hooks/useRegistration.ts:25`, `badminton-v2/src/hooks/useRegistration.ts:40`, `badminton-v2/src/hooks/useRegistration.ts:104`).
3. Once the user is authenticated and the token is valid, `RegisterView` auto-calls `register()`, which inserts into `session_registrations` (`badminton-v2/src/views/RegisterView.tsx:48`, `badminton-v2/src/hooks/useRegistration.ts:145`).

**State Management:**
- Use local React state inside hooks and components.
- Share auth and notification state through `AuthContext` and `NotificationContext`.
- Trigger refetches with incrementing refresh keys or explicit `fetchAll` callbacks instead of a centralized client-state library.

## Key Abstractions

**Supabase Client Singleton:**
- Purpose: Centralize typed access to auth, tables, RPCs, and realtime channels.
- Examples: `badminton-v2/src/lib/supabase.ts`, `badminton-v2/src/hooks/useRealtime.ts`, `badminton-v2/src/hooks/useFinanceSessions.ts`
- Pattern: Import a single `supabase` instance and call `.from(...)`, `.rpc(...)`, or `.channel(...)`

**Feature Hooks as State Machines:**
- Purpose: Model domain workflows as hooks that expose current data plus allowed actions.
- Examples: `badminton-v2/src/hooks/useSession.ts`, `badminton-v2/src/hooks/useRegistration.ts`, `badminton-v2/src/hooks/useSessionFinance.ts`
- Pattern: Encapsulate fetch-on-mount, loading flags, optimistic refetch, and command functions behind one hook return object

**Pure Scheduling Engine:**
- Purpose: Separate fairness and team-balancing logic from the admin UI.
- Examples: `badminton-v2/src/lib/matchGenerator.ts`, tests in `badminton-v2/src/__tests__/matchGenerator.test.ts`
- Pattern: Pure TypeScript functions with typed inputs/outputs and no React or Supabase dependency

**Database-First Finance Contract:**
- Purpose: Keep financial arithmetic in SQL and consume summarized rows in the client.
- Examples: `badminton-v2/src/hooks/useFinanceSessions.ts`, `badminton-v2/src/hooks/useSessionFinance.ts`, `badminton-v2/supabase/migrations/058_create_get_session_finance.sql`
- Pattern: Query RPC results and map them to view models instead of recomputing totals in components

## Entry Points

**Browser Bootstrap:**
- Location: `badminton-v2/src/main.tsx`
- Triggers: `vite` serving `badminton-v2/index.html`
- Responsibilities: Mount React, enable strict mode, provide router context

**Route Shell:**
- Location: `badminton-v2/src/App.tsx`
- Triggers: Initial page load and all client-side navigation
- Responsibilities: Route matching, lazy loading, auth gating, provider composition

**Seed/Test Scripts:**
- Location: `badminton-v2/scripts/seed-test-users.ts`, `badminton-v2/scripts/seed-extra-users.ts`
- Triggers: `npm run seed` or direct `tsx` execution
- Responsibilities: Populate Supabase-backed test users and test data outside the SPA

**Schema Evolution:**
- Location: `badminton-v2/supabase/migrations/*.sql`
- Triggers: Manual migration application in Supabase
- Responsibilities: Define tables, policies, triggers, RPCs, and finance/inventory backend behavior

## Architectural Constraints

- **Threading:** Single-threaded browser event loop with async network I/O only; no worker architecture is present.
- **Global state:** Shared mutable state is limited to `AuthContext` in `badminton-v2/src/contexts/AuthContext.tsx`, `NotificationContext` in `badminton-v2/src/contexts/NotificationContext.tsx`, and the singleton Supabase client in `badminton-v2/src/lib/supabase.ts`.
- **Circular imports:** No circular dependency chain was detected in the inspected architecture-critical files.
- **Route protection:** Admin-only screens must stay behind `AdminRoute` in `badminton-v2/src/App.tsx`; role checks are not duplicated per admin view.
- **Database ownership:** Core finance totals are expected from SQL (`get_session_finance`) and should not be reimplemented in React.

## Anti-Patterns

### View-Level Supabase Calls

**What happens:** Some route views still query or mutate Supabase directly instead of delegating all data access to a hook, for example `badminton-v2/src/views/HomeView.tsx` and `badminton-v2/src/views/AdminView.tsx`.
**Why it's wrong:** It mixes rendering with persistence logic and makes flows harder to reuse and test.
**Do this instead:** Follow the `useSessionList` / `useFinanceSessions` pattern in `badminton-v2/src/hooks/useSessionList.ts` and `badminton-v2/src/hooks/useFinanceSessions.ts`.

### Repeated Match Hydration Logic

**What happens:** Match-to-display mapping and profile name resolution are duplicated across `badminton-v2/src/hooks/useAdminSession.ts`, `badminton-v2/src/hooks/useCourtState.ts`, and `badminton-v2/src/views/PlayerView.tsx`.
**Why it's wrong:** Changes to match display semantics have to be applied in multiple places and can drift.
**Do this instead:** Extract shared match hydration helpers into `badminton-v2/src/hooks/` or `badminton-v2/src/lib/` and reuse them from each consumer.

## Error Handling

**Strategy:** Use local loading flags, early returns, and toast-based user feedback around Supabase operations.

**Patterns:**
- Report user-visible errors with `toast.error(...)` from `sonner`, as in `badminton-v2/src/hooks/useSession.ts` and `badminton-v2/src/views/HomeView.tsx`.
- Fail closed in route guards and registration gates by rendering fallback screens when auth, token, or session lookup fails.

## Cross-Cutting Concerns

**Logging:** Minimal ad hoc console logging exists, mainly in `badminton-v2/src/views/RegisterView.tsx`; most flows rely on toasts instead of structured logging.
**Validation:** Form validation uses Zod plus React Hook Form in `badminton-v2/src/views/InventoryView.tsx`; many other flows rely on imperative checks inside hooks or click handlers.
**Authentication:** Supabase OAuth plus profile-role lookup in `badminton-v2/src/contexts/AuthContext.tsx`, with admin route enforcement in `badminton-v2/src/App.tsx`.

---

*Architecture analysis: 2026-05-12*
