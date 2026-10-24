# Handoff — current snapshot

Updated: 2026-10-24 (end of session). Overwrite this file on every update; it is never a running history.

## State

- **Toast second line readable** (branch `039-toast-description-contrast`, pushed to `dev` and `main`): sonner's `#3f3f3f` description (~1.8:1 on dark) now `--muted-foreground` — 7.4:1 dark, 6.0:1 light. Affects receipt and cheers summary toasts.
- **Guest accounts** (branch `038-guest-accounts`, pushed to `dev` and `main`): `profiles.is_guest`, Guest / Not guest toggle on the Players page; guests off every all-time board, award, badge and podium; the Wins board now uses the shared gate. Migration 087 on **prod and dev** (dev pasted by the owner, 2026-10-24). Prod guest: `workislife99` (nickname "Kel").
- **No-fee banner flash fixed**, pushed to `dev` and `main` (2026-10-23).
- 459 unit tests, `tsc -b` and build pass.
- Left uncommitted on purpose: `badminton-v2/supabase/.temp/cli-latest`.

## Verified, and how

- Toast contrast: Playwright on dev fired a receipt-style toast through the app's sonner; colour read via canvas, both themes.
- Guest toggle: Playwright as Admin at 390 px and 1280 px (stubbed `is_guest` before dev had 087); PATCH `{"is_guest":true}` sent, button turns "Guest" with `aria-pressed=true`.
- Prod: 087 applied, exactly 1 profile flagged.

## Not verified

- Boards on prod in a browser with the guest flagged (guest has 1 session, so it would not have qualified anyway).
- Guest toggle saving against a real DB (dev now has 087 — one tap on dev would confirm).
- Carried over: offline backup on a real Android phone.

## Immediate next steps

- Optional: rename the prod guest from "Kel" to something like "Guest" on the Players page.
- Compare edge-log requests per 30 min after the next session with Oct 4 (~2,300–4,200; target ≤ half).

## Open questions

- Carried over: Clean Sweep parked; load reduction enough?; prod migration history out of sync (never `db push` to prod); `TodayView` old board; confetti per-frame speed; no UI for abandoning a game; `temp/` at repo root; prod `service_role` key not rotated.
