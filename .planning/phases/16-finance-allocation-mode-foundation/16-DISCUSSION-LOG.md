# Phase 16: Finance Allocation Mode Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 16-Finance Allocation Mode Foundation
**Areas discussed:** Mode persistence, Save semantics, Compatibility fallback, Mode-switch behavior

---

## Mode Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit mode field on the finance record | Store `auto` or `manual` with the finance record so downstream code can read mode directly. | Yes |
| Explicit mode field on sessions | Store the mode on the broader session row. | |
| Infer mode from saved usage rows | Derive mode from the shape of `shuttle_usage` rows. | |

**User's choice:** Explicit mode field on the finance record
**Notes:** Recommendation was to avoid inferring mode from usage rows because auto allocation can also produce multiple allocation rows.

---

## Save Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Full replacement on every save | Clear the session's old allocation rows and write the new set as the complete truth. | Yes |
| Merge/update existing rows | Try to patch prior allocation rows incrementally. | |

**User's choice:** Full replacement on every save
**Notes:** Recommendation was to preserve the current auto-flow behavior already implemented in `useSessionFinance.logUsage(...)`.

---

## Compatibility Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Missing mode loads as auto | Older records with no mode default to `auto` and remain editable without migration. | Yes |
| Infer from allocation rows | Guess the old record's mode from its saved rows. | |
| Require migration/backfill | Add a migration step before older records can be edited safely. | |

**User's choice:** Missing mode loads as auto
**Notes:** This aligns with the roadmap requirement that older automatic finance records remain readable and editable without migration work.

---

## Mode-Switch Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| One active truth only | Switching modes does not preserve a hidden draft from the other mode; the next save replaces the old allocation. | Yes |
| Preserve background draft | Keep the last draft/allocation for the off-mode and restore it later. | |

**User's choice:** One active truth only
**Notes:** Recommendation was to avoid hidden stale data and keep the Phase 16 foundation simple.

---

## the agent's Discretion

- Exact schema placement and naming for the explicit finance mode field
- Exact handler/API shape for mode-aware save logic
- Exact implementation layer for the "missing mode means auto" normalization

## Deferred Ideas

- Manual picker UX and brand search belong to Phase 17.
- Validation and regression coverage belong to Phase 18.
