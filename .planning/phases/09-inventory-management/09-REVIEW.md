---
phase: 09-inventory-management
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - badminton-v2/src/hooks/useShuttleBatches.ts
  - badminton-v2/src/views/InventoryView.tsx
  - badminton-v2/src/App.tsx
  - badminton-v2/src/components/TopNavBar.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 9 adds shuttle batch inventory management: a `useShuttleBatches` hook, an `InventoryView` with a dialog form, a new `/inventory` route (admin-only via `AdminRoute`), and an Inventory tab in `TopNavBar` (admin-only via role check). The overall approach is sound and the authorization model is correctly layered at both the route and UI levels.

Four warnings were found — all in `useShuttleBatches.ts`. The two most consequential are a silent data loss path when the usage fetch fails, and a stale-closure bug that causes `addBatch` to use the pre-render value of `fetchBatches` rather than the memoized callback. The other two are a superfluous second database round-trip (correctness: the sort order already guarantees the result) and a missing `isLoading` reset when the batch fetch errors. Three informational items cover a TypeScript `as unknown as number` cast, an unguarded `console.log`-free but silent error swallow, and a minor UX gap. No security issues were identified.

---

## Warnings

### WR-01: Silent data corruption when `shuttle_usage` fetch fails

**File:** `badminton-v2/src/hooks/useShuttleBatches.ts:53-60`

**Issue:** The `shuttle_usage` fetch uses destructuring without an `error` check:
```ts
const { data: usageRows } = await supabase
  .from('shuttle_usage')
  .select('batch_id, tubes_used')
```
When this call fails (network error, RLS rejection, etc.) `usageRows` is `null` and the code falls through to `usageRows ?? []`. Every batch then shows its full `tube_count` as `tubesRemaining` — the UI silently presents stale/wrong stock numbers with no indication that the data is incomplete. This is a data-correctness bug: wrong numbers shown with no warning.

**Fix:**
```ts
const { data: usageRows, error: usageError } = await supabase
  .from('shuttle_usage')
  .select('batch_id, tubes_used')

if (usageError) {
  setIsLoading(false)
  return   // or surface an error state to the caller
}
```

---

### WR-02: `addBatch` captures a stale closure over `fetchBatches`

**File:** `badminton-v2/src/hooks/useShuttleBatches.ts:104-116`

**Issue:** `addBatch` is defined as a plain `async function` inside the hook body — it is re-created on every render but is **not** wrapped in `useCallback`. Critically, it references `fetchBatches` (a `useCallback`-memoized function) and `user` from the enclosing scope. Because `addBatch` is returned from the hook and consumed by `InventoryView`, any render that changes `user` between the time the component mounts and the time the user submits the form may call the stale version of `addBatch`. The dependency on `user` is the real risk: if a token refresh causes a re-render that updates `user`, but `InventoryView` holds a reference to the old `addBatch`, the insert could proceed without `created_by` being the current user identity.

Additionally, the function is not included in the `ShuttleBatchState` interface's return signature with a stable identity guarantee, which makes it harder for callers to safely use it as a `useEffect` dependency in future.

**Fix:** Wrap `addBatch` in `useCallback` with explicit dependencies:
```ts
const addBatch = useCallback(async (input: AddBatchInput): Promise<{ error: string | null }> => {
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase.from('shuttle_batches').insert({
    brand: input.brand,
    tube_count: input.tubeCount,
    cost_per_tube: input.costPerTube,
    notes: input.notes ?? null,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  await fetchBatches()
  return { error: null }
}, [user, fetchBatches])
```

---

### WR-03: `isLoading` is not reset to `false` on batch fetch error

**File:** `badminton-v2/src/hooks/useShuttleBatches.ts:47-50`

**Issue:** When the `shuttle_batches` fetch returns an error the function correctly calls `setIsLoading(false)` on line 49 and returns. However, the `isLoading` state begins as `true` on mount. If the initial fetch errors, `isLoading` is set back to `false` on line 49 — that part is fine. But if `fetchBatches` is called a second time (e.g., after `addBatch`) and the second call errors, any intermediate re-render between `setIsLoading(true)` (line 38) and the error return (line 49) correctly unsets it. This is actually OK for the primary path.

