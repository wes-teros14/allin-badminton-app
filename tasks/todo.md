# Tasks

## Active — `005-payment-receipt-upload` (awaiting database migration)

Code is complete and validated as far as it can be without the schema. **Nothing
in this feature works until migrations 075–077 are applied.**

- [ ] Apply `075_create_session_receipts.sql`, `076_create_receipts_bucket.sql`,
      `077_session_receipts_realtime.sql` to **dev** (`tsvetqzkullivprbjtli`)
      via Supabase Dashboard → SQL Editor. `supabase db push` does not work in
      this environment (see lessons.md lines 29, 39, 181).
- [ ] Then run `npm run test:e2e -- tests/payment-receipts.spec.ts`
- [ ] Then the manual checks below (T012, T023, T033, T039, T044, T049, T054, T055)
- [ ] Apply the same three migrations to **prod** (`ensdfitpeyreunihkqkh`).
      Migration `071` was previously left dev-only — do not repeat that.

Full task list: `specs/005-payment-receipt-upload/tasks.md` (45/58 complete).

---

## Review — Payment Receipt Upload & Admin Receipt Review

### What was built

A player attaches their GCash screenshot with an optional note directly from the
payment banner on their session card; the organiser gets a per-player link in the
Finance payment panel to review those receipts before confirming payment.

Payment now shows three states — **Unpaid** (red), **Awaiting confirmation**
(orange), **Paid** (green) — consistently on the session card, the sessions list
and the admin panel.

### The decision everything else follows from

**The orange state is derived, never stored.** `session_registrations.paid` keeps
its exact original meaning (confirmed by an admin) and stays the sole input to
revenue; orange is computed as `paid === false && activeReceiptCount > 0`.

So `get_session_finance` was **not touched at all**, revenue arithmetic cannot
shift, and `tests/finance-totals.spec.ts` passes **unmodified**. A stored
`payment_status` column would have been a second value able to disagree with
`paid`, and that disagreement would surface as wrong money.

It also made FR-033 free: registrations predating this feature have zero
receipts, so they derive to exactly the state they already showed. No backfill.

### Files

**New (11)**: 3 migrations · `lib/paymentState.ts` · `lib/imageResize.ts` ·
`lib/receipts.ts` · `hooks/useSessionReceipts.ts` · `components/ReceiptUploadDialog.tsx` ·
`components/ReceiptViewerDialog.tsx` · 2 unit test files · 1 E2E spec

**Modified (9)**: `types/database.ts` · `hooks/useRoster.ts` ·
`hooks/usePlayerSessions.ts` · `components/RosterPanel.tsx` ·
`views/SessionPlayerDetailView.tsx` · `views/MySessionsView.tsx` ·
`views/ProfileView.tsx` · `views/AdminView.tsx` · 1 existing test

### What was validated

| Check | Result |
|---|---|
| `npx tsc -b` | Clean |
| `npm run lint` | **0 new problems** (4 pre-existing — see below) |
| `npm run test:unit` | **143 passed**, 17 files (was 139; +4 new) |
| `tests/finance-totals.spec.ts` | Passes **unmodified** — the FR-034 evidence |

**Pre-existing lint problems, not introduced here**: 3 `prefer-const` errors in
`usePlayerSchedule.ts` (zero diff — never touched by this feature) and 1
`react-hooks/exhaustive-deps` warning in `ProfileView.tsx`. The warning sat at
line 189 in HEAD and reports at 165 now because 24 lines were removed —
189 − 24 = 165, same untouched `useEffect`.

**`finance-totals.spec.ts` is flaky under parallel workers, pre-existing.**
Measured 3 runs with the feature (1 fail, then 2 clean) and 3 runs stashed at
HEAD (1 fail, then 2 clean) — identical pattern, tied to dev-server warm-up. At
`--workers=1` it passes every time. Not caused by this feature; `FinanceView`
imports nothing this feature touches.

### The bug caught before it shipped

`/speckit-analyze` found that the "delete the storage object before the row" rule
had been specified for two call sites when there are **three**. An admin removing
a player from the roster cascades their receipt rows away, and the row holds
`storage_path` — the only record of where the image lives. Every such removal
would have stranded receipt images in the bucket permanently: unreachable,
undeletable, still readable, with no error and no failing test.

Fixed in `useRoster.removePlayer`, with an E2E assertion that checks the **bucket**
rather than the rows — the rows always vanish cleanly, so asserting on them
proves nothing. Written up in `tasks/lessons.md`.

### Deferred, not done

**`AdminRoute` admits moderators to admin-only screens.** `src/App.tsx:28` lets
both `admin` and `moderator` through to `/finance`, `/players` and `/inventory`,
while `067_add_moderator_role.sql` states moderators cannot access them — that
comment is intent, not an enforced guard.

This feature meets its own requirement at the data layer instead (a moderator's
`SELECT` on `session_receipts` returns nothing and their `createSignedUrl` is
refused), which is strictly stronger than a route guard. But the underlying gap
is real, predates this work, and spans three screens this feature does not
otherwise touch. **Recommend a separate spec** rather than widening this branch.

### Also out of scope, by decision

OCR of receipts · GCash API integration · notifying the organiser on upload ·
structured partial-payment amounts · moderator access to receipts · admins
uploading on a player's behalf.

---

## Recently completed

- Added a "# of courts" control below "Set Limit" on the Registration Open
  screen (`RegistrationURLCard.tsx` + `SessionView.tsx`), updating
  `sessions.court_count`. Court-card rendering was already dynamic per
  `court_count`; verified live in a real browser. See `tasks/lessons.md`.
