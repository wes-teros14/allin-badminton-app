# Phase 1 Data Model: Finance Net Totals Summary

**Feature**: `004-finance-net-totals` | **Date**: 2026-08-18

This feature introduces **no new tables and no new columns**. It exposes one already-persisted field (`sessions.status`) through an existing read path, and derives two in-memory aggregates from it. The model below documents what is read, what is derived, and the rules governing each.

---

## Entities

### 1. Session *(existing — read-only, unchanged)*

Source: `public.sessions` (migration `002_create_sessions.sql`)

| Field | Type | Role in this feature |
|-------|------|----------------------|
| `id` | `UUID` PK | Row identity; already surfaced as `session_id` |
| `status` | `session_status` NOT NULL DEFAULT `'setup'` | **The field this feature newly exposes.** Determines membership in the Completed total |
| `date` | `DATE` NOT NULL | Already displayed; not used by the totals |
| `name` | `TEXT` NOT NULL | Already displayed; not used by the totals |

**`session_status` enum values** (in lifecycle order):

| Value | Counts toward All Sessions | Counts toward Completed |
|-------|:--:|:--:|
| `setup` | ✅ | ❌ |
| `registration_open` | ✅ | ❌ |
| `registration_closed` | ✅ | ❌ |
| `schedule_locked` | ✅ | ❌ |
| `in_progress` | ✅ | ❌ |
| `complete` | ✅ | ✅ |

**Rule**: `'complete'` is the sole terminal state and the sole qualifier for the Completed total. There is no separate "cancelled" or "archived" state to reason about.

**No writes.** This feature never mutates `status` and never triggers a lifecycle transition (Constitution IV).

---

### 2. Session Finance Record *(existing — one field added to its projection)*

Source: `public.get_session_finance(UUID)` → mapped to `FinanceSessionRow` in `src/hooks/useFinanceSessions.ts`

| Field (RPC) | Field (TS) | Type | Notes |
|---|---|---|---|
| `session_id` | `sessionId` | `string` | |
| `date` | `date` | `string` | |
| `name` | `name` | `string` | |
| `fee_per_player` | `feePerPlayer` | `number` | |
| `court_cost` | `courtCost` | `number` | |
| `revenue` | `revenue` | `number` | Displayed in table |
| `shuttle_cost` | `shuttleCost` | `number` | |
| `total_cost` | `totalCost` | `number` | Displayed in table |
| `profit_after_personal_share` | `profit` | `number` | **The value summed by both totals.** Rendered as the Net Cash column |
| `paid_count` | `paidCount` | `number` | |
| `total_count` | `totalCount` | `number` | |
| **`status`** ← NEW | **`status`** ← NEW | `SessionStatus` | **Added by migration `074`.** Sole purpose: partition rows for the Completed total |

**Mapping rule (existing, preserved)**: `profit` is mapped as `Number(row.profit_after_personal_share ?? row.profit)` — i.e. net *after* the personal-share deduction, matching the Net Cash column exactly.

**Invariant**: The value summed by the totals and the value rendered in the Net Cash cell are the *same field on the same object*. This is what makes the exact reconciliation in FR-004 / SC-002 structurally guaranteed rather than coincidental.

---

### 3. Finance Summary Totals *(new — derived, not persisted)*

Produced by `summarizeFinanceTotals(sessions: FinanceSessionRow[])` in `src/hooks/useFinanceSessions.ts`.

| Field | Type | Definition |
|-------|------|------------|
| `allSessions` | `number` | Sum of `profit` over **every** row, rounded to 2 decimals |
| `completed` | `number` | Sum of `profit` over rows where `status === 'complete'`, rounded to 2 decimals |

**Lifecycle**: Recomputed (via `useMemo`) whenever `sessions` changes. Never stored, never cached across fetches, never written to the database. Discarded on unmount.

**Validation rules**:

| # | Rule | Traces to |
|---|------|-----------|
| V-1 | Empty input returns `{ allSessions: 0, completed: 0 }` — never `null`, `undefined`, or `NaN` | FR-010, edge case "no sessions at all" |
| V-2 | Each total is rounded once, at the end of the reduce, via `Number(sum.toFixed(2))` | R-003, SC-002 |
| V-3 | Rows contributing `0` (no fee, no cost, no usage) are included in the count and contribute `0` — they never short-circuit or error | Edge case "sessions with no financial data" |
| V-4 | Negative sums are preserved as negative — no clamping, no `Math.abs` | FR-006, edge case "large negative running total" |
| V-5 | `completed` ⊆ `allSessions`: when every row is `'complete'`, the two totals are equal | User Story 2, Scenario 2 |
| V-6 | When no row is `'complete'`, `completed` is `0` while `allSessions` may be non-zero | User Story 2, Scenario 3 |
| V-7 | The function is pure — no I/O, no clock, no randomness, same input always yields same output | Constitution Testing Rules (determinism) |

---

## Derivation Flow

```
sessions table (status)
        │
        ▼
get_session_finance RPC  ──── migration 074 appends `status` to RETURNS TABLE
        │
        ▼
useFinanceSessions  ──► FinanceSessionRow[]  ──┬──► table rows (Net Cash cell = row.profit)
                                                │
                                                └──► summarizeFinanceTotals()
                                                          │
                                                          ▼
                                                { allSessions, completed }
                                                          │
                                                          ▼
                                              FinanceView heading row
```

Both consumers branch from the **same** `FinanceSessionRow[]` array, which is why the totals cannot drift from the table (FR-012).

---

## State Transitions

None introduced. The feature is strictly read-only.

The only transition it *observes* is the existing `status → 'complete'` lifecycle change, already handled by triggers in `021_add_sessions_completed_at.sql` and `030_sessions_attended_on_completion.sql`. When a session becomes complete, its net moves into the Completed total on the next fetch of the Finance page — no additional trigger, subscription, or reconciliation logic is required (User Story 2, Scenario 4).

---

## Migration Impact

| Concern | Assessment |
|---------|------------|
| New tables | None |
| New columns | None |
| Data backfill | Not required — `sessions.status` is `NOT NULL DEFAULT 'setup'` and already populated for every existing row |
| Destructive operations | None. `DROP FUNCTION` + `CREATE` replaces a function definition; no data is touched |
| Existing computed values | Unchanged — migration `074` alters only the return signature and projection, never a calculation |
| Backward compatibility | Both RPC consumers read fields by name; an added key is inert to each (see research R-002) |
| Rollback | Re-apply the `065` function definition to restore the prior signature |
