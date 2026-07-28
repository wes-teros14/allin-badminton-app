# Quickstart: Verify Payment Info Display

## Prerequisites

- App running locally (`npm run dev` inside `badminton-v2/`)
- Signed in as an admin (dev-only "login as admin" button, per project CLAUDE.md) to configure payment info
- A second test player account registered for a session, to view the player-facing side

## Manual Verification

### Admin side

1. Navigate to the new Payment Settings screen (nav tab, admin-only).
2. Enter a phone number and upload a QR code image; save.
3. Confirm the saved phone number and QR image preview appear on reload of the settings screen.
4. Replace the QR image with a different one; confirm it updates.
5. Sign in as a non-admin player account; confirm the Payment Settings nav tab is not shown and navigating directly to its URL redirects away (same behavior as the existing `/players`/`/inventory`/`/finance` admin routes).

### Player side

1. As a player registered for a session whose registration is unpaid, open that session's detail screen (tap the session card from `/sessions`).
2. Confirm the phone number and QR code image **replace** the "You're registered!" message (not shown alongside it).
3. Tap the copy action next to the phone number; confirm a copy-success indicator appears (e.g. a toast) and the number is on the clipboard.
4. As an admin, mark that player's registration for the session as Paid (existing Finance feature).
5. Reload the player's session detail screen; confirm the phone number and QR code no longer appear — only the plain "You're registered!" confirmation shows.

### Edge cases

6. Before any payment info is configured (fresh setup), confirm a registered-unpaid player sees only the plain "You're registered!" message — no empty or broken payment section.
7. Configure only a phone number (no QR image); confirm only the phone number shows, no broken image placeholder.
8. With a player already registered for a session while no payment info is configured (step 6), have an admin configure the phone number and QR code afterward; reload the player's session detail screen with no other action taken and confirm the payment info now appears automatically (SC-004).

## Automated Verification

- `npm run test:unit` — covers the extracted `shouldShowPaymentInfo` visibility-gating helper across all documented edge-case combinations.
- `npm run test:e2e` — covers the full admin-configures → player-sees → admin-marks-paid → player-no-longer-sees flow.
- `npm run lint` — no new lint violations.
