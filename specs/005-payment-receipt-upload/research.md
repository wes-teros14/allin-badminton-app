# Phase 0 Research: Payment Receipt Upload & Admin Receipt Review

**Feature**: `005-payment-receipt-upload` | **Date**: 2026-08-27

The spec carried no `[NEEDS CLARIFICATION]` markers, so this phase resolves technical unknowns rather than product ones. Each decision below was checked against code already in the repository, and the precedent is cited so the implementation does not invent a second way of doing something the codebase already does.

---

## R1. How the three payment states are represented

**Decision**: Derive the state in a pure helper. Do **not** add a status column.

```
derivePaymentState({ paid, activeReceiptCount }):
  paid === true            -> 'paid'       (green)
  activeReceiptCount > 0   -> 'submitted'  (orange)
  otherwise                -> 'unpaid'     (red)
```

`session_registrations.paid` (migration `042`, `BOOLEAN NOT NULL DEFAULT false`) keeps its exact current meaning: payment confirmed by an administrator.

**Rationale**: `074_add_status_to_get_session_finance.sql:53` computes revenue as
`COUNT(*) FILTER (WHERE sr.paid)` multiplied by session price. Any new stored status column becomes a second thing that can disagree with `paid`, and the disagreement would surface as wrong money. Deriving the middle state means `get_session_finance` needs no edit at all, revenue arithmetic is untouched by construction, and the SC-002 finance reconciliation E2E test keeps passing without being modified — which is exactly the evidence FR-034 and SC-004 demand. It also satisfies FR-033 for free: every pre-existing registration has zero receipts, so it derives to `unpaid` or `paid` exactly as today.

**Alternatives considered**:

- *Add `payment_status TEXT` to `session_registrations`* — rejected. Requires backfill, requires updating `get_session_finance` to filter on the new column, puts the finance test at risk, and creates the drift problem above.
- *Widen `paid` to a nullable tri-state (`NULL`/`false`/`true`)* — rejected. `paid` is `NOT NULL`; changing that is a destructive schema change forbidden by the constitution's additive-first rule, and `COUNT(*) FILTER (WHERE sr.paid)` would silently change behaviour for `NULL`.

---

## R2. Private storage bucket and signed URLs

**Decision**: New bucket `receipts` with `public = false`. Read access via `createSignedUrl()` with a short expiry, generated on demand from the browser using the signed-in user's own token.

**Rationale**: `createSignedUrl` is authorised by the caller's JWT against the `storage.objects` SELECT policy. Because the policy grants a player their own path and grants administrators everything, signed URLs can be minted client-side with no service-role key — which matters, since the constitution forbids committing service-role credentials and this app has no server component to hold one. The existing buckets (`avatars` in `069`, `payment-qr` in `073`) are both `public = true`; this is the first private one, so the plan must not copy their `getPublicUrl()` call, which returns an address that resolves for anyone on a public bucket and returns nothing useful on a private one.

**Expiry**: 60 seconds, minted at the moment of viewing. Long enough to load an image over court WiFi, short enough that a leaked address in a browser history or a screen-share is inert. This satisfies FR-028 and the third case of SC-005.

**Alternatives considered**:

- *Public bucket with an unguessable UUID path* — rejected by the requester during specification. Financial screenshots would be permanently readable by anyone who ever obtained the URL.
- *Long-lived signed URLs cached in the database* — rejected. Storing an access token in a table re-creates the leak it was meant to prevent, and the URL would outlive the receipt's deletion.

---

## R3. Storage path layout

**Decision**: `{player_id}/{session_id}/{receipt_id}.jpg`

**Rationale**: Putting `player_id` first preserves the ownership idiom already established in `069_add_profile_avatars.sql` — `(storage.foldername(name))[1] = auth.uid()::text` — so the RLS policy reads the same way as the one reviewers already know. Bulk cleanup does not depend on this layout because `session_receipts.storage_path` records the exact path for every object, so deleting all of a session's images is a query for its rows followed by one `remove()` call, never a directory listing.

**Alternatives considered**:

- *`{session_id}/{player_id}/...`* — rejected. It would force the ownership check onto path segment `[2]`, diverging from the established pattern for no gain.

---

## R4. Preventing orphaned images

**Decision**: Delete storage objects **before** deleting rows, everywhere a registration or receipt can disappear, and abort if the storage delete fails.

**Three** call sites:

