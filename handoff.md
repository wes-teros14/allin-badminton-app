# Handoff — current snapshot

Updated: 2026-11-17 ~10:45 Manila. Overwrite this file on every update; it is never a running history.

## Done this session
- **Switched the live site to Neon** (~10:00–10:35 Manila): Supabase frozen → owner's final pg_dump → loaded into Neon
  `production` (23 s, verify passed, identical to frozen prod on all 22 tables) → 4 Vercel Production vars →
  redeploy → owner's signed-in smoke test all good.
- Before that today: G1 final PASS; load test on the prod copy (RAM peak 300 MB / 1 GB, 0 phone errors); leaderboards
  and finance byte-identical through Neon; cutover decisions C1–C3; Neon `production` set up (pinned 0.25 CU) and
  dry-run tested; `dev` pushed and merged to `main` (699fd37).
- Incident: wrong `VITE_NEON_ANON_JWT` in the first redeploy → app looked down ~10 min; owner fixed it.

## Current state
- **Live:** data + live updates on Neon `production`; sign-in + files on Supabase prod. Supabase app tables FROZEN
  (backup, no drop date). Preview builds and local dev unchanged (Supabase DEV).
- Git: `main` = 699fd37 (pushed); `dev` = 68a1d68 (pushed). Uncommitted: cutover notes in `tasks/todo.md`,
  `tasks/lessons.md`, `project_memory.md`, `handoff.md`, CLAUDE.md lesson, Q&A entry.
- Neon branches: `production` (live), `rehearsal` (prod copy, expires 2026-11-30), `parity` (expires 2026-11-23; its
  keepalive also pings prod daily — harmless), `spike`, backups `parity-before-restore`, `parity-writetests-backup`,
  `rehearsal-loadtest-backup`, `production-dryrun-backup`.
- Scratchpad (lost on reboot): Postgres 17 tools, dumps, anon tokens (prod token now lives in Vercel).

## Next steps
1. Watch the first sessions on Neon (Sun Nov 22): Neon console RAM/CU for `production`, any errors players report.
2. Phase 4: daily CU-h + egress check with a stop-loss (Free sends no warnings); real numbers into
   `project_memory.md` Capacity.
3. Housekeeping: delete the 4 backup branches + `spike` (+ `rehearsal`/`parity` when done), archive G3/G5 sessions,
   npm audit (42 findings, 3 critical).
4. Later: decide whether DEV gets a Neon branch; remove Supabase-only code paths after a few good sessions.

## Open questions
- Kiosk rule `match_results: kiosk insert` (anon) — decide at project end (app never uses it). On Neon it's still
  granted (grants.sql mirrors prod).
- Supabase Usage → Egress figure for the last cycle (cross-check of the 0.5 GB/month estimate). Not given.
- Carried over: Broadcast/share/keep-last-good untested on real phones; magnet HTML commit; Nov 1 session not closed;
  prod `service_role` key not rotated; never `db push` to prod.
