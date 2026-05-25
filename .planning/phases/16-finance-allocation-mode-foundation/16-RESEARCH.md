# Phase 16 Research: Finance Allocation Mode Foundation

**Date:** 2026-05-25
**Phase:** 16 - Finance Allocation Mode Foundation
**Status:** Complete

## Scope

Research the safest way to add explicit `auto` / `manual` finance allocation modes without changing the current automatic shuttle allocation behavior, while keeping existing finance records readable and editable.

## Current System Findings

### 1. The finance record already lives on `sessions`

Relevant files:
- `badminton-v2/supabase/migrations/002_create_sessions.sql`
- `badminton-v2/supabase/migrations/059_add_personal_share_override_to_sessions.sql`
- `badminton-v2/src/types/database.ts`

Findings:
- Session-level finance state already lives on the `sessions` row.
- Existing finance-specific flags on `sessions` include `personal_share_override`.
- Existing operational mode flags on `sessions` include `split_match_scoring`.

Recommendation:
- Store the explicit shuttle allocation mode on `sessions` as another session-level finance field.
- This satisfies the locked decision that mode must live on the finance record, while avoiding a new table for a simple two-state mode.

### 2. `shuttle_usage` already matches manual allocation row storage

Relevant files:
- `badminton-v2/supabase/migrations/054_create_shuttle_usage.sql`
- `badminton-v2/supabase/migrations/056_rename_tubes_used_to_shuttles_used.sql`
- `badminton-v2/src/types/database.ts`

Findings:
- `shuttle_usage` already stores one `(session_id, batch_id, shuttles_used)` row per batch allocation.
- The uniqueness rule `UNIQUE (session_id, batch_id)` fits both current auto allocation and future manual per-batch allocation.
- No new allocation detail table is needed for Phase 16.

Recommendation:
- Keep `shuttle_usage` as the canonical allocation detail table for both modes.
- Use the new session-level mode field only to explain how those rows should be interpreted and edited.

### 3. The auto save path is already full-replacement

Relevant files:
- `badminton-v2/src/hooks/useSessionFinance.ts`
- `badminton-v2/src/__tests__/useSessionFinance.test.ts`

Findings:
- `useSessionFinance.logUsage(totalShuttles)` currently deletes all `shuttle_usage` rows for the session, then inserts a new cheapest-first allocation.
- This exactly matches the locked decision that every save should fully replace the session's allocation rows.
- Existing helper coverage already locks the cheapest-first ordering and remaining-stock behavior.

Recommendation:
- Preserve the delete-then-insert save shape.
- Refactor the save API to accept either auto input or manual per-batch rows, but keep the same replacement semantics underneath.

### 4. The main compatibility contract is the finance RPC

Relevant files:
- `badminton-v2/supabase/migrations/058_create_get_session_finance.sql`
- `badminton-v2/supabase/migrations/060_update_get_session_finance_for_personal_share.sql`
- `badminton-v2/src/hooks/useFinanceSessions.ts`
- `badminton-v2/src/hooks/useSessionFinance.ts`

Findings:
- Both finance list and detail flows are database-first and depend on `get_session_finance`.
- The finance detail hook does not read the `sessions` table directly for its core finance summary.
- Extending the RPC is the cleanest way to expose the new mode field and keep all finance reads on one contract.

Recommendation:
- Extend `get_session_finance` to return the new allocation mode field.
- Keep client-side fallback logic as `row.shuttle_allocation_mode ?? 'auto'` for defensive compatibility.

### 5. Inventory contracts already define manual batch identity

Relevant files:
- `badminton-v2/src/hooks/useShuttleBatches.ts`
- `badminton-v2/src/views/InventoryView.tsx`
- `badminton-v2/supabase/migrations/053_create_shuttle_batches.sql`
- `badminton-v2/supabase/migrations/061_add_shuttles_per_tube_to_shuttle_batches.sql`

Findings:
- Inventory already defines stable batch identity, remaining-stock math, and tube numbering.
- Phase 17 can build its manual picker directly on top of these contracts.
- Phase 16 does not need to invent a separate batch-display model.

Recommendation:
- Keep Phase 16 focused on mode and save contracts.
- Reuse `useShuttleBatches` / inventory display rules in Phase 17 rather than adding duplicate finance-only batch identity code now.

## Recommended Data Model

### Session-level mode field

Recommended shape:
- add a Postgres enum `shuttle_allocation_mode` with values `auto` and `manual`
- add `sessions.shuttle_allocation_mode shuttle_allocation_mode not null default 'auto'`

Why this shape:
- explicit and type-safe
- existing rows automatically normalize to `auto` through the defaulted column
- easy to expose through `database.ts` and `get_session_finance`
- consistent with other session-level operational flags

## Recommended Hook Contract

Recommended `useSessionFinance` direction:
- expose `allocationMode: 'auto' | 'manual'`
- expose a dedicated setter/persist method for mode, separate from usage-row save
- preserve current auto workflow with a wrapper like `logUsage(totalShuttles)`
- add a mode-aware save entry point that can accept:
  - auto input: total shuttles
  - manual input: explicit per-batch rows

Why:
- preserves current UI call sites while giving Phase 17 a clean manual contract
- keeps the full-replacement save rule centralized
- avoids mixing mode persistence with row persistence in ad hoc UI code

## Recommended UI Boundary for Phase 16

Phase 16 should add:
- a visible mode switch on `FinanceDetailView`
- auto mode continuing to render and save exactly as today
- manual mode branching to a separate section shell that can safely load existing manual allocations and prepare for Phase 17

Phase 16 should not add:
- searchable batch picker
- multi-row manual editor
- manual save validation rules beyond the shared replacement contract

Why:
- the roadmap assigns the actual manual builder UX to Phase 17
- Phase 16 still needs a user-visible mode boundary so the feature does not stay purely hidden in data contracts

## Risks And Mitigations

### Risk: accidental auto regression

Cause:
- refactoring `logUsage` into a shared mode-aware save path could change cheapest-first allocation or stock handling

Mitigation:
- keep `allocateCheapestFirst` unchanged
- preserve `logUsage(totalShuttles)` as a compatibility wrapper
- extend unit tests around helper ordering and save-path behavior

### Risk: mode/UI drift between RPC and hook state

Cause:
- mode could be updated on `sessions` while the hook still treats the RPC result as the source of truth

Mitigation:
- extend `get_session_finance`
- keep the hook's mode state derived from RPC refreshes after writes

### Risk: Phase 16 overreaches into Phase 17 UI

Cause:
- trying to build the full manual picker/editor too early

Mitigation:
- keep Phase 16 plans focused on contract, mode switch, and compatibility
- leave brand search and row editing to the next phase

## Planning Implications

The phase should split into:

1. Schema and RPC foundation
   - add the explicit mode field
   - update generated DB types
   - extend finance RPC output

2. Hook and save-contract refactor
   - make `useSessionFinance` mode-aware
   - preserve the current auto API behavior
   - add test coverage for normalization and replacement semantics

3. Finance page mode integration
   - add the mode switch to `FinanceDetailView`
   - keep auto mode unchanged
   - branch manual mode into a dedicated shell ready for Phase 17

## Recommendation Summary

- Store the explicit allocation mode on `sessions`, not in `shuttle_usage`.
- Keep `shuttle_usage` as the only allocation detail table for both modes.
- Extend `get_session_finance` and `database.ts` first, then refactor `useSessionFinance`, then wire the finance page.
- Preserve the current auto path as a wrapper over the new shared save contract so `FIN-01`, `FIN-03`, and `COMP-02` stay protected.

## RESEARCH COMPLETE
