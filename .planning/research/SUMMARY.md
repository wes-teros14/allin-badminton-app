# Research Summary: v1.4 Finance Manual Shuttle Allocation

## Recommendation

Add an explicit auto/manual allocation switch in session finance. Keep the existing automatic allocation path untouched. In manual mode, use a searchable combobox-based batch picker that reuses inventory-style batch labels and writes explicit `shuttle_usage` rows from per-batch shuttle counts.

## Stack Additions

- No new npm dependency is required based on the current `package.json`
- The repo likely needs local shadcn/Base UI combobox primitives added under `src/components/ui/`
- React Hook Form remains the right fit for dynamic manual allocation rows

## Table Stakes

- Auto mode is behavior-identical to today
- Manual mode supports multi-batch selection by brand
- Each selected batch accepts an exact shuttle count
- Total shuttle usage is derived from selected rows only
- Manual entries cannot exceed available stock

## Best UX Direction

- Make batch search feel like the app's existing searchable picker patterns, not a plain select
- Show the same distinguishing batch details already trusted in inventory: tube ID/range, brand, shuttles left, cost, notes
- Prevent duplicate batch selection in the picker rather than only erroring later

## Watch Out For

- Do not let manual-mode UI changes leak into the current automatic rule path
- Do not create a new finance "completion gate" based on a required shuttle total
- Prefill and edit existing saved usage rows correctly so updates do not accidentally wipe allocations

## Suggested Phase Shape

1. Finance data model and save-path refactor for manual allocations without breaking auto mode
2. Manual allocation UI with searchable batch picker and inventory-style detail rendering
3. Validation and regression coverage across auto mode, manual mode, and saved-edit flows
