---
description: "Task list for 005-payment-receipt-upload"
---

# Tasks: Payment Receipt Upload & Admin Receipt Review

**Input**: Design documents from `/specs/005-payment-receipt-upload/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. Not optional here — Constitution Principle V requires `npm run lint`, `npm run test:unit` and affected E2E coverage for every production change, and the Testing Rules require a browser-level assertion for a new user-facing flow that spans auth, upload and realtime. This one does all three.

**Organization**: Grouped by user story so each can be implemented, tested and demonstrated independently.

> **Revised after `/speckit-analyze`.** Two HIGH findings fixed: a third storage-cleanup call site was missing (now T036), and a task depended on one scheduled a phase later (Phase 5 now precedes the US3/US4 phases). Task IDs were renumbered as a result — total is now 58.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1–US4)
- All paths are relative to the repository root

## Path Conventions

Single-page web application. Runtime code lives in `badminton-v2/` per Constitution Principle I. Unit tests in `badminton-v2/src/__tests__/`, Playwright specs in `badminton-v2/tests/`, migrations in `badminton-v2/supabase/migrations/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the baseline and confirm the one piece of environment access this feature cannot proceed without.

- [X] T001 Read the Supabase migration workaround in `tasks/lessons.md` (lines 29, 39, 181) and confirm SQL Editor access to the **dev** project `tsvetqzkullivprbjtli`. `supabase db push` does not work in this environment — the Windows CLI binary is permission-blocked and the dev project's `supabase_migrations.schema_migrations` table has malformed rows for versions 037–044 that resist `migration repair`.
- [X] T002 [P] Record the pre-change validation baseline on branch `005-payment-receipt-upload`: run `npm run lint`, `npm run test:unit`, and `npm run test:e2e -- tests/finance-totals.spec.ts` in `badminton-v2/` and note any pre-existing failures. Constitution Principle V requires unrelated failures to be documented explicitly rather than discovered later and blamed on this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, types, and the pure helpers every user story reads from.

**⚠️ CRITICAL**: No user story work can begin until T006 has been applied to the dev database.

### Migrations

- [X] T003 Create `badminton-v2/supabase/migrations/075_create_session_receipts.sql` — table per [data-model.md](./data-model.md) §1 (9 columns, `note` length CHECK ≤ 140), the 3 indexes, `ENABLE ROW LEVEL SECURITY`, the 5 policies from [contracts/session-receipts-rls.md](./contracts/session-receipts-rls.md), and `GRANT SELECT, INSERT, DELETE ON public.session_receipts TO authenticated`. Copy the admin-role predicate verbatim from `073_create_payment_settings.sql`. The INSERT and DELETE policies MUST include the parent-registration `paid = false` subquery — that subquery is the only thing that closes the stale-form race. There is deliberately **no admin DELETE policy on the table**: row removal happens by cascade, never by direct admin action.
- [X] T004 [P] Create `badminton-v2/supabase/migrations/076_create_receipts_bucket.sql` — insert bucket `receipts` with **`public = false`** and the 4 `storage.objects` policies. Copy the per-user path idiom `(storage.foldername(name))[1] = auth.uid()::text` from `069_add_profile_avatars.sql`. The admin `DELETE` policy on the **bucket** is required — T036 and T037 have an admin removing other players' image files. Do **not** add a public-read policy; that single boolean is the whole privacy model.
- [X] T005 [P] Create `badminton-v2/supabase/migrations/077_session_receipts_realtime.sql` — `REPLICA IDENTITY FULL` plus the guarded `DO $$ ... IF NOT EXISTS ... ALTER PUBLICATION` block copied verbatim from `072_session_registrations_realtime.sql`.
- [X] T006 Apply migrations 075, 076 and 077 to the **dev** project via Supabase Dashboard → SQL Editor → New query → paste → Run. Verify afterwards that the table exists, the bucket shows `public = false`, and `session_receipts` appears in `pg_publication_tables` for `supabase_realtime`.

### Types and pure helpers

