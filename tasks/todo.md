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
- [x] **G1 Idle and sleep:** a 24 h idle run with Data API + Realtime enabled and no clients. Then 15 min
  with one **hidden** tab renewing its seal, and 15 min with a visible one. Read compute active time and
  CU-h. **Fail →** stop.
  - **Started 2026-11-16 00:31 UTC** on branch `spike` (`ep-sparkling-scene-ao4aq7i4`, 0.25 CU fixed).
    Realtime enabled (`wal_level` = `logical` confirmed), Data API on, no clients. Counters at start:
    `active_time_s 0, compute_time_s 0` (Neon metrics lag up to ~1 h). Check on/after 2026-11-17 00:31 UTC:
    `neon branches get spike --project-id lucky-heart-02739020 -o json` → `active_time_seconds`.
    Pass = active time ≈ only the setup minutes (well under 1 h); fail = it climbs with no clients.
    Hidden/visible-tab runs come after the idle result.
  - **Early result 2026-11-16 (control-plane watch, `neon api /projects/…/endpoints`, doesn't wake
    compute): sleeps.** `spike` (Data API + Realtime on) and `production` both showed `last_active 00:38:00`,
    went `idle` by 00:46 and stayed idle through 00:58 with no clients. Unclear why `last_active` is 00:38
    on both when the last known connection was ~00:31 — possibly a Neon-side event; the 24 h
    `active_time_seconds` read confirms whether anything wakes it later.
  - **Read 2026-11-16 10:10 UTC (~9.6 h in):** `active_time_seconds 1236` (~21 min), `compute_time_seconds 312`,
    counters last updated 07:44 UTC. Endpoint `last_active` still 00:38:00, state `idle` — nothing has woken
    it since. The 1236 s is the G0/setup work before 00:38 (start counters were lag-zero). **Looks like a
    pass;** confirm with one more read on/after 2026-11-17 00:31 UTC — pass if still 1236 (or within a few s).
  - **Tab runs 2026-11-16 on `parity` — PASS, and R1 resolved.** App with `neonLiveChannel` (localhost, DEV
    sign-in s1-alex, 2 channels: `session:` + `user:`), control-plane watch every 30 s.
    - **Visible 11:36–11:51 UTC:** both channels `connected` throughout, 42 pass renewals, yet the endpoint went
      `idle` at ~11:39 (last real query 11:33) and stayed idle. **An open Realtime subscription does not keep
      compute awake** — the Realtime FAQ was right, the logical-replication page does not apply.
    - **Delivery after sleep:** a write at 11:52 woke the database (connect 1.2 s); the open subscription got
      both changes 0–3 ms after commit. Sleeping loses nothing.
    - **Hidden 11:52:47–12:07:50** (simulated: the browser pane keeps every tab `visible`, so
      `document.visibilityState` was overridden and `visibilitychange` fired — real phone throttling not
      covered): channels closed at +60 s (11:53:47.7); two renewals already in flight finished 0.2 s later and
      were discarded; then **no seal calls for 14 min**. Endpoint idle from 11:57:46 (5 min after the 11:52 write).
    - Visible again → `connected` in ~2.3 s (includes waking the database).
    - Consequence: the hidden-tab close is no longer needed for compute; keep it to save seal calls
      (Function quota 1M/month). Compute ≈ time with real queries only.
  - **FINAL 2026-11-17 00:35 UTC: PASS.** spike `active_time_seconds` 1236 → 1544 (+308 s, one ~5 min wake). Neon
    operations log: at 15:18:18 UTC an `apply_config` ran on **all four branches** (production, spike, parity,
    rehearsal) right after I created rehearsal's Data API; all suspended at 15:23:31. Otherwise spike slept 00:38 →
    15:18 (~14.7 h) and 15:23 → 00:35 (~9.2 h). So no wake came from idle Data API/Realtime; project-level admin
    ops (Data API create, Realtime enable) briefly start every compute (same cause as the 00:38 wake on day 1).
  - Side result (part of G2): `neon realtime subscribe` on `live_messages WHERE topic=… AND id > n`:
    3 separate inserts → 3 change events (111/209/258 ms after the first write); a 2-row transaction →
    1 event carrying both rows. `live_messages` has no grants for `anonymous`/`authenticated`.
