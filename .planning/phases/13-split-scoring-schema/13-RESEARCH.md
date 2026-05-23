# Phase 13: Split Scoring Schema - Research

**Researched:** 2026-05-23
**Domain:** Supabase schema evolution and compatibility contract for game-level match results
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Existing `match_results` rows should gain `game_number integer not null default 1`.
- **D-02:** Legacy one-game matches must stay valid without null-handling.
- **D-03:** The database should enforce uniqueness on `(match_id, game_number)`.
- **D-04:** Phase 13 should remove any one-row-per-match assumption that would block split matches.
- **D-05:** The session-level boolean must be named `split_match_scoring`.
- **D-06:** The new session flag must default to current one-game behavior.
- **D-07:** Phase 13 should include small compatibility helpers, not only schema/types.
- **D-08:** Compatibility helpers should define one normalized contract for legacy one-game results as game 1.

### the agent's Discretion
- Helper naming and placement can follow existing repo conventions as long as the compatibility rule is centralized.

### Deferred Ideas (OUT OF SCOPE)
- Split result entry UI and finish-flow branching belong to Phase 14.
- Split stats aggregation and leaderboard recalculation belong to Phase 15.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FMT-01 | Session can represent split scoring with a session-level flag. | Add `sessions.split_match_scoring boolean not null default false`; no UI change yet. |
| RES-03 | Multiple game-level results can be stored for one scheduled match. | Add `match_results.game_number integer not null default 1` and remove any one-row-per-match blocker. |
| RES-04 | Duplicate rows for same match/game are rejected. | Enforce unique constraint or unique index on `(match_id, game_number)`. |
| COMP-01 | Existing one-game matches still read as one-game results. | Default/backfill `game_number = 1` and normalize app reads through one compatibility helper. |
</phase_requirements>

## Summary

Phase 13 is a contract phase, not a UX phase. The existing schema stores one `match_results` row per completed match, the current writers insert only `match_id` plus `winning_pair_index`, and multiple readers assume the first related result row is authoritative. [VERIFIED: codebase] That means the correct Phase 13 move is to make the database and TypeScript contracts split-ready now while keeping all current behavior equivalent to a one-game match.

The existing stats trigger is already row-oriented. [VERIFIED: codebase] `013_player_stats_tables.sql` increments player stats once for each inserted `match_results` row, so future Phase 14 split writes can reuse that trigger without redesigning the stats engine in this phase. The main risk is app-side code that currently selects `match_results(winning_pair_index)` and reads only index 0 without an explicit ordering or normalization rule.

**Primary recommendation:** Split the implementation into two plans. First, land the migration and generated type contract, including a deterministic uniqueness migration for `match_results`. Second, add a small `matchResults` compatibility module and migrate current readers/writers to the normalized `game_number = 1` contract without introducing split-result UX yet.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Session scoring mode storage | Database | TypeScript contract | `sessions` owns the flag; `database.ts` exposes it to app code. |
| Per-game result uniqueness | Database | App writers | Database must reject duplicates regardless of caller behavior. |
| Legacy one-game compatibility | Shared app helper | Database defaults | Defaults normalize old rows; helper keeps reads consistent across surfaces. |
| Current finish-flow preservation | App writers/readers | Database | Existing UI still behaves as one-game mode until Phase 14. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Postgres | existing project stack | Schema migration, uniqueness, triggers, RLS | All data model work already lives under `supabase/migrations/`. |
| TypeScript | existing project stack | Generated and shared app contract | `src/types/database.ts` is already the typed DB boundary. |
| React hooks/components | existing project stack | Current readers and writers of `match_results` and `sessions` | Compatibility work stays in repo patterns. |
| Vitest | existing project stack | Unit coverage for helper logic | Existing unit test runner already present. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase JS | existing project stack | Typed `.from(...).select(...)` and inserts | Required for current writer/read path updates. |
| ESLint | existing project stack | Guard helper and hook changes | Run after compatibility updates. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `NOT NULL DEFAULT 1` immediately | Nullable `game_number` rollout | Pushes unnecessary null-handling into every later phase. |
| Small compatibility helper now | Let each reader keep bespoke `match_results[0]` logic | Increases Phase 14/15 churn and regression risk. |
| Session-level flag on `sessions` | Per-match format flag | Contradicts explicit v1.3 scope and user decision. |

