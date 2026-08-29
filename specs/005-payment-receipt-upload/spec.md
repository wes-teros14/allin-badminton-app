# Feature Specification: Payment Receipt Upload & Admin Receipt Review

**Feature Branch**: `005-payment-receipt-upload`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "i want users to have ability to upload receipt image on session card below You're registered! GCash payment details below: ... in the admin view i need to be able to have the link shown per user so i can view receipts." Plus follow-up: "add also a button to add notes + receipt."

## Overview

Today a player who registers for a session sees GCash payment details on their session card and is told to send the payment screenshot to the group chat or PM the organiser. That hand-off is manual, easy to lose, and gives the organiser no per-player record. The organiser then flips a Paid/Unpaid switch from memory.

This feature lets a player attach the payment screenshot — with an optional note — directly to their session registration, and gives the organiser a per-player link to review those receipts before confirming payment.

## Impacted Surfaces

Per Constitution Principle III (Cross-Surface Consistency), the surfaces this feature touches:

| Surface | Change |
|---------|--------|
| Player session card (payment banner) | New "Add receipt + note" action, submitted-receipt thumbnails, awaiting-confirmation state |
| Player sessions list | Payment label must render the new middle state, not just Paid/Unpaid |
| Admin payment panel (Finance detail) | Per-player receipt link, receipt viewer with notes and timestamps, explicit Confirm action, three-state indicator |
| Session finance totals | MUST remain unchanged in value — see FR-034 |
| Stored data | New receipt records and a new private image store |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Player attaches a payment receipt with a note (Priority: P1)

A player registers for a session and sees the GCash payment details on their session card. After sending payment in their banking app, instead of hunting for the group chat, they tap "Add receipt + note" directly under the payment instructions, pick the screenshot from their phone (or take a photo of it), optionally type a short note such as "partial 200, ref 8842", and submit. The card immediately confirms the receipt was received and is awaiting confirmation.

**Why this priority**: This is the core of the request and the only part that removes manual work for the player. Without it nothing else has any input. Shipped alone it already replaces the "send it to the GC" instruction with a durable record.

**Independent Test**: Register a test player for a session with payment details configured, open their session card, attach an image with a note, and confirm the card shows the receipt and the awaiting-confirmation state after reload.

**Acceptance Scenarios**:

1. **Given** a player is registered for a session, payment details are configured, and their payment is not yet confirmed, **When** they view their session card, **Then** an "Add receipt + note" action is visible directly below the existing payment instruction text.
2. **Given** the player taps that action, **When** the picker opens, **Then** they can choose an existing image or capture a new photo, and enter an optional note in the same step before submitting.
3. **Given** the player submits an image with a note, **When** the upload completes, **Then** the card shows a confirmation that the receipt was received, the payment state changes to awaiting confirmation, and the receipt thumbnail and its note are visible on the card.
4. **Given** the player submits without typing a note, **When** the upload completes, **Then** the receipt is accepted and stored with no note.
5. **Given** the player selects a file that is not an image, or an image above the size limit, **When** they submit, **Then** they see a clear, specific error and nothing is stored.
6. **Given** the upload fails (connection lost mid-upload), **When** the failure occurs, **Then** the player sees a retry-able error, no partial record is left behind, and their payment state is unchanged.

---

### User Story 2 - Admin reviews receipts per player and confirms payment (Priority: P1)

The organiser opens the session's payment panel and sees, for each registered player, their current payment state and — for anyone who submitted proof — a link to view their receipts. Opening the link shows each receipt image alongside the note the player wrote and when it was submitted. After checking the amount against the GCash app, the organiser presses Confirm on that player, turning them green.

**Why this priority**: This is the second half of the user's explicit request ("in the admin view i need to be able to have the link shown per user so i can view receipts"). Together with US1 it forms the complete loop; either alone is only half a feature.

**Independent Test**: With a player who has submitted a receipt, open the admin payment panel, verify the per-player link appears, open it, verify the image, note and timestamp render, press Confirm, and verify the player becomes confirmed-paid and stays that way after reload.

**Acceptance Scenarios**:

