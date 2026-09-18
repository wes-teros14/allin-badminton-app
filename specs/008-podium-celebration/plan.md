# Implementation Plan: Leaderboard Celebrations

**Branch**: `008-podium-celebration` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-podium-celebration/spec.md`

## Summary

Tell a player, once, when their standing on a leaderboard improves in a way that is new to them: a
card over whatever screen they are on, a toast offering that board, and a sweep on their own row when
they arrive.

The whole feature turns on one comparison — current standing against *the standing this player was
last shown* — so the work divides into a pure rule that can be tested exhaustively, a cheap trigger
that avoids paying for that comparison when nothing could have changed, and a presentation layer that
is deliberately identical for medallists and non-medallists.

The single biggest design constraint is cost. Celebrating "in place" means the app must know a
player's rank from anywhere, but computing the boards is expensive. A sentinel — the most recent
session completion time — gates the expensive work so that the common launch does no board
computation at all.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, ES2023 target

**Primary Dependencies**: React Router (routing), Supabase JS (data), sonner (toasts), Tailwind CSS 4
with the app's existing design tokens, lucide-react (icons)

**Storage**: Supabase Postgres for leaderboard source data (read-only for this feature).
`localStorage` for each player's recorded standings and any uncollected sweep. No schema change.

**Testing**: Vitest (`npm run test:unit`, specs under `badminton-v2/src/__tests__/`), Playwright
(`npm run test:e2e`, specs under `badminton-v2/tests/`)

**Target Platform**: Mobile-first web app, deployed on Vercel, used predominantly on phones

**Project Type**: Single-page web application (`badminton-v2/`)

**Performance Goals**: A launch where no session has completed since the last evaluation must issue
one small query and no board computation. Celebration animation must hold 60fps on a mid-range phone.

**Constraints**: No navigation may be initiated by the app. No celebration may require dismissal.
`prefers-reduced-motion` must be honoured. The feature must read the same rank definitions the
leaderboard screen uses, not its own copy.

**Scale/Scope**: ~14–20 players per session, 8 watched boards, a few hundred completed sessions of
history. Four player-facing surfaces touched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Assessment | Evidence |
|-----------|-----------|----------|
| **I. Single-App Runtime Boundaries** | **PASS** | All runtime work lands in `badminton-v2/`. Impacted surfaces named explicitly: player layout (host for the celebration), leaderboard view (row sweep), plus two new `lib` modules and one new hook. No admin, liveboard or finance surface is touched. |
| **II. Session Data Is the Source of Truth** | **PASS** | No behaviour is duplicated from session config. Standings are derived from the existing leaderboard queries rather than re-implemented. No schema change, so no migration and no database type updates are required. Celebration state is per-player presentation history, not session configuration. |
| **III. Cross-Surface Consistency Is Mandatory** | **PASS, and it is the main design driver** | The celebration and the leaderboard must never disagree about a player's place. Achieved by extracting the board queries and ranking out of `LeaderboardView` into a shared module that both consume — see Phase 1. A second, lighter "just my rank" query was explicitly rejected; see research.md R2. |
| **IV. Safe Stateful Changes First** | **PASS** | The feature is read-only with respect to sessions, matches, queues and results. It writes only its own `localStorage` keys. An in-progress session is unaffected; the sentinel only reacts to sessions already marked complete. |
| **V. Validation Before Merge** | **PLANNED** | `npm run lint`, `npm run test:unit` (pure rule covered exhaustively), and a new Playwright spec, since the flow spans navigation and auth state. Any pre-existing unrelated failure will be named rather than glossed. |

**Additional constraints check**

- *Testing rules*: new unit specs go in `badminton-v2/src/__tests__/`; the Playwright spec is
  seed-backed and isolated, matching the existing `tests/pair-leaderboard.spec.ts` pattern.
- *UI and runtime rules*: the celebration reuses existing tokens (`--gold`, `--border`,
  `--muted-foreground`) and the medal colours already used by the leaderboard's podium rows, rather
  than introducing a parallel palette. Shared logic lives in `lib/`, not in views.

**No violations. Complexity Tracking section omitted.**

## Project Structure

### Documentation (this feature)

```text
specs/008-podium-celebration/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── celebration-contract.md   # Module and component contracts
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
badminton-v2/
├── public/
│   └── bunny-thumbsup.png            # NEW — non-podium icon, 192x261 RGBA
├── src/
│   ├── lib/
│   │   ├── leaderboardData.ts        # NEW (extracted) — board queries + ranking,
│   │   │                             #   shared by the leaderboard and this feature
│   │   ├── podiumCelebration.ts      # NEW — the pure rule: previous vs current
│   │   ├── celebrationStorage.ts     # NEW — per-player recorded standings, sweep debt
│   │   └── denseRank.ts              # existing, unchanged
│   ├── hooks/
│   │   └── useLeaderboardCelebration.ts  # NEW — sentinel, evaluation, orchestration
│   ├── components/
│   │   ├── CelebrationCard.tsx       # NEW — the card, confetti, reduced-motion path
│   │   └── ConfettiBurst.tsx         # NEW — canvas particles
│   ├── layouts/
│   │   └── PlayerLayout.tsx          # CHANGED — hosts the celebration app-wide
│   ├── views/
│   │   └── LeaderboardView.tsx       # CHANGED — imports extracted data module;
│   │                                 #   plays the row sweep when a sweep is owed
│   └── __tests__/
│       ├── podiumCelebration.test.ts     # NEW — the rule, incl. the three silences
│       └── celebrationStorage.test.ts    # NEW — per-player isolation, migration safety
└── tests/
    └── leaderboard-celebration.spec.ts   # NEW — Playwright, seed-backed
```

**Structure Decision**: Single web application under `badminton-v2/`, matching Constitution
Principle I. The feature adds three `lib` modules, one hook and two components, and modifies two
existing files. The `leaderboardData.ts` extraction is a pure move of existing code — no behaviour
change — and exists solely to satisfy Principle III by giving both consumers one definition of a rank.

## Phase Sequencing

The user stories are independently shippable in priority order, and the file layout above supports
stopping after any one of them:

| Story | Adds | Depends on |
|-------|------|------------|
| **US1** (P1) card in place | `leaderboardData`, `podiumCelebration`, `celebrationStorage`, the hook, `CelebrationCard`, `ConfettiBurst`, `PlayerLayout` wiring | — |
| **US2** (P2) toast + row sweep | toast emission, sweep debt in storage, `LeaderboardView` sweep | US1 |
| **US3** (P3) non-podium achievements | extra achievement kinds in the pure rule, bunny asset, border rule | US1 |
| **US4** (P4) several at once | multi-achievement card layout, scaled dwell, toast counting | US1 |

US3 and US4 are independent of each other; both need US1.

## Complexity Tracking

Not required — Constitution Check passed with no violations.