**Installation:** None. Use existing dependencies and project structure.

## Architecture Patterns

### System Architecture Diagram

```text
Session row
  -> sessions.split_match_scoring (default false)

Completed match result write
  -> match_results row(s)
     - match_id
     - winning_pair_index
     - game_number (default 1 for current flows)

Current app readers
  -> fetch match_results ordered by game_number
  -> normalize through shared helper
  -> current one-game UIs still consume a single effective winner/result summary

Future Phase 14
  -> insert two rows for split sessions
  -> reuse same trigger/stat pipeline
```

### Recommended Project Structure

```text
badminton-v2/
+-- supabase/migrations/063_add_split_scoring_schema.sql
+-- src/types/database.ts
+-- src/lib/matchResults.ts
+-- src/__tests__/matchResults.test.ts
+-- src/hooks/useAdminActions.ts
+-- src/components/CourtCard.tsx
+-- src/hooks/usePlayerStats.ts
+-- src/hooks/usePlayerSchedule.ts
+-- src/views/TodayView.tsx
+-- src/views/SessionPlayerDetailView.tsx
```

### Pattern 1: Additive Schema With Immediate Legacy Normalization

**What:** Add `split_match_scoring` and `game_number` as additive fields with defaults that preserve current behavior. [VERIFIED: codebase]

**When to use:** Whenever a future feature needs a broader contract but current app behavior must remain unchanged.

### Pattern 2: Shared Result Normalization Helper

**What:** Centralize `match_results` ordering and effective winner derivation in one helper module, instead of letting each hook assume `match_results[0]`. 

**When to use:** Any reader that needs to treat old one-row matches as game 1 and later tolerate multiple game rows.

### Pattern 3: Database-Enforced Duplicate Rejection

**What:** Use a unique constraint/index on `(match_id, game_number)` rather than trusting app-side insert discipline.

**When to use:** Always, because Phase 14 will have two writer entry points (`useAdminActions` and `CourtCard`).

### Anti-Patterns to Avoid

- **Keeping a unique `match_id` rule anywhere in the DB:** This would block split matches completely.
- **Introducing nullable `game_number`:** It makes every future read path more complex for no benefit.
- **Updating leaderboards for multi-row aggregation in this phase:** That is Phase 15 scope creep.
- **Leaving reads unordered:** Once a match can have multiple rows, relying on array index without `order(game_number)` is fragile.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate prevention | App-only duplicate checks | Postgres uniqueness on `(match_id, game_number)` | Handles admin/live-board concurrency correctly. |
| Legacy result fallback | Repeated `row[0] ?? ...` snippets in every hook | Shared helper in `src/lib` or `src/utils` | Keeps Phase 14/15 changes localized. |
| Stats recalculation rewrite | New aggregate engine in Phase 13 | Existing row-based trigger behavior | Current trigger already works per inserted game row. |

## Common Pitfalls

### Pitfall 1: Migration Breaks Existing Unique Assumptions
**What goes wrong:** A hidden unique constraint/index on `match_results.match_id` remains in place, so Phase 14 cannot insert game 2.
**Why it happens:** The migration adds `(match_id, game_number)` uniqueness but never drops the old blocker.
**How to avoid:** Inspect existing indexes/constraints during migration and replace the old uniqueness with the new composite rule in the same migration.
**Warning signs:** Inserts for a second game fail even though `game_number = 2`.

### Pitfall 2: Readers Still Depend on First Unordered Result Row
**What goes wrong:** Completed-match UIs behave unpredictably once multiple result rows exist.
**Why it happens:** Queries keep using `match_results[0]` with no ordering or normalization helper.
**How to avoid:** Update current readers now to select `game_number` and normalize through one helper.
**Warning signs:** Array-index access repeated across hooks/views after the migration lands.

