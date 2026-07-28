# Phase 0 Research: Reorder Session Cards by Soonest Scheduled Date

No `NEEDS CLARIFICATION` markers were present in the Technical Context — this feature has no unknown technology choices (existing stack: React 19 + TypeScript + Supabase, already in use on the exact files touched). Research below documents the decisions made while scoping the fix, not open unknowns.

## Decision 1: Where does the reorder actually need to happen?

- **Decision**: Change only the client-side `.sort()` comparator for the active/upcoming sessions group in `badminton-v2/src/views/MySessionsView.tsx` (currently `.sort((a, b) => b.date.localeCompare(a.date))` at line 197). Leave the past-sessions comparator (line 201) and the Supabase-level `.order('date', { ascending: false })` calls in `usePlayerSessions.ts` untouched.
- **Rationale**: Reading `usePlayerSessions.ts` shows the hook merges registered-session rows and open-session rows into one array (`[...registeredSessionData, ...unregisteredOpen]`) with no guaranteed combined order, and `MySessionsView` re-sorts that merged array from scratch before rendering. The Supabase query order therefore has zero effect on what's displayed — the only line that determines on-screen order is the view's own `.sort()` call. Changing the hook would be a no-op for behavior and would only add unrelated diff surface.
- **Alternatives considered**:
  - Change the Supabase query's `ascending` flag instead of (or in addition to) the view's sort — rejected, since it doesn't affect final order (the view always re-sorts) and touching it needlessly widens the diff and the constitution's "minimal impact" expectation.
  - Sort once on the full `sessions` array before splitting into active/past — rejected, because active and past need opposite directions (soonest-first vs. most-recent-first), so two separate comparators after the filter is the simplest correct shape (matches the existing code structure).

## Decision 2: Tie-breaking for same-date sessions

- **Decision**: When two active sessions share the same `date`, order by `time` ascending (earlier clock time first). Sessions with a `null`/missing `time` sort after ones with a set time on the same date (stable, no crash).
- **Rationale**: `SessionPickerItem.time` is a nullable `string` (e.g., `"14:00:00"`); comparing as strings ascending works correctly for same-day times without needing full datetime parsing, consistent with how `formattedTime` already parses it elsewhere in the same file via `new Date(\`1970-01-01T${s.time}\`)`. FR-002/FR-005 require this to not error and to remain deterministic.
- **Alternatives considered**: Combine `date` + `time` into a single `Date` object and compare — more robust to malformed time strings but adds parsing overhead and a new failure mode (invalid date) for a case (same-day sessions) that's rare; the simpler string-tuple comparison satisfies the requirement with less code.

## Decision 3: Testability approach

- **Decision**: Extract the active-sessions comparator into a small named, exported pure function (e.g., `compareSessionsByScheduledDate`) rather than leaving it as an inline arrow function inside `.sort()`, so it can be unit tested directly.
- **Rationale**: The codebase already follows this pattern — `usePlayerSessions.ts` exports `buildRegistrationPaymentMap` purely so `usePlayerSessions.test.ts` can test it without rendering a hook or mocking Supabase deeply. Constitution's "Shared business logic SHOULD live in hooks, lib utilities, or typed helpers rather than being duplicated across views" supports keeping the same convention here.
- **Alternatives considered**: Test via full component render (React Testing Library) — heavier setup, not used elsewhere in this codebase for this kind of pure-logic check; reserved for behavior that can't be isolated as a pure function.

## Summary of resolved unknowns

| Area | Resolution |
|---|---|
| Files to change | `MySessionsView.tsx` only |
| Files NOT to change | `usePlayerSessions.ts` (query order is dead code w.r.t. final display, left as-is) |
| Sort key | `date` ascending, then `time` ascending as tiebreaker |
| Past sessions | Unchanged (descending, most-recent-first) |
| Test strategy | Extract pure comparator function, unit test it; add/extend an e2e assertion for visible card order |
