---
title: 'Player Top Nav Bar & Today Leaderboard'
slug: 'player-top-nav-today-leaderboard'
created: '2026-03-21'
status: 'in-progress'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React', 'TypeScript', 'React Router v7', 'Tailwind CSS v4', 'Supabase', 'shadcn/ui']
files_to_modify:
  - badminton-v2/src/App.tsx
  - badminton-v2/src/views/HomeView.tsx
  - badminton-v2/src/views/PlayerView.tsx
  - badminton-v2/src/views/ProfileView.tsx
  - badminton-v2/src/components/PlayerScheduleHeader.tsx
  - badminton-v2/src/components/TopNavBar.tsx (new)
  - badminton-v2/src/layouts/PlayerLayout.tsx (new)
  - badminton-v2/src/views/TodayView.tsx (new)
  - badminton-v2/src/hooks/useActiveSession.ts (new)
code_patterns: []
test_patterns: []
---

# Tech-Spec: Player Top Nav Bar & Today Leaderboard

**Created:** 2026-03-21

---

## Overview

### Problem Statement

Players who arrive via shared links (the majority) never discover the Profile page or the upcoming Insights features. The app's navigation is hub-and-spoke around the homepage — but most players never see the homepage. The `/profile` page has no way to get back to the schedule during a live session. There is also no live leaderboard or "Today" view despite `player_stats` realtime triggers being in place since migration 013.

### Solution

Introduce a persistent 3-tab top navigation bar across all authenticated player-facing pages:
**🏸 Schedule | 🏆 Today | 👤 Profile**

The Schedule tab deep-links to the active session's player list when one exists, otherwise falls back to `/match-schedule`. The Today tab renders a full live leaderboard using existing `player_stats` data with Supabase Realtime. The Homepage auto-redirects authenticated users (players → Schedule, admins → `/admin`), becoming a sign-in-only landing page.

### Scope

**In Scope:**
- `TopNavBar` component — 3 tabs, active state, authenticated-only
- `PlayerLayout` — React Router v7 layout route wrapping all player-facing pages
- `useActiveSession` hook — detects current active session for Schedule tab deep-link
- `TodayView` — live leaderboard (top win rate + Most Improved Today) with Realtime
- `HomeView` update — auto-redirect authenticated users, remove nav buttons
- Route updates in `App.tsx` — add PlayerLayout wrapper, add `/today` route

**Out of Scope:**
- Removing `← All players` back-link from `PlayerScheduleHeader` (separate cleanup task)
- Admin sidebar navigation (separate spec)
- Admin FAB during live sessions (separate spec)
- Post-registration onboarding card (separate spec)

---

## Context for Development

### Codebase Patterns

- **Router:** React Router v7 with `createBrowserRouter` / `RouterProvider` in `App.tsx`. Uses lazy imports for code splitting. Admin routes wrapped in `<AdminRoute>` component. No layout routes exist yet — this spec introduces the first one.
- **Auth:** `useAuth()` hook returns `{ user, role, isLoading }`. Role is `'admin'` | `'player'` | `null`. Fetched from `profiles` table via Supabase. Import from `@/hooks/useAuth`.
- **Styling:** Tailwind CSS v4 utility classes. Primary color `#8E24AA` (purple) via CSS var `--color-primary`. Use `bg-primary text-primary-foreground` for the nav bar background to match `PlayerScheduleHeader`. shadcn/ui components available (`Button`, `Card`, etc.).
- **Supabase:** Client imported as `import { supabase } from '@/lib/supabase'`. Realtime subscriptions follow pattern in `usePlayerSchedule.ts` — `supabase.channel(...).on('postgres_changes', ...).subscribe()`. Always unsubscribe on cleanup.
- **Path alias:** `@/` maps to `src/`.
- **Component location:** New shared components go in `src/components/`. New views go in `src/views/`. New layouts go in `src/layouts/`. New hooks go in `src/hooks/`.

### Files to Reference

| File | Purpose |
|------|---------|
| `src/App.tsx` | Route definitions — add PlayerLayout wrapper and `/today` route |
| `src/hooks/useAuth.ts` | Auth + role detection pattern |
| `src/views/HomeView.tsx` | Add auto-redirect for authenticated users |
| `src/views/ProfileView.tsx` | Wrap with PlayerLayout (remove manual `← Home` link) |
| `src/views/PlayerView.tsx` | Wrap with PlayerLayout |
| `src/components/PlayerScheduleHeader.tsx` | Existing header — coexists with TopNavBar |
| `src/hooks/usePlayerList.ts` | Pattern for querying active session |
| `src/hooks/usePlayerSchedule.ts` | Pattern for Supabase Realtime subscription |
| `src/types/database.ts` | `player_stats` and `player_pair_stats` type definitions |
| `src/types/app.ts` | `SessionStatus` type — active session statuses |

### Technical Decisions

1. **Layout route approach:** Use React Router v7 layout routes. `PlayerLayout` renders `<TopNavBar />` + `<Outlet />`. Wrap all player-facing routes (`/match-schedule/**`, `/profile`, `/today`) inside a single layout route. This is cleaner than adding the nav bar to each view individually.

