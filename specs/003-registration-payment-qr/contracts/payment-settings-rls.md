# Contract: `payment_settings` Table & `payment-qr` Storage Bucket Access

This app has no separate API layer — the frontend talks to Supabase directly, so the table/bucket RLS policies below ARE the interface contract between the admin surface (writer) and the player surface (reader).

## Table: `public.payment_settings`

| Operation | Role | Policy |
|---|---|---|
| `SELECT` | `authenticated` | Allowed for all authenticated users (any signed-in player or admin) — matches `announcements: read all authenticated` |
| `INSERT` / `UPDATE` | `authenticated` | Allowed only when `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')` |
| `DELETE` | — | Not exposed — the row is never deleted, only updated (singleton) |

**Consumers**:
- `usePaymentSettings.ts` (player + admin surfaces) — `SELECT * FROM payment_settings WHERE id = 1`
- `PaymentSettingsView.tsx` (admin surface only) — `UPDATE payment_settings SET phone_number = ..., qr_code_url = ..., updated_at = now(), updated_by = auth.uid() WHERE id = 1`

## Storage Bucket: `payment-qr`

| Operation | Role | Policy |
|---|---|---|
| `SELECT` (view/download) | public | Bucket is public — matches `avatars: public read` |
| `INSERT` / `UPDATE` | `authenticated` | Allowed only when `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')` — differs from `avatars`' per-user path check since this bucket has no per-user ownership concept |
| `DELETE` | `authenticated` | Same admin-only check, for replacing/removing the QR image |

**Consumers**:
- `PaymentSettingsView.tsx` — uploads to a fixed path (e.g. `qr-code.png`) with `upsert: true`, then writes the resulting public URL into `payment_settings.qr_code_url`
- Player-facing `<img>` tag in `SessionPlayerDetailView.tsx` — reads `qr_code_url` directly, no auth required to view (public bucket)