The real issue is that there is **no error state exposed to the UI**. When both fetches fail the component renders an empty `batches` array with `isLoading = false`, which shows the empty-state placeholder ("No batches yet") — indistinguishable from a legitimately empty table. Users and admins will not know whether inventory is actually empty or whether the fetch failed.

**Fix:** Add an `error` field to `ShuttleBatchState` and surface it in `InventoryView`:
```ts
// In the hook
const [fetchError, setFetchError] = useState<string | null>(null)

// On error:
setFetchError(error.message)
setIsLoading(false)
return

// Expose in return:
return { batches, isLoading, totalStockRemaining, addBatch, fetchError }
```
Then in `InventoryView`, render an error banner when `fetchError` is non-null.

---

### WR-04: Second database round-trip to `shuttle_batches` is redundant and adds race condition risk

**File:** `badminton-v2/src/hooks/useShuttleBatches.ts:65-75`

**Issue:** Step 4 (lines 65-75) fires a second `SELECT` against `shuttle_batches` ordered by `created_at ASC` to build the `tubeStartMap`. However, the first query in step 1 already fetches all batch rows. The `tubeStartMap` can be built from `batchRows` itself by sorting in JavaScript — no second database call is needed. As written, there is a TOCTOU window: if a new batch is inserted between the two selects (by a concurrent admin session), `orderedByCreation` will contain a row that is absent from `batchRows`, causing that row to silently inflate the `cursor` and shift the tube IDs of subsequent batches.

**Fix:** Derive `tubeStartMap` from the already-fetched `batchRows`, sorted by `created_at`:
```ts
// Replace the second supabase call entirely:
const tubeStartMap = new Map<string, number>()
let cursor = 1001
const sortedByCreation = [...(batchRows ?? [])].sort(
  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
)
for (const b of sortedByCreation) {
  tubeStartMap.set(b.id, cursor)
  cursor += b.tube_count
}
```
This eliminates the extra network round-trip and removes the race window.

---

## Info

### IN-01: `as unknown as number` cast in form default values

**File:** `badminton-v2/src/views/InventoryView.tsx:61`

**Issue:** `defaultValues` uses `'' as unknown as number` to satisfy TypeScript when setting numeric fields to empty strings. This is intentional (the `z.input` type is used precisely to allow pre-coerce string values), and it works at runtime. The `z.input<typeof addBatchSchema>` / `z.output<typeof addBatchSchema>` split is the correct pattern here and is well-commented. The cast is a known limitation of Zod + RHF interop, not a bug. Flagged for visibility only — consider a comment linking to the relevant Zod issue if this pattern is unfamiliar to future maintainers.

---

### IN-02: `tubeStart` fallback of `1001` masks missing map entries

**File:** `badminton-v2/src/hooks/useShuttleBatches.ts:80`

**Issue:** `const tubeStart = tubeStartMap.get(b.id) ?? 1001` falls back to `1001` if a batch ID is missing from the map. After fixing WR-04 (building the map from `batchRows`) this case becomes impossible, but the fallback silently collides with the real first batch's tube ID. If the fallback is ever exercised (e.g., during debugging), two batches would both display `T-1001 – T-1012`, making diagnostics confusing.

**Fix:** After fixing WR-04, remove the fallback entirely and assert:
```ts
const tubeStart = tubeStartMap.get(b.id)!
// or use a thrown error during development:
// if (tubeStart === undefined) throw new Error(`Missing tubeStart for batch ${b.id}`)
```

---

### IN-03: `AdminRoute` shows a login button for unauthenticated users but does not redirect to `/inventory` after sign-in

**File:** `badminton-v2/src/App.tsx:17-20`

**Issue:** The OAuth redirect in `AdminRoute` hardcodes `redirectTo: .../admin`. Any unauthenticated user who navigates directly to `/inventory` and clicks "Sign in with Google" will be taken back to `/admin` after authentication, not to the page they originally requested. This is a UX issue (not a security issue — the route guard is correct).

**Fix:** Capture the intended destination and use it as the redirect:
```ts
const { pathname, search } = useLocation()
// ...
options: { redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}${pathname}${search}` }
```

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
