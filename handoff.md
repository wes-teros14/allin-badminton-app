# Handoff — current snapshot

Updated: 2026-10-04 (late, Manila). Overwrite this file on every update; it is never a running history.

## State

- **Design-only session. No app code changed.** Committed: Q&A log entries, lessons, one `CLAUDE.md` lesson.
- Free-plan load reduction and 🐦 Early Bird all-time (branches `015`–`017`) are on `dev` and `main` from the earlier session.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Done this session

- Diagnosed the admin's problem with the cheers gate: `PlayerLayout` swaps `<Outlet>` for `<CheersPanel>`, and the admin routes are nested in that layout, so finishing your own match unmounts the Live page.
- POC `temporary_files/admin-cheers-gate-options.html` (gitignored): options A–E. **User leaned to B** (a reminder bar plus a sheet instead of the full gate) and confirmed games stack into one bar.
- The user then reframed the request:
  - Rename **Payment Settings → Settings**.
  - Add a **"Cheer later"** player list, built like "Players who don't pay".
  - Listed players get the bar **on every page** (chosen over admin pages only).
- POC `temporary_files/settings-page-options.html`: three layouts. 1 = sections on one scroll (recommended), 2 = Payments | Cheers switch, 3 = player lists first.

## Immediate next steps

- **Get the user's pick of Settings layout (1/2/3)**, then build:
  - Route `/settings`, with a redirect from `/payment-settings`. Change the `TopNavBar` label and the page title.
  - New table (e.g. `cheer_later_players`) with admin-only write RLS. Every player must be able to *read* their own row so the layout knows to show the bar.
  - `CheerLaterCard`, modelled on `PaymentExemptCard`.
  - `PlayerLayout`: listed players get `<Outlet>` plus a `CheersReminderBar` and a sheet wrapping `CheersPanel`. The celebration hold must still apply while the sheet is open, or the cheers are still owed (decide which).
- Migration route: hand the user the CLI steps for dev. For prod, MCP `apply_migration` is fine; never `db push`.
- Carried over: restart the prod project 15–30 min before the next session. Afterwards, compare edge-log requests per 30 min with Oct 4 (~2,300–4,200, target ≤ half).

## Open questions

- Settings layout 1, 2 or 3?
- Should the celebration wait while a "Cheer later" player still owes cheers? Today it is held until the gate clears.
- Carried over: is the load reduction enough (otherwise Realtime Broadcast or paid compute)?
- Carried over: prod migration history out of sync; `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
