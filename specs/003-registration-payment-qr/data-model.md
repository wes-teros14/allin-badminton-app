# Phase 1 Data Model: Show Payment Phone Number & QR Code to Registered Players

## New Entity: Payment Settings (`payment_settings` table)

A single, app-wide singleton row — no relationship to any individual session, matching FR-007 (one shared configuration).

| Field | Type | Notes |
|---|---|---|
| `id` | `INT`, primary key, `DEFAULT 1` | Constrained to always equal 1 (`CHECK (id = 1)`) — singleton pattern, mirrors `announcements` |
| `phone_number` | `TEXT`, nullable | The copyable payment contact number. Null until an admin configures it (FR-001, FR-005) |
| `qr_code_url` | `TEXT`, nullable | Public URL of the uploaded QR code image in the `payment-qr` Storage bucket. Null until configured |
| `updated_at` | `TIMESTAMPTZ`, `NOT NULL DEFAULT now()` | Set on every update |
| `updated_by` | `UUID`, references `auth.users(id) ON DELETE SET NULL` | Which admin last updated it — audit trail only, not surfaced to players |

**Validation rules**:
- Exactly one row ever exists (`id = 1` constraint) — reads always target this single row.
- Both `phone_number` and `qr_code_url` may independently be null; the UI must handle all four combinations (both set, only phone, only QR, neither) per the spec's edge cases.

**State transitions**: None — this is a plain mutable config row, not a stateful entity with a lifecycle.

## Existing Entity (read-only for this feature): Session Registration

No schema change. This feature reads the existing `paid` column (added in migration `042_add_paid_to_registrations.sql`) to decide whether to show the Payment Settings to a given player for a given session.

| Field | Type | Relevance to this feature |
|---|---|---|
| `paid` | `BOOLEAN`, nullable | `true`/`false` once an admin sets it; drives FR-002/FR-004 — payment info shows only while this is not `true` |

## Derived Visibility Rule (not persisted — computed at render time)

`shouldShowPaymentInfo` = `isRegistered AND paid !== true AND (phone_number is set OR qr_code_url is set)`

This is implemented as a pure function (see research.md Decision 4) rather than a stored field, since it's fully derivable from the two entities above at the moment the session detail screen renders.