- [X] T007 [P] Add the `session_receipts` entry (Row / Insert / Update / Relationships) to `badminton-v2/src/types/database.ts`, beside `session_registrations` at ~line 422, matching the generated shape of neighbouring tables. Constitution Principle II makes this mandatory whenever schema shape changes.
- [X] T008 [P] Write `badminton-v2/src/__tests__/paymentState.test.ts` covering all 6 rows of the truth table in [contracts/payment-state-derivation.md](./contracts/payment-state-derivation.md), including both `null` cases. Written before the implementation — it must fail with a module-not-found error at this point.
- [X] T009 Implement `badminton-v2/src/lib/paymentState.ts` exporting `PaymentState` and `derivePaymentState({ paid, activeReceiptCount })` until T008 passes. `paid === true` dominates; `activeReceiptCount` counts only non-dismissed receipts.
- [X] T010 [P] Create `badminton-v2/src/lib/imageResize.ts` by moving `resizeImageFile` out of `badminton-v2/src/views/ProfileView.tsx:79` **verbatim**. Do not improve it while moving it — the byte-ladder behaviour is already proven on this app's target devices.
- [X] T011 Update `badminton-v2/src/views/ProfileView.tsx` to import `resizeImageFile` from `@/lib/imageResize` and delete the local copy. Leave the avatar-specific constants (`MAX_AVATAR_DIM`, `MAX_AVATAR_BYTES`, `MAX_AVATAR_INPUT_BYTES`) where they are — they are call-site arguments, not part of the helper.
- [X] T012 Manually verify the avatar upload flow on `/profile` still works after the extraction, before anything is built on top of the moved helper.
- [X] T013 [P] Create `badminton-v2/src/lib/receipts.ts` with `MAX_RECEIPTS_PER_SESSION = 5`, `MAX_RECEIPT_DIM = 1600`, `MAX_RECEIPT_BYTES = 800 * 1024`, `MAX_RECEIPT_INPUT_BYTES = 20 * 1024 * 1024`, `MAX_RECEIPT_NOTE_LENGTH = 140`, and `buildReceiptPath(playerId, sessionId, receiptId)` returning `` `${playerId}/${sessionId}/${receiptId}.jpg` ``. Dimensions exceed the avatar's because a receipt must stay legible enough to read an amount and reference number (FR-006).
- [X] T014 [P] Write `badminton-v2/src/__tests__/receipts.test.ts` asserting `buildReceiptPath` puts `playerId` in the first path segment — that ordering is what makes the storage ownership policy work, so it deserves a test that fails loudly if someone reorders it.

**Checkpoint**: Schema live on dev, types updated, all pure helpers green. User stories can now begin.

---

## Phase 3: User Story 1 — Player attaches a payment receipt with a note (Priority: P1) 🎯 MVP

**Goal**: A registered, unconfirmed player can attach a payment screenshot with an optional note from the GCash banner on their session card, and immediately sees it was received.

**Independent test**: Register a test player for a session with payment settings configured, open their session card, attach an image with a note, reload — the receipt and the awaiting-confirmation state persist. Delivers value even with no admin UI, because the proof is captured and durable.

