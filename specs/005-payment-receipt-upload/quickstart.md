# Quickstart: Payment Receipt Upload & Admin Receipt Review

**Feature**: `005-payment-receipt-upload` | **Branch**: `005-payment-receipt-upload`

What a developer picking this up needs to know, in the order they need it.

---

## What we're building

Two halves of one loop.

**Player half** — inside the GCash banner that already exists on the session card, under the "Once sent, please send the screenshot to the GC" line:

```
You're registered! GCash payment details below:
┌────────────────────────────────┐
│ 09455166579              Copy  │
└────────────────────────────────┘
        [ QR code image ]
Once sent, please send the screenshot to the GC…

┌────────────────────────────────┐
│  📎  Add receipt + note        │   ← new
└────────────────────────────────┘
🟠 Receipt submitted — awaiting confirmation
[thumb] "partial 200, ref 8842"  · 2:14 PM
                        + Add another
```

**Admin half** — in the Payment Status panel on `/finance/:sessionId`:

```
Payment Status — 6 paid · 3 awaiting · 7 unpaid
┌──────────────────────────────────────────────┐
│ Wes            🟠 2 receipts ›  [Unpaid][Confirm] │
│ Mika           ⚪ no receipt    [Unpaid][Confirm] │
│ Jah            🟢               [Unpaid][Confirm] │
└──────────────────────────────────────────────┘
```

---

## The one decision that governs everything

**There is no `payment_status` column, and there must not be one.**

Orange is *derived*: `paid === false && activeReceiptCount > 0`. `session_registrations.paid` keeps its exact current meaning — confirmed by an admin — and stays the sole input to revenue.

This matters because `get_session_finance` (`074:53`) computes revenue as `COUNT(*) FILTER (WHERE sr.paid) × price`. Deriving the middle state means **that function is not edited at all**, revenue arithmetic cannot shift, and the SC-002 finance reconciliation E2E test passes unmodified. That untouched test is the evidence for FR-034.

Any stored status column becomes a second thing that can disagree with `paid`, and the disagreement shows up as wrong money. Don't re-litigate it; rationale and rejected alternatives are in `research.md` R1.

---

## The second thing that will bite you

**The `receipts` bucket is private.** It is the first private bucket in this codebase.

`avatars` (`069`) and `payment-qr` (`073`) are both `public = true`, so every upload example you'll find in this repo ends with `getPublicUrl()`. That call is wrong here — on a private bucket it hands back an address that resolves to nothing. Every read goes through `createSignedUrl(path, 60)` instead, minted at view time from the caller's own JWT.

No service-role key is involved and none may be committed.

---

## Files you'll touch

| Order | File | Change |
|:-:|------|--------|
| 1 | `supabase/migrations/075_create_session_receipts.sql` | **NEW** — table, indexes, RLS, 6 policies, grants |
| 2 | `supabase/migrations/076_create_receipts_bucket.sql` | **NEW** — private bucket + 4 storage policies |
| 3 | `supabase/migrations/077_session_receipts_realtime.sql` | **NEW** — publication entry, mirroring `072` |
| 4 | `src/types/database.ts` (~line 422, beside `session_registrations`) | Add `session_receipts` Row/Insert/Update + relationships |
| 5 | `src/lib/paymentState.ts` | **NEW** — `derivePaymentState`, the single source of the 3 states |
| 6 | `src/lib/imageResize.ts` | **NEW** — `resizeImageFile` moved out of `ProfileView.tsx:79`, unchanged |
| 7 | `src/lib/receipts.ts` | **NEW** — size/count limits + `buildReceiptPath` |
| 8 | `src/views/ProfileView.tsx` | Import the moved helper; delete the local copy |
| 9 | `src/hooks/useSessionReceipts.ts` | **NEW** — player's own receipts: list, upload, delete, sign |
| 10 | `src/components/ReceiptUploadDialog.tsx` | **NEW** — combined image picker + note field |
| 11 | `src/views/SessionPlayerDetailView.tsx` (~line 190) | Render upload action + thumbnails inside the existing banner |
| 12 | `src/hooks/useRoster.ts` | Add `activeReceiptCount`; second realtime listener; `confirmPaid`; **receipt cleanup in `removePlayer`** |
| 13 | `src/components/RosterPanel.tsx` (lines 51–93) | 3-state row, per-player receipt link, header tally |
| 14 | `src/components/ReceiptViewerDialog.tsx` | **NEW** — admin viewer: image + note + timestamp |
| 15 | `src/hooks/usePlayerSessions.ts` + `src/views/MySessionsView.tsx:117` | 3-state label (FR-020) |
| 16 | `src/views/AdminView.tsx:56` | Remove receipt objects **before** deleting a session |
| 17 | `src/__tests__/paymentState.test.ts` | **NEW** — 6-row truth table |
| 18 | `src/__tests__/receipts.test.ts` | **NEW** — `buildReceiptPath` segment order |
| 19 | `tests/payment-receipts.spec.ts` | **NEW** — browser assertion of the full loop |

Steps 1–3 must land in the database before anything else runs. 5, 6 and 7 are pure and have no dependencies — good places to start if you're doing TDD.

---

## Step 1 — Migrations, and how to actually apply them

Write all three files, then be aware of the operational reality recorded in `tasks/lessons.md`:

> **`supabase db push` does not work in this environment.** The Windows CLI binary hits "Access is denied", and the dev project's `supabase_migrations.schema_migrations` table has malformed duplicate rows for versions 037–044 that block a push and cannot be cleared with `migration repair`.

