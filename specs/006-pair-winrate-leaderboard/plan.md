# Implementation Plan: Partner Combination Win-Rate Leaderboard

**Branch**: `006-pair-winrate-leaderboard` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-pair-winrate-leaderboard/spec.md`

## Summary

Add a fourth tab to the All-time Leaderboard ranking two-player partnerships by win rate — `Sim & Wes — 100% · 9W 0L` — with a 6-games-together floor and the same recent-activity rule the player board already applies.

The board is **derived on read** from `matches` and their nested `match_results`, not from the trigger-maintained counter tables. That choice is forced rather than stylistic: `player_pair_stats.wins_together` already holds partner wins, but its companion `losses_against` counts losses *to an opponent*, not losses *beside a partner*, and partner losses cannot be reconstructed from it. Sourcing from the counters would have meant a new column, a trigger change, and edits to both stat-reversal functions. Deriving from match records needs none of that — no migration, no RLS change, and no possibility of corrupting numbers players already see.

Two counting rules carry the correctness: partnerships are keyed on the two ids **sorted**, so Sim&Wes and Wes&Sim are one entry; and wins and losses are counted **per recorded game**, not per match, so a split-scored 1-1 gives each pair 1W and 1L — consistent with `computeStatsFromResults()` and the existing player stats.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.2

**Primary Dependencies**: `@supabase/supabase-js` 2.99, `react-router` 7.13, Tailwind 4.2; existing in-repo helpers `lib/matchResults.ts`, `lib/formatDisplayName.ts`, `components/Avatar.tsx`

**Storage**: Supabase Postgres — **read-only for this feature**. Tables read: `matches`, `match_results`, `sessions`, `session_registrations`, `profiles`. No schema change.

**Testing**: Vitest (`npm run test:unit`, specs in `badminton-v2/src/__tests__/`), Playwright (`npm run test:e2e`, specs in `badminton-v2/tests/`)

**Target Platform**: Mobile-first web app, phone-width layout primary

**Project Type**: Single-app SPA under `badminton-v2/` (Constitution Principle I)

**Performance Goals**: Partnership list rendered within 2 seconds on a normal mobile connection for a full club history of 2,000+ recorded games (SC-002)

**Constraints**: No migration, no RLS change, no edit to existing stats counters/triggers/reversal functions, no behavioural change to the three existing tabs (FR-023, FR-024, FR-003). Deterministic ordering across loads (FR-016). Structured so a future season filter is one added query condition (FR-025).

**Scale/Scope**: ~16 players and 20 matches per session; roughly 1,000 matches and 2,000 recorded games per year. One new lib module, one new unit test file, one edited view, one new E2E spec.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|-----------|---------|
| **I. Single-App Runtime Boundaries** | All runtime work is inside `badminton-v2/`. Impacted surface is named and singular: the player-facing All-time Leaderboard. Admin, liveboard, and finance surfaces are untouched. | PASS |
| **II. Session Data Is the Source of Truth** | Totals are derived from persisted match and session records, not from constants in the view. The eligibility window reads `sessions`/`session_registrations` rather than hardcoding who is active. No schema change, so the migration and `types/database.ts` obligations do not apply. | PASS |
| **III. Cross-Surface Consistency Is Mandatory** | The counting rule reuses `sortMatchResults()` and matches `computeStatsFromResults()` semantics, so the pair board cannot disagree with the player board about who won a split-scored match. Win-rate rounding and the activity window reuse the existing board's exact rules. The three existing tabs must show identical values afterward, verified per SC-006. | PASS |
| **IV. Safe Stateful Changes First** | Read-only. No writes, no state transitions, no path to session or queue state. Legacy-data edge cases are specified and tested: pre-`079` self-pair rows, matches with deleted results, missing profiles. | PASS |
| **V. Validation Before Merge** | `npm run lint`, `npm run test:unit` with a new deterministic unit suite in `src/__tests__/`, and one seed-backed Playwright spec for the new user-facing flow. Pre-existing unrelated failures, if any, to be named explicitly rather than glossed. | PASS |

**Additional Constraints check**: no schema change, so the additive-first migration rule is not engaged; no secrets involved. Unit tests land in `badminton-v2/src/__tests__/` and the Playwright spec is isolated and seed-backed, as required. The existing visual language is preserved rather than redesigned, and the shared arithmetic lives in a lib module rather than in the view.

**Post-Phase 1 re-check**: still PASS. The design added no schema change, no write path, and no new surface beyond the one tab. One item moved from implicit to explicit — pagination (research R2) — which strengthens Principle III rather than straining any gate: an unpaginated query would silently truncate history and make the pair board disagree with reality.

## Project Structure

### Documentation (this feature)

```text
specs/006-pair-winrate-leaderboard/
├── plan.md                              # This file
├── spec.md                              # Feature specification
├── research.md                          # Phase 0 — 9 technical decisions
├── data-model.md                        # Phase 1 — derived entities, tables read, validation order
├── quickstart.md                        # Phase 1 — files, commands, manual verification
├── contracts/
│   ├── pair-tally.md                    # Pure helper contract + worked examples
│   └── pair-leaderboard-read.md         # Query, composition, and rendering contract
├── checklists/
│   └── requirements.md                  # Spec quality checklist (passed)
└── tasks.md                             # Phase 2 — created by /speckit-tasks, not here
```

### Source Code (repository root)

```text
badminton-v2/
├── src/
│   ├── lib/
│   │   ├── pairStats.ts                 # NEW — pairKey, tallyPairs, rankPairs
│   │   ├── matchResults.ts              # unchanged — sortMatchResults() reused
│   │   └── formatDisplayName.ts         # unchanged — disambiguateDisplayNames() reused
│   ├── components/
│   │   └── Avatar.tsx                   # unchanged — reused for both players in a row
│   ├── views/
│   │   └── LeaderboardView.tsx          # EDIT — fetchPairLeaderboard(), PairsLeaderboard(), 4th tab
│   └── __tests__/
│       └── pairStats.test.ts            # NEW — deterministic unit tests
├── tests/
│   └── pair-leaderboard.spec.ts         # NEW — seed-backed E2E
└── supabase/migrations/                 # UNCHANGED — no migration in this feature
```

**Structure Decision**: The existing single-app layout under `badminton-v2/` is used as-is. The feature follows the file-role convention already in force — pure arithmetic in `src/lib/`, data fetching and rendering colocated in the view that owns the tab, deterministic unit tests in `src/__tests__/`, browser assertions in `tests/`. No new directory, module boundary, or abstraction layer is introduced, because the existing `WinsLeaderboard` pattern in the same file already demonstrates the shape this tab needs.

## Key Design Decisions

Full reasoning in [research.md](./research.md); the load-bearing ones:

- **R1** — Tally logic goes in a new `lib/pairStats.ts`, not into `matchResults.ts`, which is scoped to a single match and consumed by three other surfaces.
- **R2** — The match query **must paginate** with `.range()`. No file in `src/` calls `.range()` today because every existing query is session-scoped or small; this is the first that crosses the server's row cap. Unpaginated, it silently truncates history and renders a wrong board that looks right. A `count: 'exact'` cross-check guards it.
- **R3** — `sessions!inner(id)` is embedded from day one with no filter, so the coming season rule is one added `.eq(...)` rather than a restructure (FR-025).
- **R4** — Names resolve through `disambiguateDisplayNames()`, not bare `formatDisplayName()`. Two real players can share a nickname, and on a pair row that renders as "Alexis & Alexis" — indistinguishable from the duplicate-player bug migration `079` was just written to stop.
- **R5** — Self-pairs are discarded defensively. `079` forbids them going forward but aborts rather than cleaning, so a surviving historical row would otherwise rank a player partnered with themselves.
- **R6** — Ties break on the pair key, so ordering is a property of the data rather than of fetch order (FR-016).
- **R7** — Client-side computation is right at this scale (~200 KB/year). The season filter is the long-term control; server-side aggregation is the fallback and needs a migration, so it is not built here.

## Complexity Tracking

No Constitution violations. Nothing to justify.

The one place this plan spends complexity beyond the obvious is pagination (R2), which is not gold-plating: the alternative is a board that silently disagrees with the match history, which is the failure Principle III exists to prevent.
