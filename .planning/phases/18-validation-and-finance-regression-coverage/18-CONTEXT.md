# Phase 18: Validation And Finance Regression Coverage - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase hardens the manual finance allocation flow so invalid manual saves are blocked, saved totals and cost displays remain correct for both allocation modes, and the finance workflow gains regression coverage. It does not change the Phase 16 auto-allocation rules or the Phase 17 picker/editor interaction model beyond adding validation feedback and enforcement.

</domain>

<decisions>
## Implementation Decisions

### Validation Timing And Feedback
- **D-01:** Manual allocation validation must show live inline feedback while the QM edits rows.
- **D-02:** Manual allocation validation must also hard-block saving when any invalid state remains.
- **D-03:** Row-level validation feedback belongs close to the editable row inputs rather than only in toasts after save is attempted.

### Duplicate Batch Enforcement
- **D-04:** Duplicate batch selection must be prevented in the UI wherever possible.
- **D-05:** Duplicate batches must still be hard-blocked at save time as a defensive enforcement rule.
- **D-06:** A manual allocation must treat each inventory batch as unique and selectable at most once.

### Stock Validation On Reopen And Edit
- **D-07:** Stock validation must use current remaining stock while excluding this session's own previously saved usage when the session is reopened for editing.
- **D-08:** Reopened manual allocations must remain editable under the same exclusion rule rather than invalidating their own prior saved rows.
- **D-09:** No manual override path is needed in this phase; over-stock rows are invalid and must block save.

### Regression Coverage Strategy
- **D-10:** Phase 18 coverage must be split across Vitest unit tests and Playwright browser coverage.
- **D-11:** Unit tests should own validation helpers, save-shaping behavior, and mode-safe finance logic.
- **D-12:** Playwright should cover the real finance page flow: mode switching, brand search, row editing, invalid save blocking, and auto/manual regression behavior.

### the agent's Discretion
- Exact wording and visual treatment of inline validation messages, as long as they are visible during editing and the save action is still blocked.
- Exact distribution of specific assertions between the new unit tests and Playwright spec, as long as both layers are meaningfully exercised.
- Exact placement of save-disabled state versus inline error state, as long as invalid manual saves cannot succeed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Scope
- `.planning/ROADMAP.md` - Phase 18 goal, dependencies, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` - `VAL-01`, `VAL-02`, `VAL-03`, and `COMP-01`, plus the out-of-scope boundary that auto allocation rules must remain unchanged.
- `.planning/PROJECT.md` - Milestone goal, validated finance decisions from Phases 16-17, and the remaining active work for validation and regression coverage.
- `.planning/STATE.md` - Current milestone position, readiness for Phase 18 planning, and environment constraints.

### Prior Phase Decisions
- `.planning/phases/16-finance-allocation-mode-foundation/16-CONTEXT.md` - Locked mode persistence, replacement save semantics, auto fallback, and the rule that mode switching does not preserve a hidden draft.
- `.planning/phases/17-manual-batch-allocation-ui/17-CONTEXT.md` - Locked picker/editor UX decisions, add-order behavior, inline remove confirmation, and the explicit deferral of validation rules to Phase 18.
- `.planning/phases/17-manual-batch-allocation-ui/17-VERIFICATION.md` - Verified Phase 17 behavior and the remaining gap summary assigning blocking validation and regression coverage to Phase 18.

### Finance Runtime Seams
- `badminton-v2/src/hooks/useSessionFinance.ts` - Current finance read/write flow, stock calculation, mode-aware save path, manual row hydration, and the existing seam where validation-safe save logic must live.
- `badminton-v2/src/views/FinanceDetailView.tsx` - Current finance page orchestration, manual save trigger, auto/manual mode switch, and the integration point for inline validation state.
- `badminton-v2/src/components/ManualAllocationEditor.tsx` - Current manual row editor, live total recalculation, and the row-level surface where inline validation feedback will appear.
- `badminton-v2/src/components/ManualBatchPickerDialog.tsx` - Current duplicate-prevention UI guard in the picker and the searchable manual batch selection flow that must not regress.

### Inventory And Persistence Contracts
- `badminton-v2/src/views/InventoryView.tsx` - Inventory-style batch details and current display contract used by the finance picker and editor.
- `badminton-v2/src/hooks/useShuttleBatches.ts` - Stock calculation and tube identity rules that Phase 18 validation must stay aligned with.
- `badminton-v2/supabase/migrations/053_create_shuttle_batches.sql` - Base batch schema.
- `badminton-v2/supabase/migrations/054_create_shuttle_usage.sql` - Persisted per-session per-batch usage contract.
- `badminton-v2/supabase/migrations/061_add_shuttles_per_tube_to_shuttle_batches.sql` - Partial-tube stock model behind remaining-shuttle validation.

### Testing Surfaces
- `.planning/codebase/TESTING.md` - Current Vitest and Playwright patterns, placement, and runtime expectations for new regression coverage.
- `badminton-v2/src/__tests__/useSessionFinance.test.ts` - Existing finance helper coverage that should expand for validation and compatibility rules.
- `badminton-v2/tests/registration-limit.spec.ts` - Current Playwright style, real-Supabase setup pattern, and browser-spec conventions to mirror for finance regression coverage.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSessionFinance` already centralizes finance save behavior, stock math, and row shaping, making it the natural place for save-time validation rules and helper coverage.
- `ManualAllocationEditor` already owns the row inputs and live total display, making it the natural place for inline validation feedback.
- `ManualBatchPickerDialog` already disables selected rows, so duplicate prevention already exists in the common UI path and can be hardened rather than redesigned.
- Existing Vitest helper tests in `src/__tests__/useSessionFinance.test.ts` provide a low-friction place to expand validation and compatibility assertions.

### Established Patterns
- Finance writes return `{ error: string | null }` instead of throwing, so invalid save enforcement should follow the same error-return pattern.
- The app prefers lightweight inline errors and toast feedback over heavier modal flows.
- Auto allocation behavior must remain unchanged; validation work must not alter `allocateCheapestFirst` behavior except where compatibility assertions verify it stays stable.
- Playwright in this repo uses real backend setup with seeded users and direct DB prep, so finance regression coverage can follow that same pattern instead of a fake browser-only harness.

### Integration Points
- `handleManualSave` in `FinanceDetailView.tsx` is the page-level choke point for blocking invalid manual submissions before or during `saveUsageAllocation`.
- `buildUsageRowsForSave`, `buildManualAllocationRows`, and stock calculation helpers in `useSessionFinance.ts` are the most likely seams for unit-testable validation logic.
- `ManualAllocationEditor.tsx` row inputs are the immediate insertion point for inline invalid-count and over-stock feedback.
- A new Playwright finance spec under `badminton-v2/tests/` should exercise the actual page flow instead of only helper behavior.

</code_context>

<specifics>
## Specific Ideas

- Live validation should feel immediate in the manual editor, but save-time enforcement remains authoritative.
- Reopened sessions should not fail validation against their own previously saved usage; only other sessions' current stock consumption should count against them.
- Regression coverage should prove that Phase 18 hardening does not break the existing auto allocation workflow.

</specifics>

<deferred>
## Deferred Ideas

- Any change to the actual automatic allocation algorithm remains out of scope.
- Any new picker filters beyond brand remain out of scope.
- Inventory creation, archival, or stock-adjustment workflows remain outside this phase.

</deferred>

---

*Phase: 18-Validation And Finance Regression Coverage*
*Context gathered: 2026-05-25*
