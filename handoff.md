# Handoff — current snapshot

Updated: 2026-10-06. Overwrite this file on every update; it is never a running history.

## State

- **⚡ Win Streak built** on branch `019-win-streak`:
  - Awards card with the top 3 current runs of match wins, after Early Bird. A loss or draw ends a run; minimum 3.
  - Profile badge for 1st place.
- **The six cheer awards were removed from the Awards tab.** Their badges stay on My Profile, by the owner's choice.
- Also removed: two reads only the cheer awards used, `player_cheer_stats` and the whole `cheers` table.
- `tsc -b`, 414 unit tests and the build pass.
- **Committed locally only. Not pushed yet**: waiting for the owner's OK.
- Prod numbers (read-only, 2026-10-06): top current runs per match are 8, 5, 4; 6 players are on 3+.
- Carried over: 084 `cheer_later_players` is on prod, NOT on dev (dev 404s and falls back to the full gate).
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Playwright on the dev app as Admin, 390 px, dark:
  - Awards tab: cheer cards gone, Win Streak after Early Bird. On real dev data the empty text shows ("Nobody is on a run of 3 or more right now").
  - With winning matches appended in the browser only, the card showed "1st · Test Admin · 7".
  - Profile still lists the six cheer badges. No page errors.

## Not verified

- The card against real prod data (the app only runs against dev). The prod numbers come from SQL, not from the app.

## Immediate next steps

- Push `019-win-streak` → `dev` → `main` once the owner confirms.
- Then discuss the parked awards: 🗡️ Giant Slayer and 🧹 Clean Sweep (details in `project_memory.md`).
- Apply 084 to dev: paste `badminton-v2/supabase/migrations/084_cheer_later_players.sql` into the dev SQL editor.
- Carried over: restart prod 15–30 min before the next session. Afterwards, compare edge-log requests per 30 min with Oct 4.

## Open questions

- Carried over: is the load reduction enough? Prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
