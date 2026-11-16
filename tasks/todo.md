# Supabase → Neon migration — plan v2 (2026-11-16, NOT STARTED, awaiting owner go for Phase 0)

v1 was reviewed by a separate session (`tasks/neon-migration-review.md`) and its findings are folded in.
The previous plan (Postgres Changes → Broadcast, shipped 2026-11-15) is in git history and `project_memory.md`.

## Goal and hard constraints

- **Why:** Supabase Free runs on NANO, with ≈400 MB RAM. Most of that memory goes to Supabase's own stack
  (28 processes), not our 24 MB of data. The box stalls under session load (Oct 4, Nov 15).
- **$0, always.** Neon Free plan, no card. On Free, running out of CU-hours or egress **suspends the
  database until next month, with no warning**. Staying under the caps is a correctness requirement, not a
  nice-to-have.
- **The app must behave exactly as it does now.** Every screen, flow, rule and live update must survive.
- **Keep every account:** the 108 Google users keep their UUID and all their data.

## Recommended shape: H1 hybrid (decision D2 — owner)

| Piece | H1 (recommended) | Full Neon (v1) |
|---|---|---|
| Postgres + REST | **Neon** (Data API) | Neon |
| Auth (Google) | **Stays on Supabase.** The Neon Data API verifies Supabase JWTs via JWKS | Neon Auth |
| Storage (117 files) | **Stays on Supabase** (keeps the CDN; 668 of 722 file requests/day are CDN hits) | Neon Object Storage + Function |
| Live updates | Neon Realtime (beta) | Neon Realtime (beta) |
| Hourly registration opening | open on app load (D1) | same |

Why H1:
- **Managed Neon Auth appears to stop the database ever sleeping.**
  - Evidence: GitHub discussion neondatabase/neon#12909, opened 2026-06-05, still unanswered by Neon.
    Users report the auth service queries `neon_auth` every ≤ 274 s, under the 5-minute sleep threshold.
    A Free-plan user fixed it only by tearing out Managed Auth.
  - Always awake at 0.25 CU ≈ 182 CU-h/month, against a 100 CU-h cap → the app goes down around
    day 17.
- **Users don't need migrating at all.** They keep their login, nobody has to sign in again, and there's no
  UUID problem (v1 gates G3/F2 and the `user_metadata` drift go away).
- **Storage egress stays off Neon's 5 GB/month,** and the CDN keeps working.
- **Supabase keeps only light work:** about 170 auth requests/day plus file metadata. 17.4k of ~18.7k
  daily requests (REST + Realtime) leave it, so the memory-starved box stops stalling under session
  load. This is inference; Phase 2 measures it.

Full-Neon fallback, if H1's JWKS gate fails: self-host Better Auth (not Managed Neon Auth) and
re-evaluate. It would need its own plan.

## Verified facts (sources read 2026-11-16)

