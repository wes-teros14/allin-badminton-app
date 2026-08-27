# Implementation Plan: Payment Receipt Upload & Admin Receipt Review

**Branch**: `005-payment-receipt-upload` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-payment-receipt-upload/spec.md`

## Summary

Let a registered player attach their GCash payment screenshot — with an optional short note — directly to their session registration from the payment banner already on their session card, and give the administrator a per-player link to review those receipts before confirming payment.

The technical approach turns on one decision: **the new orange "awaiting confirmation" state is derived, never stored.** `session_registrations.paid` keeps its exact current meaning and stays the only input to revenue, so `get_session_finance` is not edited, revenue arithmetic cannot shift, and the existing finance reconciliation E2E test passes unmodified. Receipts live in a new **private** storage bucket — the first in this codebase — read exclusively through 60-second signed URLs minted from the caller's own token, because financial screenshots must not be readable by anyone holding only the address.

Three additive migrations, two new pure lib helpers, one new hook, two new dialogs, and edits to four existing surfaces. No existing table is altered and no data is backfilled.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2

**Primary Dependencies**: `@supabase/supabase-js` 2.99, `react-router` 7.13, Tailwind CSS 4.2, shadcn/ui on `@base-ui/react` 1.3, `sonner` 2.0 (toasts), `lucide-react` (icons)

**Storage**: Supabase Postgres with RLS + Supabase Storage. New table `session_receipts`; new private bucket `receipts`. Two projects — dev `tsvetqzkullivprbjtli`, prod `ensdfitpeyreunihkqkh`

**Testing**: Vitest for unit (`src/__tests__/`), Playwright for E2E (`tests/`)

**Target Platform**: Mobile-first responsive web (players are on phones on court WiFi), deployed to Vercel at `badmintontayo.mrkws.com`

**Project Type**: Single-page web application, no backend service — the browser talks to Supabase directly, so RLS *is* the API contract

**Performance Goals**: Receipt attached and confirmed on screen in under 30 s over mobile data (SC-001); images compressed to ≤ 800 KB client-side before upload

**Constraints**: No service-role key may exist client-side or be committed. Signed URLs expire in 60 s. Storage objects always written before their row and deleted before their row, at all three cleanup call sites. `get_session_finance` must not be modified.

**Scale/Scope**: ~16 players per session, ≤ 5 receipts per player per session. 3 migrations, 3 new lib modules, 1 new hook, 2 new components, 8 modified files, 3 new test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial evaluation (pre-research)

| Principle | Status | Assessment |
|---|---|---|
| **I. Single-App Runtime Boundaries** | PASS | All runtime work is inside `badminton-v2/`. Affected surfaces named explicitly: player session card, player sessions list, admin finance payment panel. Liveboard and match surfaces are untouched — they carry no payment concept. |
| **II. Session Data Is the Source of Truth** | PASS | Payment state is derived from persisted registration + receipt data, never from UI constants. Schema change ships as migrations `075`–`077` with matching `src/types/database.ts` updates, as required. |
| **III. Cross-Surface Consistency** | PASS | Payment state is currently rendered in three places (`SessionPlayerDetailView`, `MySessionsView`, `RosterPanel`). All three move to the shared `derivePaymentState` helper in the same change; leaving any one two-state would be a Principle III failure. |
| **IV. Safe Stateful Changes First** | PASS | Purely additive. No `ALTER` on any existing table, no backfill, no destructive transition. Pre-existing registrations have zero receipts and therefore derive to exactly the state they show today (FR-033). |
| **V. Validation Before Merge** | PASS | `npm run lint`, `npm run test:unit`, plus E2E for the new flow and the **unmodified** `finance-totals.spec.ts` as the evidence for FR-034. |

### Additional Constraints

| Rule | Status | Assessment |
|---|---|---|
| Additive-first migrations | PASS | Three `CREATE`-only migrations. Rollback is dropping three objects. |
| Backward-compatible defaults | PASS | No new column on any existing table, so nothing to default. |
| No committed secrets | PASS | Signed URLs are minted with the caller's own JWT. No service-role key is introduced. |
| Unit tests in `src/__tests__/` | PASS | `paymentState.test.ts` lands there. |
| Playwright isolated & seed-backed | PASS | `payment-receipts.spec.ts` follows the existing `payment-settings.spec.ts` pattern. |
| Browser assertion for new user-facing flows | PASS | The flow spans auth, upload and realtime — exactly the case the rule names. |
| Preserve existing visual language | PASS | The upload action renders inside the existing banner; the admin row keeps its current toggle shape, gaining a third state and a link. |
| Shared logic in hooks/lib | PASS | Drives two of the design decisions: `derivePaymentState` is a lib helper rather than three local ternaries, and `resizeImageFile` is **extracted** from `ProfileView.tsx` rather than copied. |

### Post-design re-evaluation (after Phase 1)

Re-checked against `research.md`, `data-model.md` and `contracts/`. **All gates still PASS.** Three points worth recording:

- **Principle II strengthened by the design.** Deriving payment state rather than storing it means there is no second value that can drift from `paid`. The constitution asks for session data to be the source of truth; the derivation makes that structurally true rather than a convention to maintain.
- **Principle IV strengthened.** Because `get_session_finance` is not touched, "preserve in-progress session continuity" holds trivially — a session mid-flight sees no behaviour change at all until someone uploads a receipt.
- **One constitutional tension surfaced and resolved conservatively.** Principle III (cross-surface consistency) could be read as requiring `AdminRoute`'s role guard to be corrected, since it admits moderators to a screen that migration `067` says they cannot access. This plan deliberately does **not** change it — see Deferred Findings. The feature's own requirement (FR-021) is met at the data layer instead, which is strictly stronger than a route guard.

**No violations. Complexity Tracking section omitted as unnecessary.**

## Project Structure

### Documentation (this feature)

```text
specs/005-payment-receipt-upload/
├── plan.md                              # This file
├── spec.md                              # Feature specification
├── research.md                          # Phase 0 — 9 resolved technical decisions
├── data-model.md                        # Phase 1 — entities, RLS, state machine
├── quickstart.md                        # Phase 1 — developer onboarding
├── contracts/
│   ├── session-receipts-rls.md          # Table + bucket access contract
│   └── payment-state-derivation.md      # The 3-state pure function contract
├── checklists/
│   └── requirements.md                  # Spec quality checklist (16/16)
└── tasks.md                             # Phase 2 — NOT created by /speckit-plan
```

### Source Code (repository root)

```text
badminton-v2/
├── supabase/migrations/
│   ├── 075_create_session_receipts.sql       # NEW  table + indexes + RLS + grants
│   ├── 076_create_receipts_bucket.sql        # NEW  private bucket + storage policies
│   └── 077_session_receipts_realtime.sql     # NEW  publication entry (mirrors 072)
├── src/
│   ├── lib/
│   │   ├── paymentState.ts                   # NEW  derivePaymentState — single source of 3 states
│   │   ├── imageResize.ts                    # NEW  resizeImageFile, extracted from ProfileView
│   │   └── receipts.ts                       # NEW  size/count limits + buildReceiptPath
│   ├── hooks/
│   │   ├── useSessionReceipts.ts             # NEW  player's own receipts: list/upload/delete/sign
│   │   ├── useRoster.ts                      # MOD  +activeReceiptCount, +realtime, +confirmPaid, +removePlayer cleanup
│   │   └── usePlayerSessions.ts              # MOD  +active receipt counts for the 3-state label
│   ├── components/
│   │   ├── ReceiptUploadDialog.tsx           # NEW  combined image picker + note field
│   │   ├── ReceiptViewerDialog.tsx           # NEW  admin viewer: image + note + timestamp
│   │   └── RosterPanel.tsx                   # MOD  3-state row, receipt link, header tally
│   ├── views/
│   │   ├── SessionPlayerDetailView.tsx       # MOD  upload action + thumbnails inside existing banner
│   │   ├── MySessionsView.tsx                # MOD  3-state payment label
│   │   ├── ProfileView.tsx                   # MOD  import moved helper, drop local copy
│   │   └── AdminView.tsx                     # MOD  remove receipt objects before deleting a session
│   ├── types/database.ts                     # MOD  +session_receipts Row/Insert/Update
│   └── __tests__/
│       ├── paymentState.test.ts              # NEW  6-row truth table
│       └── receipts.test.ts                  # NEW  buildReceiptPath segment order
└── tests/
    └── payment-receipts.spec.ts              # NEW  browser assertion of the full loop