1. **Given** a player has submitted at least one receipt, **When** the admin views the payment panel, **Then** that player's row shows a link/affordance to view their receipts, labelled with how many were submitted.
2. **Given** a player has submitted no receipts, **When** the admin views the payment panel, **Then** that row shows a muted "no receipt" indicator and no link.
3. **Given** the admin opens a player's receipts, **When** the viewer renders, **Then** each receipt shows the image, its note (or an explicit "no note"), and its submission date and time, ordered newest first.
4. **Given** the admin has reviewed a receipt, **When** they press Confirm on that player, **Then** the player's state becomes confirmed-paid, and the change is reflected on the player's own session card.
5. **Given** a player paid in cash at the court and submitted nothing, **When** the admin presses Confirm on that row, **Then** the player becomes confirmed-paid without any receipt being required.
6. **Given** a player was confirmed by mistake, **When** the admin sets that row back to unpaid, **Then** the player returns to the unconfirmed state and any submitted receipts remain intact and still viewable.
7. **Given** the payment panel is open, **When** a player submits a receipt from their phone at that moment, **Then** the panel reflects the new state without the admin manually reloading the page.

---

### User Story 3 - Player manages their own submitted receipts (Priority: P2)

A player realises the screenshot they sent was blurry, or they paid the balance in a second transfer. They return to their session card, see what they already submitted, and either add another receipt or remove and replace the bad one — but only while the organiser has not yet confirmed them.

**Why this priority**: Materially improves the quality of what the organiser has to review, and covers partial payments, which are a real pattern in this group. The core loop works without it, so it ships second.

**Independent Test**: As a player with an existing unconfirmed receipt, add a second receipt, verify both appear with their own notes, delete one, verify only the other remains and the payment state is still awaiting confirmation.

**Acceptance Scenarios**:

1. **Given** a player has one unconfirmed receipt, **When** they view their session card, **Then** they can add another receipt with its own separate note.
2. **Given** a player has submitted receipts and is not yet confirmed, **When** they remove one, **Then** it disappears from their card and from the admin's view.
3. **Given** a player removes their only receipt, **When** the removal completes, **Then** their payment state returns to unpaid and the full payment instructions reappear.
4. **Given** a player has been confirmed as paid, **When** they view their session card, **Then** the payment banner is gone entirely and they can no longer add or remove receipts for that session.
5. **Given** a player has reached the maximum number of receipts for a session, **When** they try to add another, **Then** they are told the limit is reached and are directed to remove one first.

---

### User Story 4 - Admin dismisses an unusable receipt (Priority: P3)

A player uploads a screenshot that is unreadable, or is clearly for a different session. Rather than leaving them stuck in the awaiting-confirmation state indefinitely, the organiser dismisses that receipt, which returns the player to unpaid so the payment instructions reappear and they know to send it again.

**Why this priority**: Prevents a stuck state, but has a manual workaround (message the player, who deletes and re-uploads). Safe to defer.

**Independent Test**: Dismiss a player's only receipt and verify they return to the unpaid state, the instructions reappear on their card, and the dismissed receipt is still visible to the admin.

**Acceptance Scenarios**:

1. **Given** a player has an unusable receipt, **When** the admin dismisses it, **Then** that receipt no longer counts toward the awaiting-confirmation state.
2. **Given** a player's only receipt is dismissed, **When** they view their session card, **Then** they are back in the unpaid state with the payment instructions and upload action visible.
3. **Given** a receipt has been dismissed, **When** the admin views that player's receipts, **Then** the dismissed receipt is still listed and visibly marked as dismissed, for audit purposes.

---

### Edge Cases

- **Player registered, no payment details configured**: the payment banner does not appear today when no phone number or QR is configured; the upload action follows the same rule and does not appear either.
- **Session price is zero or unset**: payment state behaves exactly as it does today; receipts remain possible but are not required.
- **Player removed from the roster after uploading**: their receipt records are removed with the registration, and the stored images MUST be removed too. This is the least obvious of the deletion paths — an administrator removing a *player* triggers it as a side effect — and the one where leaving images behind would be silent and unrecoverable.
- **Session deleted**: all receipts attached to that session are removed along with it.
- **Same image uploaded twice**: both are stored as separate submissions; the system does not attempt de-duplication.
- **Player uploads after registration closes or after the session has started**: allowed — a player can still owe payment after the session begins, matching the existing banner behaviour.
- **Player uploads, admin confirms, player somehow still has the upload form open**: the submission is rejected with a message explaining payment is already confirmed.
- **Very large or rotated phone photos**: images are reduced before submission so a normal phone screenshot always fits within the size limit; orientation is preserved so the receipt is not shown sideways.
- **Slow connection on court WiFi**: the player sees clear in-progress feedback and is never left unsure whether the receipt was submitted.
- **A non-admin reaches the finance screen**: the receipt panel must not disclose receipts to them — see FR-021.

## Requirements *(mandatory)*

### Functional Requirements

#### Player submission

