# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)

**Core value:** Players can register, get a fair auto-generated match schedule, and track live results without the admin manually coordinating anything during play.
**Current focus:** Starting milestone v1.1

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-04 — Milestone v1.1 Finance & Inventory started

## Accumulated Context

- App is live on Vercel (production) and dev branch deploys to separate Vercel preview
- Supabase CLI blocked on Windows — all DB migrations run via Supabase Dashboard SQL Editor
- Standard session: ~16 players, ~20 matches, 2 courts
- Fisher-Yates shuffle recently fixed in match generator (replaced biased shuffle)
- Early Bird award recently changed to latest-session-only logic
- Roster search + searchable Add Player dropdown recently added
