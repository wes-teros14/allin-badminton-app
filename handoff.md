# Handoff — current snapshot

Updated: 2026-11-15 ~22:30 Manila. Overwrite this file on every update; it is never a running history.

## Done this session
- **Admin share image** (`090`): live on prod.
- **Live board keeps last good data** (`091`): live on prod.
- **Nov 15 outage investigated:** memory, not load. Restarting and lowering `shared_buffers` are both
  disproved (see `project_memory.md` Capacity).
- **Postgres Changes → Broadcast** (`092`, migration 089): live on prod.
  - 089 was applied to DEV and prod via MCP, with only 089 pushed.
  - main was deployed and the private join verified on the live site.
  - The old poll stopped on prod: `old_poll_calls` stayed at 33,071.
- **Supabase custom report "Session health"** and SQL snippet "Session health score" created on prod.
- **Visuals:** `docs/visual/realtime-postgres-changes-vs-broadcast.html`,
  `realtime-broadcast-sim-results.html` and `prod-memory-explained.html`.

## Not verified
- Broadcast on real phones in a real session.
- Share… and Copy image on a real phone.
- Live-board keep-last-good in a real session.

## Immediate next steps
- Owner tests over the next few sessions:
  - Reload the live-board tablet before play.
  - Watch for the "Reconnecting…" badge and note the time.
  - Don't restart mid-session.
- Same day as each session: open the Session health report (last 24 h), then Observability → Database
  for swap and commitment, then pull logs and compare with Nov 15.
- If stalls continue, the only remaining fix is a paid compute upgrade (owner's decision).
- Optional later: remove the tables from the `supabase_realtime` publication.

## Open questions
- One simulated device's channel errored twice and rejoined within 3 s. Cause unclear.
- DEV session `bce6f898-…` is Schedule Locked. Is that intentional? Unclear.
- Carried over:
  - Magnet HTML commit (public repo, embeds prod names).
  - Live-session Edit untested.
  - Nov 1 session finished but not closed.
  - Jey's receipt image in storage.
  - Spotify vs announcer volume.
  - Game numbers above 9 use the computer voice.
  - Clean Sweep parked.
  - Never `db push` to prod without the owner asking.
  - `temp/` at the repo root.
  - Prod `service_role` key not rotated.
  - `sessions: admin delete` policy `qual true`: unclear, not checked.