```

**Structure Decision**: Single-project SPA layout, already established in `badminton-v2/`. No new top-level directories. Two new files land in `src/lib/` because the constitution's UI and Runtime Rules require shared logic to live in lib utilities rather than being duplicated across views — this is what makes `resizeImageFile` an *extraction* from `ProfileView.tsx:79` rather than a copy, and what keeps the three payment-state renderers reading from one function.

## Implementation Phases

Ordered so each phase is independently verifiable and the risky parts land first.

### Phase A — Foundation (blocking)

Migrations `075`–`077` plus `src/types/database.ts`. Nothing else can run until the schema exists in the dev project.

**Applied via Supabase Dashboard → SQL Editor, not `supabase db push`.** `tasks/lessons.md` records that the Windows CLI binary is permission-blocked and the dev project's migration-history table has malformed rows for versions 037–044 that block a push and resist `migration repair`. Both dev and prod need all three — `071` was previously left half-applied this way.

### Phase B — Pure helpers

`src/lib/paymentState.ts` and `src/lib/imageResize.ts`, with `paymentState.test.ts`. Zero dependencies, fully unit-testable, so this is where TDD starts. The `imageResize` extraction must be a pure move — verify the avatar flow still works before building on it.

### Phase C — Player upload (User Story 1, P1)

`useSessionReceipts`, `ReceiptUploadDialog`, and the banner changes in `SessionPlayerDetailView`. Delivers a standalone slice: receipts get captured and stored even before any admin UI exists.

### Phase D — Admin review (User Story 2, P1)

`useRoster` changes, `RosterPanel` three-state row and receipt link, `ReceiptViewerDialog`. Closes the loop. C and D together are the MVP.

### Phase E — Consistency & lifecycle (FR-020, FR-030, FR-031, FR-033)

`MySessionsView` / `usePlayerSessions` three-state label, receipt cleanup at **both** admin-side deletion paths — `useRoster.removePlayer` and `AdminView.tsx:56` — and verification that legacy registrations still render correctly. Principle III makes this non-optional for completion, not a nice-to-have.

Runs **before** Phases F and G: it establishes the `usePlayerSessions` receipt-count plumbing that Phase G's dismissal filter depends on, and it closes the orphaned-image paths before any deletion feature is layered on top. (`tasks.md` numbers this Phase 5, ahead of the US3/US4 phases, for the same reason.)

### Phase F — Player receipt management (User Story 3, P2)

Add-another and delete-while-unconfirmed.

### Phase G — Dismissal (User Story 4, P3)

Admin dismisses an unusable receipt. Droppable if scope needs trimming; the manual workaround is asking the player to delete and re-upload.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Migrations applied to dev but not prod | **High** — it has happened before (`071`) | Called out in Phase A and in `quickstart.md` with both project refs. Verify against prod before closing the story. |
| `getPublicUrl()` copied from the avatar/QR precedent | Medium | Every upload example in this repo uses a public bucket. Flagged in `quickstart.md` and in the RLS contract. On a private bucket it fails silently with a non-resolving URL rather than throwing. |
| Orphaned storage objects | **High** — one path was missed on the first pass | Fixed ordering rule (storage before row), enforced at all **three** call sites: player deletes own, `useRoster.removePlayer`, and session delete. The roster-removal path is the dangerous one — the cascade fires as a side effect of removing a *player*, so the failure is completely silent. Manual verification of all three in `quickstart.md`. |
| Realtime listener added without the publication entry | Medium | `072`'s header documents this exact silent failure. Migration `077` is a direct mirror. |
| Finance totals shift | Low, high impact | Structurally prevented: `paid` and `get_session_finance` are untouched. `finance-totals.spec.ts` must pass **unmodified** — if it needs editing, the derivation rule was broken. |
| A moderator reaching `/finance` sees receipts | Low | RLS returns zero rows and refuses to sign; component-level role check for a clean empty state. |

## Deferred Findings

Discovered while planning, deliberately **not** addressed here:

**`AdminRoute` admits moderators to admin-only screens.** `src/App.tsx:28` allows both `admin` and `moderator` through to `/finance`, `/players` and `/inventory`, while `067_add_moderator_role.sql` states moderators "cannot access setup/finance/players". The comment describes intent; no guard enforces it.

This feature meets its own requirement (FR-021) at the data layer, which is strictly stronger than a route guard — a moderator sees zero receipt rows regardless of what renders. But the underlying gap is real and predates this work: a moderator can currently view session finances, player records and inventory.

Fixing it here was rejected as scope creep with cross-surface side effects, since it would silently change moderator behaviour across three screens this feature does not otherwise touch. **Recommend a separate spec.** Raised with the requester rather than filed silently.

## Phase 2 Note

Task generation is **not** part of `/speckit-plan`. Run `/speckit-tasks` to produce `tasks.md` from these artifacts.