- **FR-001**: The player-facing payment banner MUST present a single combined action, labelled to indicate it accepts both an image and a note, positioned directly below the existing payment instruction text on the session card.
- **FR-002**: The action MUST let the player choose an existing image from their device or capture a new one with the camera.
- **FR-003**: The player MUST be able to enter an optional free-text note in the same interaction, before submitting. Submitting without a note MUST be permitted.
- **FR-004**: A note MUST be limited to a short length appropriate for a reference number or a one-line explanation, and the limit MUST be visible to the player as they type.
- **FR-005**: The system MUST accept only image files, and MUST reject anything else with a specific, actionable error.
- **FR-006**: Submitted images MUST be reduced in size before storage so that ordinary phone screenshots succeed on a slow mobile connection, while remaining legible enough to read a transaction amount and reference number.
- **FR-007**: The system MUST prevent, through the interface, a player exceeding a maximum stored size per receipt or a maximum number of receipts per player per session, and MUST tell the player clearly when a limit is reached. These are usability ceilings rather than security boundaries — the worst case they guard against is a player storing a few extra of their own images — so they are not additionally enforced at the data layer.
- **FR-008**: A player MUST be able to submit more than one receipt for the same session, each carrying its own independent note.
- **FR-009**: While a submission is in progress the player MUST see unambiguous progress feedback, and MUST see either an explicit success or an explicit, retry-able failure.
- **FR-010**: A failed submission MUST leave no partial record and MUST NOT change the player's payment state.

#### Player review of their own receipts

- **FR-011**: While payment is unconfirmed, the player's session card MUST show the receipts they have submitted, each with its note and submission time, alongside the payment details, which remain visible.
- **FR-012**: The card MUST clearly communicate the awaiting-confirmation state, so the player understands the organiser has not yet verified the payment.
- **FR-013**: The card MUST offer an "add another" affordance whenever the player is below the per-session receipt limit.
- **FR-014**: A player MUST be able to remove their own receipt while payment is unconfirmed, and MUST NOT be able to remove it once payment is confirmed.
- **FR-015**: A player MUST NOT be able to see, remove, or otherwise access any other player's receipts.

#### Payment states

- **FR-016**: Payment MUST be presented in three distinct, visually differentiated states: **Unpaid** (red), **Awaiting confirmation** (orange), and **Paid** (green).
- **FR-017**: A player MUST move to **Awaiting confirmation** automatically as soon as they have at least one active, non-dismissed receipt and payment has not been confirmed.
- **FR-018**: A player MUST move to **Paid** only by an explicit, deliberate confirming action taken by an administrator. No player action may set this state.
- **FR-019**: A player MUST return to **Unpaid** when they have no active receipts and payment is not confirmed.
- **FR-020**: Every surface that displays a player's payment state MUST render all three states consistently. No surface may continue to present payment as a two-state value.

#### Administrator review

- **FR-021**: Receipts MUST be visible only to administrators. Access MUST be enforced at the data layer, and MUST NOT depend solely on which screens a role can navigate to, because the existing screen-level guard admits a wider set of roles than are permitted to see receipts.
- **FR-022**: In the payment panel, each player row that has at least one receipt MUST show a link to view that player's receipts, indicating how many were submitted. Rows with none MUST show a muted no-receipt indicator instead.
- **FR-023**: Opening a player's receipts MUST show, for each one: the image at a size sufficient to read a transaction amount, the note the player wrote (or an explicit indication that there was none), and the submission date and time. Receipts MUST be ordered newest first.
- **FR-024**: An administrator MUST be able to set any player to **Paid** or **Unpaid** directly, with or without a receipt present, so that cash payments taken at the court can still be recorded.
- **FR-025**: The payment panel header MUST summarise all three states, replacing the current two-state summary.
- **FR-026**: When a player submits a receipt while an administrator has the payment panel open, that panel MUST reflect the change without a manual page reload.
- **FR-027**: An administrator SHOULD be able to dismiss an individual receipt as unusable, which removes it from the awaiting-confirmation calculation while keeping it visible and marked as dismissed for audit. *(User Story 4, P3)*

#### Privacy and retention

- **FR-028**: Receipt images MUST NOT be readable by anyone holding only the image's address. Access MUST require an authenticated, authorised request, and any address issued for viewing MUST expire.
- **FR-029**: A player MUST be able to read back only their own receipt images; an administrator MUST be able to read all of them.
- **FR-030**: Removing a receipt record MUST also remove the stored image, so that deleted receipts cannot be recovered by address.
- **FR-031**: Deleting a session MUST remove all receipts attached to it, images included.
- **FR-032**: Confirmed receipts MUST be retained as the audit trail for the session and MUST NOT be automatically purged on confirmation.