- [x] **G2 Realtime delivery:** trigger inserts reach subscribers. 3 notifications to one user within
  500 ms → 3 messages; `complete` + `in_progress` in one transaction → 2 messages. Measure latency.
  `anonymous`/`authenticated` can't read `live_messages`.
  - **Result 2026-11-16: PASS** (branch `parity`, real `rt_*` triggers from G3 `transform.sql`, Realtime enabled on
    `parity` without waking `spike`; script `scratchpad/pgtest/g2run.mjs`, `neon realtime subscribe --changes`).
    - 3 notifications, separate transactions 150 ms apart → 3 rows, **3 events** (ids 115–117).
    - `complete` + `playing` in one transaction → **2 rows, delivered as 1 event** carrying both (ids 118–119).
      The app status is `playing`, not `in_progress` (enum `match_status`: queued, playing, complete).
      `liveChannel.ts` must handle every row in a change event, not just the first.
    - 3 rows set to `queued` in one transaction → **1 row** (dedupe kept).
    - Latency: event reached the subscriber 1–29 ms after the client saw the commit (both in Singapore
      from the Philippines, so excludes the one-way trip to the writer).
    - `anonymous` / `authenticated` `select` on `live_messages` → 42501.
    - Subscriber startup on a sleeping branch: ~15 s (CLI + compute wake) — the app's first subscribe after a
      sleep needs a test in Phase 1 (seal Function + SDK, not the CLI).
    - Not tested here: the browser SDK path and the seal. Test data deleted; match statuses restored.
- [ ] **G3 Query parity:** the app's real queries (embeds, `count`, `upsert`/`onConflict`, `single()`,
  `maybeSingle()`, `unfinish_match`, `get_session_finance`), logged in and logged out, with all 60
  policies and `grants.sql`. Error codes `23505` and `42501` still come back.
- [x] **G4 New user:** a brand-new Google sign-in gets a profile through `ensureProfile`, with the correct
  slug and display name.
  - **Result 2026-11-16: PASS** (branch `parity`, Data API `ep-blue-recipe-aodxyifb`). Real Supabase DEV sign-ins on
    localhost; the app's own `ensureProfile` ran with `supabase.from` pointed at Neon (page-only patch, no code change).
    - Fresh user (`s1-jamie`, no profile on parity) → row created: `s1-jamie-lee`, role `player`, email, level 5,
      active, not guest. Same slug the prod trigger `handle_new_user` would give.
    - Slug taken (seeded `s1-sam-wong`) → Neon returns 23505 `profiles_name_slug_key` → retry gives
      `s1-sam-wong-533e52`. Second call is a no-op.
    - Race path: duplicate id → 23505 `profiles_pkey` (message contains `pkey`, so the early return works).
      Inserting a profile for another id → 42501 (RLS).
    - Differences from the trigger (accepted, already true for healed prod users): collision suffix is
      `-<id6>` not `-2`; name falls back to `full_name` then email local part, where the trigger used `user`.
    - Without the trigger, a failed first `ensureProfile` (network) leaves no profile until the next app load
      or Retry — `AuthContext` runs it on every load with a user, inside the loading window.
    - Test rows deleted; parity back to 9 profiles.
- [ ] **G5 Cold start and egress:** first-request latency after a sleep, from the Philippines; response
  bytes for one simulated session.
  - **Latency result 2026-11-16 (8 cycles, Philippines → Singapore, empty schema):** first Data API request
    after sleep ~1.5 s median (1118–1615 ms, incl. ~150 ms TLS); next request 125–497 ms; then ~45 ms.
    Direct `pg` cold connect + query ~1.1 s. Sleep after ~5 min (300 s default). Test cost 0.093 CU-h.
    Egress still to measure on the real schema.
  - **Egress result 2026-11-16: fits, ~10x headroom.** Source: prod Supabase `edge_logs` (24 h window
    2026-11-15 10:36 → 2026-11-16 10:30 UTC, covering most of the Nov 15 session: 16 players, 20 games, plus the
    morning after). `content_length` is logged on only 817/5436 requests (REST is chunked), so bytes = rows
    returned (`content_range`) × avg JSON row size of each query shape, measured on prod with `row_to_json`.
    - REST GETs: 2,956 requests, ~207k rows (matches 77k, session_registrations 37k, cheers 36k, profiles 21k,
      player_stats 13k, sessions 5.6k). Row sizes: matches 348 B (7 cols) / 511 B (with `match_results`
      embed), cheers 104 B, registrations 52–191 B, profiles 136 B, sessions up to 1.1 KB.
    - ≈ **50 MB uncompressed** for the window (~45 MB rows + ~3 MB headers on ~4,900 requests incl. OPTIONS).
      Session evening (10–16 UTC) is 2/3 of it.
    - Month: assume 80 MB per session day (window misses the session start) × 5 + ~5 MB × 25 quiet days
      ≈ **0.5 GB/month** vs the 5 GB Free limit. Realtime messages are tiny (< 1 KB each). Storage stays on
      Supabase. Not counted: gzip (would lower it), mid-week registration rush (unknown, small per G6 logs).
    - Biggest consumers, if it ever needs trimming: the history queries that pull every past match / every cheer
      by giver (`matches?session_id=in.(…)` 42k rows, `cheers?giver_id=eq.…` 36k rows).
    - Cross-check still open: owner reads Supabase Usage → Egress for last cycle.
