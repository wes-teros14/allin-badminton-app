# Handoff — current snapshot

Updated: 2026-10-06 (end of session). Overwrite this file on every update; it is never a running history.

## State

- All pushed to `dev` and `main` this session:
  - ⚡ Win Streak award; the six cheer awards are off the Awards tab (their profile badges stay).
  - The celebration card waits for "See the board" / "Close": dimmed page, no auto-dismiss, no follow-up toast. Confetti is 300 pieces and falls longer.
  - 📅 Most Sessions Joined and 🔥 Attendance Streak show a top 3.
  - The Awards tab is laid out like Cheers: a four-way switcher plus the same medal board as every tab.
  - Owner's `CLAUDE.md` rules: concise reporting, ambiguity, when stuck, evidence.
- `tsc -b`, 414 unit tests and the build pass.
- 084 `cheer_later_players` is on prod **and dev** (dev applied by the owner 2026-10-06 via SQL editor; verified: request 200, Settings card loads the list).
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Playwright on dev as Admin, 390 px, dark:
  - Awards tab, both themes: the switcher shows each award's name, rule and a medal board (or its empty text). Dev has one active player, so only 1st rows; a real top 3 with ties is not seen in the browser.
  - One light-theme run loaded every award empty (all calls 200). It did not happen in 2 reruns; unexplained, and the loading code is unchanged from before.
  - The celebration card stays until answered, after rewinding saved state in the browser only.

## Not verified

- The top 3 lists with real prod data, and the confetti feel on a real phone (120 Hz still runs about twice as fast).

## Immediate next steps

- Discuss the parked awards: 🗡️ Giant Slayer and 🧹 Clean Sweep (numbers in `project_memory.md`).
- Restart prod 15–30 min before the next session. Afterwards, compare edge-log requests per 30 min with Oct 4.

## Open questions

- Is the load reduction enough? Prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
