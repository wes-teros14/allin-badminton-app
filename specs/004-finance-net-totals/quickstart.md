# Quickstart: Finance Net Totals Summary

**Feature**: `004-finance-net-totals` | **Branch**: `004-finance-net-totals`

What a developer picking this up needs to know, in the order they need it.

---

## What we're building

Two gain/loss totals in the `/finance` page heading, level with the "Finance" title:

```
Finance                      All Sessions      Completed
                                ₱12,450.00       ₱9,800.00
```

Each sums the same **Net Cash** value already shown per row in the table below. Green when positive, red when negative — identical treatment to the existing Net Cash column.

**Labels are decided**: `All Sessions` and `Completed`. Don't re-litigate them; rationale and rejected alternatives are in `spec.md`.

---

## The one real problem

`get_session_finance` — the RPC that feeds this entire page — **does not return session status**. Without it there is no way to compute the Completed total. Everything else in this feature is a `reduce` and a flexbox row.

Fix: migration `074` appends `status` to the RPC's return signature. Details in `contracts/get_session_finance.md`.

---

## Files you'll touch

| Order | File | Change |
|:-:|------|--------|
| 1 | `badminton-v2/supabase/migrations/074_add_status_to_get_session_finance.sql` | **NEW** — recreate RPC with `status` appended |
| 2 | `badminton-v2/src/types/database.ts` (~line 623) | Add `status` to the `get_session_finance` `Returns` |
| 3 | `badminton-v2/src/hooks/useFinanceSessions.ts` | Map `status`; export `summarizeFinanceTotals`; return `totals` |
| 4 | `badminton-v2/src/views/FinanceView.tsx` (~line 27) | Render the two totals in the heading row |
| 5 | `badminton-v2/src/__tests__/financeTotals.test.ts` | **NEW** — unit tests for the helper |
| 6 | `badminton-v2/tests/finance-totals.spec.ts` | **NEW** (optional) — browser assertion |

Do them in that order — each depends on the one above.

---

## Step 1 — Migration

Copy the **entire** function body from `supabase/migrations/065_add_shuttle_allocation_mode.sql` (lines 17–118) into the new migration, then make exactly two edits:

- Append `status public.session_status` to the `RETURNS TABLE` list
- Append `s.status` to the final `SELECT` projection

`s` is already joined (`JOIN public.sessions s ON s.id = fb.session_id`), so nothing else moves.

Keep the `DROP FUNCTION IF EXISTS` before the `CREATE`, and **keep the `GRANT` after it** — dropping a function discards its privileges, and forgetting the re-grant breaks the page for every admin.

⚠️ No existing computed column may change value. This is a signature-only migration.

---

## Step 2 — Types

```ts
// src/types/database.ts, inside get_session_finance.Returns
status: Database["public"]["Enums"]["session_status"]
```

The `session_status` enum is already in the generated `Enums` block — no addition needed. Types are hand-maintained here; keeping them in sync with the migration is a Constitution II requirement, not a nicety.

---

## Step 3 — Hook

In `useFinanceSessions.ts`:

```ts
// 1. Extend the row interface
export interface FinanceSessionRow {
  // ...existing fields
  status: SessionStatus
}

// 2. Map it in the existing .map()
status: row.status,

// 3. Export a PURE helper — this is what gets unit tested
export function summarizeFinanceTotals(sessions: FinanceSessionRow[]) {
  const sum = (rows: FinanceSessionRow[]) =>
    Number(rows.reduce((acc, r) => acc + r.profit, 0).toFixed(2))
  return {
    allSessions: sum(sessions),
    completed: sum(sessions.filter((s) => s.status === 'complete')),
  }
}

// 4. Derive and return
const totals = useMemo(() => summarizeFinanceTotals(sessions), [sessions])
return { sessions, totals, isLoading, fetchError, refetch: fetchAll }
```

**Why the `.toFixed(2)`**: `NUMERIC(10,2)` arrives as a JS float. Summing dozens of them drifts (`4199.999999999999`). Round once at the end. This matches `calculateProfitAfterPersonalShare` in `useSessionFinance.ts:135` — same money convention, one place to reason about.

**Why exported and pure**: it's what makes the arithmetic testable without mounting a component or mocking a network. Same pattern as the existing helpers in `useSessionFinance.ts`.

---

## Step 4 — View

The heading row in `FinanceView.tsx` is currently:

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-lg font-semibold text-primary">Finance</h1>
</div>
```

Put the two totals on the right of that row. Let it wrap on narrow screens — `max-w-lg` minus `p-6` leaves ~464px, and the design target is a ~360px phone. Wrapping is sanctioned by the spec; clipping is not (SC-004).

Three states — get all three right:

| State | Render |
|-------|--------|
| `isLoading` | Skeleton pulse, matching the table's existing `animate-pulse` |
| `fetchError` | Em-dash `—`, **never** `₱0.00` |
| Otherwise | `formatPeso(value)`, including a genuine `₱0.00` |

**The trap**: on fetch failure the hook leaves `sessions` as `[]` and clears `isLoading`. A naive `formatPeso(totals.allSessions)` renders `₱0.00`, which an admin reads as "we're exactly break-even" rather than "the data didn't load." That's what FR-009 exists to prevent.

Color with the same conditional as the Net Cash cell:

```tsx
value >= 0 ? 'text-green-500' : 'text-destructive'
```

---

## Step 5 — Tests

New `src/__tests__/financeTotals.test.ts`, following `useSessionFinance.test.ts`:

```ts
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
```

Cover:

- Mixed statuses → `completed` excludes non-complete rows
- All rows `'complete'` → both totals equal
- No `'complete'` rows → `completed === 0`, `allSessions !== 0`
- Empty array → `{ allSessions: 0, completed: 0 }`
- Negative sum → stays negative, not clamped
- Float drift → e.g. `0.1 + 0.2` style inputs sum to an exact 2-decimal value
- Zero-activity rows → contribute `0`, don't error

---

## Validation before you call it done

```bash
cd badminton-v2
npm run lint
npm run test:unit
npx playwright test tests/finance-totals.spec.ts tests/finance-allocation-regression.spec.ts
```

Re-run `finance-allocation-regression.spec.ts` specifically — it exercises the same RPC you just recreated.

Then check manually at a ~360px viewport that nothing clips (SC-004), and confirm the All Sessions total equals the sum of the visible Net Cash cells (SC-002). Use the dev-only login button at the lower right to sign in as admin on localhost.

Per Constitution V, name any pre-existing unrelated failures explicitly rather than implying a clean suite.

---

## Reading order for the full context

1. `spec.md` — what and why, with decided labels
2. `research.md` — why the migration, why the rounding, why the wrap (R-001 through R-006)
3. `contracts/get_session_finance.md` — the exact RPC diff and its invariants
4. `data-model.md` — the derivation flow and the V-1…V-7 validation rules
5. `plan.md` — constitution gates and file-by-file approach
