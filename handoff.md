# Handoff — current snapshot

Updated: 2026-10-06 (end of session). Overwrite this file on every update; it is never a running history.

## State

- All pushed to `dev` and `main` this session:
  - ⚡ Win Streak award; the six cheer awards are off the Awards tab (their profile badges stay).
  - The celebration card waits for "See the board" / "Close": dimmed page, no auto-dismiss, no follow-up toast. Confetti is 300 pieces and falls longer.
  - 📅 Most Sessions Joined and 🔥 Attendance Streak show a top 3.
  - Owner's `CLAUDE.md` rules: concise reporting, ambiguity, when stuck, evidence.
- `tsc -b`, 414 unit tests and the build pass.
- 084 `cheer_later_players` is on prod, NOT on dev (dev 404s and falls back to the full gate).
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Playwright on dev as Admin, 390 px, dark:
  - The Awards tab shows all four cards as ranked lists. Dev has one active player, so only 1st rows; a real top 3 with ties is not seen in the browser.
  - The celebration card stays until answered, after rewinding saved state in the browser only.

## Not verified

- The top 3 lists with real prod data, and the confetti feel on a real phone (120 Hz still runs about twice as fast).

## Immediate next steps

- Discuss the parked awards: 🗡️ Giant Slayer and 🧹 Clean Sweep (numbers in `project_memory.md`).
- Apply 084 to dev: paste `badminton-v2/supabase/migrations/084_cheer_later_players.sql` into the dev SQL editor.
- Restart prod 15–30 min before the next session. Afterwards, compare edge-log requests per 30 min with Oct 4.

## Open questions

- Is the load reduction enough? Prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
