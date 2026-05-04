# Phase 9: Inventory Management - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the admin-only shuttle batch inventory UI. Admin can log shuttle purchases (batches), view current stock levels (derived: tubes bought − tubes used), and the list is ordered cheapest-first to guide batch selection during session usage recording. This is a session-independent standalone screen at `/inventory`. Creating matches, recording session usage, and P&L computation are Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Batch Form Fields
- **D-01:** Form captures: brand (text), tube count (integer), cost per tube (decimal), optional notes (text). No purchase date field — auto-timestamp on insert.
- **D-02:** Tube IDs are auto-assigned sequentially by the system (T-1001, T-1002, ...) — admin never types them. Displayed in the batch list for reference only.

### Stock List Display
- **D-03:** Table layout with columns: Tube ID | Brand | Tubes Bought | Stock Remaining | Cost/Tube | Notes.
- **D-04:** Sorted cheapest-first (`ORDER BY cost_per_tube ASC`) — locked from research phase.
- **D-05:** Depleted batches (stock remaining = 0) stay visible in the list with a **Depleted** badge (gray/muted). Nothing hides automatically — full history always visible.

### Batch Deletion
- **D-06:** No deletion. Batches are permanent once added. Stock depletes naturally through usage logging in Phase 10. Preserves audit trail and prevents orphaned `shuttle_usage` FK references.

### Navigation & Access
- **D-07:** `/inventory` is a **top-level tab in TopNavBar**, admin-only (hidden from regular players). Same admin-gate pattern as existing admin views. No secondary access point from Finance tab.

### Claude's Discretion
- Exact Depleted badge color/variant (gray or muted is direction; specific shadcn Badge variant is Claude's call)
- Form validation error message wording
- Empty state copy when no batches have been added yet
- Loading skeleton design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Schema
- `.planning/research/ARCHITECTURE.md` — Schema design for `shuttle_batches` and `shuttle_usage` tables, P&L query patterns, hook designs (`useShuttleBatches`, `useShuttleUsage`, `useSessionFinance`)
- `.planning/research/PITFALLS.md` — 13 domain-specific pitfalls including RLS grant gaps (hit 4× in v1.0), stale `database.ts` type debt, double-insert pattern

### Stack Constraints
- `.planning/research/STACK.md` — Zero new npm dependencies; existing shadcn/ui (Table, Card, Badge, Dialog), React Hook Form, Zod, Supabase client cover all needs
- `.planning/research/FEATURES.md` — 7 table-stakes features for v1.1; anti-features explicitly excluded (no auto-consumption, no player-visible costs)

### Requirements
- `.planning/REQUIREMENTS.md` — INV-01 through INV-05 are the requirements this phase implements

### Existing Code Patterns
- `badminton-v2/src/components/TopNavBar.tsx` — Admin-gated tab pattern to follow for adding Inventory tab
- `badminton-v2/src/hooks/useRoster.ts` — Representative hook pattern (useEffect + useState, Supabase query, typed return)
- `badminton-v2/src/views/AdminView.tsx` — Admin auth pattern (isAdmin check, redirect if not admin)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shadcn/ui` Table, Badge, Card, Dialog, Input, Label, Button — all already installed, cover the entire InventoryView UI
- `React Hook Form` + `Zod` — already in use for form handling; use for Add Batch form validation
- `badminton-v2/src/hooks/useRoster.ts` — template for the new `useShuttleBatches` hook (same useState/useEffect/supabase pattern)
- `badminton-v2/src/components/ui/sonner.tsx` — existing toast for success/error feedback on batch add

### Established Patterns
- **Admin-only gating:** `useAdminSession` hook checks `isAdmin`; redirect to home if false. Follow this for InventoryView.
- **Hook pattern:** `useState` for data + loading + error, `useEffect` with Supabase query, typed return object. All 18 hooks follow this.
- **RLS pattern:** Every new table needs `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... USING (is_admin())` + explicit `GRANT SELECT/INSERT/UPDATE ON TABLE TO authenticated`. Missing GRANT = silent empty results (hit 4× in v1.0).
- **Lazy route loading:** `App.tsx` uses `React.lazy` + `Suspense` for all views — follow same pattern for `InventoryView`.

### Integration Points
- `App.tsx` — Add `/inventory` route with `React.lazy` import of `InventoryView`
- `TopNavBar.tsx` — Add Inventory tab, visible only when `isAdmin === true`
- `badminton-v2/src/types/database.ts` — Types already regenerated in Phase 8; `shuttle_batches` and `shuttle_usage` types are available
- `badminton-v2/supabase/migrations/` — Phase 8 migrations 053–055 established the schema; no new migrations needed for Phase 9

</code_context>

<specifics>
## Specific Ideas

- Tube IDs follow T-1001+ format — auto-generated sequentially, displayed in list for admin reference
- "No deletion" policy was an explicit decision — if admin makes a data entry error on a fresh batch with zero usage, they'll have to live with it or zero out via a correction batch. This was accepted.
- TopNavBar Inventory tab must be invisible to regular players — same gate as the existing Admin tab

</specifics>

<deferred>
## Deferred Ideas

- **Batch editing** — Admin cannot edit a batch once created (price correction, tube count fix). Deferred: add as a follow-up if needed.
- **Low stock alerts** — Notification when a batch drops below threshold. Explicitly deferred to post-v1.1 per research/FEATURES.md.
- **Purchase date backdating** — Admin cannot backdate a batch purchase. Auto-timestamp only. Could be added if real-time logging proves impractical.
- **Finance tab shortcut to /inventory** — Considered and deferred. Single entry point (TopNavBar) keeps it simple.

</deferred>

---

*Phase: 09-inventory-management*
*Context gathered: 2026-05-04*
