# Phase 17 Research: Manual Batch Allocation UI

**Date:** 2026-05-25
**Phase:** 17 - Manual Batch Allocation UI
**Status:** Complete

## Scope

Research the safest way to add the manual batch allocation UI on top of the Phase 16 finance mode foundation, while matching existing inventory detail patterns and supporting editable reload of saved manual allocations.

## Current System Findings

### 1. Phase 16 already established the right persistence seam

Relevant files:
- `badminton-v2/src/hooks/useSessionFinance.ts`
- `.planning/phases/16-finance-allocation-mode-foundation/16-CONTEXT.md`
- `badminton-v2/src/views/FinanceDetailView.tsx`

Findings:
- `useSessionFinance` already supports both `auto` and `manual` save input through `saveUsageAllocation`.
- The hook already owns allocation-mode persistence and the full-replacement delete-then-insert save path.
- `FinanceDetailView` already branches UI by `allocationMode`, but manual mode is only a placeholder shell today.

Recommendation:
- Keep manual batch editing on top of the existing `saveUsageAllocation({ allocationMode: 'manual', rows })` seam.
- Avoid inventing a second save contract in the view layer.

### 2. The inventory contract already defines the exact batch identity and display details Phase 17 needs

Relevant files:
- `badminton-v2/src/hooks/useShuttleBatches.ts`
- `badminton-v2/src/views/InventoryView.tsx`
- `badminton-v2/src/hooks/useSessionFinance.ts`

Findings:
- Inventory already defines stable tube numbering, remaining-stock math, brand, cost-per-tube, and notes.
- `InventoryView` shows the exact detail set the user requested for the picker: tube ID, brand, shuttles remaining, cost per tube, and notes.
- `useSessionFinance` already computes `tubeStart` and `shuttlesRemaining` for finance allocation batches, but its saved `usageAllocations` payload is still too sparse for a full manual editor.

Recommendation:
- Extend the finance hook's batch/allocation view models so manual mode can render inventory-style details without duplicating inventory logic in the view.
- Keep batch ordering and identity aligned with the current `compareAllocationOrder` / `compareBatchIdentity` rules.

### 3. The repo has the dialog primitive but not a prebuilt combobox or alert-dialog flow

Relevant files:
- `badminton-v2/src/components/ui/dialog.tsx`
- `badminton-v2/src/views/InventoryView.tsx`
- `badminton-v2/src/components/ui/`

Findings:
- The shared UI primitives checked into the repo currently include `dialog`, `table`, `input`, `button`, `card`, `label`, and `badge`.
- There is no checked-in `alert-dialog`, `popover`, `command`, `sheet`, or combobox primitive to lean on.
- `InventoryView` already demonstrates the app's current dialog usage pattern.

Recommendation:
- Build the picker as a plain dialog with a normal text input and a filtered results list or table.
- Do not plan around a command palette / combobox abstraction that the repo does not currently provide.

### 4. The app already uses lightweight live filtering and lightweight confirmation patterns

Relevant files:
- `badminton-v2/src/components/RosterPanel.tsx`
- `badminton-v2/src/views/InventoryView.tsx`

Findings:
- `RosterPanel` uses a simple controlled text input with `includes()` filtering for live search.
- The repo does not show a modal confirmation pattern for small destructive actions; `RosterPanel` instead uses an inline two-step `Remove` -> `Sure?` confirmation state.
- This lightweight pattern fits the user's requirement for row removal confirmation without requiring a new modal component.

Recommendation:
- Use controlled local state and simple case-insensitive `includes()` filtering for brand search.
- Prefer an inline row-level confirmation state for removing a selected batch instead of introducing a new confirmation dialog dependency.

### 5. Cheapest-first default suggestions fit existing data ordering with minimal extra logic

Relevant files:
- `badminton-v2/src/hooks/useSessionFinance.ts`
- `badminton-v2/src/hooks/useShuttleBatches.ts`

Findings:
- Finance allocation batches already arrive ordered by `cost_per_tube`, then creation time, then id.
- This aligns with the user's request that empty-search suggestions default to cheapest-first.
- No special ranking algorithm is needed; the existing batch ordering can power the default suggestion list.

Recommendation:
- Reuse the hook's cheapest-first batch ordering as the default empty-search suggestion order.
- Apply brand filtering on top of that stable ordered list rather than re-sorting after every keystroke.

