# Phase 18: Validation And Finance Regression Coverage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 18-validation-and-finance-regression-coverage
**Areas discussed:** Validation timing and surface, Duplicate-batch handling, Stock-limit rule at save time, Regression coverage shape

---

## Validation Timing And Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Save-time blocking only | The QM can edit freely, and validation errors appear only when they click `Save Allocation`. | |
| Live inline feedback + save-time blocking | Show row-level issues while editing, and still block save if anything is invalid. | ✓ |
| Hybrid | Show obvious live issues while typing, but keep the full validation gate on save. | |
| You decide | Let the agent choose the most pragmatic version for the codebase. | |

**User's choice:** Live inline feedback plus save-time blocking
**Notes:** Recommended because the row editor already owns the inputs and save-time enforcement is still needed for stale stock conditions.

---

## Duplicate-Batch Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Prevent duplicates in UI and also block on save | The picker prevents the common path, and save-time validation still enforces uniqueness. | ✓ |
| Prevent duplicates in UI only | Trust the current picker guard without extra save-time enforcement. | |
| Allow duplicates temporarily but merge them automatically on save | Let the UI accept duplicate rows, then normalize them during submission. | |
| You decide | Let the agent choose. | |

**User's choice:** Prevent duplicates in UI and also block on save
**Notes:** Each inventory batch must remain unique inside one manual allocation even if the UI guard is bypassed.

---

## Stock-Limit Rule At Save Time

| Option | Description | Selected |
|--------|-------------|----------|
| Validate against current remaining stock, excluding this session’s own saved rows when reopening/editing | Reopened sessions can edit their own prior usage without self-invalidating. | ✓ |
| Validate against raw current stock with no special handling for reopened sessions | Treat reopened sessions the same as fresh allocations. | |
| Allow temporary over-stock when reopening, but warn and require explicit override | Permit override behavior for edited sessions. | |
| You decide | Let the agent choose. | |

**User's choice:** Validate against current remaining stock, excluding this session’s own saved rows when reopening/editing
**Notes:** This matches the current stock model and keeps reopened manual sessions stable while still protecting against other sessions consuming stock in the meantime.

---

## Regression Coverage Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Mostly unit tests, minimal browser coverage | Put most assertions in helper tests. | |
| Split coverage across unit + Playwright | Put logic-heavy rules in Vitest and end-to-end behavior in Playwright. | ✓ |
| Mostly Playwright, minimal unit coverage | Lean on browser coverage for most confidence. | |
| You decide | Let the agent choose. | |

**User's choice:** Split coverage across unit + Playwright
**Notes:** Unit tests should own validation logic and compatibility helpers, while Playwright should cover the real finance page behavior and regression paths.

---

## the agent's Discretion

- Exact wording and visual treatment of validation messages
- Exact assertion split between unit and Playwright coverage
- Exact save-disabled versus save-attempt-blocked UI mechanics, as long as invalid saves cannot succeed

## Deferred Ideas

- No new deferred ideas were introduced; discussion stayed within Phase 18 scope.
