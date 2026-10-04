# Handoff — current snapshot

Updated: 2026-10-04 (late night, Manila). Overwrite this file on every update; it is never a running history.

## State

- **"Cheer later" + Settings shipped** (branch `018-cheer-later` → `dev` → `main`):
  - Payment Settings is now **Settings** (`/settings`; `/payment-settings` redirects), with Payments and Cheers sections.
  - Players on the "Cheer later" list get a reminder bar and a sheet instead of the full cheers gate, on every page.
  - The celebration plays over the bar and waits only while the sheet is open.
- **Migration 084 `cheer_later_players` is on PROD** (applied via MCP). RLS tested in a rolled-back block: a player sees only their own row and can't insert.
- **084 is NOT on DEV.** On dev the lookup 404s, falls back to the full gate, and the Settings card shows "Couldn't load the list".
- `tsc -b`, lint, 405 unit tests and the build pass.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Playwright on the dev app as Admin, 390 px, dark. Two responses were rewritten in the browser only (on the list, no cheers given):
  - Listed: bar "15 games done · 45 cheers to give" over `/admin`; the sheet opened; "Later" brought the bar back.
  - Unlisted: the full gate, as before.
- `/settings` showed Payments + Cheers and four cards; `/payment-settings` landed on `/settings`; no page errors.

## Not verified

- Giving a real cheer inside the sheet (would write to dev); the sheet should stay open between cheers per the code.
- The admin-side RLS test (declined); its policy is identical to 082's.

## Immediate next steps

- **On prod:** open Settings → Cheers and add yourself to "Cheer later". It takes effect on the next app load.
- Apply 084 to dev yourself: paste `badminton-v2/supabase/migrations/084_cheer_later_players.sql` into the dev project's SQL editor (`tsvetqzkullivprbjtli`). Prefer that to `db push`, because dev's migration history state is unclear.
- Carried over: restart the prod project 15–30 min before the next session. Afterwards, compare edge-log requests per 30 min with Oct 4 (~2,300–4,200, target ≤ half).

## Open questions

- Carried over: is the load reduction enough (otherwise Realtime Broadcast or paid compute)?
- Carried over: prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
