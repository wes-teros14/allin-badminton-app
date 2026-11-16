# Review — Supabase → Neon migration plan (`tasks/todo.md`, 2026-11-16)

Independent adversarial review, 2026-11-16. Sources:
- Prod SQL via Supabase MCP (`ensdfitpeyreunihkqkh`, confirmed by `get_project_url`, SELECT only).
- Edge logs (last 24 h, which includes the Nov 15 session).
- Code at `dev` HEAD `569b044`.
- neon.com docs, fetched 2026-11-16. URLs are given per finding.

## Verdict: **go-with-changes, for Phase 0 only**

- Phases 1–3 are **no-go** until the new gate G0 (compute stays idle with Neon Auth on) passes.
- The $0 / no-outage constraint isn't proven, and there is a credible public report that Neon Auth stops scale-to-zero.
- The Realtime table design and the `--no-acl` restore each break a requirement as written. Both are fixable.

---

## Blockers

### B1. Neon Auth may keep compute awake 24/7, which means about 182 CU-h/month and a mid-month outage

- **Evidence:**
  - Neon Auth stores its users and sessions in the `neon_auth` schema inside your own database ([auth overview](https://neon.com/docs/auth/overview)).
  - Open GitHub discussion [neondatabase/neon#12909](https://github.com/neondatabase/neon/discussions/12909), with no Neon staff reply: users report that the managed auth service queries `neon_auth` every ~170–274 s, which is under the 5-minute suspend threshold, so compute never sleeps. One Free user says only disabling Managed Auth fixed it.
  - Always awake at 0.25 CU is 0.25 × 730 h ≈ 182 CU-h against the 100 CU-h cap ([plans](https://neon.com/docs/introduction/plans)). The cap is reached around day 17, and then compute is **suspended until the next billing period, with no notification on Free** (same page: spending notifications "Not available").
- **Not covered by the plan:** G1 tests Realtime only, so G1 would pass while this kills the budget.
- **Fix:** add **G0 before every other gate.**
  1. Create a fresh Free project, enable Neon Auth with no clients connected, and leave it idle for 24 h.
  2. Check the compute's active-time graph and CU-h usage.
  3. Repeat with Neon Auth plus one signed-in idle tab, and with the tab closed.
  4. **Fail →** use the hybrid **H1** below (keep Supabase Auth) or stop.

### B2. `live_messages` with primary key `(topic, tbl)` + upsert loses messages the app depends on

- Supabase today sends **one message per distinct event**, not one per table:
  - `rt_matches_changed` dedupes on `'matches|'||op||'|'||status` (prod `pg_proc`), so a `complete` and an `in_progress` update in one burst are two messages.
  - `rt_notification_inserted` sends **every** notification row with no dedupe.
- Consumers that rely on this:
  - `src/contexts/NotificationContext.tsx:204-228` does `unreadCount + 1` and shows a toast **per message**, using `message.record`.
  - `src/hooks/useMatchCheers.ts:187` acts only on `status === 'complete'`.
- With one overwritable row per (topic, table):
  - A `complete` followed by `in_progress` in the same burst loses the cheer prompt.
  - Three cheers landing on one player within the delivery window turn into one toast and `+1` instead of `+3`.
  - Whether Neon live queries deliver every intermediate row version is undocumented ([realtime overview](https://neon.com/docs/realtime/overview)).
- This breaks "behaves exactly the same".
- **Fix:**
  1. Make the table append-only: `live_messages(id bigserial pk, topic text, msg jsonb, created_at timestamptz default now())`.
  2. Have the triggers **insert**, keeping `rt_send_once`'s existing per-transaction dedupe key.
  3. Subscribe to `WHERE topic = $topic AND id > $last_seen`.
  4. Purge rows older than about 10 min inside the insert trigger (no cron).
  5. Add a G2 case: 3 notifications to one user within 500 ms must arrive as 3 messages, and `complete` + `in_progress` in one transaction must arrive as 2.

### B3. `pg_restore --no-acl` silently re-opens revoked SECURITY DEFINER functions to `anonymous`

- **Evidence (prod `proacl`):**
  - `rt_send_once` is SECURITY DEFINER with ACL `{postgres=X}`, so PUBLIC execute was revoked.
  - `--no-acl` drops that REVOKE, and Postgres's default is EXECUTE for PUBLIC.
- **Risk:** once its body upserts into `live_messages`, anyone could call it through the Data API RPC and **spoof messages into any `user:<id>` topic**. That includes fake `notifications` records, and those become toasts on the victim's phone.
- **Second problem:** `--no-acl` also removes every table grant, and the plan mentions only renaming 9 policies.
- Prod `anon` holds `TRUNCATE/REFERENCES/TRIGGER` on all public tables (Supabase default grants). These must **not** be copied to `anonymous`.
- **Fix:**
  - Write an explicit `grants.sql`: table grants per role (`anon` → `anonymous`), function EXECUTE grants, and `REVOKE EXECUTE ... FROM PUBLIC` on every `rt_*` and trigger function.
  - Have `verify.mjs` diff `has_table_privilege` / `has_function_privilege` between Supabase and Neon for `anonymous`/`authenticated`.
  - Add a Phase 0 check that `anonymous` and `authenticated` have **no** SELECT on `live_messages`.

---

## Major

### M1. The CU-hour estimate of 30–80 is optimistic even without B1

- **Evidence:** prod `auth.refresh_tokens` per Manila day, last 21 days.
  - Non-session days have tokens in **6–15 distinct hours/day**, from 2–11 users.
  - Session days (Oct 26, Nov 1, 8, 15) have 17–20 hours, with 24–44 active 15-minute slots.
  - Supabase tokens last 1 h. Neon tokens last **15 min** ([jwt](https://neon.com/docs/auth/guides/plugins/jwt)), so there are about 4× more refreshes, and each refresh reads `neon_auth` in the same database. Every hour with an open signed-in tab therefore keeps compute awake for at least ~⅓ of the hour.
- **Inference:**
  - Non-session days: ~12 h × 0.33–1 × 0.25 CU ≈ 1–3 CU-h/day, so **26–78 CU-h** over 26 days.
  - Session days: ~20 h × 0.25–0.5 CU ≈ 5–10 CU-h each, so **20–50 CU-h** over 4–5 days.
  - **Total ≈ 46–128 CU-h**, which overlaps the cap.
- **Polling isn't the main cost.** `useRealtime` polls only while the tab is visible and the session isn't complete (`src/hooks/useRealtime.ts:78-84`, `LiveBoardView.tsx:12`).
- **Open subscriptions may be the main cost.** `NotificationContext` holds a `user:<id>` subscription on **every page for every signed-in user**, visible or not, and the sealed query is renewed every 60 s. Whether a renewal touches compute is unknown.
- **Fix:**
  - Set **max autoscale to 0.25 CU** (1 GB RAM is still about 2.5× today's 406 MB), so a burst can't burn 2 CU-h per hour.
  - G1 must test a **hidden** tab renewing its seal for 15 min.
  - Close live subscriptions on `visibilitychange: hidden` and reopen with a catch-up refetch, the pattern `useRealtime` already uses on reconnect.
  - Add a daily CU-h check script (Neon API) with a stop-loss in Phase 4, because Free sends no warning.

### M2. Egress: Supabase's CDN hides most file traffic today; on Neon all of it counts against 5 GB

- **Evidence (edge logs, 24 h incl. Nov 15):** 722 storage requests, **668 were Cloudflare `HIT`**; where measured, the average object is ~127 KB. Neon documents no CDN, and egress is shared by Postgres, Object Storage and Functions **per project** ([plans](https://neon.com/docs/introduction/plans)).
- REST: 17.4k requests/day. Most responses are chunked, so their size can't be measured from logs.
- **Fix:**
  - Get the Supabase Usage → Egress figure (owner input 3) **before** G-gates.
  - Serve public images with `Cache-Control: public, max-age=31536000, immutable` and versioned keys.
  - Or keep Storage on Supabase (H1), which keeps the CDN.

### M3. FK count is 24, not 22, and fallback F2 is incomplete

- **Evidence:** `pg_constraint` shows **24** public FKs → `auth.users`, plus **2** FKs → `profiles` (`notifications.user_id` CASCADE, `announcer_clips.updated_by` SET NULL). Easy to miss because they're nullable "who did it" columns: `session_receipts.dismissed_by`, `generator_presets.created_by`, `payment_exempt_players.added_by`, `cheer_later_players.added_by`, `payment_settings.updated_by`, `announcements.updated_by`, `shuttle_*.created_by/recorded_by`.
- F2 says "remap by email in one transaction at cutover", but Neon Auth only creates the new user at that user's **first sign-in after cutover**. The remap must happen per user at first sign-in, which needs `ON UPDATE CASCADE` on all 26 FKs. It also misses:
  - storage keys containing the user id (the avatars policy uses `storage.foldername(name)[1] = auth.uid()`; `session_receipts.storage_path`; `profiles.avatar_url`);
  - `user:<id>` topics.
- **Fix:**
  - Correct the count.
  - Generate the FK list from `pg_constraint`, never by hand.
  - Rewrite F2 as an `on neon_auth.user insert` hook (or first-sign-in RPC) that matches `lower(email)` to the legacy profile and rewrites the ids through `ON UPDATE CASCADE` FKs plus storage keys.
  - Data supports email matching: 0 duplicate emails, 0 null, 0 auth/identity/profile email mismatches (prod).

### M4. The Supabase `User` shape leaks into app code; the adapter's auth surface is unproven

- `user.user_metadata` is read at `src/lib/ensureProfile.ts:33` (new-user slug) and `src/views/ProfileView.tsx:357` (display name). Better Auth users have `name`/`image`, not `user_metadata.full_name`. New players would get an email-based slug, and the profile would show their email.
- `User` is imported from `@supabase/supabase-js` in 3 files.
- `onAuthStateChange` (2 files), the `USER_UPDATED` logic (`AuthContext.tsx:76-85`), `signInWithOAuth` + `redirectTo` (3 files) and `getUser` (5 files: `PlayerListCard`, `useRoster`, `useSession`, `AdminView` …) are **not documented** for `@neon/neon-js/supabase` ([js sdk](https://neon.com/docs/reference/javascript-sdk)). OAuth is documented only as `auth.signIn.social({callbackURL})`.
- **Fix:** plan the thin auth wrapper as the default, not a G5 fallback.
  - `src/lib/auth.ts` exposes `getSession`, `onAuthStateChange(event, session)`, `signInWithGoogle(redirectPath)`, `signOut` and an app `User` type with `user_metadata.full_name` mapped from `name`.
  - Unit-test the event mapping.

### M5. The test and script harness depends on Supabase admin APIs the plan doesn't cover

- `supabase.auth.admin` is used in 8 e2e specs (`tests/*.spec.ts`) and in `scripts/seed-test-users.ts`; `supabase.storage` in `tests/payment-receipts.spec.ts`.
- "Run the e2e suite against the Neon dev branch" (Phase 1) can't run without a replacement.
- **Fix:** add a Phase 1 item for a test-user helper (Neon Auth email+password on the `dev` branch, or a SQL helper) and a storage fixture helper, then port the 8 specs.

### M6. The `ensure_rls` event trigger is silently lost

- Prod has the event trigger `ensure_rls` (`ddl_command_end` → `rls_auto_enable`), which auto-enables RLS on every new table.
- `pg_dump -n public` doesn't dump event triggers. If it were restored, it would put RLS on `live_messages`, and Neon Realtime doesn't support RLS tables ([realtime overview](https://neon.com/docs/realtime/overview)).
- **Fix:** decide explicitly. Recommended: drop it, add a CI or `verify.mjs` check that every public table except `live_messages` has RLS on, and document the exception.

---

## Minor

- **m1. The 16 users without an identity are seed accounts.** All are `@badminton.test` with a password, created 2026-03-19, never signed in, and have 0 profiles, registrations, matches, stats or cheers (prod). **Fix:** don't import them. Real accounts = **108 Google users**; 6 of them have no profile, which `ensureProfile` heals on sign-in.
- **m2.** Turning on Realtime permanently enables logical replication for the project and briefly suspends every compute on all branches ([realtime overview](https://neon.com/docs/realtime/overview)). Do it in Phase 0 on the spike, and before rehearsal on the real project, never near a session. The [logical replication](https://neon.com/docs/guides/logical-replication-neon) page says a connected subscriber prevents scale-to-zero; the Realtime page says open subscriptions don't. G1 settles which applies.
- **m3. D1(b) "open on app load"** opens a session only when someone loads the app, and players already sitting on `/sessions` won't see it until they reload. Today's hourly cron has the same lag at the hour, so the gap is acceptable. The RPC must be SECURITY DEFINER, idempotent and executable by `anonymous`, with only the one `UPDATE … WHERE status='setup' AND registration_opens_at <= now()`. Option (a) costs ~24 wakes × 5 min × 0.25 CU ≈ 15 CU-h/month (inference), which matches the plan's ~17.
- **m4. Rollback.**
  - Writes made after cutover are lost on rollback. Add a reverse `export-neon → import-supabase` script for the tables written during the window, or cap the go/no-go to the freeze window as written.
  - Supabase Free pauses inactive projects. Check the current inactivity rule in the Supabase docs, and record the date by which rollback stops being instant.
- **m5. Google OAuth.** Neon needs a **redirect URI per branch** ([oauth](https://neon.com/docs/auth/guides/oauth)): dev, rehearsal and prod. List all three in owner input 2.
- **m6.** Free limits are **1 GB storage per project, 20 GB per account, and 10 branches including the root** ([plans](https://neon.com/docs/introduction/plans)). Phase 1 `dev` plus Phase 2 `rehearsal` plus spikes fit. Every branch's compute draws on the **same 100 CU-h**, so suspend or delete the `rehearsal` and `dev` branches when they're idle.
- **m7.** `public_read` is set via the Console or API, and S3 ACL calls return 501 ([s3 compatibility](https://neon.com/docs/storage/s3-compatibility)). The import script can't create buckets with ACLs.
- **m8.** The anon kiosk writes (`matches: kiosk update`, `match_results: kiosk insert`) are among the 9 policies that move to `anonymous`. Add the logged-out kiosk result entry to the Phase 2 checklist explicitly.

## Simpler alternative worth a gate: H1 (hybrid)

- Keep **Supabase Auth + Storage** (and the CDN). Move **Postgres + Data API** to Neon, with the Neon Data API verifying Supabase-issued JWTs through Supabase's JWKS.
- **Gains:**
  - No UUID problem (G3/F2 disappear).
  - No re-sign-in for 108 players.
  - No `user_metadata` drift.
  - No Neon Auth idle risk (B1).
  - Storage egress stays off Neon's 5 GB.
- **Costs:** Supabase nano still runs, but REST/Realtime load (17.4k of ~18.7k requests/day) leaves it. Auth was 169 requests/day on Nov 15.
- **Unverified:**
  - whether Neon's Data API accepts a third-party JWKS;
  - whether Supabase pauses a project that only serves auth.
- Live updates would still use Neon Realtime (B2's design).
- **Fix:** add **G0-alt** to Phase 0. Point the Neon Data API at Supabase's JWKS and check that `auth.uid()` equals the Supabase user id. If it works, prefer H1 on correctness: fewer moving parts and no account migration.

---

## Claims verified correct

| Plan claim | Evidence |
|---|---|
| 100 CU-h/project/month, 2 CU max, scale-to-zero can't be disabled on Free | [plans](https://neon.com/docs/introduction/plans), [pricing](https://neon.com/pricing) |
| 5 GB egress per project, shared; suspension until next period; no charge; no notifications | [plans](https://neon.com/docs/introduction/plans) |
| Neon Auth 60k MAU, own Google client, `/callback/google`, 15-min EdDSA JWT | [pricing](https://neon.com/pricing), [oauth](https://neon.com/docs/auth/guides/oauth), [jwt](https://neon.com/docs/auth/guides/plugins/jwt) |
| No documented UUID-preserving import (the Supabase guide says nothing about IDs) | [from-supabase](https://neon.com/docs/auth/migrate/from-supabase) |
| Data API "fully compatible with PostgREST"; role `anonymous`; `auth.uid()` returns uuid | [data-api](https://neon.com/docs/data-api/overview), [pg_session_jwt](https://neon.com/docs/extensions/pg_session_jwt) |
| Realtime beta, sealed live queries, no RLS, ap-southeast-1 available | [realtime overview](https://neon.com/docs/realtime/overview) |
| Object Storage 5 GB, presigned PUT/GET, CORS (`PutBucketCors`) | [storage](https://neon.com/docs/storage/overview), [s3 compatibility](https://neon.com/docs/storage/s3-compatibility) |
| Function schedules fire while compute sleeps; `pg_cron` only while it's active | [functions](https://neon.com/functions.md), [pg_cron](https://neon.com/docs/extensions/pg_cron) |
| Prod: 60 public policies, 39 using `auth.uid()`, 15 storage + 2 realtime policies, 1 cron job, `on_auth_user_created` trigger, 117 objects (receipts 96, avatars 20, payment-qr 1) | prod SQL 2026-11-16 |
| No policy or function uses `auth.jwt()`, `auth.role()` or `request.jwt` GUCs (only Supabase's own `cron` policies do); `get_session_finance` uses only `auth.uid()`; vault holds 0 secrets | prod SQL |
| Error codes the app branches on (`23505` in `ensureProfile.ts:39,47`, `42501` in `SessionPlayerDetailView.tsx:801`) are Postgres SQLSTATEs, so a PostgREST-compatible API preserves them | code + PostgREST semantics (inference) |
| `rpc` call sites: `unfinish_match`, `get_session_finance` (`useAdminActions.ts`, `useFinanceSessions.ts`, `useSessionFinance.ts`) | grep. The plan says "2" because both finance hooks call one RPC |
