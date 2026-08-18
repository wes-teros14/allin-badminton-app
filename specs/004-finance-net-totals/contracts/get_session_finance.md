# Contract: `public.get_session_finance(UUID)`

**Feature**: `004-finance-net-totals` | **Change type**: Additive (backward-compatible)
**Current definition**: `supabase/migrations/065_add_shuttle_allocation_mode.sql`
**New definition**: `supabase/migrations/074_add_status_to_get_session_finance.sql`

---

## Change Summary

One column appended to the return signature. Nothing else changes.

```diff
  RETURNS TABLE (
    session_id UUID,
    date DATE,
    name TEXT,
    fee_per_player NUMERIC(10,2),
    court_cost NUMERIC(10,2),
    personal_share_override NUMERIC(10,2),
    shuttle_allocation_mode public.shuttle_allocation_mode,
    paid_count BIGINT,
    total_count BIGINT,
    revenue NUMERIC(10,2),
    shuttle_cost NUMERIC(10,2),
    total_cost NUMERIC(10,2),
    effective_personal_share NUMERIC(10,2),
    profit NUMERIC(10,2),
    profit_after_personal_share NUMERIC(10,2),
-   total_shuttles_logged NUMERIC(10,1)
+   total_shuttles_logged NUMERIC(10,1),
+   status public.session_status
  )
```

and correspondingly in the final projection:

```diff
    fb.profit_after_personal_share,
-   fb.total_shuttles_logged
+   fb.total_shuttles_logged,
+   s.status
  FROM finance_base fb
  JOIN public.sessions s ON s.id = fb.session_id
```

`s` is already joined in the existing final `SELECT`, so no CTE or query restructuring is needed.

---

## Invariants — MUST be preserved verbatim

| Property | Value |
|---|---|
| Function name & arity | `public.get_session_finance(p_session_id UUID DEFAULT NULL)` |
| Language | `plpgsql` |
| Security | `SECURITY INVOKER` |
| Search path | `SET search_path = public` |
| Authorization guard | Raises `'Not authorized'` with `ERRCODE = '42501'` unless caller's `profiles.role = 'admin'` |
| Filter semantics | `WHERE p_session_id IS NULL OR fb.session_id = p_session_id` |
| Ordering | `ORDER BY fb.date DESC, s.created_at DESC` |
| Grant | `GRANT EXECUTE ON FUNCTION public.get_session_finance(UUID) TO authenticated` |
| All 16 existing columns | Same names, same types, same computed values |

**Hard requirement**: no existing column's value may change. This migration is signature-only. Any diff in `revenue`, `total_cost`, `profit`, or `profit_after_personal_share` for identical input data is a defect.

---

## New Column

| Column | Type | Nullable | Source | Semantics |
|--------|------|:--------:|--------|-----------|
| `status` | `public.session_status` | No | `sessions.status` | Session lifecycle state. `'complete'` is the sole terminal value and the sole qualifier for the Completed total |

Enum domain: `'setup' | 'registration_open' | 'registration_closed' | 'schedule_locked' | 'in_progress' | 'complete'`

The column is `NOT NULL` at the source (`sessions.status NOT NULL DEFAULT 'setup'`), so every row — including legacy rows — carries a usable value with no backfill.

---

## Migration Mechanics

Appending to a `RETURNS TABLE` cannot be done with `CREATE OR REPLACE` alone; Postgres rejects a return-type change. The migration must therefore:

```sql
DROP FUNCTION IF EXISTS public.get_session_finance(UUID);

CREATE OR REPLACE FUNCTION public.get_session_finance(p_session_id UUID DEFAULT NULL)
RETURNS TABLE ( ... )  -- full body, copied from 065 with the two diffs above
...
$$;

GRANT EXECUTE ON FUNCTION public.get_session_finance(UUID) TO authenticated;
```

This DROP-then-CREATE shape is the established pattern for this function in this repo — migrations `060` and `065` both use it. The `GRANT` **must** be re-issued after the DROP, as dropping the function discards its privileges.

---

## Consumer Impact

| Consumer | File | Access pattern | Impact |
|---|---|---|---|
| Finance list | `src/hooks/useFinanceSessions.ts:34` | By-name field reads | **Extended** — will now map `row.status` |
| Finance detail | `src/hooks/useSessionFinance.ts:361` | By-name field reads | **None** — reads only the fields it already used; the extra JSON key is inert |

PostgREST returns each row as a JSON object, so an added key cannot break a by-name consumer. Neither call site destructures positionally or iterates over columns. Verified by inspection — see research R-002.

---

## Generated Types

`src/types/database.ts` (~line 623) must gain the matching field:

```diff
        Returns: {
          ...
          shuttle_cost: number
+         status: Database["public"]["Enums"]["session_status"]
          total_cost: number
          total_count: number
          total_shuttles_logged: number
        }[]
```

The `session_status` enum is already present in the generated `Enums` block (~line 647), so no enum addition is required. Types are hand-maintained in this repo; the file must be kept consistent with the migration per Constitution II.

---

## Verification

| # | Check | Expected |
|---|-------|----------|
| C-1 | Call as admin with `p_session_id = NULL` | Returns every session, each row carrying a valid `status` |
| C-2 | Call as admin with a specific `p_session_id` | Returns exactly one row, `status` matching that session's persisted value |
| C-3 | Call as a non-admin authenticated user | Raises `'Not authorized'` (`42501`) — guard intact |
| C-4 | Compare all 16 pre-existing columns against the `065` output for identical data | Byte-identical values |
| C-5 | Row ordering | Unchanged: `date DESC, created_at DESC` |
| C-6 | Load `/finance/:sessionId` after migration | Detail view renders unchanged (no-regression check on the untouched consumer) |

---

## Rollback

Re-apply the function definition from `065_add_shuttle_allocation_mode.sql` (DROP + CREATE + GRANT). No data migration to unwind — the change never touched a row.