| Fact | Source |
|---|---|
| Free: 100 CU-h per project per month (every branch's compute counts), autoscale up to 2 CU, scale-to-zero after 5 min, **cannot be disabled**. 1 GB storage per project, 10 branches. | neon.com/pricing (upd. 2026-11-04), /docs/introduction/plans |
| Free egress: 5 GB per project per month, shared by Postgres, Object Storage and Functions. Hitting the CU or egress cap suspends compute until next month. No charges, no card, **no spending notifications**. | same |
| Data API: "fully compatible with PostgREST". Accepts any provider via a JWKS URL ("Other Provider"). The JWT `role` claim picks the Postgres role. Logged-out role is `anonymous` (no grants by default). `auth.uid()` returns a uuid from `sub`. | /docs/data-api/overview, /custom-authentication-providers, /docs/extensions/pg_session_jwt |
| Supabase is **not** in Neon's list of JWKS providers. Untested → gate G0. | /docs/data-api/custom-authentication-providers |
| Realtime (beta): sealed live SQL queries (60 s, renewed by our endpoint). **No RLS tables. No publish from a trigger** (a trigger writes a row instead). Region ap-southeast-1 is supported. Enabling it permanently sets `wal_level=logical` and briefly suspends all computes. | /docs/realtime/* |
| Realtime FAQ says open subscriptions don't block sleep; the logical-replication page says a connected subscriber does. **Unresolved** → G1. | /docs/realtime/faq, /docs/guides/logical-replication-neon |
| Functions: schedule triggers fire while compute sleeps. `pg_cron` runs only while compute is awake. | /docs/compute/functions/*, /docs/extensions/pg_cron |
| Managed Neon Auth keeps compute awake (user reports, unanswered). | github.com/neondatabase/neon/discussions/12909 |

## Measured on prod (Supabase MCP, 2026-11-16)

- DB 24 MB. 22 public tables, 60 RLS policies (49 `authenticated`, 5 `anon`, 4 `anon,authenticated`,
  2 `public`), 22 functions, 15 public triggers + `on_auth_user_created` on `auth.users`.
- **24 FKs from public tables → `auth.users`, plus 2 → `profiles`** (v1 said 22, which was wrong).
- Event trigger `ensure_rls` (`ddl_command_end`) auto-enables RLS on every new table.
- `rt_send_once` is SECURITY DEFINER with ACL `{postgres=X}` (PUBLIC execute revoked).
- Auth: 124 users = **108 Google + 16 `@badminton.test` seed accounts** (never signed in, no data).
- Storage: 4 buckets, 117 objects, 14 MB. Realtime: 7 `rt_*` functions/triggers. Cron:
  `open-registration-hourly`.
- Traffic, Nov 15 session day: 17.6k REST/auth requests, peak 5.7k/h. Non-session days show signed-in
  activity in 6–15 distinct hours (review M1, from `auth.refresh_tokens`).

## Free-plan budget (H1)

| Limit | Ours | Verdict |
|---|---|---|
| Postgres 1 GB | 24 MB | fine |
| CU-hours 100/month | **Inference:** 46–128 CU-h if autoscale reaches 0.5 CU (review M1). With **max autoscale pinned to 0.25 CU (1 GB RAM, ~2.5× today's 406 MB)**, ~30–70 | **unproven.** Gates G0/G1 and the first month decide. |
| Egress 5 GB/month | REST + Realtime only (Storage stays on Supabase). **Size unknown** | owner input + G5 |
| Supabase Free | Auth + Storage only | **Check Supabase's inactivity-pause rule** (G6) |

## Target architecture (H1)

| Today | After | Change |
|---|---|---|
| Supabase Postgres | Neon Postgres, `aws-ap-southeast-1`, **autoscale 0.25–0.25 CU** | `pg_dump` public schema + data. **Grants are re-created explicitly** (`grants.sql`); never trust `--no-acl` defaults |
| PostgREST via `supabase.from()/rpc()` | Neon Data API | `src/lib/supabase.ts` keeps `supabase.auth` / `supabase.storage` on Supabase and routes `from()`/`rpc()` to a postgrest client pointed at Neon, carrying the Supabase access token (one file; the 56 importers don't change) |
| 24 FKs → `auth.users` | FKs → `public.profiles(id)` | Generated from `pg_constraint`, never typed by hand |
| `on_auth_user_created` → profile | Existing `src/lib/ensureProfile.ts` heals a missing profile on sign-in (6 users rely on it today) | Confirm it covers brand-new users (G4). Drop the auth trigger |
| 9 `anon` policies (incl. kiosk `matches` update / `match_results` insert) | `anonymous` | Rename. The kiosk is in the Phase 2 checklist |
| Supabase default `anon` grants (incl. TRUNCATE/TRIGGER) | Only the grants the app needs | `grants.sql`, plus a diff check in `verify.mjs` |
| SECURITY DEFINER functions | Same | `REVOKE EXECUTE … FROM PUBLIC` on every `rt_*` and trigger function, otherwise anyone could spoof `user:<id>` messages through RPC (review B3) |
| `ensure_rls` event trigger | Dropped | `verify.mjs` asserts every public table except `live_messages` has RLS on |
| Realtime Broadcast | Neon Realtime. **Append-only** `live_messages(id bigserial pk, topic text, msg jsonb, created_at)`, no RLS, **no grants to `anonymous`/`authenticated`**. Triggers **insert**, keeping `rt_send_once`'s per-transaction dedupe; rows older than 10 min are purged inside the insert trigger. A `seal` Function verifies the Supabase JWT: anyone may get `session:*`, only the owner `user:<id>`. Subscription: `WHERE topic=$1 AND id > $last_seen` | Only `src/lib/liveChannel.ts` changes. Every message still arrives (3 cheers = 3 toasts; `complete` then `in_progress` = 2 messages) |
| Background tabs holding `user:<id>` | Close subscriptions on `visibilitychange: hidden`; on visible, reopen + catch-up refetch (the pattern `useRealtime` already uses on reconnect) | Keeps hidden tabs from holding compute awake |
| `pg_cron` hourly | **D1** (b): `open_due_registrations()` RPC on app load. SECURITY DEFINER, idempotent, one `UPDATE`, executable by `anonymous`. (a) is a Function schedule, ~15–17 CU-h/month | Recommend (b). Same lag as today's top-of-hour cron |
| Supabase DEV project | Neon branch `dev` (DB) + the existing Supabase DEV project (auth/storage) | Suspend idle branches, since they share the 100 CU-h |

## Phase 0 — Spike (throwaway Neon project; no change to prod or app code)

Each gate is pass/fail. **G0 and G1 run first; if either fails, stop and report to the owner.**

- [ ] **G0 Supabase JWT on Neon:** set Data API "Other Provider" = Supabase DEV's JWKS URL
  (`https://tsvetqzkullivprbjtli.supabase.co/auth/v1/.well-known/jwks.json`). Needs asymmetric signing keys
  on Supabase. Check whether they're enabled; switching to them is a Supabase setting, so ask the owner
  before changing it. Check that `auth.uid()` = the Supabase user id, `role` maps to `authenticated`, and a
  logged-out request runs as `anonymous`. **Fail →** stop and re-plan (self-hosted Better Auth option).
  - **Result 2026-11-16: PASS, with two design changes.** Run on Neon project `lucky-heart-02739020`, branch
    `spike` (0.25 CU, expires 2026-11-23). Supabase DEV + prod already sign with ES256: no Supabase change.
    - Neon's own `auth` schema (pg_session_jwt, owned by `cloud_admin`) is unusable with an external IdP:
      `authenticated` gets `42501 permission denied for schema auth`, the grant is a no-op ("no privileges
      were granted"), and `auth.uid()` returns NULL even from a SECURITY DEFINER function.
      **Fix:** `neon data-api create … --skip-auth-schema`, then create our own `auth.uid()/role()/jwt()/email()`
      with Supabase's bodies (they read `request.jwt.claims`, which Neon's Data API sets). The 60 policies
      can migrate verbatim. Measured: `auth.uid()` = Supabase user id, `auth.email()` correct, an RLS
      `owner = auth.uid()` policy returned only that user's row, a tampered token → 401 PGRST301.
    - Neon rejects requests with **no** token (401 PGRST302), and the app's `sb_publishable_…` key is not a
      JWT (401 PGRST301). Logged-out visitors and the kiosk (`match_results: kiosk insert`,
      `matches: kiosk update`, 9 anon read policies) need a token.
      **Fix:** Neon's JWKS URL points at a merged key set (Supabase's public key(s) + our own ES256 key);
      the client sends a long-lived anon JWT `{role:"anonymous", aud:"authenticated"}` signed by our key,
      like Supabase's old anon key. Measured: runs as `anonymous`, sees only anon-policy rows, write without
      grant → 42501. Supabase users still verify through the merged set.
    - **New design items for Phase 1:** where the merged JWKS lives in prod (spike used a Neon
      `public_read` bucket; it must be refreshed if Supabase rotates keys), and the anon private key is kept
      out of the repo. Data API `update` cannot change the JWKS URL — it needs `delete` + `create`.
- [ ] **G1 Idle and sleep:** a 24 h idle run with Data API + Realtime enabled and no clients. Then 15 min
  with one **hidden** tab renewing its seal, and 15 min with a visible one. Read compute active time and
  CU-h. **Fail →** stop.
  - **Started 2026-11-16 00:31 UTC** on branch `spike` (`ep-sparkling-scene-ao4aq7i4`, 0.25 CU fixed).
    Realtime enabled (`wal_level` = `logical` confirmed), Data API on, no clients. Counters at start:
    `active_time_s 0, compute_time_s 0` (Neon metrics lag up to ~1 h). Check on/after 2026-11-17 00:31 UTC:
    `neon branches get spike --project-id lucky-heart-02739020 -o json` → `active_time_seconds`.
    Pass = active time ≈ only the setup minutes (well under 1 h); fail = it climbs with no clients.
    Hidden/visible-tab runs come after the idle result.
  - Side result (part of G2): `neon realtime subscribe` on `live_messages WHERE topic=… AND id > n`:
    3 separate inserts → 3 change events (111/209/258 ms after the first write); a 2-row transaction →
    1 event carrying both rows. `live_messages` has no grants for `anonymous`/`authenticated`.
- [ ] **G2 Realtime delivery:** trigger inserts reach subscribers. 3 notifications to one user within
  500 ms → 3 messages; `complete` + `in_progress` in one transaction → 2 messages. Measure latency.
  `anonymous`/`authenticated` can't read `live_messages`.
- [ ] **G3 Query parity:** the app's real queries (embeds, `count`, `upsert`/`onConflict`, `single()`,
  `maybeSingle()`, `unfinish_match`, `get_session_finance`), logged in and logged out, with all 60
  policies and `grants.sql`. Error codes `23505` and `42501` still come back.
- [ ] **G4 New user:** a brand-new Google sign-in gets a profile through `ensureProfile`, with the correct
  slug and display name.
- [ ] **G5 Cold start and egress:** first-request latency after a sleep, from the Philippines; response
  bytes for one simulated session.
- [ ] **G6 Supabase pause rule:** read Supabase's current docs on when Free projects pause. If an
  auth-and-storage-only project can pause, H1 needs a keep-alive plan or is off.
  - **Result 2026-11-16: RISK, not a blocker.** supabase.com/docs/guides/platform/free-project-pausing:
    Free projects pause after low activity over 7 days; inactive = "does not receive sufficient user
    database activity"; "a few user requests to the database each day" is enough. The docs do **not** say
    whether Auth or Storage/CDN requests count. A warning email comes ~1 week before; restore via
    Dashboard → Resume project (up to 1 year). **Phase 1 item:** a tiny daily PostgREST read on Supabase
    (e.g. from a Neon Function schedule trigger, which fires while Neon sleeps) so H1 never depends on the
    undefined rule. The app's weekly sessions likely suffice anyway, but don't rely on it.

## Phase 1 — Build (branch `094-neon-migration` off `dev`; Neon branch `dev`)

- [ ] `scripts/neon/`, reading secrets from `.env*` at runtime and never printing them:
  - [ ] `export-supabase.mjs` (read-only)
  - [ ] `transform.sql` (FK repoint from `pg_constraint`, `anon` → `anonymous`, `rt_*` → `live_messages`,
    drop `auth.users` trigger / `ensure_rls` / `pg_cron` / `realtime.*` / `storage.*` references)
  - [ ] `grants.sql`
  - [ ] `import-neon.mjs`
  - [ ] `verify.mjs`: row counts, FK integrity, an RLS-on check, and a privilege diff for
    `anonymous`/`authenticated` vs Supabase `anon`/`authenticated`.
- [ ] `seal` Neon Function (verifies Supabase JWT via JWKS with `jose`).
- [ ] Client: `src/lib/supabase.ts` (split data vs auth/storage), `src/lib/liveChannel.ts` (Neon
  Realtime, same `LiveMessage` API), visibility close/reopen, D1 RPC call.
- [ ] Tests:
  - [ ] Unit: `liveChannel.test.ts` with a fake Realtime client, covering per-message delivery and
    `last_seen`.
  - [ ] Build: `npm run build` (`tsc -b`).
  - [ ] e2e: the 8 specs using `supabase.auth.admin` keep working because auth stays on Supabase DEV.
    Point their data calls at Neon `dev`.
- [ ] Env: `.env.example` gains `VITE_NEON_DATA_API_URL`, `VITE_NEON_REALTIME_URL` and the seal Function
  URL. Vercel env vars are listed for the owner.

## Phase 2 — Rehearsal (prod copy → Neon branch `rehearsal`)

- [ ] Run export → transform → grants → import → verify on a fresh prod export, and record its duration.
- [ ] **"Works the same" checklist,** at phone width, as player, as admin and logged out:
  - [ ] Sign in / out, staying signed in after a reload, redirects to `/`, `/register` and `/admin`.
  - [ ] Registration:
    - [ ] Register / unregister and the registration limit.
    - [ ] Payment-exempt sync.
    - [ ] Receipt upload / view / delete, and the admin notification.
  - [ ] Admin session work:
    - [ ] Create / edit / share a session.
    - [ ] Generator presets and generating the schedule.
    - [ ] Live court screen, subs, unfinish.
    - [ ] Finish the session (stats + `sessions_attended`).
  - [ ] **Logged-out kiosk** result entry.
  - [ ] Results → player and pair stats, all leaderboards (active window 5), Today view.
  - [ ] Cheers: the gate, toasts (3 cheers = 3 toasts), cheer stats.
  - [ ] Live board logged out: updates within ~1 s, keeps last good data, "Reconnecting…" badge.
  - [ ] Announcer clips, avatars, payment QR.
  - [ ] Finance RPC, shuttles, notes.
  - [ ] Scheduled registration opening (D1).
- [ ] Load test: a 20-device simulation (`scripts/loadtest/session-sim.mjs`, adapted). Watch CU, egress
  and the Supabase memory chart.

## Phase 3 — Cutover (a day with no session; short write freeze)

- [ ] Nobody needs to sign in again (H1). Announce a short maintenance window only.
- [ ] Freeze writes → final export / import / verify → switch Vercel env → deploy `main` → smoke test.
- [ ] **Rollback:** redeploy the previous Vercel production build. Supabase still has the data, and writes
  made on Neon during the window are lost, so decide go / no-go inside the freeze window.

## Phase 4 — After cutover

- [ ] A daily CU-h and egress check script (Neon API) with a stop-loss threshold, since Free sends no
  warnings. Write real numbers into `project_memory.md` (Capacity).
- [ ] Remove the moved tables from Supabase only after the owner confirms; keep Supabase Auth/Storage.
- [ ] Update `project_memory.md` (Stack, Environments, Capacity, Realtime) and `docs/qa-log.html`.

## Owner input needed

1. **Neon account** (free, no card), and allow the Neon MCP:
   `claude mcp add --transport http neon https://mcp.neon.tech/mcp`, then authorize.
2. **D2:** H1 hybrid (recommended) or full Neon.
3. **D1:** open registration on app load (recommended) or an hourly Function.
4. **Supabase Usage → Egress** for the last billing cycle.
5. Allow switching Supabase DEV (and later prod) to asymmetric JWT signing keys, if G0 needs it.
6. A cutover day with no session.

## Risks

- **R1 (high):** whether Realtime or the Data API keep compute awake → G1 first; stop if so.
- **R2 (high):** CU-h and egress caps take the app down with no warning → 0.25 CU pin, hidden-tab close,
  daily check script.
- **R3 (medium):** Supabase JWKS on Neon is undocumented → G0.
- **R4 (medium):** Realtime is beta (protocol "not yet stable") → pin SDK versions; the 30 s safety poll
  already covers missed messages.
- **R5 (low):** cold start after 5 min idle → G5.

## Review

- 2026-11-16, session "Review Supabase → Neon migration plan": **go-with-changes for Phase 0 only**.
- Spot-checked in this session against prod: 24+2 FKs, `rt_send_once` ACL, the `ensure_rls` event
  trigger, 16 seed users, and the GitHub #12909 thread. All confirmed.
- Folded in: G0 first (B1), append-only `live_messages` (B2), explicit grants and REVOKEs (B3), 0.25 CU pin
  and hidden-tab close (M1), Storage kept on Supabase (M2), FK count 24 (M3), the auth wrapper and test
  harness issues removed by H1 (M4, M5), `ensure_rls` decision (M6), minors m1–m8, H1 adopted as the
  recommendation.
