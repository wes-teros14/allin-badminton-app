# Story 1.4: Application Routes & Role-Based Access Control

Status: review

## Story

As a user,
I want each role to have a dedicated URL that loads the correct view,
So that the kiosk, player, and admin experiences are fully separated and correctly protected.

## Acceptance Criteria

1. **Given** React Router v7 is configured in `App.tsx` with React.lazy views
   **When** `/kiosk` is accessed (authenticated or not)
   **Then** `KioskView` renders without requiring authentication

2. **Given** `/player` or `/player/:nameSlug` is accessed (authenticated or not)
   **When** any user opens the URL
   **Then** `PlayerView` renders without requiring authentication

3. **Given** `/admin` is accessed by a user with `role !== 'admin'` or no session
   **When** the `AdminRoute` guard checks the auth state
   **Then** the user is redirected to `/`

4. **Given** `/admin` is accessed by a user with `role === 'admin'`
   **When** the `AdminRoute` guard resolves
   **Then** `AdminView` renders correctly

5. **Given** each view is loaded via `React.lazy()`
   **When** a user navigates to a route
   **Then** only that route's JavaScript bundle is fetched — kiosk does not load admin bundle

6. **Given** an unknown path is accessed
   **When** React Router evaluates the route
   **Then** a redirect to `/` is shown — no blank screen

## Tasks / Subtasks

- [x] Task 1: Add `AdminRoute` guard component to `App.tsx` (AC: #3, #4)
  - [x] Define `AdminRoute` component inside `App.tsx` using `useAuth`
  - [x] While `isLoading` is true, render `<div>Loading…</div>` — do NOT redirect prematurely
  - [x] When `isLoading` is false and `role !== 'admin'`, return `<Navigate to="/" replace />`
  - [x] When `role === 'admin'`, render `<Outlet />`
  - [x] Wrap the `/admin` route with `AdminRoute` in the route tree

- [x] Task 2: Revert `AdminView` to plain stub (AC: #4)
  - [x] Remove the sign-in/sign-out test code added in Story 1.3
  - [x] `AdminView` returns `<div>Admin View</div>` — clean stub, Story 1.3 verification complete

- [x] Task 3: Verify `npm run build` and `npm run lint` pass clean

- [x] Task 4: Manual verification
  - [x] Signed out: navigate to `/admin` → redirects to `/`
  - [x] Signed in as admin (Wes): navigate to `/admin` → renders "Admin View"
  - [x] `/kiosk` and `/player` load without any auth check

---

## Dev Notes

### What Already Exists

From Story 1.1, `App.tsx` has:
```tsx
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router'

const KioskView = lazy(() => import('@/views/KioskView'))
const PlayerView = lazy(() => import('@/views/PlayerView'))
const AdminView  = lazy(() => import('@/views/AdminView'))

function App() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route path="/"                element={<div>badminton v2</div>} />
        <Route path="/kiosk"           element={<KioskView />} />
        <Route path="/player"          element={<PlayerView />} />
        <Route path="/player/:nameSlug" element={<PlayerView />} />
        <Route path="/admin"           element={<AdminView />} />
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
```

From Story 1.3, `src/hooks/useAuth.ts` exists and returns `{ user, role, isLoading }`.

---

### Task 1: Exact `AdminRoute` Implementation

Use React Router v7's `<Outlet />` pattern. Define `AdminRoute` at the top of `App.tsx` (above the `App` function):

```tsx
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router'
import { useAuth } from '@/hooks/useAuth'

function AdminRoute() {
  const { role, isLoading } = useAuth()
  if (isLoading) return <div>Loading…</div>
  if (role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

const KioskView = lazy(() => import('@/views/KioskView'))
const PlayerView = lazy(() => import('@/views/PlayerView'))
const AdminView  = lazy(() => import('@/views/AdminView'))

function App() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route path="/"                 element={<div>badminton v2</div>} />
        <Route path="/kiosk"            element={<KioskView />} />
        <Route path="/player"           element={<PlayerView />} />
        <Route path="/player/:nameSlug" element={<PlayerView />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminView />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
```

**Key decisions:**
- `AdminRoute` wraps `/admin` as a parent route with no path — `<Outlet />` renders the child
- `isLoading` guard prevents flash-redirect when the page loads with an existing session
- `role !== 'admin'` covers both `null` (no session) and `'player'` (wrong role)
- Route guards are UX-only — RLS is the real security boundary (architecture rule)

---

### Task 2: Revert AdminView

```tsx
export function AdminView() {
  return <div>Admin View</div>
}

export default AdminView
```

The sign-in/sign-out stub from Story 1.3 served its purpose — AC #1-#4 of Story 1.3 are verified. Remove it now.

---

### Architecture Compliance

- **`Outlet` import from `"react-router"`** — not `"react-router-dom"` (v7)
- **Route guards are UX convenience only** — RLS enforces server-side security
- **`useAuth` imported from `@/hooks/useAuth`** — always use `@/` alias
- **No new files** — `AdminRoute` lives in `App.tsx`, not a separate file (it's used once)
- **Code splitting preserved** — `AdminView` stays lazy-loaded; `AdminRoute` is not lazy (it's tiny)

### Previous Story Learnings

- `useAuth` hook: two `useEffect`s — one for auth listener, one for role fetch triggered by `user` state change
- `isLoading` starts `true`, resolves to `false` after `getSession()` + `fetchRole()` complete — must wait for it before redirecting
- RLS + table grants are both required on Supabase tables
- Supabase CLI has Windows permissions issue — use SQL Editor in dashboard instead

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `AdminRoute` component added to `App.tsx` — uses `useAuth`, guards with `isLoading` check before redirect
- `AdminView` reverted to plain stub — sign-in test code from Story 1.3 removed
- `npm run build` and `npm run lint` pass clean
- Code splitting confirmed: `AdminView` remains a separate 0.14kB bundle

### File List

- `badminton-v2/src/App.tsx` (updated)
- `badminton-v2/src/views/AdminView.tsx` (updated — reverted to stub)
