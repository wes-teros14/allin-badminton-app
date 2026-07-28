# Phase 0 Research: Show Payment Phone Number & QR Code to Registered Players

No `NEEDS CLARIFICATION` markers remain in the Technical Context — the two open questions from the spec (data management approach, visibility rule) were resolved interactively with the user before planning began. Research below documents the technical decisions made while translating those answers into this codebase's existing conventions.

## Decision 1: Data model shape for the payment config

- **Decision**: A singleton table `payment_settings` with a single row (`id = 1`), columns `phone_number TEXT`, `qr_code_url TEXT`, `updated_at`, `updated_by`.
- **Rationale**: The `announcements` table (migration `033_create_announcements.sql`) is an existing, working precedent for "one app-wide config row, admin-only write, all-authenticated read" in this exact codebase — same shape as what FR-007 requires (one shared configuration, not per-session or per-admin). Reusing this pattern means the RLS policies, seed pattern, and read/write code all have a known-good template rather than inventing a new shape.
- **Alternatives considered**: A per-admin-user row keyed by `auth.uid()` — rejected, because the spec (and the user's own phrasing, "my QR code") is explicit that this is one shared config, not per-admin; a key-value `app_settings` table for arbitrary settings — rejected as over-general for two fixed fields with no other settings currently planned.

## Decision 2: QR code image storage

- **Decision**: A new public-read Supabase Storage bucket `payment-qr`, with RLS restricting INSERT/UPDATE/DELETE to users whose `profiles.role = 'admin'`. The image is stored at a fixed path (e.g. `payment-qr/qr-code.png`) with `upsert: true`, since there is only ever one QR image at a time.
- **Rationale**: The `avatars` bucket (migration `069_add_profile_avatars.sql`) is the existing precedent for a public-read image bucket in this app. It restricts writes by folder-per-user (`(storage.foldername(name))[1] = auth.uid()::text`) because avatars are per-user; this feature's image is not per-user, so the write policy instead checks admin role via the same `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')` shape already used in the `announcements` update policy. A fixed upsert path avoids accumulating orphaned old QR images in storage.
- **Alternatives considered**: Storing the QR image as a base64 string directly in the `payment_settings` row — rejected; every other image in this app (avatars) uses Storage + a public URL column, and reusing that pattern keeps CDN caching/URL behavior consistent. A per-upload unique filename (timestamped) — rejected in favor of a fixed upsert path, since there's no requirement to keep QR image history and a fixed path is simpler to reference from the read side.

## Decision 3: Where the admin screen and its route live

- **Decision**: New view `PaymentSettingsView.tsx`, new top-level route (e.g. `/payment-settings`) registered as a sibling to `/players`, `/inventory`, `/finance` inside the existing `<AdminRoute>` wrapper in `App.tsx`, with a new nav tab added to `TopNavBar.tsx` using the identical `{ label, href, active: pathname.startsWith(...), show: role === 'admin', badge: false }` shape already used for those three tabs.
- **Rationale**: `TopNavBar.tsx` already defines the exact list this new entry belongs in — matching its shape means zero new navigation patterns to introduce. The flat top-level route (not nested under `/admin`) matches how `/players`/`/inventory`/`/finance` are already structured, despite `AdminView.tsx` being the "hub" — this app does not nest admin sub-pages under `/admin/*` today.
- **Alternatives considered**: Embedding the payment settings form directly inside `AdminView.tsx` as a section — rejected, since every other distinct admin concern (players, inventory, finance) already gets its own top-level view/route rather than being folded into the `AdminView` session-list dashboard.

## Decision 4: Visibility gating logic and testability

- **Decision**: Extract a small, named, exported pure function (e.g. `shouldShowPaymentInfo({ isRegistered, paid, hasPaymentInfo })`) used inside `SessionPlayerDetailView.tsx`'s registration banner, following the precedent set in the previous feature (`compareSessionsByScheduledDate` in `MySessionsView.tsx`).
- **Rationale**: This repo has an established convention (also seen in `usePlayerSessions.ts`'s `buildRegistrationPaymentMap`) of pulling pure decision logic out of components/hooks into named exported functions specifically so they can be unit tested without rendering a component or mocking Supabase deeply.
- **Alternatives considered**: Inlining the condition directly in JSX — rejected, since FR-004 and FR-005's edge cases (unpaid-but-unconfigured, paid-and-configured, etc.) are exactly the kind of branching logic this repo already prefers to test in isolation.

## Decision 5: Fetching `paid` status on the session detail screen

- **Decision**: Extend the existing registration-status query in `SessionPlayerDetailView.tsx` (currently `supabase.from('session_registrations').select('player_id')...`) to also select `paid`.
- **Rationale**: The `paid` column already exists on `session_registrations` (migration `042_add_paid_to_registrations.sql`) and is already read elsewhere (`usePlayerSessions.ts`) — no new column or migration needed for this part; only the existing query in this one component needs a wider `select()`.
- **Alternatives considered**: Fetching `paid` via a new dedicated hook — rejected as unnecessary; the component already fetches this row for the `isRegistered` check, so widening the same query is the minimal change.

## Summary of resolved unknowns

| Area | Resolution |
|---|---|
| Config shape | Singleton `payment_settings` table (id=1), mirrors `announcements` |
| Image storage | New `payment-qr` public-read bucket, admin-only write, mirrors `avatars` (role-based instead of path-based write policy) |
| Admin surface | New `PaymentSettingsView.tsx` + top-level route + `TopNavBar.tsx` entry, mirrors `/players`/`/inventory`/`/finance` |
| Player surface | Modify `SessionPlayerDetailView.tsx`'s existing registration banner; widen its existing registration query to include `paid` |
| Testability | Extract `shouldShowPaymentInfo(...)` as a pure, exported, unit-tested function |
