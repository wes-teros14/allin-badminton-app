# Implementation Plan: Show Payment Phone Number & QR Code to Registered Players

**Branch**: `003-registration-payment-qr` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-registration-payment-qr/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a single, app-wide payment configuration (phone number + QR code image) that an admin sets via a new settings screen, and surface it to a registered player on their session detail screen whenever their registration for that session is unpaid — replacing the current plain "You're registered!" message. Once an admin marks the registration Paid, the player reverts to seeing the plain confirmation. This follows two conventions already established in this codebase: the `announcements` table's singleton-row + admin-only-write RLS pattern, and the `avatars` bucket's public-read Storage bucket pattern (adapted here to role-based write access instead of per-user path ownership, since this is one shared config, not per-user data).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19

**Primary Dependencies**: react-router 7, @supabase/supabase-js 2, existing `useAuth` role gating (`role === 'admin'`)

**Storage**: Supabase Postgres — new singleton table `payment_settings` (id=1 pattern, mirrors `announcements` from migration 033); new Supabase Storage bucket `payment-qr` (public read, admin-only write, mirrors the `avatars` bucket from migration 069 but with a role-based RLS check instead of per-user path ownership, since this is one shared image, not per-user data)

**Testing**: Vitest (`npm run test:unit`) for the new pure visibility-gating helper (following the `compareSessionsByScheduledDate` precedent from the previous feature); Playwright (`npm run test:e2e`) for the admin-configures → player-sees flow

**Target Platform**: Web — both the admin surface (new settings screen) and the player surface (session detail screen)

**Project Type**: Web application — single frontend (`badminton-v2/`), Supabase as the backend (schema + RLS + Storage, no separate API layer)

**Performance Goals**: N/A — a single-row config fetch and one image load per session-detail view; no measurable perf impact

**Constraints**: Admin-only write access to the config; must degrade gracefully when unconfigured (no empty/broken UI) or when the QR image fails to load; must not alter the existing plain "You're registered!" confirmation for paid players

**Scale/Scope**: One new DB table + one new Storage bucket + one new admin route/nav entry + one modified player-facing component (`SessionPlayerDetailView.tsx`'s registration banner); RegisterView.tsx's separate post-registration screen is explicitly out of scope per spec Assumptions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Single-App Runtime Boundaries** — PASS. All work targets `badminton-v2/` and touches two runtime surfaces: admin (new settings screen) and player (`SessionPlayerDetailView.tsx`). Both are explicitly identified here per the constitution's requirement to name affected surfaces.
- **II. Session Data Is the Source of Truth** — PASS, with obligations. This is genuinely new schema-backed behavior, so it MUST include (and this plan schedules): a Supabase migration (new `payment_settings` table + `payment-qr` storage bucket + RLS), a `badminton-v2/src/types/database.ts` update for the new table, and code-path updates on both the admin (write) and player (read) surfaces. No behavior is derived from a duplicated UI-side constant.
- **III. Cross-Surface Consistency Is Mandatory** — PASS (scoped, explicitly evaluated). The only other place payment status currently surfaces is the existing "Payment: Paid/Unpaid" text label on `MySessionsView.tsx` session cards — that remains an unchanged status label; this feature does not add the interactive phone/QR block there, per the spec's Assumptions (scope is the session detail screen reached by tapping a card, not the list itself). The separate `RegisterView.tsx` post-registration confirmation screen is likewise explicitly out of scope. Both exclusions are conscious, documented decisions, not gaps.
- **IV. Safe Stateful Changes First** — PASS. The migration is purely additive (new table, new bucket, no changes to `sessions`, `matches`, or existing `session_registrations` columns/data). No in-progress session or match state is touched.
- **V. Validation Before Merge** — PLANNED. `npm run lint`, `npm run test:unit` (new unit tests for the extracted visibility-gating helper), and `npm run test:e2e` (new/extended Playwright coverage for admin-configures → player-sees → admin-marks-paid → player-no-longer-sees). Note: this repo's local `.env` (used by Playwright's Node-side Supabase client) was empty during the previous feature's implementation, blocking e2e execution in this environment — flagged here so it isn't a surprise at implementation time.

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-registration-payment-qr/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output — RLS/Storage policy contract (this app has no separate API layer; Supabase table + RLS + bucket policies ARE the interface between admin and player surfaces)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
badminton-v2/
├── supabase/migrations/
│   └── 073_create_payment_settings.sql   # new singleton table + RLS + payment-qr storage bucket + policies
├── src/
│   ├── types/
│   │   └── database.ts                   # add payment_settings Row/Insert/Update types
│   ├── hooks/
│   │   └── usePaymentSettings.ts          # new — reads the singleton row (id=1)
│   ├── views/
│   │   ├── PaymentSettingsView.tsx        # new admin screen — phone number field + QR image upload
│   │   └── SessionPlayerDetailView.tsx    # modify registration banner (~lines 139-176) to show phone/QR when unpaid
│   ├── components/
│   │   └── TopNavBar.tsx                  # add "Payment Settings" admin nav entry
│   └── App.tsx                            # add new admin-gated route, e.g. /payment-settings
└── src/__tests__/
    └── (new) unit test for the extracted visibility-gating helper
```

**Structure Decision**: Single frontend project (`badminton-v2/`), Supabase as backend (no separate API service). New admin route sits as a sibling to the existing `/players`, `/inventory`, `/finance` admin routes inside the same `<AdminRoute>` wrapper in `App.tsx`, and gets a nav entry in `TopNavBar.tsx` following the exact same `show: role === 'admin'` pattern already used there.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