#### Data integrity

- **FR-033**: Existing sessions and registrations that predate this feature MUST continue to display and behave correctly, showing **Unpaid** or **Paid** as they do today, with no receipts attached.
- **FR-034**: Session finance figures MUST NOT change in value as a result of this feature for any existing session.

### Key Entities

- **Session Receipt**: One payment proof submitted by one player for one session. Holds the stored image reference, an optional short note, who submitted it and when, and whether an administrator has dismissed it. Multiple receipts may exist for the same player and session. Belongs to exactly one session registration and is removed with it.
- **Session Registration** *(existing)*: Continues to carry the authoritative confirmed-payment flag, which remains the sole input to revenue. Gains a relationship to zero or more Session Receipts.
- **Payment State** *(derived, not stored)*: The three-state value shown in the UI, computed from the registration's confirmed-payment flag together with the presence of at least one active receipt. It is derived rather than stored so that no new value can drift out of sync with the confirmed-payment flag that finance depends on.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A registered player can attach a payment screenshot with a note and see it confirmed as received in under 30 seconds on a phone over a mobile connection, without leaving their session card.
- **SC-002**: For every player who submitted proof, the organiser can go from opening the payment panel to seeing that player's receipt image and note in no more than two taps.
- **SC-003**: 100% of players who have submitted at least one active receipt are visually distinguishable at a glance from both those who have paid nothing and those who are confirmed paid.
- **SC-004**: Session finance totals for every pre-existing session are identical before and after this feature ships; the existing finance reconciliation check continues to pass unchanged.
- **SC-005**: A receipt image cannot be opened by an unauthenticated request, by a different player, or by a previously-issued address after it has expired — verified for all three cases.
- **SC-006**: Removing a receipt leaves no retrievable image behind, verified by attempting to fetch the previously valid address after deletion.
- **SC-007**: A player's payment state as seen on their own session card always matches the state the organiser sees in the payment panel, verified across all three states.
- **SC-008**: The organiser no longer needs to consult the group chat to verify any payment that was submitted through the app.

## Assumptions

These are reasonable defaults chosen where the request did not specify. Each is a deliberate decision, not an oversight.

- **Confirmed payment is the only thing that counts as revenue.** The orange awaiting-confirmation state represents a claim, not collected money. It is deliberately excluded from all finance figures. This is why Payment State is derived rather than stored: the existing confirmed-payment flag stays the single input to revenue, so finance behaviour and the existing reconciliation check are untouched by design rather than by careful patching.
- **Receipt visibility is administrator-only.** Moderators do not review receipts, consistent with moderators being scoped to live-match management. Because the current screen-level guard is broader than that, FR-021 requires the restriction to be enforced at the data layer instead of relying on navigation.
- **The existing rule for when payment details appear is unchanged.** The upload action appears exactly when the payment banner appears today: the player is registered, payment is unconfirmed, and payment details have been configured. It is not gated on session status, because a player can still owe money after a session starts.
- **Receipts are per session, not per player globally.** A receipt is meaningless outside the session it paid for.
- **Reasonable ceilings**: a small fixed maximum number of receipts per player per session, and a per-image size ceiling comfortably above a compressed phone screenshot. Exact numbers are an implementation choice, subject to FR-006 keeping the amount and reference number legible.
- **No notification is sent** to the organiser when a receipt arrives. The payment panel updating live (FR-026) is the notification mechanism for this release.
- **No amount field.** The player writes any partial-payment detail in the free-text note. Introducing a structured amount would create a second source of truth against the session price and invite reconciliation bugs; the note keeps the feature descriptive rather than authoritative.
- **No optical reading of the receipt.** Verification remains a human judgement by the organiser.
- **Storage growth is acceptable.** At roughly 16 players per session with compressed images, receipt storage is negligible against normal limits; no archival policy is needed for this release.

## Out of Scope

- Automatic verification or optical extraction of amounts from receipt images.
- Integration with GCash or any payment provider API.
- Notifying the organiser (push, email, or chat) when a receipt is submitted.
- Structured partial-payment tracking or per-player running balances.
- Receipts for anything other than session registration payment.
- Moderator access to receipts.
- Administrators uploading a receipt on a player's behalf.

## Dependencies

- The existing payment settings (phone number and QR code) must be configured for the payment banner, and therefore the upload action, to appear.
- The existing per-registration confirmed-payment flag remains the authority for revenue and must not be repurposed.
- The existing live-update mechanism on session registrations is relied upon for FR-026.