- [X] T015 [US1] Create `badminton-v2/src/hooks/useSessionReceipts.ts` exporting the `SessionReceipt` interface and a hook that fetches the signed-in user's own receipts for a session, ordered `uploaded_at DESC`. Follow the fetch-and-map shape already used in `badminton-v2/src/hooks/useRoster.ts:47-95`.
- [X] T016 [US1] Add `uploadReceipt(file, note)` to `badminton-v2/src/hooks/useSessionReceipts.ts`: resize via `resizeImageFile`, generate a receipt UUID, `storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg' })` with **no `upsert`**, then INSERT the row. Storage object before row, always — a failed upload must leave no row behind (FR-010).
- [X] T017 [US1] Add signed-URL minting to `badminton-v2/src/hooks/useSessionReceipts.ts` using `createSignedUrl(path, 60)`. Do **not** use `getPublicUrl()` — on a private bucket it returns a non-resolving address and fails silently.
- [X] T018 [P] [US1] Create `badminton-v2/src/components/ReceiptUploadDialog.tsx` — one combined step containing an image input (`accept="image/*"`, camera capture allowed) and a note field with a visible character counter against `MAX_RECEIPT_NOTE_LENGTH`. Submitting with no note must be permitted (FR-003).
- [X] T019 [US1] Add validation and failure handling to `badminton-v2/src/components/ReceiptUploadDialog.tsx`: reject non-images and oversize inputs with specific messages, show unambiguous in-progress feedback, and surface a retry-able error on failure. Use `sonner` toasts, matching `ProfileView.tsx:237-260`.
- [X] T020 [US1] Render the "Add receipt + note" action in `badminton-v2/src/views/SessionPlayerDetailView.tsx` directly below the existing instruction line at ~line 190, inside the banner already gated by `shouldShowPaymentInfo`. Do not change that helper — it already returns `true` for both unpaid and submitted, which is exactly the FR-011 behaviour.
- [X] T021 [US1] Render submitted-receipt thumbnails in `badminton-v2/src/views/SessionPlayerDetailView.tsx`, each with its note and submission time, plus the "Receipt submitted — awaiting confirmation" line (FR-011, FR-012). Thumbnails load through the signed URL from T017.
- [X] T022 [US1] Wire `derivePaymentState` into `badminton-v2/src/views/SessionPlayerDetailView.tsx` so the banner's state comes from the shared helper rather than a local ternary.
- [X] T023 [US1] Manually verify on localhost (dev-only login button, bottom right): attach a receipt with a note → banner shows the thumbnail and the orange awaiting-confirmation state → reload → both persist. **Time the attach-to-confirmation round trip on a throttled mobile connection and record it against SC-001's 30-second budget** — if it exceeds, revisit `MAX_RECEIPT_BYTES` in `src/lib/receipts.ts`.

**Checkpoint**: Receipts are captured, stored privately, and visible to their owner.

---

## Phase 4: User Story 2 — Admin reviews receipts per player and confirms payment (Priority: P1) 🎯 MVP

**Goal**: The organiser sees a per-player receipt link in the payment panel, opens it to view images with notes and timestamps, and confirms payment explicitly.

**Independent test**: With a player who has submitted a receipt, open the payment panel, verify the link appears, open it, verify image + note + timestamp render, press Confirm, and verify the player turns green on both surfaces and stays green after reload.

- [X] T024 [US2] In `badminton-v2/src/hooks/useRoster.ts`, fetch `session_receipts` for the session alongside the existing registration and profile queries, group by `player_id` counting only `dismissed_at IS NULL`, and add `activeReceiptCount: number` to the `RosterPlayer` interface. Leave `paid: boolean` untouched.
- [X] T025 [US2] In `badminton-v2/src/hooks/useRoster.ts`, add a **second** `.on('postgres_changes', ...)` listener for `session_receipts` to the existing `roster:{sessionId}` channel (~line 105). Do not open a new channel.
- [X] T026 [US2] In `badminton-v2/src/hooks/useRoster.ts`, extend the payment action so setting Paid is an explicit confirm and Unpaid is a reversal, both writing only `session_registrations.paid`. No new column, no write to any derived value.
- [X] T027 [P] [US2] Create `badminton-v2/src/components/ReceiptViewerDialog.tsx` — lists a player's receipts newest first, each showing the image at a size sufficient to read an amount, its note or an explicit "no note", and the submission date and time (FR-023). Mints signed URLs at view time.
- [X] T028 [US2] Replace the two-state toggle in `badminton-v2/src/components/RosterPanel.tsx` (lines 71-88) with a three-state indicator driven by `derivePaymentState` plus an explicit Confirm control. Preserve the existing row shape and visual language per the constitution's UI Rules.
- [X] T029 [US2] Add the per-player receipt link to each row in `badminton-v2/src/components/RosterPanel.tsx`, labelled with the receipt count and opening `ReceiptViewerDialog`. Rows with zero receipts show a muted "no receipt" indicator and no link (FR-022).
- [X] T030 [US2] Replace the header tally in `badminton-v2/src/components/RosterPanel.tsx` (lines 52-58) with a three-state summary (FR-025).
- [X] T031 [US2] Add a `role === 'admin'` check around the receipt link and viewer in `badminton-v2/src/components/RosterPanel.tsx`. RLS is the real enforcement — `AdminRoute` at `badminton-v2/src/App.tsx:28` admits moderators to `/finance` — but this gives a moderator a clean absence rather than an empty broken-looking panel (FR-021, research R7).
- [X] T032 [US2] Create `badminton-v2/tests/payment-receipts.spec.ts` asserting the full loop in a browser: player uploads → admin sees the link and the orange state → admin confirms → player's banner disappears. Additionally assert that **the receipt is still listed to the admin after confirmation** (FR-032 — nothing may purge it on confirm) and that **the player card and admin panel agree in all three states** (SC-007). Follow the isolated, seed-backed pattern in `badminton-v2/tests/payment-settings.spec.ts`.
- [X] T033 [US2] Manually verify realtime: with the payment panel open in one browser, upload a receipt from another session as the player, and confirm the panel updates without a manual reload (FR-026).

