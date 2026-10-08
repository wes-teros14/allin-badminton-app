# Handoff — current snapshot

Updated: 2026-10-08. Overwrite this file on every update; it is never a running history.

## State

- **"Who's going" now stays on closed sessions** (branch `026-roster-after-close`): committed locally, **not pushed** (waiting for the owner's OK).
  - A `registration_closed` card shows faces + "14 going" and expands into name chips, like an open one. No slot count, no "slots left", and an empty list says "No one registered".
  - Only `registration_closed` (not locked/live/finished) was assumed; easy to extend.
- Everything before this is on `dev` and `main` (top-5 awards, 🎲 Against the Odds, awards celebrations, Settings, Cheer later, Win Streak).
- `tsc -b`, 431 unit tests and the build pass. Lint: no errors (1 old warning in ProfileView).
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Dev, Playwright as Admin at 390 px, dark and light: the closed "New Session" card shows 14 faces/names, no slots chip, no page errors.
- Not seen: the empty closed state ("No one registered") and a prod session; dev has one closed session with 14 registrants.

## Immediate next steps

- Push `026-roster-after-close` → `dev` → `main` once the owner confirms.
- Clean Sweep is still parked (numbers in `project_memory.md`).
- Restart prod 15–30 min before the next session. Afterwards, compare edge-log requests per 30 min with Oct 4.

## Open questions

- Should the roster also show on locked / live / finished sessions? Unclear; owner only asked about "when registration closes".
- Carried over: is the load reduction enough? Prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
