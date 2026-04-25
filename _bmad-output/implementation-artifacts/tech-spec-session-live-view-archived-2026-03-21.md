---
title: 'Session Live View'
slug: 'session-live-view'
created: '2026-03-19'
status: 'in-progress'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React', 'TypeScript', 'React Router', 'Supabase']
files_to_modify:
  - badminton-v2/src/App.tsx
  - badminton-v2/src/hooks/useAdminSession.ts
  - badminton-v2/src/views/AdminView.tsx
  - badminton-v2/src/views/SessionView.tsx (new)
code_patterns: []
test_patterns: []
---

# Tech-Spec: Session Live View

**Created:** 2026-03-19

## Overview

### Problem Statement

The admin live court view (courts + queue + mark done + reorder) is embedded inside `/admin`, which mixes session management with day-of operations. Admins need a dedicated, bookmarkable URL to manage a live session independently.

### Solution

Add a new `/session/:sessionId` route (admin-only) that renders the same live court management UI (`CourtTabs` + `LiveIndicator`) but loaded by a specific session UUID instead of querying for the active session. The `/admin` view shows a link to open this URL when the session is `in_progress`.

### Scope

**In Scope:**
- New `SessionView` component at `/session/:sessionId`
- Admin-only protection (same `AdminRoute` guard)
- Session loaded by `sessionId` URL param (not by status query)
- Renders: session name header + `CourtTabs` + `LiveIndicator` + Realtime sync
- `AdminView` shows "Open Session" button linking to `/session/{session.id}` when `in_progress`
- Modify `useAdminSession` to accept optional `sessionId` param

**Out of Scope:**
- Public/unauthenticated access
- Any new DB schema or RLS changes
- Removing the existing live view from `/admin`

---

## Context for Development

### Codebase Patterns

- **Admin live view pattern:** `AdminLiveView` in `AdminView.tsx` calls `useAdminSession()` → `useRealtime(sessionId, refresh, 'admin')` → renders `<LiveIndicator> + <CourtTabs>`
- **Route protection:** `AdminRoute` in `App.tsx` checks `useAuth()` — shows Google sign-in if no user, redirects to `/` if not admin
- **Hook pattern:** `useState + useEffect + useCallback + useRef(isFirstLoad)` — same pattern used in `useAdminSession`, `useCourtState`, `usePlayerSchedule`
- **Realtime:** `useRealtime(sessionId, refresh, channelPrefix)` — use `'session'` as channel prefix for this new view

### Files to Reference

| File | Purpose |
|------|---------|
| `src/views/AdminView.tsx` | Contains `AdminLiveView` — copy this pattern for `SessionView` |
| `src/hooks/useAdminSession.ts` | Needs `sessionId?` param to skip active session lookup |
| `src/components/CourtTabs.tsx` | Already built — just render it |
| `src/components/LiveIndicator.tsx` | Already built — just render it |
| `src/hooks/useRealtime.ts` | Use with `'session'` channel prefix |
| `src/App.tsx` | Add new route + protect with `AdminRoute` |

### Technical Decisions

- Modify `useAdminSession` to accept `sessionId?: string`. When provided, skip the active session query and load that session directly. When omitted, existing behavior (query for active session) is preserved — so `AdminLiveView` in `/admin` continues working unchanged.
- Use `'session'` as Realtime channel prefix to avoid collision with `'admin'` prefix used by `AdminLiveView`.

---

## Implementation Plan

### Tasks

**Task 1 — Modify `useAdminSession.ts` to accept optional `sessionId`**

Change signature:
```typescript
export function useAdminSession(sessionId?: string): UseAdminSessionResult
```

In the `load()` function, replace the active session query with:
```typescript
let sid: string
let sessionName: string

if (sessionId) {
  // Load specific session by ID
  const { data: session } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('id', sessionId)
    .maybeSingle()

  if (cancelled) return
  if (!session) {
    setSessionId(null)
    isFirstLoad.current = false
    setIsLoading(false)
    return
  }
  sid = (session as { id: string; name: string }).id
  sessionName = (session as { id: string; name: string }).name
} else {
  // Existing behavior — find active session
  const { data: session } = await supabase
    .from('sessions')
    .select('id, name')
    .in('status', ['schedule_locked', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cancelled) return
  if (!session) { /* existing early return */ }
  sid = (session as { id: string; name: string }).id
  sessionName = (session as { id: string; name: string }).name
}

setSessionId(sid)
setSessionName(sessionName)
// ... rest of load() unchanged
```

**Task 2 — Create `src/views/SessionView.tsx`**

```tsx
import { useParams, Link } from 'react-router'
import { useAdminSession } from '@/hooks/useAdminSession'
import { useRealtime } from '@/hooks/useRealtime'
import { CourtTabs } from '@/components/CourtTabs'
import { LiveIndicator } from '@/components/LiveIndicator'

export function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { court1Current, court2Current, queued, sessionId: sid, sessionName, isLoading, refresh } =
    useAdminSession(sessionId)
  const { status } = useRealtime(sid, refresh, 'session')

  if (!isLoading && !sid) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Session not found</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 relative">
      <LiveIndicator status={status} onRefresh={refresh} />
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{sessionName || 'Session'}</h1>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Admin
        </Link>
      </div>
      <CourtTabs
        court1Current={court1Current}
        court2Current={court2Current}
        queued={queued}
        isLoading={isLoading}
        sessionId={sid}
        onDone={refresh}
      />
    </div>
  )
}

export default SessionView
```

**Task 3 — Add route in `App.tsx`**

Add import:
```typescript
const SessionView = lazy(() => import('@/views/SessionView'))
```

Add route inside the `<AdminRoute>` element:
```tsx
<Route element={<AdminRoute />}>
  <Route path="/admin" element={<AdminView />} />
  <Route path="/session/:sessionId" element={<SessionView />} />
</Route>
```

**Task 4 — Add "Open Session" link in `AdminView.tsx`**

In the `session.status === 'in_progress'` branch, replace `<AdminLiveView />` with:

```tsx
) : session.status === 'in_progress' ? (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">Session is live</p>
      <a
        href={`/session/${session.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors"
      >
        Open Session View ↗
      </a>
    </div>
    <AdminLiveView />
  </div>
```

This keeps the existing inline live view AND adds a button to open the dedicated session URL in a new tab.

**Task 5 — Build & lint pass clean**

### Acceptance Criteria

- **AC1:** Navigating to `/session/{valid-uuid}` as an admin shows the live court view with session name, courts, queue, Mark Done, and reorder buttons.
- **AC2:** Navigating to `/session/{valid-uuid}` when not logged in shows the Google sign-in button (same `AdminRoute` guard).
- **AC3:** Navigating to `/session/{invalid-uuid}` shows "Session not found".
- **AC4:** The view stays in sync via Realtime — changes from kiosk or admin reflect within ≤ 2 seconds.
- **AC5:** `/admin` shows an "Open Session View ↗" link when session is `in_progress` that opens `/session/{id}` in a new tab.
- **AC6:** Existing `/admin` live view continues working unchanged.

---

## Additional Context

### Dependencies

None — all components and hooks already exist.

### Testing Strategy

Build passes clean. Manual test: start a session, copy the `/session/{id}` URL, open in new tab, verify courts + queue + actions all work and sync with kiosk.

### Notes

- `useAdminSession` called without args in `AdminLiveView` → existing behavior unchanged
- `useAdminSession(sessionId)` called in `SessionView` → loads specific session
- Channel prefix `'session'` avoids collision with `'admin'` and `'kiosk'` channels