**Checkpoint**: MVP loop complete end to end.

---

## Phase 5: Cross-Surface Consistency & Lifecycle

**⚠️ REQUIRED, not polish.** Constitution Principle III states a feature is not complete if one surface is updated while another still reflects stale assumptions. FR-020, FR-031 and FR-033 live here.

**Scheduled before the US3/US4 phases deliberately.** It establishes the receipt-count plumbing in `usePlayerSessions.ts` that T048 later depends on, and it closes the orphaned-image paths before any deletion feature is built on top of them.

- [X] T034 In `badminton-v2/src/hooks/usePlayerSessions.ts`, fetch the signed-in user's active receipt counts (`dismissed_at IS NULL`) across the listed sessions and expose them alongside the existing `paid` value.
- [X] T035 In `badminton-v2/src/views/MySessionsView.tsx`, replace the two-state payment ternary at line 117 and the label at lines 179-182 with `derivePaymentState`, so the sessions list shows all three states (FR-020).
- [X] T036 In `badminton-v2/src/hooks/useRoster.ts:122` (`removePlayer`), query that registration's `session_receipts.storage_path` values and `storage.remove()` them **before** deleting the registration row. Abort with a toast if the storage removal fails. Without this, the `registration_id` cascade destroys the rows holding the only record of each image's path, stranding the files in the bucket permanently — unreachable, undeletable, and still readable by anyone whose storage RLS matches the path (FR-030). This is the third of three storage-cleanup call sites; the others are T041 and T037.
- [X] T037 In `badminton-v2/src/views/AdminView.tsx:56`, query the session's `session_receipts` storage paths and `storage.remove()` them **before** deleting the session. The database cascade removes rows but has no reach into storage (FR-031).
- [X] T038 Grep the feature's changed files for `getPublicUrl` and confirm zero hits. Every read must go through `createSignedUrl`; a stray `getPublicUrl` on a private bucket fails silently rather than throwing, so it will not surface in testing.
- [X] T039 Verify FR-033 against legacy data: open a session whose registrations predate this feature (zero receipts) and confirm every surface — session card, sessions list, admin payment panel — renders exactly the red/green behaviour it did before, with no orange state and no receipt affordances.

**Checkpoint**: All surfaces agree, no path leaks storage objects. **Shippable here.**

---

## Phase 6: User Story 3 — Player manages their own submitted receipts (Priority: P2)

**Goal**: A player can add a second receipt or remove a bad one, but only while unconfirmed.

**Independent test**: With one existing unconfirmed receipt, add a second, verify both show with their own notes, delete one, verify the other remains and the state is still orange.

- [X] T040 [US3] Add the "Add another" affordance to the banner in `badminton-v2/src/views/SessionPlayerDetailView.tsx`, shown whenever the player is below `MAX_RECEIPTS_PER_SESSION` (FR-013).
- [X] T041 [US3] Add `deleteReceipt(receipt)` to `badminton-v2/src/hooks/useSessionReceipts.ts`: `storage.remove([path])` **first**, then DELETE the row, aborting if the storage removal fails. The reverse order strands the image permanently (FR-030, research R4).
- [X] T042 [US3] Add a remove control to each thumbnail in `badminton-v2/src/views/SessionPlayerDetailView.tsx`, rendered only while payment is unconfirmed (FR-014).
- [X] T043 [US3] Add limit-reached messaging in `badminton-v2/src/components/ReceiptUploadDialog.tsx` directing the player to remove one first (FR-007, US3 scenario 5).
- [X] T044 [US3] Verify that removing the last receipt returns the player to the red unpaid state with the full payment instructions restored, and that a confirmed player sees no banner and no add/remove controls at all.
- [X] T045 [US3] Extend `badminton-v2/tests/payment-receipts.spec.ts` with the add-second and delete paths.

