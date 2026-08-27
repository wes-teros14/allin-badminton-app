# Contract: `session_receipts` Table & `receipts` Storage Bucket Access

This app has no separate API layer — the frontend talks to Supabase directly, so the table/bucket RLS policies below ARE the interface contract between the player surface (writer) and the admin surface (reviewer).

Unlike `payment-qr` (`003`) and `avatars` (`069`), the `receipts` bucket is **private**. `getPublicUrl()` must not appear anywhere in this feature; every read goes through a short-lived signed URL.

## Table: `public.session_receipts`

| Operation | Role | Policy |
|---|---|---|
| `SELECT` | `authenticated` (player) | Own rows only: `player_id = auth.uid()` |
| `SELECT` | `authenticated` (admin) | All rows: `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')` |
| `INSERT` | `authenticated` (player) | `player_id = auth.uid()` **AND** the parent registration is not yet confirmed: `EXISTS (SELECT 1 FROM public.session_registrations sr WHERE sr.id = registration_id AND sr.player_id = auth.uid() AND sr.paid = false)` |
| `DELETE` | `authenticated` (player) | Own rows, still unconfirmed — same parent-`paid` check as `INSERT` |
| `DELETE` | admin | **No policy.** Deliberate — see below |
| `UPDATE` | `authenticated` (admin) | Admin-role check. Used **only** to set `dismissed_at` / `dismissed_by`. Players have no `UPDATE` policy at all — receipt content is immutable once submitted |

**There is deliberately no admin `DELETE` policy on this table.** FR-027 gives administrators *dismissal* precisely so evidence is retained, and FR-032 requires confirmed receipts to survive as the session's audit trail. Row removal happens only by cascade, when the parent registration or session is deleted. Granting a destructive capability no requirement asks for would also sit against the constitution's Safe Stateful Changes principle.

Note this is a table-only restriction. The **bucket** does grant admin `DELETE` — see below — because an administrator removing a player or a session must be able to remove that player's image files.

**Moderators match no policy on this table.** They see zero rows and cannot mint a signed URL, which is how FR-021 is actually enforced — `AdminRoute` (`src/App.tsx:28`) admits moderators to `/finance`, so the screen-level guard cannot be relied upon.

**The parent-`paid` subquery is load-bearing, not decorative.** It is evaluated at write time, so it is the only thing that closes the race where a player holds the upload form open while an administrator confirms their payment. A UI-only check cannot close it.

**Consumers**:
- `useSessionReceipts.ts` (player surface) — `SELECT * FROM session_receipts WHERE session_id = ? AND player_id = auth.uid() ORDER BY uploaded_at DESC`; `INSERT` after the storage object is written; `DELETE` before the storage object is removed
- `useRoster.ts` (admin surface) — `SELECT player_id, id, dismissed_at FROM session_receipts WHERE session_id = ?`, grouped by `player_id` into `activeReceiptCount`
- `usePlayerSessions.ts` (player sessions list) — active receipt counts across the listed sessions, so the three-state label is consistent there (FR-020)
- `useRoster.ts` (`removePlayer`) — `SELECT storage_path FROM session_receipts WHERE registration_id = ?` before removing a player from the roster, to remove the objects first (FR-030)
- `AdminView.tsx` — `SELECT storage_path FROM session_receipts WHERE session_id = ?` before deleting a session, to remove the objects first (FR-031)

## Storage Bucket: `receipts`

Created with `public = false`. This is the first private bucket in the codebase.

| Operation | Role | Policy |
|---|---|---|
| `SELECT` (sign/download) | `authenticated` | Own path (`(storage.foldername(name))[1] = auth.uid()::text`) **OR** admin-role check |
| `INSERT` | `authenticated` | Own path only — an admin cannot upload on a player's behalf (declared out of scope) |
| `DELETE` | `authenticated` | Own path **OR** admin-role check. The admin arm is **required**, not incidental: two of the three cleanup call sites have an administrator removing another player's image files |
| `UPDATE` | — | Not exposed. Objects are immutable; a correction is a new receipt plus a delete, never an overwrite |

Path layout is `{player_id}/{session_id}/{receipt_id}.jpg`, with `player_id` first so the ownership predicate matches `avatars: users upload own` from `069` exactly.

**Consumers**:
- `useSessionReceipts.ts` — `upload(path, blob, { contentType: 'image/jpeg' })` with **no** `upsert`, so an interrupted retry can never overwrite an existing receipt
- `useSignedReceiptUrl` (both surfaces) — `createSignedUrl(path, 60)`, minted at view time using the caller's own JWT. No service-role key is involved, and none may be committed
- `AdminView.tsx` and `useSessionReceipts.ts` — `remove([...paths])` **before** the corresponding rows are deleted

## Ordering guarantee

Storage objects are always written before their row and deleted before their row, at **all three** places a receipt can disappear:

1. `useSessionReceipts.deleteReceipt` — player removes their own
2. `useRoster.removePlayer` — administrator removes a player from the roster (`registration_id` cascade)
3. `AdminView` session delete — administrator deletes a session (`session_id` cascade)

A failed storage write leaves no row, so nothing is visible and the player simply retries. A failed storage delete aborts with the row intact, so the receipt is still listed and still deletable. The reverse order would drop the only record of `storage_path` and strand the image permanently — the exact failure FR-030 and SC-006 exist to prevent.

Sites 2 and 3 are the dangerous ones, because in both the cascade fires as a *side effect* of deleting something else. Nobody in those flows is thinking about receipts, and the failure is completely silent.

## Realtime

`session_receipts` is added to the `supabase_realtime` publication with `REPLICA IDENTITY FULL`, following `072_session_registrations_realtime.sql`. Realtime applies RLS, so administrators receive every change and players receive only their own. `useRoster` adds a second `postgres_changes` listener on its existing `roster:{sessionId}` channel rather than opening a new one.