1. Player removes one receipt — remove the object, then the row.
2. Administrator removes a player from the roster (`src/hooks/useRoster.ts:122`, `removePlayer`) — query that registration's receipt paths, remove the objects, then delete the registration and let the `registration_id` cascade take the rows.
3. Administrator deletes a session (`src/views/AdminView.tsx:56`) — query that session's receipt paths, remove the objects, then let the existing `sessions` delete cascade take the rows.

**Rationale**: The database cascade removes `session_receipts` rows but has no reach into `storage.objects`, so a naive cascade leaves images that are unreachable through the app yet still stored — failing FR-030, FR-031 and SC-006. Ordering storage first means a failure aborts with the row still present and the receipt still visible, which is recoverable; the reverse order would drop the only record of the path and strand the image permanently.

**Site 2 was missed on the first pass** and caught by `/speckit-analyze`. It is the least obvious of the three because nobody in that flow is thinking about receipts — the administrator is removing a *player*, and the `registration_id` cascade disposes of the receipt rows as a silent side effect. It is also the most damaging to miss: no error, no failing test, and the spec's own edge case ("Player removed from the roster after uploading") names the scenario. Recorded here so the count is not re-derived as two.

**Alternatives considered**:

- *Database trigger deleting from `storage.objects`* — rejected. Writing to the storage schema from a trigger bypasses Storage's own bookkeeping and is unsupported; the physical object would survive anyway.
- *Scheduled orphan sweeper* — rejected as disproportionate. Roughly 16 receipts per session makes a background job more machinery than the problem justifies.

---

## R5. Image resizing — extract the existing helper

**Decision**: Move `resizeImageFile` out of `src/views/ProfileView.tsx:79` into `src/lib/imageResize.ts` unchanged, and have both the avatar flow and the receipt flow import it.

**Rationale**: The function is already written, already proven on this codebase's target devices, and already does exactly what FR-006 needs — `createImageBitmap`, canvas draw, then a JPEG quality ladder from 0.92 down in six steps until it fits the byte ceiling. The constitution's UI and Runtime Rules require shared logic to live in a lib utility rather than being duplicated across views, so copying it into a second view would be a direct violation. Extracting it also makes it unit-testable for the first time.

**Receipt-specific limits**: `MAX_DIM = 1600`, `MAX_BYTES = 800 KB`, `MAX_INPUT_BYTES = 20 MB`. The dimension is raised above the avatar's 1024 because a receipt must stay legible enough to read an amount and a reference number (FR-006), whereas an avatar only has to look right at 72 px.

**Note**: `createImageBitmap` honours EXIF orientation in the browsers this app targets, which covers the rotated-photo edge case without extra work.

**Alternatives considered**:

- *Copy the function into the receipt component* — rejected, see above.
- *Upload the original untouched* — rejected. A modern phone screenshot regularly exceeds several megabytes and would fail SC-001's 30-second budget on mobile data.

---

## R6. Keeping the admin panel live when a receipt arrives

**Decision**: Add `session_receipts` to the `supabase_realtime` publication with `REPLICA IDENTITY FULL`, following `072_session_registrations_realtime.sql` exactly. Extend the existing `roster:{sessionId}` channel in `src/hooks/useRoster.ts` with a second `postgres_changes` listener for the new table.

**Rationale**: `useRoster` already opens a channel per session and already re-fetches on `session_registrations` changes; adding a listener there is a few lines and reuses the subscription the admin panel depends on. Migration `072` documents the exact failure this avoids: a table subscribed to but never added to the publication broadcasts nothing, and the bug presents as "works only after a full page refresh". Realtime applies RLS, and the administrator's SELECT policy covers every row, so administrators receive the events while players do not receive each other's.

**Alternatives considered**:

- *Polling the receipt count* — rejected. Wasteful and inconsistent with how every other live surface in this app behaves.
- *A separate channel for receipts* — rejected. A second channel per session for one extra table, when a channel already exists and already triggers the same re-fetch.

---

## R7. Enforcing administrator-only access despite the route guard

**Decision**: Enforce in RLS as the primary control; add a component-level `role === 'admin'` check as defence in depth.