- **G3 result 2026-11-16: PASS with one serious break** (session `neon-g3-parity`, branch
  `claude/practical-chandrasekhar-7fc37a`, scripts in `badminton-v2/scripts/neon/` there, not merged).
  62/63 checks pass incl. 14 with real Supabase DEV tokens. **Break:** Neon's Data API `.single()` returns
  200 `null` on 0 rows (no PGRST116) and the first row on 2+; a PATCH `.single()` hitting 2 rows commits
  both. Phase 1: custom `fetch` in `src/lib/supabase.ts` that returns PGRST116 when the count ≠ 1.
  - **Fix built 2026-11-16 (not wired):** `src/lib/singleObjectFetch.ts` + `src/__tests__/singleObjectFetch.test.ts`
    (11 tests, real postgrest-js). Sends object requests as array requests and rebuilds the object or the
    PGRST116 error (details "The result contains N rows", so `maybeSingle()` still works). Live on `parity`: raw
    client 0 rows → 200 null, 6 rows → 200 object; wrapped → 406 PGRST116 both; 1 row / maybeSingle / lists
    unchanged. Full suite 506/506, build passes. **Phase 1:** pass it as `global.fetch` on the client that
    talks to Neon (prod stays on Supabase until then).
  - **Write rollback can't be restored:** Neon ignores `Prefer: handling=strict, max-affected=1` (a PATCH
    and a DELETE on 4 rows both committed all 4). The wrapper reports PGRST116 but the write stays. All 10
    `.single()` writes in `useSession.ts` filter by `id`, so none can match 2 rows. Keep it that way.
  Also found: repo migrations drift from prod (56 vs 60 policies, `cheers` differs); prod lets anyone,
  even logged-out, run `unfinish_match` / `reverse_session_stats`; the kiosk `matches` update policy
  can't work on prod (no UPDATE grant for `anon`).
- [ ] **G6 Supabase pause rule:** read Supabase's current docs on when Free projects pause. If an
  auth-and-storage-only project can pause, H1 needs a keep-alive plan or is off.
  - **Result 2026-11-16: RISK, not a blocker.** supabase.com/docs/guides/platform/free-project-pausing:
    Free projects pause after low activity over 7 days; inactive = "does not receive sufficient user
    database activity"; "a few user requests to the database each day" is enough. The docs do **not** say
    whether Auth or Storage/CDN requests count. A warning email comes ~1 week before; restore via
    Dashboard → Resume project (up to 1 year). **Phase 1 item:** a tiny daily PostgREST read on Supabase
    (e.g. from a Neon Function schedule trigger, which fires while Neon sleeps) so H1 never depends on the
    undefined rule. The app's weekly sessions likely suffice anyway, but don't rely on it.
  - **Keep-alive built 2026-11-16.** Owner: run it as a **Neon Function** (not GitHub Actions) calling a **ping
    function** (not an app table). Migration `091_keepalive_ping.sql`: `keepalive_ping()` returns now(), EXECUTE to
    `anon` only; owner ran it on prod, verified read-only. `functions/keepalive` (7 tests) answers only Neon trigger
    deliveries (`x-neon-trigger-invocation-id` = body `invocation_id`; the proxy strips forged `x-neon-*`, so a
    forged call got 401) and POSTs `/rest/v1/rpc/keepalive_ping` with the publishable key. `neon.ts`: function
    `keepalive` (env KEEPALIVE_SUPABASE_URL/KEY in the deploy file — always prod) + trigger `supabase-keepalive`
    `0 19 * * *` (03:00 Manila). `transform.sql` drops `keepalive_ping` on Neon.
  - **Verified:** deployed to `parity`; trigger set to every minute for 3 min → prod edge logs show
    `POST /rest/v1/rpc/keepalive_ping` 200 at 13:49, 13:50, 13:51 UTC (colo SIN); parity's database stayed idle.
    Trigger back to daily (next 19:00 UTC). It now pings prod daily from parity until that branch expires 2026-11-23.
  - **Cutover item:** deploy `keepalive` (and its trigger) on the Neon `production` branch. Not needed before then:
    prod Supabase still serves all data traffic.

## Phase 1 — Build (branch `094-neon-migration` off `dev`; Neon branch `dev`)