### 6. Reload-and-edit behavior needs an editable draft model, not direct mutation of saved rows

Relevant files:
- `badminton-v2/src/hooks/useSessionFinance.ts`
- `badminton-v2/src/views/FinanceDetailView.tsx`

Findings:
- Saved `usageAllocations` are display-oriented today, not an editable draft model with row-local UI state.
- The user wants reopening a saved manual allocation to restore the rows directly into the live editable state, with no distinction between old and new rows.
- Selected rows must keep add order, which means the UI needs its own draft ordering rather than constantly re-sorting from backend data.

Recommendation:
- Introduce a local manual draft row model in the finance UI, seeded from saved manual allocations when the page loads or when manual mode is re-entered.
- Keep the add order in the draft state; only the picker suggestions stay cheapest-first.

### 7. Phase 17 should keep validation shallow because Phase 18 owns the blocking rules

Relevant files:
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/phases/17-manual-batch-allocation-ui/17-CONTEXT.md`

Findings:
- Phase 17 requirements focus on search, selection, display detail, count entry, total auto-calculation, and reload/editing.
- The stricter blocking rules for duplicate selection, empty save, invalid counts, and stock overflow are explicitly assigned to Phase 18.

Recommendation:
- Phase 17 should still avoid obviously broken UI states where easy, but the plans should not overreach into full save-blocking validation logic that belongs in the next phase.

## Recommended Implementation Shape

### Finance hook/data layer

Recommended additions:
- extend finance-side batch metadata to include `notes` and a stable tube identifier on both available picker rows and saved manual allocations
- expose a finance-friendly available-batch list for the picker, already ordered cheapest-first
- preserve the existing manual save contract and add helper coverage for manual row shaping

Why:
- keeps the finance page thin
- prevents duplication of inventory-specific data massaging in the UI
- gives the picker and reload/edit flow one canonical data source

### Picker UI

Recommended shape:
- a dedicated `ManualBatchPickerDialog` component
- controlled `search` input
- case-insensitive brand `includes()` filtering
- empty search shows cheapest-first suggestions
- each result row includes full inventory-style details and a one-tap `Add` action

Why:
- matches the user's choices exactly
- fits the repo's current primitive set
- keeps the search-heavy UI separate from the finance card

### Selected-row editor

Recommended shape:
- an inline manual allocation table in `FinanceDetailView` or a dedicated child component
- rows keep add order
- each row shows full batch details plus a shuttle-count input
- totals recalculate immediately from draft row counts
- each row uses inline two-step confirmation for removal

Why:
- keeps the finance page focused on the current editable allocation
- avoids introducing extra modal complexity for every remove action
- aligns with the repo's existing lightweight interaction style

## Risks And Mitigations

### Risk: view-level duplication of batch metadata logic

Cause:
- both the picker and the saved manual rows need the same inventory-style batch details

Mitigation:
- enrich the hook contract first
- keep the view focused on draft/edit state and rendering only

### Risk: accidental overlap with Phase 18 validation scope

Cause:
- manual editor work can easily drift into full duplicate/stock/error enforcement

Mitigation:
- keep Phase 17 focused on construction, editing, and reload
- defer blocking validation rules and regression coverage to Phase 18

### Risk: remove confirmation introduces heavy new UI infrastructure

Cause:
- using a new alert-dialog pattern would require adding new primitives or patterns first

Mitigation:
- reuse the repo's existing lightweight inline confirmation approach

## Planning Implications

The phase should split into:

1. Finance hook and draft-data foundation
   - enrich available batch metadata and saved allocation row data
   - keep manual save contract stable
   - add helper-focused unit coverage

2. Picker dialog component
   - dialog shell
   - live brand search
   - cheapest-first default suggestions
   - one-tap add with inventory-style details

3. Finance-page integration
   - selected allocation table
   - live total updates
   - row removal confirmation
   - save/reload behavior for manual mode

## Recommendation Summary

- Use the existing finance hook as the save boundary; do not add a second manual-save path.
- Reuse inventory-derived batch identity and details directly in finance.
- Build the picker with plain dialog + input + filtered results, not a missing combobox abstraction.
- Use local editable draft state in manual mode so saved rows reopen directly and preserve add order.
- Keep Phase 17 focused on the UI flow and defer blocking validation rules to Phase 18.

## RESEARCH COMPLETE
