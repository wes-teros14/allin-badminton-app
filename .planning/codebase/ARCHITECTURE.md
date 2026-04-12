# ARCHITECTURE.md — System Design & Patterns

## Pattern

**Single-Page Application (SPA)** — React 19 + React Router v7, deployed to Vercel. No SSR. All data from Supabase (PostgreSQL + Realtime).

## Layers

```
┌─────────────────────────────────────────────────────────┐
│  Views  (src/views/)        — Route-level page components│
├─────────────────────────────────────────────────────────┤
│  Layouts (src/layouts/)     — Shared chrome (nav, cheers)│
├─────────────────────────────────────────────────────────┤
│  Components (src/components/) — Feature UI components   │
├─────────────────────────────────────────────────────────┤
│  Hooks (src/hooks/)         — Data fetching + mutations  │
├─────────────────────────────────────────────────────────┤
│  Contexts (src/contexts/)   — Auth, Notifications state │
├─────────────────────────────────────────────────────────┤
│  Lib (src/lib/)             — Supabase client, utils,    │
│                               match generator engine     │
├─────────────────────────────────────────────────────────┤
│  Supabase (supabase/)       — Migrations, RLS, schema    │
└─────────────────────────────────────────────────────────┘
```

## Entry Points

- `badminton-v2/index.html` — Vite HTML entry
- `badminton-v2/src/main.tsx` — React root mount
- `badminton-v2/src/App.tsx` — Router tree + providers
- `badminton-v2/src/lib/supabase.ts` — Supabase singleton client

## Routing

Defined in `src/App.tsx`:

| Path | View | Auth |
|------|------|------|
| `/` | HomeView | Public |
| `/live-board`, `/live-board/:sessionId` | LiveBoardView | Public |
| `/register` | RegisterView | Public |
| `/profile` | ProfileView | Player (PlayerLayout) |
| `/sessions` | MySessionsView | Player (PlayerLayout) |
| `/sessions/:sessionId` | SessionPlayerDetailView | Player (PlayerLayout) |
| `/leaderboard` | LeaderboardView | Player (PlayerLayout) |
| `/today` | TodayView | Player (PlayerLayout, legacy) |
| `/match-schedule`, `/match-schedule/:nameSlug` | PlayerView | Player (PlayerLayout, legacy) |
| `/admin` | AdminView | Admin only |
| `/session/:sessionId` | SessionView | Admin only |
| `/players` | PlayersView | Admin only |

All views are **lazy-loaded** via `React.lazy()` — initial bundle is minimal.

## Authentication & Authorization

- **Provider:** `AuthContext` wraps app in `AuthProvider`
- **Two-step init:** 1) set Supabase user → 2) fetch role from `profiles` table (separate `useEffect` to ensure JWT is stored before querying)
- **Roles:** `admin` | `player` | null
- **Admin gate:** `AdminRoute` component — wraps admin routes; unauthenticated users see Google Sign-In, non-admins redirect to `/`
- **Player layout gate:** `PlayerLayout` shows `CheersPanel` if player has unsubmitted cheers (blocks the page view until cheers are rated)

## Data Flow

```
View → Hook → supabase.from(table).select/insert/update/delete → Supabase DB
                            ↕
              Realtime channel subscription (useRealtime.ts)
              PostgreSQL → channel event → hook callback → setState → re-render
```

- No Redux or global store — all state is local to hooks
- Hooks own the Supabase queries and mutations
- Mutations use `toast.error()` for error feedback (Sonner)
- Optimistic updates: not used — mutations await server response before updating local state

## Key Abstractions

### `useSession(sessionId?)` — `src/hooks/useSession.ts`
Fat hook: owns all session lifecycle mutations:
- `createSession`, `openRegistration`, `closeRegistration`, `reopenRegistration`
- `lockSchedule(matches)` — bulk inserts matches + transitions status
- `unlockSchedule` — deletes matches, reverts status
- `startSession` — sets first 2 queued matches to `playing` on courts 1 & 2
- `unstartSession`, `closeSession`

### `useRealtime(sessionId, onUpdate)` — `src/hooks/useRealtime.ts`
Generic Supabase Realtime wrapper — subscribes to `matches` table changes for a session. Returns `status: 'connected' | 'reconnecting' | 'disconnected'` and a `refresh()` callback.

### Match Generator Engine — `src/lib/matchGenerator.ts`
Three-phase algorithm:
1. **Assignment** — builds fair participation matrix (each player gets equal matches)
2. **Team Formation** — picks best 2v2 split for each group of 4 (minimize level imbalance)
3. **SA Optimization** — Simulated Annealing with cross-swap + row-swap mutations across 15 starts × 50 trials

Public API:
- `generateSchedule(players, options)` — fast multi-trial best-of (no SA)
- `generateScheduleOptimized(players, options)` — full SA optimization
- `evaluateSessionScore(matches, ...)` — returns `AuditData` score breakdown

### Session Status Machine

```
setup → registration_open → registration_closed → schedule_locked → in_progress → complete
           ↑_______________________________↑ (reopen)
                  ↑_________↑ (unlock)
```

## Contexts

- `AuthContext` (`src/contexts/AuthContext.tsx`) — user, role, isLoading
- `NotificationContext` (`src/contexts/NotificationContext.tsx`) — subscribes to user notifications Realtime channel; mounted inside `PlayerLayout`

## Notifications / Toasts

- **Toasts:** Sonner — called via `toast.error()` / `toast.success()` directly in hooks and components
- **In-app notifications:** Supabase `notifications` table + Realtime — delivered via `NotificationContext`

## UI Component System

- shadcn/ui components in `src/components/ui/` — stateless, Tailwind-styled
- Feature components in `src/components/` — stateful, consume hooks
- Pattern: pass data down as props; hooks stay in the view or layout level