- [ ] `scripts/neon/`, reading secrets from `.env*` at runtime and never printing them:
  - [ ] `export-supabase.mjs` (read-only)
  - **Dress rehearsal, part 1 — 2026-11-16: PASS (owner OK'd copying prod data to Neon).**
  - Getting the data out: `supabase db dump --remote` fails for this account (login-role endpoint 403); Neon's Import
    Data Assistant does not support Supabase; logical replication needs Supabase's paid IPv4 add-on. Used pg_dump:
    PostgreSQL 17.12 binaries zip from get.enterprisedb.com unpacked into the scratchpad (winget installer was cancelled
    at UAC); the owner ran `pg_dump -Fc --schema=public --no-owner --no-acl` against the session pooler
    (aws-1-ap-southeast-1, IPv4) and typed the password — never seen by Claude. Dump 806 KB.
  - **Version gap:** Neon project is **Postgres 18.7**, prod is 17.6. The 17 dump restored into 18 with no errors.
  - Branch `rehearsal` (`br-lively-waterfall-aolnrtw4`, ep-late-river-aozehmpq, 0.25 CU, expires 2026-11-30), from
    the empty `production` branch. Order: bucket `jwks` (`--access-level public_read`; `--access` is silently ignored
    and gives a private bucket) with prod Supabase key + new `neon-anon-rehearsal-1` (non-extractable, never saved;
    10-year token kept) → Data API (external, Supabase, aud authenticated, --skip-auth-schema, anon role `anonymous`)
    → `apply.mjs pre` → pg_restore pre-data + data (`--single-transaction --exit-on-error`, list without the
    `SCHEMA public` entry) → shim `auth.users` filled from profiles (102) → pg_restore post-data → transform (24 FKs
    repointed) + grants + verify (all checks passed). Prod had 0 orphan user ids. Triggers are post-data, so loading
    data fired none.
  - **All 22 tables identical to prod**: row counts and md5 content hashes per table (UTC), e.g. cheers 6168,
    notifications 6349, player_pair_stats 1184, matches 563, registrations 537, profiles 102, sessions 41.
  - Realtime (prod + localhost origins), `seal` (prod sign-in) and `keepalive` (+ daily trigger, JWKS refresh from
    prod) deployed to rehearsal. Signed-out live board for the Nov 15 session loads from rehearsal (4 Neon calls, 0
    Supabase, 0 failed).
  - **Part 2 (next):** owner signs in with Google on localhost (app pointed at prod auth + rehearsal data; launcher
    `scratchpad/rehearsal/launch.mjs`) — check prod allows localhost as a redirect — then compare leaderboards,
    history and finance with the live site, and measure egress per page.
- **Load test on rehearsal (prod copy) — 2026-11-17 00:47–01:02 UTC: PASS — memory issue answered.**
  - `scripts/loadtest/session-sim-neon.mjs` (new): 20 phones (the Nov 15 session's 16 real players, tokens signed with
    a temporary test key added to rehearsal's JWKS only — removed after, private key deleted), each with its own
    Realtime connection and 2 live queries (`session:` + `user:`), app-style refetch (300–1000 ms coalesce, 30 s poll,
    60 s name cache); admin finishes/starts a game every 60 s through the Data API (triggers fire). Guarded to the
    named endpoint, never Supabase. Busier than a real session.
  - **2,250 requests (150/min), 0 failed for the phones.** Reads p50 ~48 ms, p95 ~300 ms, max 678 ms. Live updates
    **340/340 delivered**, p50 56 ms, p95 368 ms. Admin writes p50 ~45 ms, max 315 ms.
  - **Backends 12 → max 19** (Data API `authenticator` pool 9; Realtime shows none) of max_connections 112 — vs 28
    Postgres processes on Supabase NANO idle.
  - **Memory fit:** database 12 MB vs `shared_buffers` 128 MB (1 GB RAM, 0.25 CU). LFC: 1,393 misses (first loads,
    344 pages ≈ 2.7 MB), 0 hits — everything after warm-up came from shared buffers. (`CREATE EXTENSION neon` on
    rehearsal only.)
  - 16 failures were the test admin only: no DELETE on `match_results` for `authenticated` (same on prod), so old
    results stayed and new inserts hit the unique key. Not a Neon difference.
  - **RAM (Neon console, endpoint stats API, 1-min points): used 232 MB at start, peak 300 MB, settled 272–288 MB, of
    1,024 MB provisioned (≤ 29%).** OS page cache another ~270–290 MB (reclaimable). CPU 0.02–0.03 of 0.25 vCPU (~10%).
    Compare Supabase NANO: 406 MB total with ~520 MB held, 230–370 MB in swap all day.
  - Rehearsal restored to 2026-11-17T00:45:29Z (backup `rehearsal-loadtest-backup`); fingerprints identical to prod again;
    the `neon` extension is gone; anonymous read 200.
- **Prod key decisions (owner, 2026-11-16):**
  1. **JWKS location: a `public_read` Neon bucket on the `production` branch** (as on parity), not a file on the
     Vercel site — data must not depend on a healthy web deploy. The Data API JWKS URL is fixed at create time.
  2. **Kept current automatically:** the daily keepalive Function also fetches the Supabase project's public keys,
     merges the anonymous key, and rewrites the bucket file when it differs. Rotation note: create the Supabase
     standby key a day before switching to it, so the refresh has already published it.
  3. **Anonymous signing key: thrown away** after signing the token (nothing secret to keep; replacing = new pair).
  4. **Anonymous token lifetime: 10 years** (like Supabase's anon key; prod's runs to 2036).
  - **#2 built 2026-11-16:** `functions/keepalive/jwks.ts` (`mergeJwks`/`refreshJwks`, 10 tests: public fields only, anon
    key wins a kid clash, no write on unchanged/empty/failed answers, refuses without an anon key) + handler runs it
    after the ping (3 more tests; refresh failure → 502 logged). `index.ts` uses `@aws-sdk/client-s3` 3.1161.0
    (`forcePathStyle`) on the bucket from `JWKS_BUCKET`; `neon.ts` declares bucket `jwks` (public_read) — this also
    injects the AWS_* credentials — plus env JWKS_SUPABASE_URL (auth project for that branch), JWKS_BUCKET, ANON_JWKS.
  - **Verified on parity:** uploaded a stale list without the DEV key → 14:39 run restored it (DEV + both anon kids);
    14:40 and 14:41 runs left it untouched (same Last-Modified 14:39:02, same etag); pings to prod 200 at all three;
    anonymous Data API read 200 afterwards. Trigger back to daily. Backup of the pre-test file in the scratchpad.
  - Production setup at cutover: create the Data API with JWKS URL `<production storage endpoint>/jwks/jwks.json`;
    generate the anon key pair, sign the 10-year token, put the public JWK in ANON_JWKS, destroy the private key.
- **Prod security fix 2026-11-16 (migration 090, owner ran it on prod):** `sessions: admin delete` USING (true) let any
  signed-in player delete any session; replaced by `sessions: staff delete` (admin/moderator). Prod still 60 policies, so
  `verify.sql`'s count holds for the pg_dump path; the repo-migrations path now makes 57. Parity has the fix too. Open, by
  design: `match_results: kiosk insert` lets logged-out callers insert results for any match (decide before Phase 1).
- **G3 scripts now on `dev` (2026-11-16)** in `badminton-v2/scripts/neon/` (copied from the G3 worktree; that branch had
  no commits of its own). Known gap: the repo migrations make 56 policies, prod has 60, so `apply.mjs` on the
  migrations path stops at `verify.sql` (expects 60); parity got the 4 by hand. The Phase 2 path (pg_dump of prod)
  has all 60 and is the one that counts.
- [ ] `transform.sql` (FK repoint from `pg_constraint`, `anon` → `anonymous`, `rt_*` → `live_messages`,
    drop `auth.users` trigger / `ensure_rls` / `pg_cron` / `realtime.*` / `storage.*` references)
  - [ ] `grants.sql`
  - [ ] `import-neon.mjs`
  - [ ] `verify.mjs`: row counts, FK integrity, an RLS-on check, and a privilege diff for
    `anonymous`/`authenticated` vs Supabase `anon`/`authenticated`.
- [x] `seal` Neon Function (verifies Supabase JWT via JWKS with `jose`). **Built + deployed to `parity` 2026-11-16.**
  - Owner decisions (2026-11-16): host = **Neon Function** (own free quota: 1M invocations, 10 active
    capacity-hours/month, separate from 100 CU-h; a limit hit stops only live updates — a Vercel over-limit
    pauses the whole site 30 days). **Session channels open to anyone** (logged-out live board), user channels
    owner-only (same as migration 089). **Realtime origins: prod + localhost only** (Neon takes exact origins
    or `*`; previews fall back to the 30 s refresh).
  - Code: `functions/seal/handler.ts` (logic, 18 tests in `handler.test.ts`), `functions/seal/index.ts`
    (SDK + `jose` wiring), `neon.ts` `functions.seal` (env REALTIME_SECRET, SUPABASE_URL, ALLOWED_ORIGINS),
    `tsconfig.functions.json` (build type-checks it), vitest includes `functions/**`. `@neon/realtime` 0.2.1 and
    `jose` 6.2.1 pinned exact. Suite 524/524, build passes.
  - API: `POST {topic}` (+ `Authorization: Bearer <supabase jwt>` for `user:`). Seals
    `SELECT id, msg FROM public.live_messages WHERE topic = $1` — fixed params, so renewal = same call.
    400 bad topic, 401 no/invalid token on user:, 403 someone else's user: or another website, no-store.
  - Deploy: `neon config plan` first (showed only `+ function seal`), then
    `neon deploy --branch parity --no-env-pull --env <file>` (file = `neon env pull -s realtime` for that branch
    + `SEAL_SUPABASE_URL`). `--no-env-pull` matters: otherwise it rewrites `.env.local` for that branch.
    URL: `https://br-gentle-wildflower-ao7c6whw-seal.compute.c-2.ap-southeast-1.aws.neon.tech/`.
  - **Live result on parity:** seal 347 ms cold / 50–130 ms warm; database stayed asleep through seal calls.
    Browser (localhost, DEV sign-in `s1-alex`, `@neon/realtime/client` raw mode): own user pass 200, other
    user 403; subscribe → `live` in ~2.3 s (wakes the database); notification on `user:` 13 ms after commit,
    match change on `session:` ~1 ms; `renew()` 105–173 ms, stays live; a pass for another topic is refused
    as a renewal ("must be for the same query").
  - **For `liveChannel.ts`:** the initial `rows` snapshot holds up to 10 min of old messages — ignore it, act on
    `changes` only, and only `upsert` (the purge arrives as `remove` changes: 7 seen). One event can carry
    several rows (G2). Subscribing wakes the database, so close on hidden tabs as planned.
- [x] **Data client switch — built 2026-11-16, dormant until env set.** Owner chose option A (one-file router) over
  rewriting ~230 call sites. `src/lib/dataRouter.ts` (`routeDataCalls`: from/rpc/schema → Neon client, auth/storage/
  channel → Supabase; 7 tests) + `src/lib/supabase.ts`: when `VITE_NEON_DATA_API_URL` and `VITE_NEON_ANON_JWT` are set,
  data goes to the Neon Data API with the player's Supabase token, or the anonymous token when signed out, through
  `singleObjectFetch`. Otherwise the plain Supabase client, unchanged. Suite 551/551, build ok.
  - Parity anonymous key: G3's `neon-anon-parity-1` private key was lost (G3 session temp files). New ES256 key
    `neon-anon-parity-2` added to `parity-jwks/jwks.json` (DEV key + both anon kids); private key and 10-year token
    in the scratchpad only. The Data API picked up the new kid without a restart. Prod key location still open.
  - **Browser on parity** (data + realtime on Neon, sign-in on Supabase DEV; launcher in scratchpad, not committed):
    admin `/admin` 41 Neon REST calls, `/leaderboard` 16, `/sessions` 9 — 0 to Supabase REST, 0 failures; signed-out
    `/live-board/<parity S1>` 7 Neon calls with the anonymous token + 1 seal, renders both courts. No writes from
    the UI tested (G3 covered writes at the API level).
- [x] **Write tests through the app's own screens — PASS 2026-11-16** (parity: data + realtime on Neon, sign-in on
  Supabase DEV, localhost; clicks in the browser pane). 0 failed requests in every step.
  - Player: new DEV user s1-jamie → profile created on first load; registered for Parity S2 (201); nickname edit
    (204). Players have no cancel-registration button (by design).
  - Admin: Create Session (201) → edit name/price/opening time + Confirm (opens registration) → Set Limit 16 →
    add 4 players from the roster → Close Registration → generate (needed "Disable Gender Rules": test players have
    no gender) → Save & Lock (20 games inserted in one write, `schedule_locked`) → Start Session (`in_progress`,
    2 playing) → Finish Game 1 "Jamie Neon & Alex" (match `complete`, result pair 2, Game 3 promoted).
    14 live messages written on the session topic across these steps.
  - Cheer: s1-alex got the post-game cheer prompt by itself; Good Sport to P1 (201) → notification row for P1.
  - Logged-out live board: shows live courts; **has no write path** — only admins/moderators can finish games
    (`CourtCard.tsx:29`). So `match_results: kiosk insert` (anon) is unused by the app and can be dropped.
  - Seen, not Neon: "0 / 16 registered" counts only self-registrations; with 4 players on 2 courts the generator puts
    the same 4 in Games 2 and 3 at once. Admin confirm buttons need the second tap within 3 s.
  - Cleanup: `neon branches restore parity ^self@2026-11-16T13:54:22Z --preserve-under-name parity-writetests-backup`;
    S1/S2/9 profiles back, Data API, seal, keepalive and its trigger intact, anonymous read 200.
