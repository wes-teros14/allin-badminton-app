# Handoff — current snapshot

Updated: 2026-10-04 (night, Manila). Overwrite this file on every update; it is never a running history.

## State

- **Free-plan load reduction shipped** (branch `015-free-plan-load` → `dev` → `main`): court poll 30 s
  while Realtime is connected (5 s fallback), burst coalescing, unique channel topics, cheers channel
  only for live sessions, profile ensured once per user, 10 s sign-in timeout with a "Can't reach the
  server" screen, leaderboard listeners coalesced.
- **Prod DB changed today (also DEV):** `session_registrations` added to the Realtime publication (072
  had never been applied to prod); `pg_net` dropped (083). Both verified.
- `tsc -b`, lint on changed files, 391 unit tests, `npm run build` pass. Pages checked in the browser,
  no console errors; idle court polls 0 in 20 s (was 4), safety poll at 33 s.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

- **🐦 Early Bird rebuilt (branch `016-early-bird-points`):** points race, last 8 finished sessions,
  5-4-3-2-1 for the first 5 self-registered, organisers excluded, top 3 on the Awards card, badge for
  1st only. Seen on DEV in the browser; prod expectation: Ronwald 31, Jerome 20, AJ 20 (Jerome 2nd on
  1st places).

## Done this session (earlier, already pushed)

- UI/UX critique + fixes (generator presets/help/sliders, schedule tracker, ARIA tabs, `--primary-ink`).
- Missing-profile fix (`ensureProfile` on sign-in), "slots" copy, hide settled-fee row once matches exist.
- Oct 4 outage investigated end to end; notes in `docs/qa-log.html` and `tasks/lessons.md`.

## Not verified

- The "Can't reach the server" screen was never triggered (no way to stall the backend locally).
- Two-tab "finish a match" live update and live registration updates on a real session — a browser
  check was blocked by the permission classifier.

## Immediate next steps

- **Before the next session:** restart the prod project (Project Settings → General → Restart
  project) 15–30 min before play.
- **After the next session:** compare edge-log requests per 30 min with Oct 4 (06:00–07:35 UTC:
  ~2,300–4,200 per 30 min). Target ≤ half. Query via the Supabase connector `query_logs`.

## Open questions

- Is the reduction enough, or does the box still stall? If it stalls again, the remaining free option
  is moving live updates to Realtime Broadcast; otherwise a paid compute upgrade.
- Carried over: prod migration history out of sync (never `db push` to prod); `TodayView` old board;
  confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root unresolved; prod
  `service_role` key still not rotated.