**Apply via Supabase Dashboard → SQL Editor → New query → paste → Run.** That is the established workaround in this repo, not a shortcut.

There are **two projects**, and both need all three migrations:

| | Project ref |
|---|---|
| dev | `tsvetqzkullivprbjtli` |
| prod | `ensdfitpeyreunihkqkh` |

Shipping to dev only is how `071` ended up half-applied. Don't repeat it.

**Copy the policy idioms rather than inventing them**:
- Per-user path ownership → `069_add_profile_avatars.sql`, `(storage.foldername(name))[1] = auth.uid()::text`
- Admin-role check → `073_create_payment_settings.sql`, `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')`
- Guarded publication add → `072_session_registrations_realtime.sql`, the `DO $$ ... IF NOT EXISTS` block verbatim

⚠️ Bucket insert must be `public = false`. That single boolean is the whole privacy model.

⚠️ Don't forget `GRANT SELECT, INSERT, DELETE ON public.session_receipts TO authenticated` — RLS policies alone don't grant table privileges. `073` shows the pairing.

---

## Step 2 — The pure helpers (start here if writing tests first)

`src/lib/paymentState.ts` is 6 lines and has one job. Its truth table is in `contracts/payment-state-derivation.md`; the test writes itself.

`src/lib/imageResize.ts` is a **pure move** of `resizeImageFile` from `ProfileView.tsx:79`. Do not improve it while moving it — move it, confirm the avatar flow still works, then use it. Receipt limits differ from avatar limits (1600 px / 800 KB vs 1024 px / 1 MB) because a receipt has to stay legible enough to read an amount and a reference number; pass them as arguments, since the function already takes them.

---

## Step 3 — Ordering rule, and the three places it applies

**Storage object first, row second. Both directions.**

```
Upload:  resize → storage.upload → INSERT row
Delete:  storage.remove → DELETE row
```

A failed upload leaves no row, so nothing is visible and the player retries. A failed remove aborts with the row intact, so the receipt is still listed and still deletable.

Reverse either one and you strand an image nobody can reach or delete — the exact failure FR-030 and SC-006 exist to catch. The row holds `storage_path`, which is the *only* record of where the file lives; delete it first and the image is unreachable forever.

**There are three deletion paths, not one.** Two are cascades, which is what makes them easy to miss:

| # | Where | What fires |
|:-:|---|---|
| 1 | `useSessionReceipts.deleteReceipt` | Player removes their own receipt — the obvious one |
| 2 | `useRoster.removePlayer` (`useRoster.ts:122`) | Admin clicks ✕ on a player → `registration_id` cascade silently drops the rows |
| 3 | `AdminView.tsx:56` | Admin deletes a session → `session_id` cascade silently drops the rows |

Sites 2 and 3 get the same treatment: query the relevant `storage_path` values, `remove()` them, *then* delete and let the cascade take the rows.

**Site 2 is the one that bites.** The admin is removing a *player* — nobody in that flow is thinking about receipts. No error, no failing test, and the UI looks entirely correct. It was missed on the first planning pass and caught only by `/speckit-analyze`.

---

## Step 4 — Realtime

`useRoster` already opens `roster:{sessionId}` and re-fetches on `session_registrations` changes. Add a **second** `.on('postgres_changes', ...)` for `session_receipts` on that same channel — don't open a new one.

Migration `072`'s header documents the failure mode if you skip the publication entry: the subscription is silently inert and the bug presents as "only updates after a full page refresh."

---

## Step 5 — Don't rely on the route guard for admin-only

`AdminRoute` (`src/App.tsx:28`) admits **both** `admin` and `moderator`. The comment in `067_add_moderator_role.sql` says moderators can't access finance, but that's intent, not enforcement.

The requester settled on receipts being admin-only, so RLS does the work: a moderator's `SELECT` returns zero rows and their `createSignedUrl` is refused. Add a `role === 'admin'` check in the panel too, so a moderator sees a clean absence rather than an empty broken-looking panel.

**Do not "fix" `AdminRoute` as part of this feature.** It governs Finance, Players and Inventory alike; changing it here would alter moderator behaviour far beyond this scope. It's flagged in `plan.md` as a separate follow-up.

---

## Verification

```bash
cd badminton-v2
npm run lint
npm run test:unit
npm run test:e2e -- tests/payment-receipts.spec.ts
npm run test:e2e -- tests/finance-totals.spec.ts   # MUST pass unmodified
```

That last one is the point. `finance-totals.spec.ts` is not to be edited for this feature — if it needs editing, the derivation rule in Step 1 was broken somewhere.

**Manual pass** (localhost has a dev-only login button, bottom right):

1. Sign in as a player, register for a session that has payment settings configured
2. Attach a receipt with a note → banner turns orange, thumbnail appears
3. Reload → still orange, receipt still there
4. Sign in as admin → `/finance/:sessionId` → row shows "1 receipt ›", opens to image + note + timestamp
5. Press Confirm → green both sides; player's banner disappears entirely
6. Set back to Unpaid → returns to orange, receipt intact
7. Copy a signed URL, wait 60 s, open it → must fail
8. Delete the receipt as the player → old signed URL must 404 even before expiry
9. Upload a fresh receipt, then **remove that player from the roster** as admin → their image must be gone from the bucket, not just the row
10. Upload another, then **delete the whole session** → same check

Steps 7–10 are SC-005 and SC-006, and none of them is caught by a passing test suite. Step 9 in particular has no automated coverage at all — the rows disappear cleanly via cascade and everything *looks* right, so the only way to catch a regression is to look in the bucket.
