# CONCERNS.md — Technical Debt, Issues & Areas of Concern

## Type System Debt

### Stale `database.ts` (widespread impact)
The generated Supabase types in `src/types/database.ts` are **out of sync** with the actual schema. Multiple migrations have added columns (e.g., `duration_seconds`, `paid`, `gender`, `level`, `generator_settings`, `email`, `nickname`) that aren't reflected in the types.

This forces widespread `as never` and `as unknown as` casts throughout hooks and components:
- `src/components/CourtCard.tsx:49` — `{ status: 'complete', duration_seconds: elapsed } as never`
- `src/components/RegistrationURLCard.tsx:29` — `{ max_players: val } as never`
- `src/hooks/useAdminActions.ts:94` — `{ status: 'complete', ... } as never`
- `src/hooks/useMatchCheers.ts:157` — `... as never`
- `src/hooks/useRegistration.ts:113,119,125,132` — profile insert/update casts
- `src/hooks/useRoster.ts:122,131` — `{ gender, level } as never`, `{ paid } as never`
- `src/views/ProfileView.tsx:166` — `{ nickname: ... } as never`
- `src/contexts/AuthContext.tsx:22` — `(data as { role?: string } | null)`

**Fix:** Run `npx supabase gen types --linked > src/types/database.ts` against both dev and prod projects to regenerate. This should eliminate most casts.

### `as unknown as` casts for Supabase JOIN responses
Hooks that use Supabase PostgREST JOINs (nested selects) get back complex inferred types that don't match hand-written interfaces:
- `src/hooks/usePlayerList.ts:49,71` — session JOIN shape cast
- `src/hooks/usePlayerSchedule.ts:91,112` — session JOIN shape cast
- `src/hooks/usePlayerSessions.ts:62,69` — session JOIN shapes cast

These should be resolved by type regeneration + proper interface definitions for JOIN response shapes.

## Legacy Routes (dead code risk)

Two legacy player-facing routes kept in `App.tsx` "for internal links":
- `/today` → `TodayView`
- `/match-schedule` / `/match-schedule/:nameSlug` / `/match-schedule/session/:sessionId` → `PlayerView`

These are marked `// Legacy routes — kept for internal links (AllMatchesView, etc.)` but `AllMatchesView` doesn't appear in the views directory. These routes may be dead code that can be removed.

## `DevLoginPanel` in Production Bundle

`src/components/DevLoginPanel.tsx` is **unconditionally imported and rendered** in `App.tsx`:
```tsx
import { DevLoginPanel } from '@/components/DevLoginPanel'
...
<DevLoginPanel />
```
The component itself contains hardcoded test credentials (`admin@test.local`, `Test1234!`, etc.). Even if it renders nothing in production, it ships in the bundle with credentials visible in the JS. This is a **security concern** — the component should be gated on `import.meta.env.DEV` or removed from production builds.

## No Optimistic Updates

All mutations (session lifecycle, match finish, cheer submission) await server round-trips before updating local state. For the live board (admin managing a session in real-time), this creates latency spikes. The Realtime subscription partially compensates, but there's a window between mutation and realtime update where the UI lags.

## Missing CI Pipeline

No `.github/workflows/` or CI config found. ESLint and TypeScript build are documented as required (`lessons.md`: "Always run `npm run build` + `npm run lint`") but not automated. Test suite (`npm run test:unit`) is not run in CI.

## Thin Test Coverage

- **Only `matchGenerator.ts` is tested** — no tests for hooks, components, views, or auth flows
- **E2E:** Only registration limit scenario covered
- No tests for session lifecycle, cheer submission, realtime updates, admin actions
- No component rendering tests (no `@testing-library/react` setup)
- Bugs from `lessons.md` (duplicate realtime channels, multiple active sessions, RLS gaps) were not caught by tests

## Fragile Areas

### Cheers gate in `PlayerLayout`
The cheers gate (`CheersPanel` blocks `<Outlet />`) is sensitive to timing:
- `useMatchCheers` fires on every `PlayerLayout` mount
- Gate shows if `hasPendingCheers` — if Supabase is slow, gate may flash briefly before loading completes
- Admin users: `showGate = !cheerLoading && hasPendingCheers` is hardcoded in layout — admin can hit the gate too if they're registered players

### Multiple active sessions edge case
`useActiveSessions()` returns all in-progress sessions (no filter). If two simultaneous live sessions exist (e.g., test seed + real session), the `PlayerLayout` takes the first one (`activeSessions[0]`) for the cheers gate. Wrong session ID → wrong match cheers queried.

### Session status machine — no server enforcement
Session status transitions (setup → registration_open → ... → complete) are only enforced client-side in `useSession.ts`. No server-side state machine. An admin with direct Supabase access could skip states. Migration triggers enforce registration limits (migration 020) but not status transitions.

### `lockSchedule` — no duplicate check
`lockSchedule()` bulk-inserts matches without checking if matches already exist for the session. If called twice (e.g., user double-clicks "Lock Schedule"), duplicate matches would be inserted. The UI has a loading state but no debounce guard.

## Performance Concerns

### Match generator CPU cost
`generateScheduleOptimized()` runs 15 SA starts × 50 trials = 750 scoring passes on the main thread. For 16+ players with 20+ matches, this can take 200–500ms and blocks the UI thread (no Web Worker). Users experience a brief freeze when generating optimized schedules.

### No pagination
`useSessionList`, `usePlayerList`, `usePlayerSessions` all fetch all rows without pagination. As the session/player history grows, these queries will become slower.

### Supabase queries in `useRegisteredPlayers` / `useRoster`
Some hooks fetch player profile data by making N individual queries or large JOINs. No query result caching (no SWR/React Query).

## Security

### `DevLoginPanel` credentials in production bundle
See above — hardcoded test credentials ship in the production JS bundle. Low actual risk (test-only accounts with no prod data access), but should be env-gated.

### No CSRF protection needed (SPA + Supabase JWT handles it)
Supabase JWT auth via PKCE is CSRF-safe by design. Not a concern.

### RLS policy completeness
Multiple RLS gaps have been patched over time (see `lessons.md`). Pattern: new tables added without explicit `anon`/`authenticated` grants → silent empty results. Risk: future migrations adding tables may forget RLS grants. Each migration should include `GRANT SELECT` and both policy variants as a checklist item.

## Minor Debt

- `useSession.ts` is a fat hook (~340 lines) that handles both data fetching and all lifecycle mutations. Could be split into `useSessionData` + `useSessionMutations` for maintainability.
- `src/types/app.ts` comment: "add types as features are implemented" — some domain types (e.g., `Session`, `Invitation`) are still defined inline in `useSession.ts` rather than centralized in `app.ts`.
- Inline hex color values (`#EB5B00`, `#FFB200`, `#D91656`) used for status indicators — not mapped to design tokens.
