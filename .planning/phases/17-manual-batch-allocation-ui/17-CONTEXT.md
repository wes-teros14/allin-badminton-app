# Phase 17: Manual Batch Allocation UI - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds the manual batch allocation UI on the session finance page. In manual mode, the QM can open a batch picker dialog, search inventory batches by brand, add multiple batches into an editable allocation table, enter per-batch shuttle counts, see the total update automatically, and reopen saved manual allocations for direct editing. This phase does not add stock-safe validation rules beyond basic UI flow, and it does not change the existing auto allocation behavior.

</domain>

<decisions>
## Implementation Decisions

### Picker Surface
- **D-01:** Manual batch search happens in a picker dialog opened from the finance page, not inline on the finance card.
- **D-02:** Inside the picker dialog, search results support one-tap add. Adding a batch immediately inserts it into the manual allocation table on the finance page.
- **D-03:** Search results must show full inventory-style batch details: tube ID, brand, shuttles remaining, cost per tube, and notes when present.

### Search And Result Presentation
- **D-04:** Brand search filters results live while the QM types.
- **D-05:** Brand matching uses a case-insensitive contains match rather than exact or starts-with only.
- **D-06:** When the search field is empty, the dialog shows default suggestions instead of a blank state or the full inventory list.
- **D-07:** Default suggestions are ordered cheapest first.

### Selected Allocation Rows
- **D-08:** Selected batches appear on the finance page as an editable table rather than cards or a compact list.
- **D-09:** Selected rows keep the order the QM added them; they do not auto-sort to inventory order or cheapest-first order.
- **D-10:** Total logged shuttles recalculates immediately as row counts change.
- **D-11:** Each row includes a remove action, and removal requires confirmation before the row is deleted.

### Reopening Saved Manual Allocations
- **D-12:** When reopening a session with saved manual allocation rows, manual mode shows the prefilled editable table first.
- **D-13:** Saved manual rows are restored directly as the current editable manual state.
- **D-14:** Previously saved rows and newly added rows are not visually distinguished; the table behaves as one current editable allocation state.

### the agent's Discretion
- Exact dialog layout, sizing, and responsive behavior, as long as it remains a dialog-based picker and preserves full inventory-style details.
- Exact visual treatment of the cheapest-first default suggestions when the search box is empty.
- Exact confirmation UI for removing a selected row, as long as removal is not immediate without confirmation.
- Exact empty states and helper copy, as long as they stay within the Phase 17 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Scope
- `.planning/ROADMAP.md` - Phase 17 goal, dependencies, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` - `MAN-01` through `MAN-06` plus the out-of-scope guardrails for the manual picker.
- `.planning/PROJECT.md` - Milestone goal, locked product constraints, and Phase 16 finance allocation decisions.
- `.planning/STATE.md` - Current milestone position and environment constraints relevant to planning.

### Prior Phase Foundation
- `.planning/phases/16-finance-allocation-mode-foundation/16-CONTEXT.md` - Locked mode semantics, save semantics, compatibility fallback, and the rule that switching modes does not preserve a hidden draft.

### Finance UI And Save Flow
- `badminton-v2/src/views/FinanceDetailView.tsx` - Current finance page, manual-mode placeholder, allocation display table, and the seam where the manual picker UI must connect.
- `badminton-v2/src/hooks/useSessionFinance.ts` - Existing finance read/write flow, manual save input types, allocation row shape, stock-derived batch mapping, and mode-aware save entry points.
- `badminton-v2/src/__tests__/useSessionFinance.test.ts` - Existing finance hook coverage that constrains backward compatibility expectations.

### Inventory Batch Identity And Display
- `badminton-v2/src/views/InventoryView.tsx` - Inventory-style batch table details, dialog usage pattern, and the exact fields the manual picker should mirror.
- `badminton-v2/src/hooks/useShuttleBatches.ts` - Batch identity, tube numbering, remaining-stock calculation, and inventory ordering/display patterns.
- `badminton-v2/supabase/migrations/053_create_shuttle_batches.sql` - Base batch schema used by inventory and finance allocation.
- `badminton-v2/supabase/migrations/054_create_shuttle_usage.sql` - Persisted allocation row contract per `(session_id, batch_id)`.
- `badminton-v2/supabase/migrations/061_add_shuttles_per_tube_to_shuttle_batches.sql` - Current partial-tube stock model used for remaining shuttle counts.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSessionFinance` in `badminton-v2/src/hooks/useSessionFinance.ts`: already exposes `allocationMode`, `usageAllocations`, `saveUsageAllocation`, and batch availability data for the manual flow.
- `UsageAllocation` and `ManualUsageInput` in `badminton-v2/src/hooks/useSessionFinance.ts`: existing TypeScript contracts that the manual UI should build on rather than duplicating.
- Inventory table and dialog primitives in `badminton-v2/src/views/InventoryView.tsx`: the current app pattern for showing batch details and using a dialog in this domain.
- `Dialog`, `Table`, `Button`, `Input`, and related shadcn/ui primitives already used in `FinanceDetailView.tsx` and `InventoryView.tsx`.

### Established Patterns
- Finance view logic stays route-level in `FinanceDetailView.tsx`, with Supabase reads/writes encapsulated inside `useSessionFinance`.
- Inventory batch identity is derived from stable tube numbering and existing stock calculations; the manual picker should reuse those rules instead of inventing a separate identity model.
- The app uses lightweight toast feedback and inline form errors rather than heavy wizard flows.
- Auto mode behavior must remain unchanged while manual mode gets richer UI.

### Integration Points
- The manual-mode placeholder block in `badminton-v2/src/views/FinanceDetailView.tsx` is the immediate insertion point for the picker trigger, selected allocation table, and total display updates.
- `saveUsageAllocation` in `badminton-v2/src/hooks/useSessionFinance.ts` is the main write seam for saving manual rows.
- Existing `usageAllocations` readback in `useSessionFinance` is the seam for restoring saved manual rows into the editable table.

</code_context>

<specifics>
## Specific Ideas

- The finance page should stay focused on the current manual allocation table and totals, while the search-heavy workflow lives in the picker dialog.
- The picker dialog should feel inventory-native by showing the same identifying details the QM already uses in the inventory page.
- Reopening saved manual allocations should feel like reopening a draft form, not reviewing history first.

</specifics>

<deferred>
## Deferred Ideas

- Validation for duplicate batch selection, empty manual allocation, invalid counts, and stock-overflow belongs to Phase 18.
- Any search filters beyond brand remain out of scope for this milestone.
- Change-tracking visuals between previously saved rows and newly added rows are not needed in this phase.

</deferred>

---

*Phase: 17-manual-batch-allocation-ui*
*Context gathered: 2026-05-25*