**Rationale**: `AdminRoute` in `src/App.tsx:28` admits both `admin` and `moderator`, so a moderator can reach `/finance` and would render the payment panel. The comment in `067_add_moderator_role.sql` says moderators "cannot access setup/finance/players", but that is a statement of intent, not an enforced guard. Since the requester settled on administrator-only receipt visibility, FR-021 requires the restriction to hold at the data layer: a moderator's SELECT on `session_receipts` returns zero rows and their `createSignedUrl` call is refused, so even if the panel rendered, no receipt could be disclosed. The component check exists so a moderator sees a clean absence rather than an empty, broken-looking panel.

**Explicitly not in scope**: tightening `AdminRoute` itself. That is a pre-existing access-control question affecting Finance, Players and Inventory alike, and changing it here would silently alter moderator behaviour well beyond this feature.

**Alternatives considered**:

- *Rely on the route guard alone* — rejected; it does not implement the requirement.
- *Fix `AdminRoute` as part of this feature* — rejected as scope creep with cross-surface side effects. Flagged separately for the requester.

---

## R8. Enforcing the write rules server-side

**Decision**: Express every rule in the spec as an RLS predicate, not only as a UI condition.

| Rule | Enforcement |
|------|-------------|
| A player may only attach to their own registration (FR-015) | INSERT policy: `player_id = auth.uid()` |
| No attaching once confirmed paid (US3 scenario 4, edge case) | INSERT policy also requires the parent registration's `paid = false` |
| A player may only remove their own, and only while unconfirmed (FR-014) | DELETE policy: own row **and** parent `paid = false` |
| Only an administrator may dismiss (FR-027) | UPDATE policy restricted to the admin role |
| Administrators never delete receipt *rows* directly (FR-032) | No admin DELETE policy on the table — rows go only by cascade. The admin DELETE policy on the *bucket* is required, since call sites 2 and 3 have an administrator removing another player's image files |
| Receipt-count ceiling (FR-007) | Checked in the client before upload; the ceiling is a courtesy limit, not a security boundary |

**Rationale**: The client already holds an authenticated Supabase key, so any UI-only rule is advisory. The "already confirmed" race in the edge-case list — a player holding a stale form while the administrator confirms — is only actually closed by the INSERT policy consulting the parent registration's current `paid` value at write time.

**Alternatives considered**:

- *UI-only checks* — rejected; leaves every rule bypassable.
- *Enforcing the count ceiling in RLS too* — rejected as poor value. It needs a subquery counting sibling rows on every insert, to protect against a user who can at worst store a few extra of their own images.

---

## R9. Where receipt counts are read from

**Decision**: One aggregate fetch per surface, joined in memory alongside the existing roster/session fetches.

- `useRoster` (admin) — fetch `session_receipts` for the session, group by `player_id`, merge into each `RosterPlayer`.
- `SessionPlayerDetailView` (player) — fetch the signed-in user's own receipts for the session.
- `usePlayerSessions` (sessions list) — fetch the user's active receipt counts across the listed sessions, so FR-020 holds on that surface too.

**Rationale**: Every one of these hooks already issues a small batch of parallel queries and merges the results in memory (`useRoster.ts:47-95` is the pattern). Following it keeps the code recognisable. A database view or an RPC would be a new mechanism for something three plain selects already answer.

**Alternatives considered**:

- *A `receipt_count` column maintained by trigger* — rejected. Denormalised state that can drift, for a table with roughly 16 rows per session.
- *Extending `get_session_finance` to return counts* — rejected. That function's output feeds money calculations; adding presentation data to it widens the blast radius of the one thing SC-004 promises not to disturb.

---

## Summary of resolved unknowns

| # | Unknown | Resolution |
|---|---------|-----------|
| R1 | Representing three states without disturbing revenue | Derived helper; `paid` untouched |
| R2 | Private receipt access | Private bucket, 60-second client-minted signed URLs |
| R3 | Path layout | `{player_id}/{session_id}/{receipt_id}.jpg` |
| R4 | Orphaned images | Storage deleted before rows, at all **three** call sites |
| R5 | Image compression | Extract existing `resizeImageFile` to `src/lib/imageResize.ts` |
| R6 | Live admin panel | Publication entry + listener on the existing roster channel |
| R7 | Admin-only despite a permissive route guard | RLS primary, component check secondary |
| R8 | Write rules | RLS predicates, including the confirmed-payment race |
| R9 | Receipt counts | In-memory merge, matching the existing hook pattern |

**No unresolved `NEEDS CLARIFICATION` items remain.** Phase 1 may proceed.