---

## Phase 7: User Story 4 — Admin dismisses an unusable receipt (Priority: P3)

**Goal**: An unreadable or wrong receipt can be dismissed, returning the player to unpaid without destroying the evidence.

**Independent test**: Dismiss a player's only receipt; they return to red with instructions restored, and the dismissed receipt is still listed to the admin, marked as dismissed.

**Droppable if scope needs trimming** — the manual workaround is asking the player to delete and re-upload.

- [X] T046 [US4] Add `dismissReceipt(receiptId)` to `badminton-v2/src/hooks/useRoster.ts`, setting `dismissed_at = now()` and `dismissed_by = auth.uid()`. Admin-only by RLS. Dismissal never deletes — the image and row are retained for audit (FR-027, FR-032).
- [X] T047 [US4] Add the dismiss control and a visible dismissed marker to `badminton-v2/src/components/ReceiptViewerDialog.tsx`. Dismissed receipts remain listed (FR-027).
- [X] T048 [US4] Confirm dismissed receipts are excluded from `activeReceiptCount` at all three read sites — `useRoster.ts` (T024), `useSessionReceipts.ts` (T015), and `usePlayerSessions.ts` (T034). All three exist by now; if any lacks the `dismissed_at IS NULL` filter, a dismissed receipt will show orange on one surface and red on another, breaking FR-020 and SC-007.
- [X] T049 [US4] Verify dismissing a player's only receipt returns them to red on the admin panel, their session card, and their sessions list.

---

## Phase 8: Validation & Closeout

- [X] T050 Run `npm run lint` in `badminton-v2/` and resolve all new findings.
- [X] T051 Run `npm run test:unit` in `badminton-v2/`; `paymentState.test.ts`, `receipts.test.ts` and the 6 pre-existing `sessionPlayerDetailView.paymentVisibility.test.ts` cases must all pass.
- [X] T052 Run `npm run test:e2e -- tests/payment-receipts.spec.ts`.
- [X] T053 Run `npm run test:e2e -- tests/finance-totals.spec.ts` and confirm it passes **with the spec file unmodified**. This is the evidence for FR-034 and SC-004 — if that file needed editing, the derived-state rule was broken somewhere and the fix is in the implementation, not the test.
- [X] T054 Manually verify SC-005: copy a signed receipt URL, wait past the 60-second expiry, and confirm it no longer resolves. Also confirm a second signed-in player cannot read another player's receipt.
- [X] T055 Manually verify SC-006 across **all three** deletion paths: player deletes own receipt (T041), admin removes a player from the roster (T036), admin deletes a session (T037). In each case, fetch the previously valid signed URL afterwards and confirm the object is gone. The roster-removal path is the one with no automatic test coverage — check it by hand.
- [ ] T056 Apply migrations 075, 076 and 077 to the **prod** project `ensdfitpeyreunihkqkh` via Dashboard → SQL Editor, and verify table, bucket privacy and publication entry as in T006. Migration `071` was previously left applied to dev only — do not repeat it.
- [X] T057 Add an entry to `tasks/lessons.md` per the project's Bug & Resolution Log rule, covering anything that bit during implementation — particularly any private-bucket or signed-URL surprise, since this is the codebase's first private bucket.
- [X] T058 Add the review section to `tasks/todo.md` summarising what was built, what was validated, and what was deferred, per Constitution Development Workflow step 5.

---

## Dependencies

### Phase order

```
Phase 1 (Setup)
   └─> Phase 2 (Foundational)  ← T006 is the hard gate: schema must be live on dev
          ├─> Phase 3 (US1, P1) ─┐
          │                      ├─> Phase 5 (Cross-surface) ─> Phase 6 (US3, P2) ─> Phase 7 (US4, P3)
          └─> Phase 4 (US2, P1) ─┘                                                        │
                                                                                          v
                                                                              Phase 8 (Validation)
```

### Story dependencies

