# Live updates: Postgres Changes → Broadcast — plan (2026-11-15, live on prod)

Why (measured on prod, Nov 15): the box is short of memory (≈400 MB RAM, 230–370 MB in swap, commitment
1.3 GB). The fixes we tried don't work: restarting (swap refills in about an hour) and lowering
`shared_buffers` (only 15.6 MB of 224 MB is used; the box has no huge pages, so the unused part takes no RAM).
The cheapest thing left is to make the app do less database work.

Realtime's Postgres Changes poll (`list_changes`) takes **263 s of 539 s of all DB time since the 16:12
restart (49%)**, averaging 12.2 ms over 21,627 calls. It runs non-stop whenever anyone has the app open, and
on every poll it checks each change against each subscriber's access rules. It is always the first query to
stall. Broadcast pushes a message only when a row actually changes, and checks access once, when a phone joins.

**Will not fix:** the swap itself. Expected: about half of the DB work goes away, there is no constant
poll, and stalls should be rarer. If stalls continue after this, the only fix left is a compute upgrade.

## Design
- **Messages carry no data, only "this changed".** Clients keep today's refetch logic unchanged: coalesce
  plus jitter, the 30 s safety poll, the keep-last-good board, and the backoff retries.
- **Topics:**
  - `session:<id>`: changes to `matches`, `sessions`, `session_registrations`, `session_receipts`, and
    `match_results` (the trigger looks up `session_id` through `matches`).
  - `user:<id>`: changes to `notifications` (`user_id`), `player_stats` (`player_id`), and
    `session_registrations` (`player_id`).
- **Triggers:** one trigger function that calls `realtime.send(jsonb, 'changed', topic, true)`, with
  `FOR EACH STATEMENT` triggers using transition tables. A bulk write (the generator inserting 40 games)
  then sends one message per session instead of 40. `realtime.send` and `broadcast_changes` already exist
  on prod.
- **Private channels with access rules on `realtime.messages`:**
  - Anyone, including the logged-out live board, may receive `session:%`.
  - Only the owner may receive `user:<id>`.
  - Nobody may send from a phone. This stops anyone from spamming fake "changed" messages that would
    make every phone refetch.
- **Client:** one `useLiveChannel(topic, onChange)` helper, with the same connected / reconnecting /
  disconnected status as `useRealtime`. It replaces all 13 `postgres_changes` listeners:
  - `useRealtime` (the live board, PlayerView ×2, SessionPlayerDetailView, SessionView)
  - `useMatchCheers` (a duplicate `matches` UPDATE listener; fold it into the session topic)
  - `useRoster`, `useRegisteredPlayers`, `SessionPlayerDetailView` (leaderboard and my-registration), `TodayView`
  - `NotificationContext`, `usePlayerSessions`, `ProfileView`

## Steps
- [x] 0. Build a 20-device simulation on DEV (`scripts/loadtest/`), with its project ref hard-checked
       before it runs.
       - Devices: 20 sign-ins using the dev test accounts. Each one subscribes like the app and polls
         every 30 s.
       - Admin: finishes a game every ~4 min across 3 courts; players cheer.
       - Measures: DB time per minute (`pg_stat_statements` deltas), `list_changes` calls, request
         latency p50/p95, and the delay from a write until every device sees it.
       - Run it now as the before-measurement.
- [x] 1. Migration (additive): the trigger function, the triggers, and the `realtime.messages` access
       rules. Postgres Changes keeps working, so nothing breaks yet.
- [x] 2. Verify on DEV that the logged-out live board can join a private `session:` channel. If it can't,
       make the `session:` topics public (still message-only), but then phones can send fake messages.
- [x] 3. Client: add `useLiveChannel`, convert all 13 listeners, and add unit tests for the topic
       helpers. Check the live board, player view, notifications and roster on localhost.