- [x] **D1 — scheduled registration opening, built 2026-11-16 (dormant until data is on Neon).**
  - Owner decisions: **keep the feature** (prod: used for 5 of 41 sessions, all Mon 20:00 Manila, last 27 Apr 2026;
    the hourly `open-registration-hourly` pg_cron job has had nothing to open since) and **open on app load**, not
    an hourly Function (~15–17 CU-h/month).
  - Players never fetch `setup` sessions, so the app cannot spot a due one; it asks the database instead.
    `open_due_registrations()` (SECURITY DEFINER, one idempotent UPDATE, returns the count) added to
    `scripts/neon/transform.sql`; EXECUTE to `anonymous`/`authenticated` in `grants.sql`; whitelisted in `verify.sql`.
    Not added to Supabase — pg_cron keeps doing it there until cutover.
  - `src/lib/openDueRegistrations.ts` (6 tests): only when `usesNeonData`, at most once a minute per tab, shared
    request, failures logged and never block loading. Called before loading in `usePlayerSessions` and
    `SessionPlayerDetailView`. Suite 557/557, build ok.
  - **Parity:** S2 set to setup with opening time 1 min ago → loading /sessions as s1-alex called the RPC once
    (200, 114 ms) → S2 `registration_open` + live message on its session topic. Future time → 0 opened, stays
    setup (run as `anonymous`). S2 restored.
