# Handoff — current snapshot

Updated: 2026-10-06 (late, end of session). Overwrite this file on every update; it is never a running history.

## State

- Pushed to `dev` and `main` this round:
  - **Every Awards board is a top 5** (`AWARD_PLACES` in `lib/denseRank.ts`).
  - **🗡️ Giant Slayer** is the fifth award: gap 20 points, win rate from 4 earlier games, 3 underdog games to qualify, counted in games. It's on the Awards tab, with a profile badge for 1st.
- The name was not picked by the owner; it uses the recommended "Giant Slayer". Other options were 🐶 Top Underdog, 💥 Upset Maker, 🎲 Against the Odds and 🏹 David vs Goliath.
- `tsc -b`, 424 unit tests and the build pass. Lint: no errors (1 old warning in ProfileView).
- 084 `cheer_later_players` is on prod and dev.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- The app's `rankGiantSlayers` was run on the same 598 prod games as the tuning report: identical results (107 underdog games, 21 upsets, 11 qualify, the same top 5 in order). The game-level report was itself checked against SQL.
- Dev, Playwright as Admin: five switcher buttons fit at 390 px, and Giant Slayer shows Test Admin 75% (3 of 4 games as underdog). No page errors.

## Not verified

- Giant Slayer on prod in the app itself (the app runs against dev). Expected prod top 5: 67% (2 of 3), 50% (3 of 6), 33% (2 of 6), 31% (5 of 16), 30% (3 of 10).

## Immediate next steps

- Owner to confirm the name, or pick another.
- Clean Sweep is still parked (numbers in `project_memory.md`).
- Restart prod 15–30 min before the next session. Afterwards, compare edge-log requests per 30 min with Oct 4.

## Open questions

- The leader can qualify with only 3 underdog games (2 of 3 = 67%). Fine by the owner's choice; revisit if it feels too jumpy.
- Carried over: is the load reduction enough? Prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