- [x] 4. Re-run the simulation and compare DB time, polls and update delay with step 0.
       DEV, 20 devices, 20 min, a game every 2 min, Nov 15:
       - DB time: 37.0 s before vs 28.5 s after. The 28.5 s includes 9.4 s of a leftover poll: Realtime
         kept polling for ~10 min after the last old-style subscriber left (it stopped at 12:59:16).
         Without that it is 19.1 s, about 48% less.
       - The poll's own cost: 18.3 s, 49% of DB time before, the same share as prod. After the leftover
         poll stopped it ran 0 times.
       - Updates delivered: 100% in both runs. Delay p50 295 ms after vs 734 ms before; p95 1.7 s vs
         1.0 s.
       - Requests: no failures in either run.
       - Stalls: per-minute p95 over 1 s happened in 4 of 19 minutes before, and in 1 of 11 minutes
         after the poll stopped. A DEV-wide stall at 12:51–12:52 (p95 5.1 s) happened while the
         leftover poll was still running.
       - One device's channel errored twice at 16.5 min and rejoined within 3 s with no missed
         updates. Cause unclear.
- [x] 5. Prod rollout, Nov 15 ~21:40, after the session. 089 was applied via MCP apply_migration (only 089; owner asked),
       verified with a rolled-back dry run, then main deployed. The logged-out board's private join was authorized on prod.
       Originally planned as: run the migration (owner runs `db push` to prod),
       then deploy.
- [ ] 6. Once every phone is on the new version, remove the tables from the `supabase_realtime`
       publication. Old cached app versions then fall back to the 30 s poll.
- [ ] 7. First session after rollout: pull logs and metrics the same day and compare DB time and stalls
       with Nov 15.

## Open questions
- Can a logged-out (anon) phone join a private channel? Answered by step 2.
- Do old PWA versions stay cached on players' phones? This decides when step 6 is safe.

---

# Court announcer (prerecorded names) — plan (2026-10-26)

Context: when a game starts on a court, the live-board tablet (already on the Bluetooth speaker, Spotify
alongside) calls it out: "Court 2 … [AJ] … and … [Jaz] … versus … [Sim] … and … [Kurt]". Decided with the owner:
prerecorded clips stored on the server and downloaded to the tablet ahead of time; the admin records every
name and the fixed words; only the game starting now is announced; clips readable by link (the live board
has no login).

## Storage
- [x] Migration 088: public bucket `announcer-clips` (public read, admin-only insert/update/delete, like
      `avatars` in 069) + table `announcer_clips (key text pk, path text, updated_at)`; key = player id or
      `phrase:court`, `phrase:number-1..9`, `phrase:and`, `phrase:versus` (changed 2026-10-26 from court-1..4). anon/authenticated read, admin write.
- [x] Clips are saved as short mono WAV: plays everywhere, so no iPhone/Android format question. ~1 s ≈ 40 KB.

## Recording (admin)
- [x] `lib/clipAudio.ts` (pure, tested): trim leading/trailing silence, normalise peak, encode WAV.
- [x] Record control: hold-to-record via MediaRecorder → decode → `clipAudio` → preview ▶ → Save (upload +
      upsert `announcer_clips`). Re-record replaces.
- [x] Players page: 🎙 per player (record / play / re-record), plus a "no recording" filter.
- [x] Second option, Upload: pick an audio file already on the phone (recorder app, MP3/M4A, voice note) → same
      decode → trim → normalise → WAV → preview → Save. Unreadable format → clear error naming the file type.
      (iPhone may not decode WhatsApp `.opus`; test both platforms.) Same two options on the fixed-words card.
- [x] Settings page: "Announcer voice" card for the fixed words (Court 1…N, "and", "versus").

## Announcing (live board tablet)
- [x] `useCourtState`: add player `id` to `CourtPlayerDisplay` (additive; phones unaffected).
- [x] "🔊 Announcer" button on the live board: one tap unlocks audio, downloads the session's clips into the
      Cache API (keyed by `updated_at`, so a re-record refreshes), decodes them once, shows "14 of 16 names ready".
      Off by default; remembered per tablet.
- [x] `lib/announcer.ts` (pure, tested): detect a court whose current match id changed to a new one — never on
      first load or a reload (no burst of calls when the tablet opens); build the clip sequence.
- [x] Playback through Web Audio, clips back to back with short gaps; two courts starting together queue.
- [x] Missing name clip → that name via the phone's text-to-speech; missing phrase clip → whole call via text-to-speech.

