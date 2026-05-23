# All-In Badminton App

## What This Is

A real-time badminton session manager built for weekly group play. It covers the full session lifecycle, from player registration through live match tracking, result recording, and post-session leaderboards, with an admin-managed session flow for a regular group at a fixed venue.

## Core Value

Players can register, get a fair auto-generated match schedule, and track live results without the admin manually coordinating anything during play.

## Requirements

### Validated

- [x] Six-state session lifecycle with admin controls (Setup -> Registration Open -> Registration Closed -> Schedule Locked -> In Progress -> Complete) - v1.0
- [x] Shareable invitation token system (UUID per session) - v1.0
- [x] Player self-registration via Google OAuth plus invite link - v1.0
- [x] Match generation engine with fairness and balance optimization - v1.0
- [x] No back-to-back games, repeat partner avoidance, and gender balance scoring - v1.0
- [x] Live board with dual-court real-time updates - v1.0
- [x] Admin court view for result recording and queue advancement - v1.0
- [x] Player schedule, wait-time, and session detail views - v1.0
- [x] Cheers, leaderboards, player profile awards, and My Sessions - v1.0
- [x] Today tab with multi-session support and roster search/filtering - v1.0
- [x] Registration Early Bird award - v1.0
- [x] Session-level split scoring toggle - v1.3
- [x] Split-match result entry in live board and admin court flows - v1.3
- [x] `1-1` split results as valid final outcomes - v1.3
- [x] Game-level result aggregation across leaderboard, schedule, and profile surfaces - v1.3

### Active

- Define the next milestone after v1.3 closeout
- Decide whether the next focus is finance follow-through, inventory follow-through, or a new player/admin workflow improvement

### Out of Scope

- Mobile native app - web-first and acceptable in mobile browsers
- Video posts or media uploads - not relevant to badminton session operations

## Context

- Stack: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Supabase (Postgres, Realtime, Auth)
- Two Supabase projects: dev and prod, with separate environment variables
- App runtime lives in `badminton-v2/`
- Tests: Vitest for unit coverage and Playwright for browser/E2E coverage
- Typical session shape: about 16 players, about 20 matches, 2 courts

## Current State

- Shipped milestone: `v1.3 Split Match Scoring` on 2026-05-23
- Result handling now supports both legacy one-game rows and split game-level rows
- Split-scoring flows are verified in both write-path and read-path browser coverage

## Next Milestone Goals

- Start a fresh milestone definition flow with a new `REQUIREMENTS.md`
- Keep roadmap/archive size stable by treating future requirements as milestone-scoped planning inputs
- Add validation artifacts during execution rather than retroactively at closeout

## Constraints

- Tech stack remains React/Supabase, with no separate backend server
- Google OAuth only, with no email/password auth
- Deployment remains Vercel plus Supabase
- Supabase migrations still run through the Dashboard SQL Editor on Windows

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Simulated annealing for schedule optimization | Good balance quality without slow generation | Good |
| Supabase Realtime for live updates | Eliminates polling and keeps player/admin views in sync | Good |
| Fisher-Yates shuffle in match generation | Removes biased permutation behavior | Good |
| Early Bird award applies to latest session only | All-time logic was confusing and low-value | Good |
| Separate dev/prod Supabase projects | Prevents production data contamination during development | Good |
| Split scoring is session-level, not per-match | Match administration happens within one session mode | Good |
| `1-1` is a valid final split result | Product models two short games, not forced deciders | Good |
| Game-level rows are the canonical stats source | Read surfaces aggregate raw result rows and derive compatibility on top | Good |

## Evolution

This document should evolve at phase transitions and milestone boundaries. At milestone close, validated requirements move up, active requirements are redefined for the next milestone, and key architectural/product decisions are re-audited against what shipped.

---
*Last updated: 2026-05-23 after v1.3 milestone closeout prep*
