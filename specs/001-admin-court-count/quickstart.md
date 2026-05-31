# Quickstart: Admin Court Count

## Goal

Implement configurable per-session court count and remove the hard-coded two-court assumption from live session behavior and court rendering.

## Steps

1. Add a Supabase migration that introduces `sessions.court_count` with a default of `2`.
2. Regenerate or update [badminton-v2/src/types/database.ts](/D:/ZZWES/wApps/Badminton_v2_app/badminton-v2/src/types/database.ts) so the new field is available in typed session reads and writes.
3. Extend session setup in [badminton-v2/src/views/SessionView.tsx](/D:/ZZWES/wApps/Badminton_v2_app/badminton-v2/src/views/SessionView.tsx) and session data handling in [badminton-v2/src/hooks/useSession.ts](/D:/ZZWES/wApps/Badminton_v2_app/badminton-v2/src/hooks/useSession.ts) to load, validate, and persist `court_count`.
4. Refactor live-state hooks and admin state loaders so they return dynamic ordered court collections instead of fixed `court1` and `court2` values.
5. Update live action flows in [badminton-v2/src/hooks/useSession.ts](/D:/ZZWES/wApps/Badminton_v2_app/badminton-v2/src/hooks/useSession.ts), [badminton-v2/src/hooks/useAdminActions.ts](/D:/ZZWES/wApps/Badminton_v2_app/badminton-v2/src/hooks/useAdminActions.ts), and [badminton-v2/src/components/CourtCard.tsx](/D:/ZZWES/wApps/Badminton_v2_app/badminton-v2/src/components/CourtCard.tsx) to honor dynamic court numbers.
6. Update [badminton-v2/src/components/CourtTabs.tsx](/D:/ZZWES/wApps/Badminton_v2_app/badminton-v2/src/components/CourtTabs.tsx), [badminton-v2/src/views/LiveBoardView.tsx](/D:/ZZWES/wApps/Badminton_v2_app/badminton-v2/src/views/LiveBoardView.tsx), and [badminton-v2/src/views/PlayerView.tsx](/D:/ZZWES/wApps/Badminton_v2_app/badminton-v2/src/views/PlayerView.tsx) to render courts from the shared collection.
7. Add or update unit tests for session-start and court-state derivation, then add one Playwright flow for a non-default court count.

## Validation

Run from `badminton-v2/`:

```bash
npm run lint
npm run test:unit
npm run test:e2e
```

At minimum before merge, verify:

- a new session can save a non-default court count
- starting a session with more than two courts promotes the first `court_count` queued matches
- admin view, liveboard, and player live summary all show the same number of courts
- a legacy session with no explicit court count still behaves as a two-court session
