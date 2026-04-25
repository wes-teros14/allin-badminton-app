---
title: 'Navigation & Insights Brainstorming'
created: '2026-03-21'
status: 'complete'
stepsCompleted: [1, 2, 3, 4]
session_topic: 'App navigation/page flow improvements and Insights feature ideation'
session_goals: 'Surface navigation pain points and generate ideas for player stats/insights feature'
selected_approach: 'ai-recommended'
techniques_used: ['Role Playing', 'SCAMPER', 'What If Scenarios']
ideas_generated: 19
session_active: false
workflow_completed: true
---

# Brainstorming Session — Navigation & Insights

**Date:** 2026-03-21
**Topic:** App navigation/page flow improvements + Insights feature ideation
**Goals:** Surface navigation pain points, generate ideas for player stats/insights
**Techniques:** Role Playing → SCAMPER (all 7 lenses) → What If Scenarios

---

## Session Overview

**Problem Statement:**
The app's navigation is hub-and-spoke around the homepage — players who arrive via shared links (the majority) never discover the profile page or insights features. The `/profile` page has no navigation back to the schedule during live sessions. The Insights feature (story 7-1) is in backlog with no concrete design.

**Solution Approach:**
Replace scattered back-links with a persistent 3-tab top nav bar for players. Redesign the homepage to be sign-in only for unauthenticated users. Build out Insights as a combination of live session features (ETA, banners, leaderboard) and profile-based career stats.

**Context:**
- Already implemented as of 2026-03-21: venue/time fields, nickname substitution in player views, migration 013 (player_stats + player_pair_stats with realtime triggers), match duration tracking
- Admin audit panel already exists in MatchGeneratorPanel (score, participation gap, streak violations, skill gaps, wishes granted)

---

## Technique Execution

### Phase 1: Role Playing
Explored 3 personas: Regular Player, First-Time Visitor, Admin during live session.
Key breakthrough: Discovery is the core problem — players live in a single-page bubble with no awareness of richer features. The homepage "My Profile" button is invisible to players who arrive via shared links.

### Phase 2: SCAMPER
Systematically attacked all 7 lenses across navigation and Insights.
Key breakthrough: The 3-tab top nav bar emerged from combining Substitute (replace back-links) + Eliminate (remove homepage dependency) lenses. Queue ETA emerged from Adapt (Grab/Uber pattern).

### Phase 3: What If Scenarios
Bold ideas with no constraints.
Key breakthrough: Nemesis & Bond cards — turns raw stats into personal narrative. Session Recap card — stats delivered as a moment of delight rather than a page you visit.

---

## Complete Idea Inventory

### Theme 1: Navigation Foundation

| ID | Idea | Notes |
|----|------|-------|
| Nav #3 | **3-tab Top Nav Bar: 🏸 Schedule / 🏆 Today / 👤 Profile** | Persistent across all player-facing pages. Auto deep-links to active session schedule. |
| E #1 | **Homepage → Sign-in only** | Authenticated users auto-redirect: players → Schedule, admins → `/admin` |
| E #2 | **Remove scattered back-links** | "← Home", "← Admin", "← All players" replaced by top nav bar |
| Nav #4 | **Admin Sidebar Navigation** | Persistent left sidebar on `/admin`, `/session/:id`, `/players` |

### Theme 2: Player Discovery & Onboarding

| ID | Idea | Notes |
|----|------|-------|
| Nav #1 | **Schedule → Profile discovery banner** | Subtle card at bottom of schedule: "See your full stats & profile →" |
| Nav #5 | **Post-registration onboarding card** | After successful registration: "You're in! 🎉 Check your profile →" |
| WI #1 | **Auto-select returning player** | localStorage remembers player identity, skips name-finding list on return visits |
| Nav #2 | **Context-aware "Back to Schedule" on Profile** | Deep-link button only appears during `in_progress` sessions |

### Theme 3: Live Session Experience

| ID | Idea | Notes |
|----|------|-------|
| A #2 | **"Now On Court" sticky banner** | 🏸 You're on court now! / ⏳ You're up next — real-time, top of schedule |
| A #3 | **Queue ETA** | "3 games ahead · ~60 min wait" using actual tracked match duration. Fallback: 20 min/game |
| M #2 | **Win/Loss badge on completed game rows** | ✅ Win / ❌ Loss inline on schedule view — immediate feedback loop |
| Nav #6 | **Admin FAB during live sessions** | Floating action button: quick links to Kiosk, Match Schedule, Session during `in_progress` |
| S #2 | **Session Progress Stepper** | `Setup → Reg Open → Reg Closed → Locked → Live → Done` with filled/empty dots |

### Theme 4: Insights & Stats

