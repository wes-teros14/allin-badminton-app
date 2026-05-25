# Phase 18 Research: Validation And Finance Regression Coverage

**Date:** 2026-05-25
**Phase:** 18 - Validation And Finance Regression Coverage
**Status:** Complete

## Scope

Research the safest way to harden the new manual finance allocation flow so invalid manual saves are blocked, reopened sessions validate against current stock correctly, and regression coverage proves auto/manual finance behavior stays stable.

## Current System Findings

### 1. Manual save validation is still almost entirely absent from the save seam

Relevant files:
- `badminton-v2/src/hooks/useSessionFinance.ts`
- `badminton-v2/src/views/FinanceDetailView.tsx`

Findings:
- `buildUsageRowsForSave` validates stock only for the `auto` branch.
- The `manual` branch currently maps whatever rows it receives directly into `shuttle_usage` inserts.
- `handleManualSave` truncates row counts and allows zero-row saves, zero counts, and duplicate rows to reach the hook.
- A manual save with zero rows currently succeeds after deleting existing `shuttle_usage` rows, which violates `VAL-01`.

Recommendation:
- Add a dedicated manual validation helper inside `useSessionFinance.ts` so the save seam itself rejects empty allocations, duplicate batch ids, non-whole or non-positive counts, and over-stock rows.
- Keep the view responsible for presenting feedback, but make the hook authoritative for enforcement.

### 2. Reopen-safe stock math already exists and should be reused instead of reinvented

Relevant files:
- `badminton-v2/src/hooks/useSessionFinance.ts`
- `.planning/phases/18-validation-and-finance-regression-coverage/18-CONTEXT.md`

Findings:
- `buildUsageMapForAllocation` already excludes the current session id when computing remaining stock.
- `fetchAll` uses that exclusion rule before hydrating `batchesForAllocation` and `usageAllocations`.
- This means reopened manual allocations already receive the correct available-stock baseline for the current session's own saved rows.

Recommendation:
- Build Phase 18 stock validation on top of the existing `batchesForAllocation` / `shuttlesRemaining` contract.
- Do not add a second stock-exclusion path in the view layer.

### 3. Duplicate prevention exists only in the happy-path picker UI and is not a sufficient guard

Relevant files:
- `badminton-v2/src/components/ManualBatchPickerDialog.tsx`
- `badminton-v2/src/views/FinanceDetailView.tsx`
- `badminton-v2/src/hooks/useSessionFinance.ts`

Findings:
- The picker disables `Add` for already-selected rows.
- `handleAddManualBatch` also drops an exact duplicate if it is re-added from the same UI path.
- The save seam does not defend against duplicate `batchId` rows, so malformed local state or future UI changes could still violate `VAL-02`.

Recommendation:
- Keep the picker/UI duplicate guard, but add save-time duplicate rejection in the hook as a defensive rule.
- Expose row-level duplicate feedback in the editor so the QM sees the problem before save is attempted.

### 4. Inline editor feedback is the missing user-facing half of the validation story

Relevant files:
- `badminton-v2/src/components/ManualAllocationEditor.tsx`
- `badminton-v2/src/views/FinanceDetailView.tsx`

Findings:
- The editor currently shows editable counts and a total, but no validation state.
- Inputs allow `0`, and invalid values are normalized silently rather than explained.
- Save failures currently surface only as a generic toast in `FinanceDetailView.tsx`.

Recommendation:
- Add derived validation state to the finance-page manual flow and render row-level messages next to the affected inputs.
- Keep the current lightweight interaction style: inline messages plus disabled or blocked save, with toasts only as secondary feedback.

### 5. Auto/manual compatibility is concentrated in a few contracts, which makes regression coverage tractable

Relevant files:
- `badminton-v2/src/hooks/useSessionFinance.ts`
- `badminton-v2/src/views/FinanceDetailView.tsx`
- `badminton-v2/src/__tests__/useSessionFinance.test.ts`

Findings:
- `allocateCheapestFirst`, `buildUsageRowsForSave`, and `saveUsageAllocation` define nearly all persistence-sensitive finance behavior.
- The finance page has a single route-level branch for `auto` versus `manual`.
- Existing unit coverage already protects helper ordering and manual row hydration, but it does not yet cover invalid manual cases or compatibility-safe totals/cost behavior.

