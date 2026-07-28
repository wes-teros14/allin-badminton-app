# Feature Specification: Show Payment Phone Number & QR Code to Registered Players

**Feature Branch**: `003-registration-payment-qr`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "new feature, currently, when player register and is registered. when clicking the session card it just says' you're registered'. i want to have a copyable cellphone number there and my QR code that i will upload in supabase so they can transfer payment via QR."

## Clarifications

### Session 2026-07-28

- Q: How should the payment phone number + QR code image actually get into the app? → A: Build a simple admin settings screen (phone number field + QR image upload) so the admin can update it anytime without touching Supabase directly.
- Q: Should the payment info stay visible only until marked Paid, or always? → A: Hide once the player's registration is marked Paid; show the existing plain confirmation instead.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registered player sees how to pay (Priority: P1)

A player has registered for a session and taps their session card to check details. Today they only see a plain "You're registered!" message with no way to know how to pay. They want to see the organizer's payment phone number (which they can copy with one tap) and a QR code they can scan in their banking or e-wallet app, right there on the same screen.

**Why this priority**: This is the entire point of the request — it turns a dead-end confirmation message into an actionable next step, and is expected to reduce the back-and-forth of players asking the organizer "paano magbayad?" (how do I pay?) individually.

**Independent Test**: Register a test player for a session while payment info is configured and the registration is unpaid. Open the session detail screen for that session and confirm the phone number and QR code both appear, and the phone number can be copied.

**Acceptance Scenarios**:

1. **Given** a player is registered for a session and their registration is unpaid, and the admin has configured a payment phone number and QR code, **When** the player opens that session's detail screen, **Then** the payment phone number and QR code image replace the existing plain "You're registered!" message (showing both would be redundant — the payment block itself confirms they're registered).
2. **Given** the payment phone number is displayed, **When** the player taps/clicks a copy action next to it, **Then** the number is copied to their clipboard and they get a clear confirmation that it was copied.
3. **Given** a player's registration for a session has been marked Paid by an admin, **When** the player opens that session's detail screen, **Then** they see the existing plain "You're registered!" confirmation only, with no payment phone number or QR code.

---

### User Story 2 - Admin configures the payment info (Priority: P1)

An admin wants to set (and later update) the phone number and QR code image that players see when they need to pay, without needing to go into Supabase directly.

**Why this priority**: Without this, there is no way to get the payment info into the app at all — this is a prerequisite for User Story 1, not a nice-to-have.

**Independent Test**: As an admin, open the payment settings screen, enter a phone number and upload a QR code image, save, and confirm a registered-but-unpaid player now sees that exact phone number and image on their session detail screen.

**Acceptance Scenarios**:

1. **Given** no payment info has been configured yet, **When** an admin opens the payment settings screen and enters a phone number and uploads a QR code image, **Then** the info is saved and becomes visible to registered, unpaid players across all sessions.
2. **Given** payment info is already configured, **When** an admin uploads a new QR code image or changes the phone number and saves, **Then** players immediately see the updated info the next time they open a session detail screen.
3. **Given** a non-admin (regular player) account, **When** they attempt to reach the payment settings screen, **Then** access is denied, consistent with how other admin-only areas of the app are protected.

---

### Edge Cases

- What happens if only a phone number has been configured but no QR code (or vice versa)? Show whichever piece is configured; do not show a broken image or an empty placeholder for the missing piece.
- What happens if a player is registered but payment info hasn't been configured by the admin yet? They continue to see the existing plain "You're registered!" confirmation — no empty or broken payment section is shown.
- What happens if the QR code image fails to load (e.g., broken file)? The screen degrades gracefully — the phone number (if configured) still displays, and no broken-image icon is shown.
- What happens for a player registered across multiple sessions? The same phone number and QR code are shown for every session they're registered in and haven't yet paid for — it is one shared, global payment configuration, not per-session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an admin to configure a single payment phone number and a single QR code image, and to update (replace) either one at any time.
- **FR-002**: When a signed-in player is registered for a session and that registration is unpaid, opening that session's detail screen MUST display the configured payment phone number and QR code image in place of the plain registration confirmation (not alongside it).
- **FR-003**: The displayed payment phone number MUST be copyable to the clipboard in a single action, with a visible confirmation that the copy succeeded.
- **FR-004**: Once an admin marks a player's registration for a session as Paid, that player MUST no longer see the payment phone number or QR code for that session — they see the existing plain "You're registered!" confirmation instead.
- **FR-005**: If no payment phone number or QR code has been configured yet, the system MUST show the existing plain "You're registered!" confirmation with no empty or broken payment section.
- **FR-006**: Only an admin MUST be able to add, replace, or update the payment phone number and QR code image; regular players MUST NOT have access to this configuration.
- **FR-007**: The payment phone number and QR code MUST be a single, shared configuration used identically across all sessions and all players — not configured per-session or per-admin-user.

### Key Entities

- **Payment Settings**: A single, app-wide configuration consisting of a phone number and a QR code image, maintained by an admin. Not tied to any individual session.
- **Session Registration**: Existing entity representing a player's registration for a specific session, including its paid/unpaid status — this status determines whether the Payment Settings are shown to that player for that session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A registered, unpaid player can view the payment phone number and QR code and copy the number without leaving the session detail screen.
- **SC-002**: An admin can set up or update the payment phone number and/or QR code in under a minute, entirely within the app.
- **SC-003**: Once a player's registration is marked Paid, they no longer see any payment-collection prompt for that session on subsequent visits.
- **SC-004**: Players registered before payment info was configured see it appear automatically once the admin configures it, with no additional action needed from the player.

## Assumptions

- This feature applies to the session detail screen reached by tapping a session card from a player's own Sessions list (where the "You're registered!" confirmation currently appears). The separate one-time confirmation screen shown immediately after registering via a shared registration link is out of scope for this feature, since the request specifically describes the screen reached "when clicking the session card."
- "Paid" status is the existing paid/unpaid tracking already used elsewhere in the app for session registrations — this feature reads that existing status rather than introducing a new one.
- One phone number and one QR code image cover the payment methods needed (e.g., a single e-wallet or bank transfer channel) — supporting multiple simultaneous payment methods/QR codes is out of scope unless a future need arises.
- The QR code image is treated as an ordinary image upload (similar to existing profile picture uploads) — no special QR-content validation is performed by the system; the admin is responsible for uploading a correct, scannable image.
