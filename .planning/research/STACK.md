# Stack Research: v1.4 Finance Manual Shuttle Allocation

## Existing Stack

- React 19, TypeScript, Vite, Tailwind CSS v4, React Hook Form, Zod
- `@base-ui/react` and `shadcn` are already installed in `package.json`
- Finance currently uses `useSessionFinance.ts` plus `FinanceDetailView.tsx`
- Inventory already exposes stable batch identity details through `useShuttleBatches.ts` and `InventoryView.tsx`

## Stack Additions

No new runtime package is required.

The likely code additions are repo-local UI primitives or copied components:
- add a combobox/search picker component from the current shadcn stack if the repo does not already contain one
- add any supporting overlay/input primitives needed by that picker in `src/components/ui/`

Research basis:
- shadcn/ui documents a `Combobox` with multi-select, chips, custom items, invalid state, and popup trigger patterns
- WAI-ARIA APG treats combobox as the correct pattern for searchable suggestion pickers with keyboard navigation
- React Hook Form remains the existing form layer and is suitable for dynamic per-batch rows

## Database Implications

The current tables can likely support this milestone without a schema change:
- `shuttle_batches` already provides brand, remaining stock inputs, cost per tube, and stable display ordering inputs
- `shuttle_usage` already stores per-session per-batch `shuttles_used`

The open decision is write-path shape:
- if manual mode only changes how rows are chosen before saving, existing `shuttle_usage` rows are sufficient
- if the product needs to remember whether a saved allocation was auto or manual, add an explicit mode field on the finance/session side

Inference: manual mode can ship without a migration if preserving mode after save is not a reporting requirement.

## TypeScript Implications

`useSessionFinance.ts` currently exposes only `logUsage(totalShuttles)`.
This milestone likely needs:
- a persisted allocation input shape for manual rows
- a view model for searchable batch options that includes inventory detail fields
- explicit validation results for duplicate selection, stock overflow, and empty manual state

## What Not To Add

- No separate backend server
- No ad hoc custom autocomplete that bypasses accessible combobox behavior if the shadcn/Base UI path is available
- No duplicated batch-detail logic between inventory and finance if the same mapping can be reused
