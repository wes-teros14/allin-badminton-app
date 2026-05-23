# Phase 13: Split Scoring Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 13-Split Scoring Schema
**Areas discussed:** Migration compatibility, Uniqueness contract, Session flag naming, Type/update boundary

---

## Migration compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| `NOT NULL DEFAULT 1` | Add `game_number integer not null default 1`, so existing and future one-game rows are normalized immediately. | x |
| Nullable during rollout | Add `game_number` with a default but allow null temporarily, and treat null as game 1 in app reads. | |
| Agent decides | Let the planner choose after checking current schema and constraints. | |

**User's choice:** `NOT NULL DEFAULT 1`
**Notes:** The recommended path was accepted so downstream phases do not need null-handling for a field that should always exist.

---

## Uniqueness contract

| Option | Description | Selected |
|--------|-------------|----------|
| `(match_id, game_number)` unique only | Allow one row per game for a match, supporting both one-game and split-match results. | x |
| Keep old single-result assumptions too | Preserve any one-row-per-match uniqueness in addition to the new game-level rule. | |
| Agent decides | Let the planner verify the current constraints and choose the migration path. | |

**User's choice:** `(match_id, game_number)` unique only
**Notes:** The recommended path was accepted because any one-row-per-match uniqueness would conflict with split matches.

---

## Session flag naming

| Option | Description | Selected |
|--------|-------------|----------|
| `split_match_scoring` | Clear and direct, matching roadmap language closely. | x |
| `uses_split_scoring` | Clear, slightly more behavior-oriented. | |
| `is_split_scoring_enabled` | Explicit but verbose relative to the existing schema style. | |
| Agent decides | Let the planner match the existing schema style after a broader audit. | |

**User's choice:** `split_match_scoring`
**Notes:** The recommended name was accepted for clarity and alignment with roadmap wording.

---

## Type/update boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Schema/types/tests only | Keep Phase 13 strictly foundational and defer compatibility code to later phases. | |
| Include small compatibility helpers | Add minimal shared helpers that normalize legacy one-game reads and the new `game_number` contract. | x |
| Agent decides | Let the planner judge whether the current code duplication justifies helpers now. | |

**User's choice:** Include small compatibility helpers
**Notes:** The recommendation was accepted because multiple future phases will need one normalized rule for legacy game-1 behavior.

---

## the agent's Discretion

- Helper naming and exact placement can be chosen during planning, as long as the compatibility contract remains centralized.

## Deferred Ideas

None.
