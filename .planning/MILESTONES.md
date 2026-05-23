# Milestones

## v1.3 - Split Match Scoring (Completed)

**Goal:** Allow sessions to run in either normal one-game mode or split-match mode while keeping result entry and stats correct.

**Shipped:**
- Session-level split scoring toggle in the admin session flow
- Split finish flows in both live board and admin court views
- Two-row game-level result persistence for split outcomes
- `1-1` draw support as a valid split result
- Split-aware leaderboard, profile, and schedule aggregation
- Browser validation for split write-path and stats read-path behavior

**Milestone stats:**
- Phases: 13-15
- Plans: 8
- Tasks: 18
- Requirements satisfied: 12/12

**Archive:**
- [v1.3-ROADMAP.md](/C:/1Wes/all-in-badminton-app/.planning/milestones/v1.3-ROADMAP.md)
- [v1.3-REQUIREMENTS.md](/C:/1Wes/all-in-badminton-app/.planning/milestones/v1.3-REQUIREMENTS.md)

**Last phase:** 15 (split stats aggregation verified)

## v1.0 - Initial Build (Completed)

**Goal:** Build a fully functional badminton session manager from scratch.

**Shipped:**
- Session lifecycle (6 states) with admin controls
- Match generation engine with simulated annealing optimization
- Player self-registration via Google OAuth + invite links
- Live board (projector-optimized, Supabase Realtime)
- Admin court view with result recording
- Player views: schedule, wait time, session detail, My Sessions
- Cheers system plus leaderboards and player profile awards
- Today tab with multi-session support
- Roster search plus active player filter
- Registration Early Bird award (latest session only)

**Last phase:** 7 (Epics 1-7 completed via BMAD)

---
*Milestone history initialized: 2026-05-03*
