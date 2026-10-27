# Handoff — current snapshot

Updated: 2026-10-27 (end of session). Overwrite this file on every update; it is never a running history.

## State

- **Announcer changes this session** (branch `dev`, pushed to `dev` and `main`): call is now "Court N … Game M … names"; any unrecorded word falls back to the computer voice per word (consecutive ones joined into one utterance with commas); Delete-recording button; calls said 3 times; no pause before court number, game number, "and", name 2. Not yet heard by anyone.
- Migrations through 088 applied on dev and prod (owner confirmed, not verified by me).
- 471 unit tests, `tsc -b`, build pass.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Not verified

- Real sound from the tablet; **Spotify interplay**; how long the computer voice lags on the real tablet (joining words is a fix by reasoning, not measured).
- Whether the tablet's default voice is a network voice (needs internet).
- Delete button clicked in the app (typechecks only).

## Immediate next steps

- Owner: Settings → Announcer → record the new "Game" word (13 words now); listen on the tablet with Spotify playing.
- If computer voice still lags: pick a local voice in `speak()` and/or raise its rate.

## Open questions

- Spotify drowning the call: lower Spotify volume manually, or a short chime before the call (not built).
- Game numbers above 9 use the computer voice (no clip) — record more number clips, or accept?
- Carried over: Clean Sweep parked; prod migration history out of sync (never `db push` to prod); `TodayView` old board; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