- [x] **Live channel on Neon Realtime — built 2026-11-16, dormant until env set.**
  - `src/lib/neonLiveChannel.ts`: same `listen(topic, onMessage, onStatus)` as the Supabase registry. First
    result = baseline (ignored); only `upsert` changes delivered, once, in id order; several per event. Renew
    15 s before expiry; failures back off 5/10/20/30 s; `error` → resubscribe with a new pass; rows missed in a
    gap come from the next snapshot (within the 10-min purge window). Hidden > 60 s closes subscriptions and the
    client so the database can sleep; visible reopens (reconnecting → connected → screens' catch-up).
  - `src/hooks/useLiveChannel.ts` picks Neon when `VITE_NEON_REALTIME_URL` and `VITE_NEON_SEAL_URL` are both
    set, else Supabase Broadcast. SDK lazy-loaded; with the vars unset the build has no Neon code. No screen
    changed. `.env.example` documents both. `.claude/launch.json` has `badminton-v2-neon-live` (parity URLs).
  - Tests: `src/__tests__/neonLiveChannel.test.ts`, 20 cases (fake client + fake timers). Suite 544/544, build ok.
  - **Browser on parity (DEV sign-in s1-alex, the app's own hook path):** connected in ~2.6 s; the app opened
    `user:<alex>` by itself (NotificationContext); a parity notification insert showed the real cheer toast;
    `complete` + `playing` in one transaction → 2 messages, 15 ms after commit.
  - Not tested in a browser: the 60 s hidden-tab close (unit-tested only), and G1's 15-minute hidden/visible
    compute runs — next.
- [ ] Tests:
  - [x] Unit: `neonLiveChannel.test.ts` (20) — see above.
  - [ ] Build: `npm run build` (`tsc -b`).
  - [ ] e2e: the 8 specs using `supabase.auth.admin` keep working because auth stays on Supabase DEV.
    Point their data calls at Neon `dev`.
- [ ] Env: `.env.example` gains `VITE_NEON_DATA_API_URL`, `VITE_NEON_REALTIME_URL` and the seal Function
  URL. Vercel env vars are listed for the owner.

## Phase 2 — Rehearsal (prod copy → Neon branch `rehearsal`) — mostly done 2026-11-16/17

- [x] Export → pre → restore → transform → grants → verify on a fresh prod export: clean, all 22 tables identical
  (counts + md5). Owner's `pg_dump` took seconds (806 KB); restore + scripts a few minutes.
- [x] Load test (20 phones × 15 min, `scripts/loadtest/session-sim-neon.mjs`): 0 phone errors, RAM peak 300 MB / 1 GB.
- [x] **All leaderboards identical** — `scripts/neon/compare-boards.ts` runs the app's own fetchers (Individual,
  Partners, 5 Awards, 6 Cheers, eligibility) against the real Neon Data API and against a PostgREST-style
  reference over the same rows: byte-identical output (23,963 bytes), twice. One earlier run returned an empty
  Individual board, not reproducible; it came seconds after a JWKS change (inference: requests briefly refused while
  the Data API re-read the key list). The app shows a failed board load as "No stats recorded yet" — so never
  change the key list during a session.
- [x] **Finance identical:** `get_session_finance` through the Data API (admin) = the function run directly, for all
  41 sessions, 0 failures.
- [x] Writes through the real screens (on parity): register, profile, create/edit/close session, generate/lock,
  start, finish, cheer. D1 opening. Logged-out live board. Kiosk entry: N/A (no logged-out write path exists).
- [ ] Not covered without the owner's sign-in: Google sign-in/out on the Neon build, receipt upload/view (Storage
  stays on Supabase, unchanged), session share image, announcer clips. Low risk (none of these moved), checked in
  the cutover smoke test instead.
