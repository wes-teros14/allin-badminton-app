---

description: "Task list template for feature implementation"
---

# Tasks: Show Payment Phone Number & QR Code to Registered Players

**Input**: Design documents from `/specs/003-registration-payment-qr/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/payment-settings-rls.md, quickstart.md

**Tests**: Included. Constitution Principle V (Validation Before Merge) requires targeted unit + e2e coverage for user-facing flow changes, and research.md Decision 4 commits to extracting a testable pure visibility-gating function following this repo's existing convention.

**Organization**: Tasks are grouped by user story. Note: although the spec numbers them User Story 1 and User Story 2, **User Story 2 (admin configures payment info) is implemented first** — the spec explicitly states it's a prerequisite for User Story 1 (there's no payment info to display until an admin sets it). Story labels below still match the spec's own `[US1]`/`[US2]` numbering.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Single frontend project rooted at `badminton-v2/`, Supabase as the backend (no separate API layer — see `contracts/payment-settings-rls.md`). All paths below are relative to the repository root.

---

## Phase 1: Setup

**Purpose**: Confirm the working environment is ready.

- [X] T001 Confirm branch `003-registration-payment-qr` is checked out; run `npm run dev`, `npm run test:unit`, and `npm run lint` in `badminton-v2/` once to establish a clean baseline before making changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, storage, and shared read access that both user stories depend on.

**⚠️ CRITICAL**: Must be complete before Phase 3/4 work begins.

- [X] T002 [P] Write `badminton-v2/supabase/migrations/073_create_payment_settings.sql`: create singleton table `payment_settings` (`id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1)`, `phone_number TEXT`, `qr_code_url TEXT`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL`), seed the single row, enable RLS with a `SELECT` policy for all `authenticated` users and an `INSERT`/`UPDATE` policy restricted to `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')` — mirrors migration `033_create_announcements.sql`; also create the public-read `payment-qr` Storage bucket with `INSERT`/`UPDATE`/`DELETE` policies restricted to the same admin-role check — mirrors migration `069_add_profile_avatars.sql` (per `contracts/payment-settings-rls.md`)
- [ ] T003 Apply migration `073_create_payment_settings.sql` to the local/dev Supabase project (project's existing migration workflow, e.g. `npx supabase db push`) and confirm the table, seed row, bucket, and policies exist — including a direct check (e.g. via the Supabase SQL editor signed in as a non-admin, or a quick script) that a non-admin `UPDATE` on `payment_settings` is rejected by RLS (FR-006 defense-in-depth, not just UI-level gating)
- [X] T004 [P] Add `payment_settings` table types (Row/Insert/Update) to `badminton-v2/src/types/database.ts`, matching the existing style used for other tables (e.g. `announcements`)
- [X] T005 Add `usePaymentSettings.ts` in `badminton-v2/src/hooks/` — fetches the singleton row (`id = 1`) from `payment_settings` and returns `{ phoneNumber, qrCodeUrl, isLoading }` (depends on T004 for types, T003 for the table to exist)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 2 - Admin configures the payment info (Priority: P1) 🎯 MVP enabler

**Goal**: An admin can set (and later update) the payment phone number and QR code image without touching Supabase directly.

**Independent Test**: As an admin, open the payment settings screen, enter a phone number and upload a QR code image, save, and confirm the exact values are shown on reload.

### Implementation for User Story 2

- [X] T006 [US2] Add `badminton-v2/src/views/PaymentSettingsView.tsx` — a form with a phone number text input and a QR code image upload/preview control. On save: upload the image to the `payment-qr` bucket at a fixed path (e.g. `qr-code.png`) with `upsert: true` (only if a new image was chosen), then update the `payment_settings` row (`phone_number`, `qr_code_url`, `updated_at`, `updated_by`) via Supabase
- [X] T007 [US2] Add a new admin-gated route in `badminton-v2/src/App.tsx` (e.g. `/payment-settings`), registered as a sibling to `/players`, `/inventory`, `/finance` inside the existing `<AdminRoute>` wrapper
- [X] T008 [P] [US2] Add a "Payment Settings" nav tab entry to `badminton-v2/src/components/TopNavBar.tsx`'s `tabs` array, using the same shape as the Players/Inventory/Finance entries (`{ label: 'Payment Settings', href: '/payment-settings', active: pathname.startsWith('/payment-settings'), show: role === 'admin', badge: false }`)
- [ ] T009 [US2] Manually verify via `quickstart.md` "Admin side" steps 1-5: enter and save phone number + QR image, confirm they persist and can be replaced, and confirm a non-admin cannot reach the settings screen (US2 Acceptance Scenario 3, FR-006)

**Checkpoint**: An admin can fully configure payment info — this unblocks User Story 1.

---

## Phase 4: User Story 1 - Registered player sees how to pay (Priority: P1) 🎯 MVP

**Goal**: A registered, unpaid player sees the configured payment phone number (copyable) and QR code on their session detail screen, in place of the current plain "You're registered!" message; this disappears once an admin marks them Paid.

**Independent Test**: Register a test player for a session while payment info is configured and the registration is unpaid; open the session detail screen and confirm the phone number and QR code appear and the number can be copied; mark the registration Paid and confirm they disappear.

### Implementation for User Story 1

- [X] T010 [US1] In `badminton-v2/src/views/SessionPlayerDetailView.tsx`, add a named, exported pure function `shouldShowPaymentInfo({ isRegistered, paid, hasPaymentInfo }: { isRegistered: boolean; paid: boolean | null; hasPaymentInfo: boolean }): boolean` implementing: `isRegistered && paid !== true && hasPaymentInfo` (per data-model.md's Derived Visibility Rule)
- [X] T011 [P] [US1] Add unit tests for `shouldShowPaymentInfo` in `badminton-v2/src/__tests__/sessionPlayerDetailView.paymentVisibility.test.ts` covering: registered + unpaid + fully configured → true; registered + paid + configured → false; registered + unpaid + unconfigured (both fields null) → false; not registered → false; only phone configured → true; only QR configured → true
- [X] T012 [US1] Widen the existing registration-status query in `SessionPlayerDetailView.tsx` (`supabase.from('session_registrations').select('player_id')...`, ~line 324) to also select `paid`, and store it in component state
- [X] T013 [US1] Wire `usePaymentSettings()` into `SessionPlayerDetailView.tsx`. Render the payment block as its own condition — `isRegistered && shouldShowPaymentInfo(...)` — independent of `sessionStatus`, not nested inside the existing `sessionStatus === 'registration_open'` registration banner (a player may still owe payment after registration closes, schedule locks, or the session starts — FR-002/FR-004 don't restrict this to the registration window). Within the existing registration-open banner, suppress the old plain "✅ You're registered!" confirmation only when the new payment block is already showing, to avoid duplicating it. Gracefully omit either phone or QR if not configured, and handle a QR image load failure with no broken-image icon
- [X] T014 [US1] Add a copy-to-clipboard action next to the displayed phone number in `SessionPlayerDetailView.tsx`: call `navigator.clipboard.writeText(phoneNumber)` and, on success, show a `sonner` `toast.success(...)` (already imported/used elsewhere in this file for registration errors, and in `FinanceView.tsx`) to satisfy FR-003's "visible confirmation that the copy succeeded" — note `RegisterView.tsx`'s "Copy Link" button is NOT a valid precedent to copy here, since it has no success feedback at all (silent `.catch(() => {})`, only a static instructional line)
- [ ] T015 [P] [US1] Add or extend a Playwright test in `badminton-v2/tests/` covering: admin configures payment info (via seeded/direct DB write, following existing e2e conventions) → a registered, unpaid seeded player sees the phone number and QR code and can copy the number → the registration is marked Paid → the player no longer sees the payment info on reload → (FR-007) the same player, if also registered for a second unpaid session, sees the identical phone number and QR code there too
- [ ] T016 [US1] Manually verify via `quickstart.md` "Player side" steps 1-5 and "Edge cases" steps 6-8 (step 8 covers SC-004 — payment info configured after a player was already registered appears automatically on next view, with no action needed from the player)

**Checkpoint**: Both user stories work independently and together — this is the full scope of the original request.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both stories, per Constitution Principle V.

- [X] T017 [P] Run `npm run lint` in `badminton-v2/` and resolve any violations introduced by this change
- [X] T018 [P] Run `npm run test:unit` in `badminton-v2/` and confirm all tests pass, including the new tests from T011
- [ ] T019 Run the full `quickstart.md` validation checklist end-to-end and confirm `MySessionsView.tsx`'s existing "Payment: Unpaid" label and `RegisterView.tsx`'s post-registration confirmation screen remain unchanged (Constitution Principle III — these were explicitly scoped out, not overlooked)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS both user stories (no table/bucket, no config to read or write)
- **User Story 2 (Phase 3)**: Depends on Foundational completion. Despite being "story 2," this MUST be implemented before Phase 4, since it's what produces the data Phase 4 displays
- **User Story 1 (Phase 4)**: Depends on Foundational AND on User Story 2 having a way to write real config data (T009 confirms this works) — its acceptance scenarios require configured payment info to exist
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- User Story 2: T006 (view) → T007 (route, references the view) → T008 (nav entry, can be written in parallel with T006/T007 since it only needs the agreed-upon route string) → T009 (manual verify, needs T006-T008 done)
- User Story 1: T010 (pure function) and T012 (widen query) both land in the same file before T013 (wiring); T011 (unit tests) can be written in parallel with T010/T012/T013 landing, though it will only pass once T010 exists; T014 (copy action) follows T013; T015 (e2e test) is a separate file, independent of T010-T014's file but exercises their combined behavior; T016 (manual verify) needs T010-T014 done

### Parallel Opportunities

- T002 (migration file) and T004 (database.ts types) touch different files and can be developed in parallel
- T008 (nav entry) can be developed in parallel with T006/T007 (different file)
- T011 (unit test file) and T015 (e2e test file) can be developed in parallel with each other and with the implementation tasks in their respective stories
- T017 and T018 (lint, unit tests) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Once Setup (T001) is done, these can proceed together:
Task: "Write badminton-v2/supabase/migrations/073_create_payment_settings.sql"
Task: "Add payment_settings table types to badminton-v2/src/types/database.ts"
```

## Parallel Example: User Story 2

```bash
# Once Foundational (Phase 2) is done, these can proceed together:
Task: "Add badminton-v2/src/views/PaymentSettingsView.tsx"
Task: "Add Payment Settings nav tab entry to badminton-v2/src/components/TopNavBar.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (migration, types, hook)
3. Complete Phase 3: User Story 2 (admin can configure payment info) — required before Phase 4 can be meaningfully tested
4. Complete Phase 4: User Story 1 (players see and copy payment info, hidden once paid) — this delivers the entire user-visible fix requested
5. **STOP and VALIDATE**: Run `quickstart.md` in full
6. This is the complete scope of the original request — there is no smaller independently-shippable slice, since User Story 1 has no data to display without User Story 2

### Incremental Delivery

1. Setup + Foundational → schema and read/write access ready
2. User Story 2 → admin can configure payment info → validate via quickstart.md "Admin side"
3. User Story 1 → players see, copy, and stop seeing payment info correctly → validate via quickstart.md "Player side" and "Edge cases"
4. Polish → lint, full unit suite, full quickstart pass, confirm out-of-scope surfaces (MySessionsView label, RegisterView screen) are untouched

---

## Notes

- Unlike the previous feature, this one is NOT single-file-scoped: it spans a new migration, new types, a new hook, a new admin view + route + nav entry, and a modified player-facing view. Task granularity reflects that — most tasks are separate files and are marked `[P]` where genuinely independent.
- `MySessionsView.tsx`'s "Payment: Unpaid" label and `RegisterView.tsx`'s post-registration confirmation screen are explicitly out of scope (see plan.md Constitution Check, Principle III) — no tasks touch them, and T019 confirms they remain unchanged.
- If e2e credentials are unavailable in the implementation environment (this repo's `badminton-v2/.env` was empty during the previous feature's implementation), T015 may need to be written but not executed — document that explicitly rather than claiming it passed.
- Commit after each task or logical group.

## Implementation Status (as of 2026-07-28)

- T001, T002, T004-T008, T010-T014, T017, T018 complete and verified (unit tests: 108/108 pass including 6 new; lint: identical to baseline, zero new violations; `tsc -b --noEmit`: clean).
- **T003 deferred to the user by explicit choice**: the currently-linked Supabase project (`supabase/.temp/project-ref`) is `ensdfitpeyreunihkqkh`, which matches `supabase:link:prod` in `package.json` — i.e. **production**, not dev. Additionally the Supabase CLI failed to execute in this sandbox (`EPERM` spawning the binary) regardless. The user chose to apply the migration themselves rather than have it attempted from here. Migration file (T002) is ready at `badminton-v2/supabase/migrations/073_create_payment_settings.sql`.
- **T009, T016, T019 partially blocked by T003**: with the table not yet applied, `usePaymentSettings` gracefully returns nulls (confirmed live — no crash, no console errors, falls back to existing behavior). This validates graceful degradation, but the actual save/persist (T009), show/hide/copy (T016), and full quickstart pass (T019) cannot be verified until T003 is done. T019's specific added check — confirming `MySessionsView.tsx` and `RegisterView.tsx` remain untouched — IS confirmed (`git status` shows zero changes to either file).
- **T015 (e2e test) written but not executed** — same pre-existing environment gap as the previous feature (`badminton-v2/.env` empty, blocks the Node-side service-role Supabase client Playwright tests use for seeding/cleanup). Confirmed by re-running an existing, untouched e2e spec (`registration-limit.spec.ts`) which fails identically.
- **Self-caught correction during implementation**: T013 was initially implemented nesting the payment block inside the existing `sessionStatus === 'registration_open'` conditional, inherited from the code it was replacing. This would have made the payment info silently disappear once registration closes, even for an unpaid player — contradicting FR-002/FR-004, which don't restrict this to the registration window. Fixed before this status was recorded; see T013's updated description above.
- **Next step for the user**: run `npm run supabase:link:dev && npx supabase db push` (or the prod equivalent when ready) to apply migration 073, then re-verify T009/T016/T019 and optionally run T015's e2e test.