Recommendation:
- Expand the unit suite around helper validation, save-row shaping, and auto-allocation compatibility.
- Avoid component-test infrastructure; the repo's current unit scope is pure helper logic in Node.

### 6. Browser regression coverage for finance does not exist yet, so Playwright should cover the real page flow

Relevant files:
- `badminton-v2/tests/registration-limit.spec.ts`
- `.planning/codebase/TESTING.md`

Findings:
- The repo has no finance Playwright spec today.
- Existing browser coverage uses a real Supabase service-role client, direct DB setup, and serial cleanup helpers.
- Phase 18 requirements explicitly call for browser coverage over mode switching, brand search, row editing, invalid save blocking, and auto/manual regression behavior.

Recommendation:
- Add a dedicated finance Playwright spec that seeds batches, creates a test session, drives the real finance page, and asserts both invalid manual blocking and compatible saved totals/cost displays.
- Mirror the existing serial setup/teardown pattern from `registration-limit.spec.ts`.

## Recommended Implementation Shape

### Validation foundation

Recommended additions:
- a pure manual validation helper in `useSessionFinance.ts`
- structured validation output that can identify both top-level and row-level failures
- unit coverage for empty rows, duplicates, zero/non-integer counts, over-stock counts, reopen-safe stock cases, and auto compatibility

Why:
- it makes the hook the enforcement boundary
- it keeps UI feedback derived from one source of truth
- it protects future finance UI changes from bypassing the rules

### Finance page integration

Recommended shape:
- derive manual validation from the current `manualRows` and `availableManualBatches`
- show inline validation close to each row input and a top-level message for empty allocation
- keep duplicate prevention in the picker and add defensive save blocking in the hook
- disable or hard-block `Save Allocation` while invalid manual state exists

Why:
- matches the locked Phase 18 context decisions
- preserves the existing lightweight UI style
- prevents silent data mutation on invalid saves

### Regression coverage

Recommended split:
- Vitest owns pure helper validation, row shaping, and compatibility-sensitive save logic
- Playwright owns route-level manual flow behavior plus auto/manual display and save regression

Why:
- matches current repo testing boundaries
- avoids inventing a jsdom component-test layer
- proves both data contracts and actual browser behavior

## Risks And Mitigations

### Risk: breaking the Phase 16 auto path while hardening manual saves

Cause:
- `buildUsageRowsForSave` is shared by both allocation modes

Mitigation:
- isolate manual validation into a helper branch
- retain existing auto allocation logic and extend unit coverage around `allocateCheapestFirst` compatibility behavior

### Risk: reopened manual allocations falsely failing against their own saved rows

Cause:
- a new validator could accidentally recompute stock from raw usage instead of the existing excluded-session batch state

Mitigation:
- validate against `batchesForAllocation` / `availableManualBatches` as already computed by the hook
- add a unit test for the reopen/edit scenario

### Risk: browser coverage becomes too brittle if it depends on incidental text or generic selectors

Cause:
- the finance page has no dedicated E2E hooks yet

Mitigation:
- prefer stable visible labels already present in the UI
- add minimal deterministic selectors only if the page flow cannot be exercised reliably otherwise

## Planning Implications

The phase should split into:

1. Save-time validation foundation and helper coverage
   - add structured manual validation to `useSessionFinance`
   - preserve auto compatibility
   - lock invalid-case coverage in Vitest

2. Finance-page inline validation and save hardening
   - show row-level/top-level feedback
   - prevent invalid manual saves in the real editor flow
   - keep batch allocation display and mode behavior compatible

3. Browser regression coverage
   - add a finance Playwright spec
   - cover manual invalid-save blocking plus auto/manual compatibility flows

## Recommendation Summary

- Make `useSessionFinance` the authoritative manual validation boundary.
- Reuse the existing excluded-session stock math for reopened manual edits.
- Add inline editor feedback in `FinanceDetailView` / `ManualAllocationEditor`, not just generic toasts.
- Cover helper rules in Vitest and real finance flows in Playwright.

## RESEARCH COMPLETE