- Facts learned: Neon Data API caches JWKS keys **by kid** — never reuse a kid for a different key.

## Phase 3 — Cutover (DRAFT, owner decisions pending)

**When:** a weekday evening with no session; announce a short maintenance window. Rollback is minutes.

**Before the day (no impact on players):**
1. Neon `production` branch (`br-polished-unit-aoa3nyat`, empty): confirm fixed 0.25 CU and scale-to-zero 5 min.
2. Bucket `jwks` with `--access-level public_read`; generate the anon key (non-extractable), sign the 10-year
   token, upload JWKS = prod Supabase key + anon key; destroy the private key.
3. Data API on `production`: external, Supabase, aud `authenticated`, `--skip-auth-schema`, anon role
   `anonymous`, JWKS URL `<production storage>/jwks/jwks.json`.
4. `neon realtime enable --branch production --allowed-origin https://badmintontayo.mrkws.com
   --allowed-origin http://localhost:5173`. (Admin ops briefly wake every branch; harmless.)
5. Deploy `seal` + `keepalive` to `production` (`neon config plan` then `neon deploy --branch production
   --no-env-pull --env <file>`; SEAL/KEEPALIVE/JWKS Supabase = prod, JWKS_BUCKET=jwks, ANON_JWKS = the anon key).
6. Dry run on `production`: load yesterday's dump through the scripts, verify, fingerprints; then wipe it again
   (or keep and reload on the day).
