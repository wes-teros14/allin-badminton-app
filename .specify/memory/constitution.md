<!--
Sync Impact Report
- Version change: template placeholder -> 1.0.0
- Modified principles:
  - Principle 1 -> I. Single-App Runtime Boundaries
  - Principle 2 -> II. Session Data Is the Source of Truth
  - Principle 3 -> III. Cross-Surface Consistency Is Mandatory
  - Principle 4 -> IV. Safe Stateful Changes First
  - Principle 5 -> V. Validation Before Merge
- Added sections:
  - Additional Constraints
  - Development Workflow
- Removed sections:
  - None
- Templates requiring updates:
  - compatible: `.specify/templates/plan-template.md`
  - compatible: `.specify/templates/spec-template.md`
  - compatible: `.specify/templates/tasks-template.md`
  - compatible: `AGENTS.md`
- Follow-up TODOs:
  - None
-->

# Badminton V2 Constitution

## Core Principles

### I. Single-App Runtime Boundaries
All runtime product work MUST target `badminton-v2/` unless a change is explicitly
documentation-only or planning-only.

Contributors MUST treat root-level legacy and planning folders as non-runtime context.

New feature work MUST identify the exact runtime surfaces it affects: admin, player,
liveboard, finance, or shared hooks/state.

Rationale: This repository contains active app code plus planning and legacy material.
The constitution prevents accidental work in the wrong area.

### II. Session Data Is the Source of Truth
Behavior that depends on session configuration MUST be derived from persisted session
data, not duplicated constants in UI components.

Schema-backed session behavior changes MUST include:
- a Supabase migration when schema changes are required
- maintained TypeScript database type updates when schema shape changes
- code-path updates for every affected runtime surface

Rationale: Features such as court count, split scoring, and registration state are
session-level rules and must stay consistent across views.

### III. Cross-Surface Consistency Is Mandatory
Any feature that changes session state, match state, or player-visible session
information MUST be evaluated across all impacted surfaces before completion.

At minimum, affected work MUST check:
- admin operational views
- liveboard views
- player-facing summaries or schedules when applicable

A feature is not complete if one surface is updated while another still reflects stale
assumptions.

Rationale: The app exposes the same live session state in multiple views. Divergence is
a product bug, not a cosmetic issue.

### IV. Safe Stateful Changes First
Changes to live-session behavior MUST preserve in-progress session continuity.

Contributors MUST avoid destructive transitions that lose match assignments, queue
state, results, or session history unless the requirement explicitly allows it.

When changing a stateful rule, edge cases for legacy data and in-progress sessions MUST
be specified and tested.

Rationale: The app manages active badminton sessions. Unsafe changes can corrupt
operational data during real use.

### V. Validation Before Merge
Every production code change MUST pass targeted validation proportional to impact.

At minimum:
- `npm run lint`
- `npm run test:unit`
- affected `npm run test:e2e` coverage when user-facing flows change

If unrelated pre-existing failures block full validation, they MUST be documented
explicitly, and the feature-specific validation that did pass MUST be named.

Rationale: The repository already mixes stable and unstable flows. The constitution
requires honest validation rather than implying a full green suite exists when it does
not.

## Additional Constraints

### Data and Migration Rules
Supabase schema changes MUST be additive-first unless a destructive change is explicitly
planned.

New columns that support legacy records MUST define a backward-compatible default or a
documented reconciliation strategy.

Service-role credentials, tokens, and secret values MUST never be committed.

### Testing Rules
Unit tests MUST be deterministic and live under `badminton-v2/src/__tests__/`.

Playwright tests MUST remain isolated and seed-backed.

A new user-facing flow SHOULD include at least one browser-level assertion when the
behavior spans navigation, auth, or realtime state.

### UI and Runtime Rules
Established UI patterns and the existing visual language SHOULD be preserved unless the
task explicitly calls for redesign.

Shared business logic SHOULD live in hooks, lib utilities, or typed helpers rather than
being duplicated across views.

## Development Workflow

1. Specification work MUST identify impacted surfaces and state transitions.
2. Plan work MUST identify schema changes, shared state changes, and validation
   strategy.
3. Tasks MUST map requirements to concrete files and tests.
4. Implementation MUST update all affected surfaces before closeout.
5. Final reporting MUST state what was validated, what was deferred, and why.

## Governance

This constitution supersedes conflicting local planning preferences for feature delivery
and validation.

Changes to this constitution require:
- a documented rationale
- explicit version bump reasoning
- updates to dependent Speckit templates when the rules affect planning, tasks, or
  validation

Compliance review for any substantial feature MUST check:
- schema safety
- cross-surface consistency
- validation evidence
- explicit handling of legacy or in-progress session state

Versioning policy:
- MAJOR: removes or redefines a principle in a breaking way
- MINOR: adds a new principle or materially expands governance
- PATCH: clarifies wording without changing enforcement meaning

**Version**: 1.0.0 | **Ratified**: 2026-06-01 | **Last Amended**: 2026-06-01
