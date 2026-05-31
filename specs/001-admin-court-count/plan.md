# Implementation Plan: Admin Court Count

**Branch**: `[001-admin-court-count]` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-admin-court-count/spec.md`

**Note**: This plan covers Phase 0 research and Phase 1 design artifacts for making session court count configurable and removing the hard-coded two-court assumption from live session flows.

## Summary

Add a session-level `court_count` configuration with a legacy default of two, then refactor session start, live court state, admin live controls, liveboard rendering, and player-facing live court summaries to work from an ordered set of configured courts instead of fixed `court1` and `court2` branches.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19

**Primary Dependencies**: React Router 7, Supabase JS 2, Sonner, Vite 8

**Storage**: Supabase Postgres with generated TypeScript database types

**Testing**: Vitest for unit tests, Playwright for end-to-end browser tests

**Target Platform**: Responsive web app for admin, player, and liveboard views

**Project Type**: Single-page web application

**Performance Goals**: Live court changes remain visible across admin, liveboard, and player views within 2 seconds of a court action or realtime refresh

**Constraints**: Preserve legacy two-court sessions; avoid losing active match assignments during court-count changes; maintain usability on mobile admin view and landscape liveboard

**Scale/Scope**: Per-session configuration for small live badminton sessions, typically tens of players and 1-8 active courts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current `.specify/memory/constitution.md` is still the default placeholder template and does not define enforceable project-specific principles or gates.

- Gate status before research: PASS
- Reason: No concrete constitutional constraints are defined yet, so no feature-specific violations can be evaluated
- Follow-up note: When the constitution is formalized later, this feature should be re-checked against the actual project rules

### Post-Design Re-Check

- Gate status after Phase 1 design: PASS
- Reason: The produced design stays within the existing React + Supabase application structure, introduces one bounded schema change, and does not require architectural exceptions

## Project Structure

### Documentation (this feature)

```text
specs/001-admin-court-count/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── session-court-count.md
└── tasks.md
```

### Source Code (repository root)

```text
badminton-v2/
├── src/
│   ├── components/
│   │   ├── CourtCard.tsx
│   │   ├── CourtTabs.tsx
│   │   ├── MatchGeneratorPanel.tsx
│   │   └── RegistrationURLCard.tsx
│   ├── hooks/
│   │   ├── useAdminActions.ts
│   │   ├── useAdminSession.ts
│   │   ├── useCourtState.ts
│   │   ├── usePlayerList.ts
│   │   ├── usePlayerSchedule.ts
│   │   └── useSession.ts
│   ├── types/
│   │   └── database.ts
│   ├── views/
│   │   ├── AdminView.tsx
│   │   ├── LiveBoardView.tsx
│   │   ├── PlayerView.tsx
│   │   └── SessionView.tsx
│   └── __tests__/
├── supabase/
│   └── migrations/
└── tests/
```

**Structure Decision**: Keep the existing single Vite app structure. Implement the feature by extending the existing session schema and refactoring the live-session hooks/components that currently hard-code two courts.

## Complexity Tracking

No constitution violations or special complexity exemptions are currently required.
