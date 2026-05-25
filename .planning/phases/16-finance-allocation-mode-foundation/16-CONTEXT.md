# Phase 16: Finance Allocation Mode Foundation - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds the data contract and save-path foundation for explicit finance allocation modes while preserving the current automatic shuttle allocation behavior unchanged by default. It covers how finance records represent `auto` versus `manual`, how saves replace prior allocation rows, and how older finance records remain readable and editable without migration work. It does not add the manual batch picker or per-batch editing UI yet.

</domain>

<decisions>
## Implementation Decisions

### Mode Persistence
- **D-01:** Finance allocation mode must be stored explicitly on the finance record as `auto` or `manual`.
- **D-02:** The mode must not be inferred from `shuttle_usage` rows, because auto allocation can also produce multiple per-batch rows.

### Save Semantics
- **D-03:** Saving shuttle usage for a session is a full replacement operation.
- **D-04:** On each save, the session's previous allocation rows are cleared and replaced with the newly submitted allocation rows for the active mode.

### Compatibility Fallback
- **D-05:** Older finance records with no saved allocation mode must load as `auto` by default.
- **D-06:** No migration is required for existing finance records; current saved auto allocations remain readable and editable.

### Mode Switching
- **D-07:** A finance record has exactly one active allocation mode at a time.
- **D-08:** Switching modes does not preserve a hidden draft from the other mode. The next save in the selected mode becomes the single source of truth and replaces the prior allocation rows.

### the agent's Discretion
- The exact schema shape for the explicit finance mode field is left to planning, as long as it is stored with the finance record rather than inferred from allocation rows.
- The exact API shape for the save handler can change, as long as it preserves full-replacement semantics and keeps auto mode behavior unchanged.
- The precise read-path fallback for "missing mode means auto" can be implemented in SQL, typed mapping code, or hook-level normalization.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Scope
- `.planning/ROADMAP.md` - Phase 16 goal, requirements, and success criteria for the finance allocation mode foundation.
- `.planning/REQUIREMENTS.md` - `FIN-01`, `FIN-02`, `FIN-03`, and `COMP-02`, plus out-of-scope boundaries for this milestone.
- `.planning/PROJECT.md` - Milestone goal, product constraints, and already-locked finance decisions.
- `.planning/STATE.md` - Current milestone status and the Windows/Supabase migration constraint.

### Existing Finance Contract
- `badminton-v2/src/hooks/useSessionFinance.ts` - Current finance read/write flow, cheapest-first auto allocation, and the existing delete-then-insert save behavior that Phase 16 must preserve for auto mode.
- `badminton-v2/src/views/FinanceDetailView.tsx` - Current finance page behavior, total-shuttles auto entry flow, and allocation display surface that must keep working for auto mode.
- `badminton-v2/supabase/migrations/054_create_shuttle_usage.sql` - Defines one allocation row per `(session_id, batch_id)` and the admin-only write contract for usage rows.
- `badminton-v2/supabase/migrations/058_create_get_session_finance.sql` - Original SQL finance summary contract showing shuttle totals/costs derived from `shuttle_usage`.
- `badminton-v2/supabase/migrations/060_update_get_session_finance_for_personal_share.sql` - Current `get_session_finance` contract used by the app today; this is the real RPC shape Phase 16 must extend safely.

### Inventory And Batch Identity
- `badminton-v2/src/hooks/useShuttleBatches.ts` - Existing inventory batch mapping, remaining-stock calculation, and tube numbering rules that Phase 17 manual allocation will build on.
- `badminton-v2/src/views/InventoryView.tsx` - Inventory-style batch details and interaction patterns the later manual picker should stay aligned with.
- `badminton-v2/supabase/migrations/053_create_shuttle_batches.sql` - Base inventory batch schema used by finance allocation.
- `badminton-v2/supabase/migrations/061_add_shuttles_per_tube_to_shuttle_batches.sql` - Current stock model for partial tubes and per-batch remaining shuttle counts.

### Existing Coverage
- `badminton-v2/src/__tests__/useSessionFinance.test.ts` - Existing tests around auto allocation ordering, stock exclusion, and helper behavior that should stay valid in auto mode.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `allocateCheapestFirst` in `badminton-v2/src/hooks/useSessionFinance.ts`: current auto-allocation rule that must remain the unchanged auto-mode engine.
- `buildUsageMapForAllocation` in `badminton-v2/src/hooks/useSessionFinance.ts`: reusable stock accounting helper for batch availability calculations.
- `useShuttleBatches` in `badminton-v2/src/hooks/useShuttleBatches.ts`: existing inventory-derived batch identity and stock model that can anchor later manual selection flows.

### Established Patterns
- Finance totals are database-first: the app reads `get_session_finance` and should not reimplement the cost summary logic in React.
- The current finance write path already uses full replacement by deleting all `shuttle_usage` rows for the session and inserting the new set; Phase 16 should preserve that shape.
- Inventory numbering and display identity are derived from creation order plus stable tie-breaking, so any manual allocation model should keep using the same batch identity rules.
- Supabase migrations are additive SQL files under `badminton-v2/supabase/migrations/`, and the project still applies them via the Dashboard SQL Editor on Windows.

### Integration Points
- `useSessionFinance` is the central seam where mode-aware read/write logic will connect to the existing finance page.
- `get_session_finance` is the backend contract that downstream readers depend on for shuttle totals, shuttle cost, and profit numbers.
- `shuttle_usage` remains the persisted per-batch allocation table for both auto and manual modes; Phase 16 is defining how mode metadata relates to those rows.
- Phase 17 should consume the Phase 16 mode contract instead of inventing its own UI-only interpretation of auto versus manual behavior.

</code_context>

<specifics>
## Specific Ideas

- The safest mental model is: save one explicit field that says `auto` or `manual`, and keep `shuttle_usage` as the batch allocation detail table.
- Missing mode on older records should be normalized to `auto` rather than guessed from the shape of the allocation rows.

</specifics>

<deferred>
## Deferred Ideas

- Manual brand search, multi-batch selection UX, and per-batch shuttle entry belong to Phase 17.
- Validation rules such as duplicate-batch prevention, required selection, whole-number checks, and stock-safe save enforcement belong to Phase 18.

</deferred>

---

*Phase: 16-Finance Allocation Mode Foundation*
*Context gathered: 2026-05-25*
