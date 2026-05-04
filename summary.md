# All-In Badminton App — Feature Summary

## Overview
A real-time badminton session manager built for weekly group play. Covers the full session lifecycle — from player registration through live match tracking, result recording, and post-session leaderboards.

---

## Session Lifecycle
Sessions move through six stages: **Setup → Registration Open → Registration Closed → Schedule Locked → In Progress → Complete**.

- Configurable session details: venue, date, time, duration, price, notes
- Scheduled auto-open for registration at a specified date/time
- Shareable invitation token system (UUID per session)
- Admin controls at every stage: open/close registration, lock/unlock schedule, start/stop session

---

## Match Generation Engine
The core of the app. A three-phase algorithm that builds the full match schedule automatically:

1. **Assignment Phase** — Fairly distributes players across matches (participation gap ≤ 1 guaranteed)
2. **Team Formation** — Picks the best 2v2 split from each group of 4 to minimize skill imbalance
3. **Simulated Annealing Optimization** — Runs 15 starts × 50 trials (~750 candidate schedules) and picks the best

### What it optimizes for:
- **Skill balance** — minimizes level spread within a match
- **No back-to-back games** — enforces rest gaps between a player's matches
- **Repeat partner avoidance** — penalizes playing with the same partner repeatedly
- **Gender balance** — scores Mixed Doubles, Same-Gender matches, and uneven splits differently
- **Fairness** — early rest window bonus rewards clean pacing in first few rounds
- **Configurable rules** — max consecutive games, max skill spread, ideal rest spacing, match count

---

## Player Views
Each player has a personal view of the session:

- **Match Schedule** — see all assigned matches, partners, opponents, and win/loss results
- **Live Wait Time** — counts down in real time based on current playing matches and queue position
- **Session Detail View** — session-specific match history, leaderboard position, and cheers UI
- **My Sessions** — lists all sessions the player is registered in (active and past)

---

## Live Board
A full-screen display designed for projector use (landscape-only):

- Dual-court layout showing the current match on each court
- Next queued match visible per court
- Updates instantly via Supabase real-time subscriptions — no refresh needed

---

## Admin Court View
The admin's in-progress view mirrors the live board but adds controls:

- Record match results (mark winner)
- Advance to next queued match
- Real-time connection status indicator
- Color-coded court cards with live/upcoming match info

---

## Cheers System
A post-match social engagement feature:

- After a match completes, all 4 players get a cheer opportunity for the other 3
- 6 cheer types: Offense, Defense, Technique, Movement, Good Sport, Solid Effort
- Cheers are tracked per player across all sessions
- Aggregated into a **Cheer Leaderboard** on the player's profile

---

## Leaderboards & Stats
- **All-Time Leaderboard** — sorted by (wins × 2 − losses) points
- **Cheer Leaderboard** — top receivers broken down by cheer type
- **Session Leaderboard** — per-session wins visible during and after play
- **Player Profile** — lifetime games played, wins, sessions attended, cheer stats, and emoji awards

---

## Registration Flow
- Players self-register via a shareable session link + Google OAuth
- Token stored in localStorage during OAuth redirect to survive the page reload
- In-app browser detection (Facebook, Instagram, etc.) with link-copy fallback
- Admin can manually add/remove players and override per-session gender/level

---

## Real-Time Architecture
All live data is powered by **Supabase Realtime** (Postgres change subscriptions):

- Match status changes propagate instantly to all connected clients
- Roster updates reflect immediately in admin view
- Player wait times recalculate as matches start and finish
- Connection status tracked with a manual refresh fallback

---

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend / DB | Supabase (Postgres + Realtime + Auth) |
| Forms | React Hook Form + Zod |
| Notifications | Sonner |
| Testing | Vitest, Playwright |