- **US1** depends only on Phase 2. Independently demonstrable.
- **US2** depends on Phase 2 for its own code, but **T032 tests a player upload and therefore requires US1**. Build US1 first, or seed a receipt directly.
- **Phase 5** depends on `derivePaymentState` (T009) and on US2's count-plumbing pattern (T024). It precedes US3 and US4 on purpose — see the phase note.
- **US3** depends on US1 (extends the same banner and hook).
- **US4** depends on US2 (extends the viewer dialog) and on **T034**, since T048 checks the dismissal filter in `usePlayerSessions.ts`.

### Critical task dependencies

- T006 blocks everything in Phases 3–7.
- T009 (`derivePaymentState`) blocks T022, T028, T035.
- T010–T012 (helper extraction, verified) block T016.
- T013 (`receipts.ts`) blocks T016 and T018.
- T017 (signed URLs) blocks T021 and T027.
- T024 (`activeReceiptCount`) blocks T028, T029, T030.
- **T034 blocks T048** — this was the ordering defect found by `/speckit-analyze` and is why Phase 5 now precedes Phase 7.
- T041 (`deleteReceipt`) blocks T042.

---

## Parallel Execution Opportunities

**Phase 2** — after T003 is written, these are independent files:

```
T004 (migration 076)     T005 (migration 077)
T007 (database.ts)       T008 (paymentState test)
T010 (imageResize.ts)    T013 (receipts.ts)     T014 (receipts test)
```

**Phase 3** — T018 (`ReceiptUploadDialog.tsx`) is a new file and can be built alongside T015–T017 in the hook.

**Phase 4** — T027 (`ReceiptViewerDialog.tsx`) is a new file and can be built alongside T024–T026 in `useRoster.ts`.

**Cross-story** — once Phase 2 is complete, US1 (Phase 3) and US2 (Phase 4) touch disjoint files and can proceed in parallel by two people. The only shared file is `paymentState.ts`, which is finished and frozen by then.

Tasks touching the same file are never marked `[P]`: T015/T016/T017/T041 all edit `useSessionReceipts.ts`; T024/T025/T026/T036/T046 all edit `useRoster.ts`; T028/T029/T030/T031 all edit `RosterPanel.tsx`; T020/T021/T022/T040/T042 all edit `SessionPlayerDetailView.tsx`.

---

## Implementation Strategy

### MVP scope

**Phases 1–4** — 33 tasks. Delivers the complete loop the requester asked for: a player attaches proof with a note, the organiser opens a per-player link, reviews it, and confirms. US1 and US2 are both P1 because either alone is only half a feature.

**Phase 5 is required before shipping.** Principle III makes the sessions-list state part of correctness, and T036/T037 close the paths that would otherwise leak receipt images into the bucket permanently.

### Incremental delivery

1. Phases 1–2 → schema and helpers live, nothing user-visible yet
2. Phase 3 → players can submit; organiser still confirms from memory. Already better than the group chat
3. Phase 4 → loop closed. **Demo here**
4. Phase 5 → cross-surface consistency, orphan cleanup, legacy verified. **Ship here**
5. Phase 6 → multi-receipt and self-service correction
6. Phase 7 → dismissal; drop if scope tightens

### The two rules that govern the whole implementation

**Storage object before row. Both directions, all three call sites** — T036 (`removePlayer`), T037 (session delete), T041 (player deletes own). A database cascade deletes rows but cannot touch Storage, so a row removed first strands its image with no record of where it lives.

**`session_registrations.paid` keeps its exact current meaning.** No task adds a payment status column, and none touches `get_session_finance`. T053 is how that stays true.

---

## Task Summary

| Phase | Story | Tasks | Count |
|---|---|---|---|
| 1. Setup | — | T001–T002 | 2 |
| 2. Foundational | — | T003–T014 | 12 |
| 3. Player upload | US1 (P1) | T015–T023 | 9 |
| 4. Admin review | US2 (P1) | T024–T033 | 10 |
| 5. Cross-surface & lifecycle | — | T034–T039 | 6 |
| 6. Manage own receipts | US3 (P2) | T040–T045 | 6 |
| 7. Dismiss receipt | US4 (P3) | T046–T049 | 4 |
| 8. Validation & closeout | — | T050–T058 | 9 |
| **Total** | | | **58** |