| ID | Idea | Notes |
|----|------|-------|
| M #1 | **All-time career stats** | Win rate, games, partners across ALL sessions — not just current |
| S #3 | **Win Rate dual format** | "12W 5L · 71%" — count gives context the percentage alone hides |
| M #3 | **Real-time profile stats** | Leverages existing `player_stats` Supabase Realtime triggers (migration 013) |
| P #3 | **🏆 Today tab — Live Leaderboard** | Top win rate + Most Improved Today 🔥. Shows all-time stats when no active session |
| R #1 | **Session Recap card** | Pushed on next app open after session completes: "4W 2L today, best partner was Rico 🏸" |
| WI #3 | **Nemesis 😤 & Bond 🤝 cards** | Single named rivalry + partner highlight on profile — turns stats into personal narrative |
| WI #2 | **Upset badge ⚡** | Awarded when beating a significantly higher-ranked opponent |

---

## Prioritization

### ⚡ Quick Wins — Implement First
*Low effort, high visibility*

1. **Win/Loss badge on game rows** — data already exists, purely UI change
2. **Real-time profile stats** — triggers already in place (migration 013), wire up Realtime subscription
3. **Win Rate dual format** — display-only change on profile page
4. **"Now On Court" sticky banner** — Realtime already wired in player views
5. **Session Progress Stepper** — UI component, status values already defined

### 🏗️ Core Features — Next Sprint
*Medium effort, foundational*

6. **3-tab Top Nav Bar** — structural change, unlocks everything in Theme 1 & 2
7. **Homepage → sign-in only + auto-redirect** — depends on top nav bar
8. **Remove scattered back-links** — cleanup after top nav bar is in place
9. **All-time career stats** — query changes to aggregate across sessions
10. **🏆 Today tab — Live Leaderboard + Most Improved** — new tab, new queries

### 🚀 Breakthrough Features — Future Sprints
*Higher effort, highest delight*

11. **Queue ETA** — requires surfacing match duration data into player view
12. **Session Recap card** — trigger on session `complete` status change
13. **Nemesis & Bond cards** — `player_pair_stats` queries, profile page additions
14. **Auto-select returning player** — localStorage implementation
15. **Admin Sidebar** — admin-side nav restructure

### 💡 Nice-to-Have
16. Post-registration onboarding card
17. Context-aware "Back to Schedule" on Profile
18. Admin FAB during live sessions
19. Upset badge ⚡

---

## Action Plans

### Priority 1: Top Nav Bar (3-tab)
**Why this matters:** Unlocks player discovery of Profile and Today tab. Removes homepage dependency. Foundation for all other navigation improvements.
**Next steps:**
1. Create `TopNavBar` component with 3 tabs — active state based on current route
2. Integrate into all player-facing views (PlayerView, ProfileView, Today tab placeholder)
3. Auto deep-link Schedule tab to active session when one exists
4. Remove `← Home` / `← All players` back-links from player views
5. Update HomeView to redirect authenticated users (players → `/match-schedule`, admins → `/admin`)

**Dependencies:** None — can start immediately
**Success indicator:** Player can navigate between Schedule, Today, and Profile without ever touching the homepage

---

### Priority 2: Insights — Quick Wins Bundle
**Why this matters:** High visibility, low effort, leverages existing infrastructure (migration 013, Realtime)
**Next steps:**
1. Add Win/Loss result to match rows in `ScheduleView`
2. Subscribe to `player_stats` Realtime on ProfileView — remove manual refresh need
3. Update win rate display to show "12W 5L · 71%" format
4. Add "Now On Court" / "Up Next" sticky banner to ScheduleView using existing match status

**Dependencies:** None — all data already available
**Success indicator:** Profile feels live during a session. Schedule shows results inline.

---

### Priority 3: 🏆 Today Tab — Live Leaderboard
**Why this matters:** Creates social engagement and friendly competition at the venue. Gives every player a reason to check the app between games.
**Next steps:**
1. Create `TodayView` component as 3rd tab in top nav
2. Query `player_stats` for current session — rank by win rate
3. Add "Most Improved Today" — compare today's win rate vs career average
4. Subscribe to Realtime updates — leaderboard refreshes as matches complete
5. Show all-time leaderboard (most career games/wins) when no active session

**Dependencies:** Top nav bar (Priority 1)
**Success indicator:** Players check the leaderboard between games without prompting

---

## Session Summary

**Total ideas generated:** 19 confirmed across 3 techniques
**Key themes identified:** 4 (Navigation Foundation, Discovery & Onboarding, Live Session Experience, Insights & Stats)
**Quick wins identified:** 5 (implementable immediately)
**Breakthrough concepts:** Queue ETA, Session Recap card, Nemesis & Bond cards, Most Improved Today

**Biggest insight from this session:**
The navigation problem and the insights problem are the same problem — players don't know what exists. The 3-tab top nav bar solves navigation AND acts as the primary discovery mechanism for Insights. Build the nav bar first and everything else becomes more valuable.

**What already exists that can be leveraged:**
- `player_stats` + `player_pair_stats` tables with Realtime triggers (migration 013)
- Match duration tracking
- Admin audit panel (MatchGeneratorPanel)
- Venue/time fields now live (migration 015)
- Nickname resolution in player views

---

*Session facilitated using BMAD Brainstorming Workflow — Role Playing + SCAMPER + What If Scenarios*
