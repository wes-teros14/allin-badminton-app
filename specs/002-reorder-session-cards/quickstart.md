# Quickstart: Verify Session Card Ordering

## Prerequisites

- App running locally (`npm run dev` inside `badminton-v2/`)
- Signed in as a player (or use the dev-only "login as admin" button, then a test player account) who is registered for, or can view, at least two active/upcoming sessions with different scheduled dates

## Manual Verification

1. Navigate to `/sessions`.
2. Confirm the first card shown under the active/upcoming list is the session with the nearest scheduled date (not the furthest one).
3. If two sessions share the same date but different start times, confirm the earlier time appears first.
4. Register for a new session dated sooner than an existing one; reload `/sessions` and confirm the new session now appears above the previously-soonest one.
5. Expand "Show Past Sessions" and confirm past sessions still show most-recent-first (unchanged behavior — FR-004).

## Automated Verification

- `npm run test:unit` — covers the extracted sort comparator (ascending by date, time tiebreaker, null-time handling).
- `npm run test:e2e` — covers the on-page card order for a seeded player with multiple active sessions across different dates.
- `npm run lint` — no new lint violations.