### Pitfall 3: Phase 13 Accidentally Rewrites Stats Semantics
**What goes wrong:** The phase starts counting split rows in leaderboards before split entry exists, expanding scope and increasing regression risk.
**Why it happens:** Planner treats "multiple results per match" as "full split stats support."
**How to avoid:** Limit this phase to schema readiness and compatibility helpers; postpone multi-row aggregation logic to Phase 15.
**Warning signs:** Changes touch leaderboard formulas beyond normalization or ordering.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Existing commands | `npm run test:unit`, `npm run lint`, `npm run build` |
| Migration validation | SQL review plus type-check/build since Supabase CLI is blocked locally |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FMT-01 | `sessions` exposes `split_match_scoring` in types and inserts/updates. | Type/build validation | `npm run build` | Existing build |
| RES-03 | `match_results` supports `game_number` contract and current writers can still write game 1. | Unit + build | `npm run test:unit` / `npm run build` | Plan creates helper test |
| RES-04 | Duplicate `(match_id, game_number)` rows are rejected by migration contract. | Migration review / SQL assertion comments | manual + build | Migration file created |
| COMP-01 | Existing one-game matches still read as one-game results through shared normalization. | Unit tests | `npm run test:unit` | Plan creates `matchResults.test.ts` |

### Sampling Rate

- **After schema/type edits:** `npm run build`
- **After helper/read-path edits:** `npm run test:unit`
- **Before phase completion:** `npm run lint`, `npm run test:unit`, `npm run build`

### Wave 0 Gaps

- No migration runner is available locally because Supabase CLI remains blocked on Windows for this repo. The implementation summary should record any dashboard-only validation that could not be executed in the terminal.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V4 Access Control | yes | Preserve existing `sessions` and `match_results` RLS/policies while adding fields. |
| V8 Data Protection | yes | Keep schema changes additive and non-destructive for existing production rows. |
| V10 Malicious Input / Integrity | yes | Enforce duplicate prevention in Postgres, not only in UI code. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Duplicate result submission from two entry points | Tampering | Composite uniqueness on `(match_id, game_number)`. |
| Legacy row misread after schema expansion | Integrity | Default `game_number = 1` plus shared normalization helper. |
| Schema drift between SQL and TypeScript | Tampering | Update `src/types/database.ts` in the same phase and verify with build. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No hidden application code depends on a unique single `match_results` row beyond the readers already identified. | Summary | If false, additional compatibility updates may be needed during execution. |
| A2 | The existing stats trigger should remain correct once Phase 14 inserts one row per game. | Summary | If false, Phase 14 or 15 will need targeted trigger adjustments. |

## Open Questions (RESOLVED)

1. **Should `game_number` be nullable during rollout?**
   - RESOLVED: No. Use `NOT NULL DEFAULT 1`.
2. **Should the app wait until Phase 14 to add compatibility helpers?**
   - RESOLVED: No. Add a small shared helper in Phase 13 to reduce reader churn later.
3. **Does Phase 13 need full split leaderboard math?**
   - RESOLVED: No. Keep that in Phase 15.

## Environment Availability

Step 2.6: SKIPPED. No new dependencies or external services are required beyond the existing app stack. Supabase Dashboard SQL Editor remains the expected way to apply the migration because local CLI execution is blocked in this environment.

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/13-split-scoring-schema/13-CONTEXT.md`
- `badminton-v2/supabase/migrations/002_create_sessions.sql`
- `badminton-v2/supabase/migrations/007_match_results_and_court.sql`
- `badminton-v2/supabase/migrations/013_player_stats_tables.sql`
- `badminton-v2/src/types/database.ts`
- `badminton-v2/src/hooks/useAdminActions.ts`
- `badminton-v2/src/components/CourtCard.tsx`
- `badminton-v2/src/hooks/usePlayerStats.ts`
- `badminton-v2/src/hooks/usePlayerSchedule.ts`
- `badminton-v2/src/views/TodayView.tsx`
- `badminton-v2/src/views/SessionPlayerDetailView.tsx`

### Secondary (MEDIUM confidence)
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/INTEGRATIONS.md`

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Schema strategy: HIGH
- Compatibility-helper direction: HIGH
- Validation strategy without local Supabase CLI: MEDIUM

**Research date:** 2026-05-23
**Valid until:** 2026-06-22
