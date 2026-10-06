# Handoff — current snapshot

Updated: 2026-10-06 (afternoon). Overwrite this file on every update; it is never a running history.

## State

- **Win Streak is live** (`dev`/`main` pushed). The six cheer awards are off the Awards tab; their profile badges stay.
- **Celebration card waits for an answer** (branch `020-celebration-stays`, committed locally, NOT pushed yet):
  - Dimmed page, "See the board" / "Close", Escape closes. No auto-dismiss and no follow-up toast.
  - Confetti: 300 pieces, ~5 s trickle, slower fall.
- `tsc -b`, lint, 414 unit tests and the build pass.
- Carried over: 084 `cheer_later_players` is on prod, NOT on dev.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Celebration card: Playwright on dev as Admin, after rewinding this browser's saved celebration state (no data changed). Seven 1st places showed:
  - "See the board" was focused, and the card was still up after 8 s.
  - A tap on the page behind did nothing.
  - Close removed it with 0 toasts; "See the board" went to `/leaderboard?tab=wins`; Escape closed it.
- Win Streak: on dev the card renders; prod numbers come from SQL only (top runs 8, 5, 4).

## Immediate next steps

- Push `020-celebration-stays` → `dev` → `main` once the owner confirms.
- Then discuss the parked awards: 🗡️ Giant Slayer and 🧹 Clean Sweep (details in `project_memory.md`).
- Apply 084 to dev: paste `badminton-v2/supabase/migrations/084_cheer_later_players.sql` into the dev SQL editor.
- Carried over: restart prod 15–30 min before the next session. Afterwards, compare edge-log requests per 30 min with Oct 4.

## Open questions

- Carried over: is the load reduction enough? Prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
