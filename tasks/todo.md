# Cheer later + Settings page — plan (2026-10-04)

Decided with the user: Payment Settings becomes Settings, with layout 1 (Payments and Cheers sections on one
scroll). A "Cheer later" list gives listed players a reminder bar and a sheet on every page instead of the
full cheers gate. The celebration plays anyway and waits only while the sheet is open.

- [x] Migration 084 `cheer_later_players`: admin manages it, a player can read their own row
- [x] `database.ts` types
- [x] Shared `PlayerListCard`; `PaymentExemptCard` and new `CheerLaterCard` become thin wrappers
- [x] `PaymentSettingsView` → `SettingsView`, route `/settings`, `/payment-settings` redirects; nav label
- [x] `useCheerLater` hook; `cheersReminderLabel` (unit-tested); `CheersReminderBar` + sheet
- [x] `PlayerLayout`: bar instead of the gate for listed players; the celebration hold follows the sheet
- [x] Update navMatch test + e2e path; `tsc -b`, lint, unit tests, build; browser check
- [x] Apply 084 to prod (MCP); CLI steps for dev

## Review

- 084 applied to prod via MCP and RLS tested in a rolled-back block: a player sees own=1, other=0, insert
  refused. The admin-side test was declined; the policy is identical to 082's.
- **Dev does not have 084** (the CLI is logged into a foreign account). On dev the lookup 404s and falls back
  to the full gate, by design.
- Browser (Playwright, 390 px, dark, responses rewritten in the browser only): listed admin got the bar
  "15 games done · 45 cheers to give" over /admin, the sheet opened, Later brought the bar back. Unlisted got
  the full gate. /settings shows Payments + Cheers; /payment-settings redirects. No page errors.
- Not exercised: giving a real cheer inside the sheet (it would write to dev).
- `tsc -b`, lint, 405 unit tests and the build all pass.


# Free-plan load reduction — plan (after the 2026-10-04 outage)

Evidence (prod logs, 06:00–07:35 UTC Oct 4): ~10,800 requests / 95 min from ~12 devices. Court poll
(sessions+matches pair) ≈ 3,800 of ~7,800 GETs. First failures at 07:35 were Realtime
`insert into realtime.subscription`; 157 websocket connects in 95 min. `ensureProfile` read ran 107×
for one user. Goal: roughly halve load, and fail visibly instead of spinning.

Branch: `015-free-plan-load`.

## Status (2026-10-04) — done on `015-free-plan-load`

Deviations from the original plan are marked **changed**.

### Fix 1 — poll only as a fallback
- [x] Poll moved out of `useCourtState` into `useRealtime({ onPoll })` (**changed**: avoids a
      circular status hand-off between the two hooks). 30 s while connected, 5 s otherwise, plus an
      immediate refresh on `visibilitychange`. Callers: `LiveBoardView`, `PlayerView` (ScheduleView),
      `SessionPlayerDetailView`. No poll for closed sessions.
- [x] Burst coalescing: 300 ms + up to 700 ms jitter (`lib/realtimePolicy.ts`, unit-tested).
- [x] Bug found: `supabase.channel()` returns the existing channel for a reused topic, so My Games and
      the embedded All Games tab shared one channel. Topics now carry a `useId()` suffix.
- [x] Measured locally: 0 court polls in 20 s idle (was 4), safety-net poll at 33 s.
- [ ] Manual two-tab "finish a match" test — not run (no live session on DEV).

### Fix 2 — fewer subscribe/unsubscribe cycles
- [x] `useMatchCheers`: fetch keyed on the session *set*, display order applied client-side; channel
      filtered server-side to in-progress sessions (`session_id=in.(…)`), none when nothing is live;
      `load` held in a ref; cheer types read once.
- [x] `session_registrations` listeners: table published instead (6b).
- [ ] Before/after channel count across a walk-through — not measured.

### Fix 3 — `ensureProfile` once per user
- [x] Same-id user object kept on token refresh / refocus (`USER_UPDATED` still replaces it); profile
      effect keyed on `user.id`.
- [ ] Provider unit test — not written (vitest runs in `node`, no React renderer set up).

### Fix 4 — unscoped fan-out (**changed**)
- [x] Kept `match_results` listeners: the result insert happens *after* the match update
      (`useAdminActions.finishMatch`), so listening to `matches` alone would miss the final result.
      With one live session at a time a session filter would not cut events anyway.
