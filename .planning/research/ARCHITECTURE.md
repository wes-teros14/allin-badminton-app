# Architecture Research: v1.4 Finance Manual Shuttle Allocation

## Existing Integration Points

- `useSessionFinance.ts` is the current orchestration layer for finance detail fetch, stock computation, and shuttle usage writes
- `FinanceDetailView.tsx` owns the shuttle usage form UI and currently submits a single `totalShuttles` number
- `useShuttleBatches.ts` already computes inventory-facing batch details, including stable `tubeStart`, `tubeEnd`, `shuttlesRemaining`, `costPerTube`, and notes
- `InventoryView.tsx` is the canonical display reference for how batch details are currently presented

## Likely New Or Modified Pieces

Modified:
- `useSessionFinance.ts`
- `FinanceDetailView.tsx`

Potential additions:
- a reusable finance batch picker component
- repo-local `combobox` and related UI primitives in `src/components/ui/`
- shared mapping/helper functions so finance and inventory do not diverge on batch labeling

## Data Flow Recommendation

1. Fetch finance session and available batches as today
2. Build searchable option rows from batch data already computed in hooks
3. In manual mode, store selected batch rows in form state
4. Derive total shuttle usage from the row sum on each change
5. On save, replace existing `shuttle_usage` rows for the session with the explicit manual rows
6. Recompute finance summary from the saved rows the same way auto mode already does

## Suggested Build Order

1. Refactor finance hook types to support both auto and manual allocation input shapes
2. Add reusable batch-label formatting based on inventory data
3. Add searchable multi-select picker and manual allocation row editor in finance UI
4. Extend save logic so auto mode keeps using current rules and manual mode writes explicit rows
5. Add unit tests for allocation validation and browser coverage for both modes

## Dependency Notes

- Manual mode should depend on the existing `shuttle_usage` replacement behavior rather than introducing a second storage model
- If a mode flag is added later, keep it optional and backward-compatible with sessions that only store usage rows
