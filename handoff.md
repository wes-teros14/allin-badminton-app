# Handoff — current snapshot

Updated: 2026-11-15 ~21:15 Manila. Overwrite this file on every update; it is never a running history.

## Done this session
- **Admin share image** (`090-session-share-image`): pushed to dev + main.
- **Live board keeps last good data** (`091-liveboard-keep-last-good`): pushed to dev + main.
- **Prod outage on Nov 15, investigated** (read-only):
  - Owner restarted at 16:09 → down 3 min, then 30–137 s requests until 16:19.
  - Cause is memory: swap 230–370 MB on a box with ~400 MB RAM.
  - Disproved: restarting (swap refills within ~1 h) and lowering `shared_buffers` (15.6 MB of 224 MB used).
  - Details: `docs/qa-log.html` corrections, `docs/visual/realtime-postgres-changes-vs-broadcast.html`.
- **Postgres Changes → Broadcast** (branch `092-realtime-broadcast`, NOT committed, DEV only):
  - Migration `089_realtime_broadcast.sql`: applied to DEV via MCP; **not on prod**.
  - App: `lib/liveChannel.ts` and `hooks/useLiveChannel.ts`; all 13 listeners converted.
  - Tests: 10 new; 495/495 pass; `tsc -b` clean.
  - Load test: `scripts/loadtest/` (DEV-only guard).
    - DB time ~48% lower.
    - The change poll ran 0 times once the old subscribers were gone.
    - Results are in `tasks/todo.md` step 4.

## Not verified
- Share… and Copy image on a real phone.
- Broadcast on real phones, and in a long (2 h) run.
- Live-board keep-last-good fix in a real session.

## Immediate next steps
- Owner reviews, then: commit the branch, merge to dev, and push (ask first).
- Prod rollout, on a day without a session:
  - The owner runs `db push` for 089 to prod.
  - Then deploy main.
- First session after rollout: pull prod logs the same day and compare DB time and stalls with Nov 15.
- Later: remove the tables from the `supabase_realtime` publication, once old cached app versions are gone.

## Open questions
- One simulated device's channel errored twice and rejoined within 3 s. Cause unclear.
- Do old PWA versions stay cached on phones? This decides when the publication can be dropped.
- DEV session `bce6f898-…` is back in its pre-test state; is its Schedule Locked status intentional? Unclear.
- Carried over:
  - Magnet HTML commit (public repo, embeds prod names).
  - Live-session Edit untested.
  - Nov 1 session finished but not closed.
  - Jey's receipt image in storage.
  - Spotify vs announcer volume.
  - Game numbers above 9 use the computer voice.
  - Clean Sweep parked.
  - Never `db push` to prod.
  - `temp/` at the repo root.
  - Prod `service_role` key not rotated.
  - `sessions: admin delete` policy `qual true`: unclear, not checked.
