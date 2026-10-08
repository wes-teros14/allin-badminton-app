# Handoff — current snapshot

Updated: 2026-10-08. Overwrite this file on every update; it is never a running history.

## State

- **Ranked Subs panel + back-to-back fix** (branch `029-subs-ranking`): merged to `dev` and `main` (if the push step succeeded — see git log).
  - Who's out? → ranked list (★ picks → closest level → fewest games → most rest) with reasons and one-tap Sub in.
  - Migration 085 `sessions.sub_picks` applied to **dev and prod** via MCP (prod records a timestamp version, not 085).
- Branch `028-moderator-admin-tab` exists locally at dev's old commit with no commits; origin unclear. Not touched.
- `tsc -b`, build, 440 unit tests pass. Lint: 2 errors in `MatchGeneratorPanel.tsx:162` (`_pinnedGames`, `_wishlistStr` unused) — not from this change, already there.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Dev, in-app browser as Admin at 390 px: court-card panel ranked 3 subs; ★ saved and moved Neil to #1; 3rd star disabled with "Max 2 picks"; Sub in Steph for Cait updated Game 3; queued-game panel full width in light theme. No console errors.
- Dev data put back afterwards: Cait restored, picks cleared, session back to schedule_locked.
- Not seen: a moderator account's view (levels hidden, stars read-only) and anything on prod.

## Immediate next steps

- Before the next session: check Subs on prod once as admin.
- Clean Sweep is still parked (numbers in `project_memory.md`).
- Restart prod 15–30 min before the next session. Afterwards, compare edge-log requests per 30 min with Oct 4.

## Open questions

- On 2 courts, when a court frees up, the game that starts could be the 1st *or* 2nd queued game; only the 1st is blocked (the rest tiebreak shows "next G…"). Owner agreed to the 1st only; revisit if a sub ends up back-to-back.
- Should the roster also show on locked / live / finished sessions? Unclear.
- Carried over: is the load reduction enough? Prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