2. **Active session detection for Schedule tab:** `useActiveSession` queries `sessions` table for any session with `status IN ('registration_open', 'registration_closed', 'schedule_locked', 'in_progress')`. Returns `{ sessionId, status } | null`. Schedule tab links to `/match-schedule/session/${sessionId}` if found, else `/match-schedule`.

3. **Today tab — leaderboard data source:** Query `player_stats` table joined with `profiles` (for nickname) filtered to `session_id` of active session. For "Most Improved", compare `session_win_rate` (today) vs `career_win_rate` (all-time). `player_stats` table has both from migration 013.

4. **TopNavBar visibility:** Render only when `user` is non-null AND `role !== 'admin'`. Admin users see no player nav bar — they have their own navigation. Check with `useAuth()`.

5. **Active tab detection:** Use `useLocation()` from React Router. Match `/match-schedule` → Schedule tab, `/today` → Today tab, `/profile` → Profile tab. Use `pathname.startsWith()` for nested routes.

6. **HomeView redirect:** Use `useEffect` + `navigate` from `useNavigate()`. If `isLoading` is false and `user` exists: `role === 'admin'` → navigate to `/admin`, else navigate to `/match-schedule`. Render `null` or a spinner while auth is loading.

---

## Implementation Plan

### Tasks

**Task 1: `useActiveSession` hook**
File: `src/hooks/useActiveSession.ts` (new)

- Query `sessions` table: `select('id, status, name').in('status', ['registration_open', 'registration_closed', 'schedule_locked', 'in_progress']).order('date', { ascending: false }).limit(1)`
- Return type: `{ sessionId: string; status: SessionStatus; name: string } | null`
- Return `{ sessionId, status, name }` if found, `null` otherwise
- No Realtime needed — session status changes are infrequent

---

**Task 2: `TopNavBar` component**
File: `src/components/TopNavBar.tsx` (new)

- Import `useAuth`, `useLocation`, `Link` from react-router, `useActiveSession`
- Render only if `user && role !== 'admin'` (return `null` otherwise)
- Purple bar (`bg-primary text-primary-foreground`) matching `PlayerScheduleHeader` style
- 3 tabs as `<Link>` elements:
  - 🏸 **Schedule** → `/match-schedule/session/${sessionId}` if active session, else `/match-schedule`
  - 🏆 **Today** → `/today`
  - 👤 **Profile** → `/profile`
- Active tab: `pathname.startsWith('/match-schedule')` → Schedule, `pathname === '/today'` → Today, `pathname.startsWith('/profile')` → Profile
- Active tab style: white underline or bold indicator. Inactive: `opacity-70`
- Height: compact — `py-2 px-4`. Full width.

---

**Task 3: `PlayerLayout` component**
File: `src/layouts/PlayerLayout.tsx` (new)

- Simple layout: renders `<TopNavBar />` on top, then `<Outlet />` below
- No additional styling — child views handle their own padding/layout

```tsx
import { Outlet } from 'react-router'
import TopNavBar from '@/components/TopNavBar'

export default function PlayerLayout() {
  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />
      <Outlet />
    </div>
  )
}
```

---

**Task 4: Update `App.tsx` routes**
File: `src/App.tsx`

