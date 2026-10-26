# Handoff — current snapshot

Updated: 2026-10-26. Overwrite this file on every update; it is never a running history.

## State

- **Fixed words reworked** (branch `041-announcer-court-numbers`, pushed to `dev` and `main`): "Court" + numbers 1–9 as separate clips, replacing "Court 1"…"Court 4".
- **Court announcer built** (branch `040-court-announcer`, pushed to `dev` and `main`): admin records/uploads name clips (Players page) and fixed words (Settings → Announcer); live-board tablet 🔊 chip downloads clips and calls each new game.
- Migration 088 (`announcer_clips` table + public `announcer-clips` bucket) **applied on prod**. **Dev: not applied — owner to paste `088_announcer_clips.sql` into the dev SQL editor.** Until then dev's Players page shows "Couldn't load name recordings" and the Settings card an error; nothing else breaks.
- 471 unit tests, `tsc -b`, build pass. Lint: only pre-existing errors in `MatchGeneratorPanel.tsx:162`.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Dev via Playwright with 088 stubbed: Record (fake mic) → preview → Save at 390 px and 1280 px; Upload WAV → Save; corrupt `.mp3` → error toast; Settings card lists 6 words.
- Live board (dev session `27ff6ffd…`, matches stubbed): enable → "3 of 14 names"; court 1 changes game → exactly 1 call queued; repeat poll → 0; reload → 0 and chip "Tap to turn sound on".
- Prod: bucket public, anon SELECT yes / INSERT no, 6 policies.

## Not verified

- Real sound out of the tablet/speaker; **Spotify interplay** (does Android duck, overlap or pause it?).
- Uploads of MP3, M4A, OGG/OPUS (only WAV and a corrupt file tested); iPhone recording.
- Wake lock on the real tablet.

## Immediate next steps

- Owner on prod: Settings → Announcer → record the 6 words; Players → record a few names; open live board on the tablet, tap 🔈 Announcer, finish a game, listen with Spotify playing.
- Paste 088 on dev.

## Open questions

- If Spotify drowns the call: options are lowering Spotify volume manually, or a short chime before the call (not built).
- Carried over: Clean Sweep parked; load reduction enough?; prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
