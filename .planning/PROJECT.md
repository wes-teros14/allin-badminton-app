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
- [x] Auto/manual shuttle allocation mode stored on session finance while keeping automatic allocation behavior unchanged - v1.4 / Phase 16
- [x] Session finance page can switch between automatic and manual allocation modes - v1.4 / Phase 16
- [x] Automatic shuttle logging still uses the existing total-shuttles flow and allocation rules - v1.4 / Phase 16
- [x] QM can search and select multiple inventory batches by brand from a dialog-based manual finance picker - v1.4 / Phase 17
- [x] Manual finance allocation rows show inventory-style details, editable per-batch counts, and auto-calculated session totals - v1.4 / Phase 17
- [x] Saved manual finance allocations reopen directly into the editable batch table - v1.4 / Phase 17
- [x] Invalid manual allocation saves are blocked for empty rows, duplicates, non-positive counts, and counts above available stock - v1.4 / Phase 18
- [x] Regression coverage exists for auto/manual finance allocation flows across unit and browser tests - v1.4 / Phase 18

### Active

- No active milestone requirements yet; next milestone definition pending

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

- Current milestone: `v1.4 Finance Manual Shuttle Allocation` complete and verified on 2026-05-25
- Phase 16 is complete: finance now has explicit auto/manual allocation mode foundations
- Phase 17 is complete: finance manual mode now supports searchable batch picking, editable row counts, save, and reload
- Phase 18 is complete: manual allocation validation and finance regression coverage are verified through UAT

## Current Milestone: v1.4 Finance Manual Shuttle Allocation

**Goal:** Keep the current finance auto-allocation rules intact by default, while letting the QM manually allocate shuttle usage from specific inventory batches when needed.

**Target features:**
- Auto/manual allocation toggle in session finance with no behavior change in auto mode
- Searchable brand-based batch picker that shows the same distinguishing details already exposed in inventory
- Manual per-batch shuttle count entry with auto-calculated session total and stock-safe validation

**Outcome:**
- Delivered and verified on 2026-05-25 across Phases 16-18
- Manual allocation now supports stock-safe save-time validation and regression coverage without changing the existing automatic allocation path

## Next Milestone Goals

- Define the next release slice from the deferred finance insights and inventory backlog
- Decide whether the next milestone prioritizes finance analytics, stock awareness, or inventory metadata depth
- Start with a fresh `.planning/REQUIREMENTS.md` after milestone archival

## Constraints

- Tech stack remains React/Supabase, with no separate backend server
- Google OAuth only, with no email/password auth
- Deployment remains Vercel plus Supabase
- Supabase migrations still run through the Dashboard SQL Editor on Windows
- Finance workflows remain QM-driven; there is no separate completion gate based on a precomputed shuttle requirement

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
| Manual finance allocation should be optional | Current automatic shuttle allocation works and should remain the default path | Good |
| Manual finance allocation derives the total from selected batches | QM records actual per-batch usage; there is no separate required-total workflow to satisfy | Good |
| Manual batch selection should reuse searchable picker patterns | The app already uses searchable selection flows and inventory-style batch details | Good |
| Manual allocation validation must be enforced at the save seam as well as in the UI | Client feedback alone is not enough to protect persisted finance data | Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-25 after Phase 18 verification and v1.4 milestone completion*
