# Handoff — current snapshot

Updated: 2026-11-16 ~23:45 Manila. Overwrite this file on every update; it is never a running history.

## Done this session
- **Phase 0 gates:** G0, G2, G3, G4, G5, G6 pass; G1 early reads pass (spike asleep since 00:38 UTC; open
  Realtime subscriptions don't keep compute awake). Egress ≈ 0.5 GB/month.
- **Phase 1 built, all dormant behind env vars (prod unchanged):** `.single()` fix, data router, Neon live
  channel, `seal` + `keepalive` Functions (daily Supabase ping + JWKS refresh), D1 registration opening.
  App writes through real screens pass on parity.
- **Prod changes (owner ran SQL):** migration 090 (only admins/moderators delete sessions — security fix),
  091 (`keepalive_ping()`).
- **Key decisions (owner):** JWKS in a public Neon bucket, refreshed daily; anon signing key thrown away; anon
  token 10 years.
- **Dress rehearsal part 1:** prod copied into Neon branch `rehearsal` via owner-run `pg_dump`; all 22 tables
  identical to prod (counts + content hashes); Data API, JWKS, Realtime, Functions set up there.

## Current state
- `dev` has 11 Neon commits (latest 553c9b3), **not pushed**. Uncommitted: `tasks/todo.md`, `docs/qa-log.html`,
  `project_memory.md`, `handoff.md` (rehearsal notes + wrap-up).
- Neon branches: `production` (empty), `spike` (G1 idle test), `parity` (tests; expires 2026-11-23; runs
  keepalive daily → pings prod), `rehearsal` (prod copy; expires 2026-11-30), backups `parity-before-restore`,
  `parity-writetests-backup`.
- Scratchpad (lost on reboot): Postgres 17 tools, prod dump, rehearsal anon token + launcher, parity anon key.

## Next steps
1. **G1 final read** after 2026-11-17 00:31 UTC: `neon branches get spike --project-id lucky-heart-02739020 -o json`
   → `active_time_seconds` should still be ~1236. Also re-read parity's counter (it lagged).
2. **Rehearsal part 2:** owner signs in with Google on localhost (app on prod auth + `rehearsal` data; launcher
   `scratchpad/rehearsal/launch.mjs` via a TEMP launch entry); compare leaderboards, history, finance with the live
   site; measure egress per page.
3. Cutover plan: window between sessions, checklist (production Data API + JWKS bucket, anon token, Functions on
   `production`, Vercel env vars, final dump/restore), rollback = remove Neon env vars + redeploy.

## Open questions
- Does prod Supabase allow `http://localhost:5173` as an OAuth redirect? Unclear until tried.
- Drop `match_results: kiosk insert` on prod? Owner said "not now".
- Supabase Usage → Egress figure for last cycle (cross-check of the 0.5 GB estimate). Not given.
- Housekeeping waiting: delete the 2 parity backup branches, archive G3/G5 sessions, 42 npm audit findings (3
  critical), push `dev` (needs owner OK).
- Carried over: Broadcast/share/keep-last-good untested on real phones; magnet HTML commit; Nov 1 session not
  closed; prod `service_role` key not rotated; never `db push` to prod.
