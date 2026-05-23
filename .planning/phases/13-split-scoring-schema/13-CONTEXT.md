# Phase 13: Split Scoring Schema - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase extends the session and result data model so the app can represent split-match scoring at the session level and store multiple game-level results for one scheduled match. It covers the database migration shape, TypeScript contract updates, and compatibility support needed so existing one-game data continues to behave as game 1. It does not add split-result entry UI or change leaderboard/stat aggregation logic yet.

</domain>

<decisions>
## Implementation Decisions

### Match Result Migration
- **D-01:** Existing `match_results` rows should be normalized by adding `game_number integer not null default 1`.
- **D-02:** Legacy one-game matches must remain valid without requiring null-handling for `game_number` in downstream code.

### Duplicate Prevention
- **D-03:** The database should enforce uniqueness at the game-result level with a unique constraint on `(match_id, game_number)`.
- **D-04:** Phase 13 should move the data model toward the new per-game uniqueness rule rather than preserving an old one-row-per-match uniqueness assumption that would block split matches.

### Session Format Flag
- **D-05:** The new session-level boolean column should be named `split_match_scoring`.
- **D-06:** The column default must preserve the current one-game behavior for existing and newly created sessions unless explicitly enabled later.

### Compatibility Boundary
- **D-07:** Phase 13 should include small compatibility helpers in addition to schema, generated types, and tests.
- **D-08:** Those helpers should establish one normalized contract for later phases, especially the rule that legacy one-game results read as game 1.

### the agent's Discretion
- The exact helper API shape, migration sequencing details, and whether compatibility logic lives in a hook helper, domain utility, or typed mapper are left to the planner, as long as the decisions above remain locked.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Scope
- `.planning/ROADMAP.md` - Phase 13 goal, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` - v1.3 requirement IDs, traceability, and out-of-scope boundaries.
- `.planning/PROJECT.md` - Milestone goal and project constraints.
- `.planning/STATE.md` - Current milestone status, prior decisions, and Windows/Supabase migration constraint.

### Schema And Types
- `badminton-v2/supabase/migrations/002_create_sessions.sql` - Base `sessions` table definition.
- `badminton-v2/supabase/migrations/007_match_results_and_court.sql` - Base `match_results` table definition and policies.
- `badminton-v2/supabase/migrations/013_player_stats_tables.sql` - Existing result-triggered stats logic that assumes one inserted result row per game outcome.
- `badminton-v2/src/types/database.ts` - Generated TypeScript contract that must absorb the new session and result fields cleanly.

### Existing Result Flows
- `badminton-v2/src/hooks/useAdminActions.ts` - Admin finish flow currently inserts a single `match_results` row.
- `badminton-v2/src/components/CourtCard.tsx` - Live-board finish flow currently inserts a single `match_results` row.

### Codebase Guidance
- `.planning/codebase/STACK.md` - Confirms the React, Supabase, and TypeScript stack boundaries for this work.
- `.planning/codebase/ARCHITECTURE.md` - Current hook/domain/data-layer structure and the existing match hydration duplication concern.
- `.planning/codebase/INTEGRATIONS.md` - Supabase schema, auth, and realtime integration context.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `badminton-v2/src/types/database.ts`: Central typed contract for Supabase table fields and inserts/updates.
- `badminton-v2/src/hooks/useAdminActions.ts`: Current admin-side result write path that Phase 14 will likely extend from one insert to multiple game inserts.
- `badminton-v2/src/components/CourtCard.tsx`: Current live-board result write path with the same one-row insert assumption.

### Established Patterns
- Schema changes are expressed as additive Supabase SQL migrations under `badminton-v2/supabase/migrations/`.
- The client reads and writes Supabase data directly through feature hooks and a typed client, so schema drift shows up quickly in `database.ts`.
- Match/result handling already has some duplicated hydration and mapping logic, so a small compatibility helper introduced here can reduce repeated legacy handling in later phases.
- Supabase CLI is blocked on Windows in this project, so migration application planning should assume Dashboard SQL Editor usage and careful type-sync handling.

### Integration Points
- Any new `sessions.split_match_scoring` field will flow into session fetches and later admin configuration surfaces.
- Any new `match_results.game_number` field will affect result inserts first, then stats and schedule readers in later phases.
- Existing stats SQL and result consumers still assume one row per completed match result, so the planner should isolate Phase 13 compatibility work from full stats recalculation changes reserved for Phase 15.

</code_context>

<specifics>
## Specific Ideas

- Keep the migration contract strict and normalized from day one: `game_number` should not be nullable.
- Favor a compatibility helper that defines the canonical rule "existing one-game results are game 1" once, instead of repeating fallback logic in each future reader.
- Preserve current one-game behavior by default at the session level until Phase 14 introduces the split-scoring controls and two-row finish flows.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 13-Split Scoring Schema*
*Context gathered: 2026-05-23*
