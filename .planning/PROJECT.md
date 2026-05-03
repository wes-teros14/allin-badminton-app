# All-In Badminton App

## What This Is

A real-time badminton session manager built for weekly group play. Covers the full session lifecycle — from player registration through live match tracking, result recording, and post-session leaderboards. Used by a regular group of players at a fixed venue with an admin-managed session flow.

## Core Value

Players can register, get a fair auto-generated match schedule, and track live results — all without the admin manually coordinating anything during play.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — present in v1.0 build -->

- ✓ Six-state session lifecycle with admin controls (Setup → Registration Open → Registration Closed → Schedule Locked → In Progress → Complete) — v1.0
- ✓ Shareable invitation token system (UUID per session) — v1.0
- ✓ Player self-registration via Google OAuth + invite link — v1.0
- ✓ Match generation engine: fair distribution, skill-balanced teams, simulated annealing optimization — v1.0
- ✓ No back-to-back games, repeat partner avoidance, gender balance scoring — v1.0
- ✓ Live board (dual-court, projector-optimized, Supabase Realtime) — v1.0
- ✓ Admin court view: record results, advance queue, real-time status — v1.0
- ✓ Player view: match schedule, live wait time, session detail — v1.0
- ✓ Cheers system: 6 cheer types, post-match social engagement — v1.0
- ✓ All-time and session leaderboards, player profile with awards — v1.0
- ✓ My Sessions view: all sessions a player attended — v1.0
- ✓ Today tab: active session leaderboard, multi-session pill selector — v1.0
- ✓ Roster search + active player filter in admin views — v1.0
- ✓ Registration Early Bird award (latest session only, excludes setup sessions) — v1.0

## Current Milestone: v1.1 Finance & Inventory

**Goal:** Add an admin-only Finance tab covering shuttle stock management, session P&L, and per-player payment tracking.

**Target features:**
- Shuttle batch inventory with partial tube tracking (cheapest batch consumed first)
- Session P&L: revenue, court cost, shuttle COGS, net profit
- Per-player payment status per session (moves from Admin tab)

### Active

<!-- v1.1 scope -->

### Out of Scope

<!-- Explicit boundaries -->

- Mobile native app — web-first, works fine on mobile browser
- Video posts / media uploads — not relevant to badminton sessions

## Context

- Stack: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Supabase (Postgres + Realtime + Auth)
- Two Supabase projects: dev and prod (separate env vars in Vercel per environment)
- App lives in `badminton-v2/` subfolder; root `vercel.json` handles build config
- Tests: Vitest (unit), Playwright (E2E) — located in `badminton-v2/`
- Sessions have a standard format: ~16 players, ~20 matches, 2 courts

## Constraints

- **Tech stack**: React/Supabase — no backend server, all logic is client-side or Supabase functions
- **Auth**: Google OAuth only — no email/password auth
- **Deployment**: Vercel + Supabase; CLI tools blocked on Windows, migrations run via Supabase Dashboard SQL Editor

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Simulated annealing for schedule optimization | 15 starts × 50 trials gives good balance without being slow | ✓ Good |
| Supabase Realtime for live updates | Eliminates polling; instant propagation to all clients | ✓ Good |
| Fisher-Yates shuffle in match generator | Replaced biased shuffle — equal probability per permutation | ✓ Good |
| Early Bird award: latest session only | All-time logic was confusing and not useful | ✓ Good |
| Separate dev/prod Supabase projects | Prevents prod data contamination during dev | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-03 — bootstrapped from existing codebase for GSD initialization*