- [x] Instead: leaderboard listeners coalesced, not resubscribed on `load` identity, and the Today
      leaderboard only subscribes while a session is active.

### Fix 5 — fail visibly
- [x] `getSession` and profile load time out after 10 s → `ConnectionProblem` screen with Try again.
      A failed profile read is no longer treated as "no role".
- [ ] Not exercised against a real failure (no way to stall the backend locally).
- [ ] Court "Reconnecting…" notice — skipped: `LiveIndicator` already shows the Realtime status.
- **changed**: no POC first (user approved going straight to implementation).

### Fix 6 — database (applied to DEV and prod 2026-10-04)
- [x] 6a `083_drop_pg_net.sql` — applied, verified `pg_net` gone.
- [x] 6b `072_session_registrations_realtime` — had never been applied to prod; applied, verified in
      the publication with replica identity FULL.
- [ ] Optional `cron.job_run_details` cleanup — skipped (24 rows/day, negligible).

### Verify / ship
- [x] `tsc -b`, eslint on changed files, 391 unit tests pass; pages checked in the browser, no console
      errors.
- [ ] Next session: compare edge-log requests per 30 min with Oct 4 (target ≤ half).
- [x] lessons.md entry; qa-log updated.

# Payment-exempt players — plan

Admin keeps a list of players who don't pay (the admin, typically). They skip the payment steps and
finance stops counting them as unpaid. Revenue is untouched: it only ever counts `paid = true`.

## Agreed (from `temporary_files/payment-exempt-poc.html`)

- List is managed on **Payment Settings**, as a new card under the QR code.
- An exempt player sees **one small line** ("No payment needed for you · NO FEE") instead of the
  payment steps.
- **Past sessions don't change.** The flag is snapshotted on each registration; adding or removing a
  player updates only their registrations in sessions that are not `complete`. (Recommended; the user
  did not object.)
- A registration already confirmed `paid` stays paid and stays in revenue.

## Data (migration 082)

- [x] `payment_exempt_players (player_id PK → auth.users, added_at, added_by)`; admin-only RLS.
- [x] `session_registrations.payment_exempt BOOLEAN NOT NULL DEFAULT false`.
- [x] BEFORE INSERT trigger on registrations sets the flag from the list (SECURITY DEFINER; overwrites
      whatever the client sent, so a player cannot exempt themselves).
- [x] AFTER INSERT/DELETE trigger on the list updates that player's non-complete registrations.
- [x] `get_session_finance`: add `due_count` (paid OR not exempt) and `exempt_count`. `total_count`
      keeps its meaning.

## App

- [x] `derivePaymentState` gains `'exempt'` (paid dominates, then exempt). Let the compiler find every
      `Record<PaymentState, …>`.
- [x] Read `payment_exempt` in `useRoster`, `usePlayerSessions`, `SessionPlayerDetailView`, `PlayerView`.
- [x] Player: small line in place of the fee card; `PaymentBanner` / `NoScheduleYet` / My Sessions
      label handle `exempt`.
- [x] Admin `RosterPanel`: exempt rows last, "No fee" tag, no toggle, own count.
- [x] `FinanceView`: `paid / due · N no fee`.
- [x] `PaymentSettingsView`: list card (add from dropdown, × to remove, saved immediately).
- [x] `types/database.ts`.
- [x] Unit tests for the new state and visibility.

## Deploy order (blocking)

The code reads a new column, so **migration 082 must be on a database before code that reads it
runs against that database**:

1. Apply 082 to dev → verify locally.
2. Apply 082 to prod → only then push `main` (Vercel deploys prod from it).

Claude has no CLI migration path; this needs the user.

## Review

- Shipped 2026-09-28. 082 applied to prod via MCP `apply_migration` (recorded as `20260928035840`),
  to dev by the user in the SQL editor.
- Prod: triggers tested in a `DO` block ending in `RAISE` (rolled back) — open session flipped, 0 of 11
  completed sessions touched, a self-insert claiming `false` came back `true`, removal reverted it.
- Dev, in the app: added Test Admin → chip + toast, "New Session" flipped, 3 completed untouched;
  session page shows the one-line "No fee"; Payment Status "12 unpaid · 2 no fee" with exempt rows last
  and no toggle; Finance "0 / 12 · 2 no fee"; removal reverted. Test Admin removed again; "Gab" (added
  by the user) left on the list.
- Found on the way: the card rendered a failed load as "Nobody yet" — fixed to show the error.
- Tests: 371 passing (8 new).