## Verify
- [x] Dev: upload an MP3 and an M4A/OGG; an unsupported file shows the error.
- [x] Unit: change detection (first load silent, reload silent, new match once, two courts queued), WAV encoder, trim.
- [x] Dev, Playwright: record (fake mic), save, live board announces on a court change.
- [ ] **On the real tablet with Spotify playing**: is the call audible over the music, ducked, or does it pause Spotify? (Unknown until tested.)

Review (2026-10-26): built per the approved plan. Deviation: record is tap-to-start/tap-to-stop (hold is unreliable on touch). Clips are all downloaded on switch-on, not only the session's players (≈40 KB each; covers subs). 471 tests, `tsc -b`, build pass. Dev via Playwright with 088 stubbed (dev not migrated): record (fake mic) + upload WAV + bad file error at 390/1280; live board: one call on a court change, none on repeat poll or reload. Prod: 088 applied, anon read-only verified. Not tested: MP3/M4A/OGG uploads, real audio output, Spotify interplay.

# Guest accounts — plan (2026-10-23)

Context: walk-ins play on a shared dummy account (`workislife99@gmail.com`). Its games must show in the session
views (schedule, session Leaderboard tab, TodayView) but never on any all-time board, award, badge or podium
celebration. Decided with the owner: a real player's games with or against the guest still count in that
player's own all-time stats; pairs with the guest stay off Partners.

- [x] Migration `087_profiles_is_guest.sql`: `is_guest boolean not null default false`; set it true for the
      profile whose `email = 'workislife99@gmail.com'`. Applied to prod via MCP (never `db push`); owner pastes on dev.
- [x] `fetchEligiblePlayerIds` (`lib/boardEligibility.ts`): also drop profiles with `is_guest`. That one gate
      covers Cheers, Partners (both partners checked), Awards, Early Bird, Win Streak, Against the Odds, profile badges.
- [x] `fetchAllTimeLeaderboard` (`lib/leaderboardData.ts:80`): the Wins board copies the gate inline and skips it;
      switch it to `fetchEligiblePlayerIds`. This also fixes the podium celebration's `wins` standing.
- [x] `types/database.ts`: add `is_guest` to profiles Row/Insert/Update.
- [x] Tests: gate drops a guest; Wins board drops a guest; a pair containing a guest is dropped.
- [x] Not changed (per decision): session views, `player_stats`, a guest showing in another player's
      "Best partners"/"Toughest opponents" on My Profile. No admin toggle — the flag is set in SQL.

Verify: `tsc -b`, unit tests, build. Prod: guest is flagged and every board/award query on prod returns no guest row
(read-only checks). Dev: Playwright as Admin at 390 px — guest absent from Wins/Partners/Cheers/Awards, present on a
session's Leaderboard tab.

Review: done 2026-10-23. Prod migration applied, guest flagged; 459 tests, `tsc -b` clean. Dev Wins board renders (guest query 400s on dev until 087 is pasted, ignored). Not checked in-browser on prod.

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

---

# New app logo — "Badminton Tayo!" bunny (2026-11-08)

## Plan

- [x] Source: user-supplied 2000×2000 webp (bunny + "Badminton Tayo!" text on purple/green court).
- [x] Generate with Pillow (LANCZOS): `public/logo-32.png`, `public/logo-192.png`, `public/logo-512.png`,
      `public/apple-touch-icon.png` (180), `src/assets/logo-nav.png` (96, for the 32 px nav at 3× DPR).
- [x] `index.html`: favicon → `/logo-32.png` + 192 icon + `apple-touch-icon`.
- [x] `TopNavBar.tsx` home button: import new logo; `rounded-md` instead of `rounded-full`, so the
      square art's corners (where the text starts) aren't cropped.
- [x] Out of scope (not asked): HomeView 80 px logos and Live Board keep `pp-logo.jpeg`.
- [x] `npm run build`, check nav + tab icon in browser, commit on `dev`, push, merge `dev` → `main`, push.

## Review

- Shipped 2026-11-08. Verified on dev server: favicon links resolve to `/logo-32.png`, `/logo-192.png`, `/apple-touch-icon.png`; nav image is `logo-nav.png` (96 px natural) at 32 px, rounded square. `npm run build` passes.