- Import `PlayerLayout` (lazy or direct — direct is fine since it's a layout)
- Import `TodayView` (lazy)
- Wrap player-facing routes in a layout route using `PlayerLayout`:

```tsx
{
  element: <PlayerLayout />,
  children: [
    { path: '/match-schedule', lazy: () => import('./views/PlayerView') },
    { path: '/match-schedule/:nameSlug', lazy: () => import('./views/PlayerView') },
    { path: '/match-schedule/session/:sessionId', lazy: () => import('./views/PlayerView') },
    { path: '/match-schedule/session/:sessionId/:nameSlug', lazy: () => import('./views/PlayerView') },
    { path: '/profile', element: <ProtectedRoute><ProfileView /></ProtectedRoute> },
    { path: '/today', lazy: () => import('./views/TodayView') },
  ]
}
```

- Keep `/`, `/kiosk`, `/register`, `/admin`, `/session/:id`, `/players` outside PlayerLayout

---

**Task 5: Update `HomeView`**
File: `src/views/HomeView.tsx`

- Add `useEffect` auto-redirect:
  - If `!isLoading && user && role === 'admin'` → `navigate('/admin')`
  - If `!isLoading && user && role !== 'admin'` → `navigate('/match-schedule')`
- While `isLoading`: render a centered spinner or blank screen
- For unauthenticated users: keep existing sign-in UI (Google sign-in button)
- Remove "My Profile", "Admin", "Players" nav buttons (no longer needed — users never see this page when logged in)

---

**Task 6: `TodayView` component**
File: `src/views/TodayView.tsx` (new)

**When active session exists:**
- Header: "🏆 Today" with session name
- **Top Performers** section: query `player_stats` filtered to `session_id`, order by `win_rate DESC`, show top 10. Display: rank, nickname, W/L count, win rate %
- **Most Improved** section: players whose `session_win_rate > career_win_rate` by the largest margin. Show: nickname, today's rate vs career rate, delta (e.g. "+23%")
- Subscribe to Realtime on `player_stats` table for live updates — refresh list on change
- Show "No games played yet" if session has no completed matches

**When no active session:**
- Show all-time leaderboard from `player_stats` aggregated across all sessions (or career stats): top 10 by all-time win rate (minimum 10 games played to qualify)
- Header: "🏆 All Time"

**Data queries:**
```ts
// Active session leaderboard
supabase
  .from('player_stats')
  .select('*, profiles(nickname)')
  .eq('session_id', sessionId)
  .order('win_rate', { ascending: false })

// Most Improved: filter where session_win_rate > career_win_rate
// career_win_rate available from player_stats or separate all-sessions aggregate
```

---

**Task 7: Update `ProfileView`**
File: `src/views/ProfileView.tsx`

- Remove the `← Home` back-link (top nav bar handles navigation)
- Remove the `Go to Admin` button (admins auto-redirect away from player views; if an admin visits `/profile` directly the nav bar won't show anyway)
- No other changes needed

---

### Acceptance Criteria

**AC1 — Top Nav Bar visible for authenticated players**
- Given: user is signed in with `role = 'player'`
- When: user navigates to `/match-schedule`, `/profile`, or `/today`
- Then: purple top nav bar appears with 3 tabs — Schedule, Today, Profile

**AC2 — Top Nav Bar hidden for unauthenticated users and admins**
- Given: user is not signed in OR has `role = 'admin'`
- When: user visits any player-facing page
- Then: no top nav bar is rendered

**AC3 — Active tab highlighting**
- Given: user is on `/match-schedule` or `/match-schedule/session/...`
- When: nav bar renders
- Then: Schedule tab appears active (bold/underline); Today and Profile tabs appear inactive

**AC4 — Schedule tab deep-links to active session**
- Given: a session with status `in_progress` exists
- When: user taps the Schedule tab
- Then: navigates to `/match-schedule/session/:sessionId`

**AC5 — Schedule tab falls back when no active session**
- Given: no session with active status exists
- When: user taps the Schedule tab
- Then: navigates to `/match-schedule`

**AC6 — Homepage auto-redirects authenticated users**
- Given: user is signed in as player
- When: user visits `/`
- Then: immediately redirected to `/match-schedule`

**AC7 — Homepage auto-redirects admins**
- Given: user is signed in as admin
- When: user visits `/`
- Then: immediately redirected to `/admin`

**AC8 — Homepage shows sign-in for unauthenticated users**
- Given: user is not signed in
- When: user visits `/`
- Then: sign-in UI is shown (no redirect, no nav bar)

**AC9 — Today tab shows live leaderboard during active session**
- Given: active session exists with completed matches
- When: user taps Today tab
- Then: leaderboard shows players ranked by win rate with W/L counts, updates in real-time

**AC10 — Today tab shows all-time leaderboard when no active session**
- Given: no active session
- When: user taps Today tab
- Then: all-time leaderboard shown with header "🏆 All Time"

**AC11 — Most Improved section**
- Given: active session where some players are outperforming their career average
- When: Today tab is viewed
- Then: "Most Improved Today" section shows those players with delta vs career average

---

## Additional Context

### Dependencies

- `player_stats` table must exist with `session_id`, `win_rate`, `wins`, `losses` columns — confirmed in migration 013
- `profiles` table must have `nickname` column — confirmed in migration 006/011
- Supabase Realtime must be enabled on `player_stats` table — confirmed in migration 010

### Testing Strategy

1. Sign in as a player → visit `/` → confirm redirect to `/match-schedule`
2. Sign in as admin → visit `/` → confirm redirect to `/admin`
3. Visit `/match-schedule` → confirm purple top nav bar shows with 3 tabs
4. With active session: tap Schedule tab → confirm deep-link to session player list
5. Without active session: tap Schedule tab → confirm `/match-schedule`
6. Visit `/today` with active session → confirm leaderboard loads with real data
7. Complete a match → confirm Today leaderboard updates without page refresh
8. Open `/match-schedule/session/:id/:nameSlug` in incognito → confirm no nav bar shown
9. Sign in as admin → visit `/match-schedule` → confirm no player nav bar shown

### Notes

- `PlayerScheduleHeader` coexists with `TopNavBar`. The header renders inside the page content (below the nav bar via `<Outlet />`). No changes needed to `PlayerScheduleHeader` in this spec — the `← All players` back-link remains for now.
- The `/register` route stays outside `PlayerLayout` — it's a standalone flow accessed via invite link and should not show the nav bar.
- The `/kiosk` route stays outside `PlayerLayout` — it's a display screen, not a player-facing nav experience.
- `TodayView` career win rate comparison: if `player_stats` only stores per-session stats, the "Most Improved" calculation requires aggregating across all sessions for the career baseline. Check if a career aggregate view exists or needs to be computed client-side.