7. Vercel: prepare the 4 env vars (`VITE_NEON_DATA_API_URL`, `VITE_NEON_ANON_JWT`, `VITE_NEON_REALTIME_URL`,
   `VITE_NEON_SEAL_URL`) on the project that serves badmintontayo.mrkws.com — Production scope only. (3 Vercel
   projects build this repo; only one serves the domain — check the name.) Merge Phase 1 to `main` first: with the
   vars unset it changes nothing.

**On the day (~30–45 min):**
1. Freeze writes on Supabase (decision C1) → no new data lands in the old database.
2. Owner runs `pg_dump` (same command as the rehearsal) → Claude loads it into `production` → verify +
   fingerprints vs prod.
3. Set the 4 Vercel env vars → redeploy production → check the bundle contains the Neon URLs.
4. Smoke test on the live site: sign in (Google), sessions list, a session page, leaderboards, live board logged
   out, admin pages, one registration on a test session, receipts view, avatars.
5. Unfreeze nothing on Supabase — it is now the old copy. Watch Neon RAM/CU and the app for the evening.

**Rollback (decide inside the window):** remove the 4 env vars → redeploy → the app is back on Supabase. Re-grant
Supabase writes. Writes made on Neon in between would be lost (or copied back by hand) — so decide go/no-go before
reopening to players.

**Owner decisions needed (ask one by one when we get here):**
- C1: how to stop open tabs (old code in memory, no service worker) writing to Supabase after the switch —
  revoke INSERT/UPDATE/DELETE for `anon`/`authenticated` on Supabase `public` (old tabs then error → reload), or
  rely on the timing (evening, no session).
- C2: which evening, and who announces the window.
- C3: what happens to the old Supabase tables afterwards (keep read-only for N weeks as a fallback, then drop).
- Kiosk rule (`match_results: kiosk insert`, anon): drop or keep — noted, decide before the project ends.

## Phase 4 — After cutover

- [ ] Delete the parity `keepalive` deploy (it pings prod daily until parity expires 2026-11-23); production's takes over.
- [ ] A daily CU-h and egress check (Neon API) with a stop-loss threshold — Free sends no warnings. Real numbers
  into `project_memory.md` (Capacity).
- [ ] Remove the moved tables from Supabase only after the owner confirms (C3); keep Supabase Auth/Storage.
- [ ] Remove Supabase-only code paths (Broadcast registry, pg_cron job) once Neon has run a few sessions.
- [ ] Update `project_memory.md` and `docs/qa-log.html`.

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
