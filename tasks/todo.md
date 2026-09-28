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
