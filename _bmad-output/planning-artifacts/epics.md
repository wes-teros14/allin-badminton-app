---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-03-18'
inputDocuments: ['prd.md', 'architecture.md', 'ux-design-specification.md']
workflowType: 'epics-and-stories'
project_name: 'badminton_v2'
user_name: 'Wes'
date: '2026-03-18'
---

# badminton_v2 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for badminton_v2, decomposing the requirements from the PRD, UX Design Specification, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Players can sign in using their Google account
FR2: Admin can sign in using their Google account with elevated privileges
FR3: Kiosk view is accessible without authentication
FR4: Player view is accessible without authentication (public read-only)
FR5: Admin can generate a unique registration URL for a session
FR6: Admin can close registration, invalidating the current registration URL
FR7: A signed-in player can register for a session via the active registration URL
FR8: A player who is not signed in is prompted to sign in before registering
FR9: Admin can view the list of registered players for a session
FR10: Admin can manually add or remove a player from a session's roster
FR11: Admin can generate a full match schedule from the confirmed player roster
FR12: Admin can review the generated match schedule before saving it
FR13: Admin can save and lock the match schedule
FR14: Admin can manually edit a match in the schedule after it has been generated
FR15: The system maintains a per-court ordered queue of matches
FR16: The kiosk displays two courts side by side, each showing the current and next queued game
FR17: Players can mark a game as finished on the kiosk, advancing that court's queue (including win/loss outcome capture)
FR18: The kiosk updates in real time (within ≤2 seconds) when the match queue changes
FR19: Admin can manually advance or adjust a court's queue remotely
FR20: Players can view all their matches for the session (game number, partner, opponents)
FR21: The player view reflects completed games and remaining queue in real time (within ≤2 seconds)
FR22: Player view does not display court assignment (court is dynamic, shown only on kiosk)
FR23: Admin changes are pushed to the kiosk without manual refresh
FR24: Kiosk Finish actions are reflected in the admin view in real time (within ≤2 seconds)
FR25: A manual refresh fallback is available on the kiosk if real-time sync fails
FR26: Admin can create a new session
FR27: Admin can set the number of active courts for a session
FR28: Admin can view the current state of all courts and the full match queue during a session
FR29: The system records the win/loss outcome of each doubles game per player
FR30: The system tracks cumulative win/loss record per player across all sessions
FR31: Players can view their own all-time win rate
FR32: Admin can view all-time win rate for all players
FR33: The system records each player's attendance per session from first registration onward
FR34: Admin can view cumulative attendance per player across all sessions
FR35: Players can view their own attendance history across all sessions

### NonFunctional Requirements

NFR1 (Performance): Kiosk updates reflect within ≤2 seconds of any admin or player action
NFR2 (Performance): All user-facing interactions complete within 500ms for 95th percentile actions
NFR3 (Performance): Match generation for 10–30 players completes within 5 seconds
NFR4 (Security): All user data stored in Supabase, protected by row-level security (RLS)
NFR5 (Security): Unauthenticated access limited to public Player view and Kiosk view only
NFR6 (Security): Registration URLs expire on close — old URLs must not grant access
NFR7 (Security): Admin privileges enforced server-side
NFR8 (Reliability): App remains available and functional for the full duration of a session (2–4 hours)
NFR9 (Reliability): Real-time sync failure must not crash or freeze the kiosk — manual refresh fallback keeps session running
NFR10 (Reliability): Match schedule, results, and attendance data must not be lost on device disconnect/reconnect
NFR11 (Scalability): Supports 10–30 concurrent users within Supabase free-tier limits (200 concurrent Realtime connections max)

### Additional Requirements

- AR1: Project scaffold — `npm create vite@latest badminton-v2 -- --template react-ts` + `npm install @supabase/supabase-js tailwindcss @tailwindcss/vite` + `npx shadcn@latest init` (first implementation story)
- AR2: Supabase project setup with Google OAuth provider configured in Supabase Auth dashboard
- AR3: `profiles` table with `role` column (`'admin' | 'player'`) and `name_slug` column; row created via Supabase DB trigger on `auth.users` insert; admin role set manually in DB
- AR4: `session_invitations` table with `token` (UUID), `session_id`, `is_active` (boolean), `created_at` for registration URL management
- AR5: Session state machine as PostgreSQL enum `session_status` with states: `setup → registration_open → registration_closed → schedule_locked → in_progress → complete`; only admin can UPDATE `sessions.status` via RLS
- AR6: `name_slug` column on `profiles` for shareable player URL (`/player/:nameSlug`); generated from Google display name on first sign-in; deduplicated on collision
- AR7: All schema changes managed via Supabase CLI migrations (`supabase migration new` / `supabase db push`)
- AR8: TypeScript DB types auto-generated via `supabase gen types typescript --local > src/types/database.ts` after every migration
- AR9: Vercel deployment with git auto-deploy on push to `main`; `vercel.json` for SPA fallback routing
- AR10: RLS policies for all tables covering three roles: admin (`profiles.role = 'admin'`), authenticated player, and anon (kiosk/player public read)
- AR11: Client-side match generation algorithm in `src/lib/matchGenerator.ts` — pure function, no Supabase calls inside
- AR12: Realtime channel-per-view pattern: `kiosk-{sessionId}`, `player-{nameSlug}-{sessionId}`, `admin-{sessionId}`; cleanup `supabase.removeChannel()` on unmount
- AR13: Win/loss outcome captured on Finish: two-button pair selection in `CourtCard`; stored as `winning_pair_index` (1 or 2) in `match_results` table

### UX Design Requirements

UX-DR1: Implement full design token system in `src/index.css` — light mode CSS variables: `--primary: #9C51B6`, `--primary-hover: #B472CC`, `--primary-pressed: #7A3D8E`, `--primary-subtle: #F0E6F7`, `--success: #22C55E`, `--muted: #6B7280`, `--muted-surface: #F4F4F6`, `--border: #E4E4E7`, `--foreground: #18181B`, `--background: #FFFFFF`
UX-DR2: Implement kiosk dark theme CSS class override — `--background: #0F0F17`, `--surface: #1C1C28`, `--border: #2E2E3E`, `--foreground: #F4F4F6`, `--primary: #B472CC` — applied at `KioskView` root element
UX-DR3: Implement `game-hero` typography scale — 4–6rem, weight 700 — for game number on kiosk and player view
UX-DR4: Build `<CourtCard>` — full-height dark card for one court; contains current game, next game queue, Finish button; states: `live` (primary border, active game highlighted), `idle`; Finish disables on tap, re-enables after server confirmation; winner pair selection on Finish
UX-DR5: Build `<GameCard>` — player view single game card; states: `done` (muted opacity, strikethrough, success checkmark), `active` (primary-subtle tint, hero game number prominent), `queued` (neutral, recedes)
UX-DR6: Build `<StatusChip>` — 3-state badge (Playing / Up Next / Queued / Done) using primary / muted / muted-surface / success colour variants; based on shadcn Badge
UX-DR7: Build `<LiveIndicator>` — realtime connection status dot; states: connected (hidden), reconnecting (amber pulse), fallback (grey, manual refresh mode); placed top corner of kiosk and player view
UX-DR8: Build `<PlayerScheduleHeader>` — purple identity header; displays player name, session name, game count; static once loaded
UX-DR9: Build `<RegistrationURLCard>` — URL display with copy button ("Copied!" 2s label feedback), live player count, open/close toggle; Close Registration uses destructive 2-tap confirm pattern
UX-DR10: Build `<MatchGeneratorPanel>` — 3-stage flow: roster list (`pre-generate`) → editable preview (`preview`) → read-only locked (`locked`); Lock uses destructive 2-tap confirm; no modal
UX-DR11: Build `<CourtTabs>` — two-tab court switcher (Court 1 / Court 2) for admin mobile; primary active indicator; remembers scroll position per tab
UX-DR12: Implement destructive action pattern globally — 2-tap confirm with 5s auto-cancel countdown; button label changes to "Confirm [Action]?" on first tap; tap elsewhere cancels; no modals; applies to Close Registration and Lock Schedule
UX-DR13: Implement kiosk portrait orientation guard — check `screen.orientation.type` on mount in `KioskView`; show "Please rotate your device" overlay if portrait
UX-DR14: Implement skeleton loading states — 3 skeleton `<GameCard>` placeholders on player schedule first load; skeleton list rows for admin roster; no blank screen flash
UX-DR15: Implement in-place animation for real-time queue updates — slide/fade transitions when game queue advances; no position jumps; no auto-scroll
UX-DR16: Implement button hierarchy and feedback pattern — one primary action per screen; action buttons disable immediately on tap (no toast); inline red error text below action on error; no toasts on kiosk
UX-DR17: Kiosk layout — full-viewport `h-screen w-screen overflow-hidden`; 50/50 side-by-side split with two `<CourtCard>` instances; no scroll; no navigation chrome
UX-DR18: Player view layout — single column, 16px padding, mobile portrait (360–430px target), `min-h-screen`, vertical card stack
UX-DR19: Admin desktop layout — 2-column: 280–320px fixed sidebar (schedule/roster list) + fluid main content; sidebar permanent at `lg` breakpoint
UX-DR20: Admin mobile layout — single column, bottom-anchored action bar, `<CourtTabs>` for court switching; full match queue visible on scroll
UX-DR21: Player navigation pattern — `/player` as single shareable link (all registered players listed); tapping a name navigates to `/player/:nameSlug` for personal schedule view

### FR Coverage Map

FR1: Epic 1 — Player Google OAuth sign-in
FR2: Epic 1 — Admin Google OAuth sign-in with elevated privileges
FR3: Epic 1 — Kiosk unauthenticated access
FR4: Epic 1 — Player view unauthenticated access
FR5: Epic 2 — Admin generates unique registration URL
FR6: Epic 2 — Admin closes registration, invalidates URL
FR7: Epic 2 — Player registers via active URL
FR8: Epic 2 — Unsigned-in player prompted to sign in before registering
FR9: Epic 2 — Admin views registered player list
FR10: Epic 2 — Admin manually adds or removes player from roster
FR11: Epic 3 — Admin generates full match schedule from roster
FR12: Epic 3 — Admin reviews generated schedule before saving
FR13: Epic 3 — Admin saves and locks schedule
FR14: Epic 3 — Admin manually edits a match after generation
FR15: Epic 3 — System maintains per-court ordered match queue
FR16: Epic 4 — Kiosk displays two courts side by side (current + next game)
FR17: Epic 4 — Players mark game as finished on kiosk, queue advances; win/loss captured
FR18: Epic 4 — Kiosk updates in real time (≤2 seconds)
FR19: Epic 6 — Admin remotely advances or adjusts court queue
FR20: Epic 5 — Players view all their matches (game number, partner, opponents)
FR21: Epic 5 — Player view reflects completed games and queue in real time (≤2 seconds)
FR22: Epic 5 — Player view does not display court assignment
FR23: Epic 4 — Admin changes pushed to kiosk without manual refresh
FR24: Epic 6 — Kiosk Finish actions reflected in admin view in real time (≤2 seconds)
FR25: Epic 4 — Manual refresh fallback available on kiosk if real-time fails
FR26: Epic 2 — Admin creates a new session
FR27: Epic 2 — Admin sets number of active courts for a session
FR28: Epic 6 — Admin views current state of all courts and full match queue
FR29: Epic 4 — System records win/loss outcome of each game on Finish
FR30: Epic 7 — System tracks cumulative win/loss record per player across sessions
FR31: Epic 7 — Players view their own all-time win rate
FR32: Epic 7 — Admin views all-time win rate for all players
FR33: Epic 2 (recording) / Epic 7 (display) — Attendance recorded from first registration
FR34: Epic 7 — Admin views cumulative attendance per player
FR35: Epic 7 — Players view their own attendance history

## Epic List

### Epic 1: Foundation & Authentication
The app is scaffolded, deployed to Vercel, and all three role-based routes exist. Admin and players can authenticate via Google OAuth. Unauthenticated access to Kiosk and Player routes works. Design token system and base theming established.
**FRs covered:** FR1, FR2, FR3, FR4
**ARs covered:** AR1–AR9
**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR3

### Epic 2: Session Setup & Player Registration
Admin can create a session, set the number of courts, generate a time-limited registration URL, and share it with the group. Players can register via the link using Google OAuth. Admin can view and manage the roster. Attendance recording begins from first registration.
**FRs covered:** FR5, FR6, FR7, FR8, FR9, FR10, FR26, FR27, FR33 (recording)
**UX-DRs covered:** UX-DR9, UX-DR12, UX-DR16

### Epic 3: Match Generation & Schedule Management
Admin can generate a complete match schedule from the confirmed roster, review and edit it inline, then lock it. Court queues are populated and ready for the session. Admin desktop layout established.
**FRs covered:** FR11, FR12, FR13, FR14, FR15
**UX-DRs covered:** UX-DR10, UX-DR19

### Epic 4: Live Kiosk & Real-Time Foundation
The kiosk displays live court state on a landscape tablet. Players tap Finish to advance the queue and record who won. Real-time push infrastructure is established — all views update within ≤2 seconds. Manual refresh fallback available on kiosk.
**FRs covered:** FR16, FR17, FR18, FR23, FR25, FR29
**UX-DRs covered:** UX-DR4, UX-DR6, UX-DR7, UX-DR13, UX-DR14 (kiosk), UX-DR15, UX-DR17

### Epic 5: Player Schedule View
Any player can open a single shareable link on their phone and view their personal match schedule without logging in. The view updates in real time as games finish. Player can find their name from the list or bookmark their personal URL.
**FRs covered:** FR20, FR21, FR22
**UX-DRs covered:** UX-DR5, UX-DR8, UX-DR14 (player), UX-DR18, UX-DR21

### Epic 6: Admin Day-of Session Management
Admin can monitor live court state during the session from their phone, remotely advance or edit queues, and the kiosk and player view reflect changes within ≤2 seconds. Full bidirectional real-time sync verified.
**FRs covered:** FR19, FR24, FR28
**UX-DRs covered:** UX-DR11, UX-DR20

### Epic 7: Player Statistics & Attendance
Players can view their all-time win rate and attendance history across all sessions. Admin can view stats and attendance for all players. Win/loss data flows from Finish actions recorded in Epic 4.
**FRs covered:** FR30, FR31, FR32, FR33 (display), FR34, FR35

## Epic 1: Foundation & Authentication

The app is scaffolded, deployed to Vercel, and all three role-based routes exist. Admin and players can authenticate via Google OAuth. Unauthenticated access to Kiosk and Player routes works. Design token system and base theming established.

### Story 1.1: Project Scaffold & Deployment Pipeline

As a developer,
I want the project scaffolded with the full technology stack and deployed to Vercel,
So that all dev agents have a working, deployable foundation to build on.

**Acceptance Criteria:**

**Given** the project is initialized with `npm create vite@latest badminton-v2 -- --template react-ts` and all dependencies installed (`@supabase/supabase-js`, `tailwindcss`, `@tailwindcss/vite`, shadcn/ui via `npx shadcn@latest init`)
**When** `npm run dev` is run
**Then** the app starts at `localhost:5173` with no console errors
**And** shadcn/ui components are importable via `@/components/ui/`

**Given** `.env.local` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
**When** `npm run build` is run
**Then** the build completes with zero TypeScript errors
**And** environment variables are accessible via `import.meta.env.VITE_SUPABASE_*`

**Given** the project is pushed to `main` on GitHub
**When** Vercel detects the push
**Then** a production deployment completes and the app loads at the Vercel URL

**Given** the app is deployed to Vercel with `vercel.json` SPA fallback config
**When** any route (e.g., `/admin`, `/kiosk`) is accessed directly or refreshed
**Then** the app loads correctly — no 404 from the server

### Story 1.2: Design Token System & Base Theming

As a developer,
I want the full design token system implemented as CSS variables with a kiosk dark theme variant,
So that all components consistently use brand colors and the kiosk dark mode works at the root level.

**Acceptance Criteria:**

**Given** `src/index.css` is the global stylesheet
**When** the app loads in any view
**Then** all light mode tokens are available: `--primary: #9C51B6`, `--primary-hover: #B472CC`, `--primary-pressed: #7A3D8E`, `--primary-subtle: #F0E6F7`, `--success: #22C55E`, `--muted: #6B7280`, `--muted-surface: #F4F4F6`, `--border: #E4E4E7`, `--foreground: #18181B`, `--background: #FFFFFF`

**Given** the CSS class `.kiosk-dark` is applied to the `KioskView` root element
**When** the kiosk view renders
**Then** dark mode tokens override: `--background: #0F0F17`, `--surface: #1C1C28`, `--border: #2E2E3E`, `--foreground: #F4F4F6`, `--primary: #B472CC`

**Given** a `game-hero` Tailwind utility class is defined
**When** applied to a game number element
**Then** the text renders at `4rem` on mobile and `6rem` on larger screens, weight `700`

**Given** shadcn/ui `--primary` maps to the `--primary` CSS token
**When** a shadcn `<Button variant="default">` is rendered
**Then** it displays with background `#9C51B6` (light) or `#B472CC` (kiosk dark)

### Story 1.3: Google OAuth Authentication & User Profiles

As a player or admin,
I want to sign in with my Google account,
So that the system knows who I am and can enforce my role.

**Acceptance Criteria:**

**Given** the Supabase project is configured with the Google OAuth provider
**When** a user clicks "Sign in with Google"
**Then** they are redirected to Google's OAuth consent screen
**And** on successful sign-in, returned to the app as an authenticated Supabase user

**Given** a user signs in to the app for the first time
**When** the `after insert on auth.users` database trigger fires
**Then** a row is created in `profiles` with `id`, `role = 'player'`, and `name_slug` derived from their Google display name (lowercase, hyphens, URL-safe, deduplicated on collision)

**Given** a user is signed in
**When** `useAuth.ts` hook is called
**Then** it returns `{ user, role, isLoading }` where `role` is read from `profiles.role`
**And** `isLoading` is `true` until the profile query resolves, then `false`

**Given** Wes's `profiles` row is manually updated to `role = 'admin'`
**When** Wes signs in and `useAuth` resolves
**Then** `role` returns `'admin'`

### Story 1.4: Application Routes & Role-Based Access Control

As a user,
I want each role to have a dedicated URL that loads the correct view,
So that the kiosk, player, and admin experiences are fully separated and correctly protected.

**Acceptance Criteria:**

**Given** React Router v7 is configured in `App.tsx` with React.lazy views
**When** `/kiosk` is accessed (authenticated or not)
**Then** `KioskView` renders without requiring authentication

**Given** `/player` or `/player/:nameSlug` is accessed (authenticated or not)
**When** any user opens the URL
**Then** `PlayerView` renders without requiring authentication

**Given** `/admin` is accessed by a user with `role !== 'admin'` or no session
**When** the `AdminRoute` guard checks the auth state
**Then** the user is redirected to `/`

**Given** `/admin` is accessed by a user with `role === 'admin'`
**When** the `AdminRoute` guard resolves
**Then** `AdminView` renders correctly

**Given** each view is loaded via `React.lazy()`
**When** a user navigates to a route
**Then** only that route's JavaScript bundle is fetched — kiosk does not load admin bundle

**Given** an unknown path is accessed
**When** React Router evaluates the route
**Then** a redirect to `/` is shown — no blank screen

## Epic 2: Session Setup & Player Registration

Admin can create a session, generate a time-limited registration URL, and players can register via the link. Admin can view and manage the roster. Attendance recording begins from first registration. Courts are fixed at 2 — no court count configuration needed.

### Story 2.1: Create New Session

As an admin,
I want to create a new session,
So that the session is ready to accept player registrations.

**Acceptance Criteria:**

**Given** the admin is signed in and on the Admin view
**When** they enter a session name and date and tap "Create Session"
**Then** a new row is inserted into `sessions` with `status = 'setup'`
**And** the `sessions` table uses the `session_status` enum (`setup`, `registration_open`, `registration_closed`, `schedule_locked`, `in_progress`, `complete`)
**And** only admin can INSERT/UPDATE sessions (RLS enforced)

**Given** a session has been created
**When** the admin views the Admin panel
**Then** the session name, date, and current status are displayed

### Story 2.2: Registration URL Generation

As an admin,
I want to generate a unique registration URL for a session,
So that I can share it with players and they can self-register.

**Acceptance Criteria:**

**Given** a session exists with `status = 'setup'`
**When** the admin taps "Open Registration"
**Then** a UUID token is inserted into `session_invitations` with `session_id`, `is_active = true`, `created_at`
**And** the session `status` updates to `'registration_open'`

**Given** an active invitation token exists
**When** the `<RegistrationURLCard>` component renders
**Then** the full registration URL (`/register?token={uuid}`) is displayed
**And** a copy button is present; tapping it changes the label to "Copied!" for 2 seconds then reverts (no toast)
**And** the current registered player count is shown

**Given** the admin has already opened registration
**When** they view the RegistrationURLCard
**Then** only one active token exists per session at any time

### Story 2.3: Player Registration via OAuth Link

As a player,
I want to register for a session by clicking the link the admin shared,
So that I appear on the roster and my attendance is recorded.

**Acceptance Criteria:**

**Given** a player receives and clicks the registration URL with a valid token
**When** they are not signed in to Google
**Then** they are prompted to sign in via Google OAuth before proceeding
**And** after sign-in, they land on the registration confirmation page

**Given** a player is signed in and visits a URL with a valid, active token
**When** they tap "Register"
**Then** a row is inserted into `session_registrations` (`player_id`, `session_id`, `registered_at`)
**And** this records the attendance for FR33

**Given** a player visits a URL with a token where `is_active = false`
**When** the registration page loads
**Then** an error message is shown: "Registration is closed. Contact the admin."
**And** no registration action is possible

**Given** a player is already registered for the session
**When** they visit the registration URL again
**Then** they see a confirmation that they are already registered — no duplicate row is created

### Story 2.4: Roster Management & Registration Close

As an admin,
I want to view the registered player list, manually adjust it, and close registration when ready,
So that I have full control over the final roster before generating the schedule.

**Acceptance Criteria:**

**Given** players have registered for a session
**When** the admin views the roster panel
**Then** all registered players are listed with their display names
**And** the list updates in real time as new players register

**Given** the admin views the roster
**When** they tap "Add Player" and select a player from the all-players list
**Then** a row is inserted into `session_registrations` for that player

**Given** the admin views the roster
**When** they tap "Remove" next to a player's name
**Then** that player's `session_registrations` row is deleted
**And** the list updates immediately

**Given** registration is open and the admin taps "Close Registration"
**When** they confirm via the destructive 2-tap pattern (first tap changes button to "Confirm Close?", second tap within 5s executes)
**Then** `session_invitations.is_active` is set to `false` for the current token
**And** the session `status` updates to `'registration_closed'`
**And** subsequent visits to the old registration URL show the "Registration closed" error

**Given** the admin taps "Close Registration" then taps elsewhere within 5 seconds
**When** the auto-cancel fires
**Then** the button reverts to "Close Registration" — no action taken

## Epic 3: Match Generation & Schedule Management

Admin can generate a complete match schedule from the confirmed roster, review and edit it inline, then lock it. The single ordered match queue is initialised and ready for the kiosk to run the session.

### Story 3.1: Match Schedule Generation & Preview

As an admin,
I want to generate a full match schedule from the confirmed roster and review it before saving,
So that I can verify the schedule is fair before locking it in.

**Acceptance Criteria:**

**Given** a session has `status = 'registration_closed'` with ≥ 4 registered players
**When** the admin taps "Generate Schedule" in `<MatchGeneratorPanel>`
**Then** `lib/matchGenerator.ts` runs client-side and produces a list of doubles matches covering all players
**And** the algorithm completes within 5 seconds for 10–30 players
**And** the schedule is displayed in the `preview` stage of MatchGeneratorPanel — not yet saved to DB

**Given** the preview is displayed
**When** the admin reviews it
**Then** each match shows: game number, player 1 + player 2 vs player 3 + player 4
**And** all registered players appear across the schedule with fair rotation (no player sits out consecutively)

**Given** the admin views the preview
**When** they tap "Generate Again"
**Then** a new schedule is generated and replaces the preview — still not saved to DB

**Given** the admin is on the desktop layout
**When** the MatchGeneratorPanel renders in `preview` state
**Then** the full schedule is visible in a scrollable list with the 2-column admin desktop layout (280px sidebar + fluid content)

### Story 3.2: Lock Schedule & Initialise Match Queue

As an admin,
I want to save and lock the match schedule,
So that the ordered match queue is ready for the kiosk to run the session.

**Acceptance Criteria:**

**Given** the admin has reviewed the generated schedule preview
**When** they tap "Save & Lock" and confirm via the destructive 2-tap pattern
**Then** all matches are inserted into the `matches` table with `queue_position` (1, 2, 3…), player IDs, and `status = 'queued'`
**And** the session `status` updates to `'schedule_locked'`
**And** the MatchGeneratorPanel transitions to `locked` state (read-only)

**Given** the schedule is locked
**When** the admin views the MatchGeneratorPanel
**Then** the schedule is displayed as read-only — no edit controls visible in the panel

**Given** the admin taps "Save & Lock" then taps elsewhere within 5 seconds
**When** the auto-cancel fires
**Then** the button reverts — no data is written to the DB

**Given** the matches are saved
**When** the `matches` table is queried ordered by `queue_position`
**Then** the full session queue is returned as a single ordered list — no pre-assignment to courts (courts claim matches dynamically when they finish)

### Story 3.3: Post-Lock Match Editing

As an admin,
I want to edit individual matches after the schedule is locked,
So that I can correct mistakes or swap players before the session begins.

**Acceptance Criteria:**

**Given** the schedule is locked and matches exist in the `matches` table
**When** the admin taps "Edit" on a specific match in the admin view
**Then** an inline edit form shows the four player slots for that match

**Given** the admin makes changes to player assignments in the edit form
**When** they tap "Save"
**Then** the match row in `matches` is updated with the new player IDs
**And** the schedule list refreshes to show the updated match

**Given** the admin is editing a match
**When** they tap "Cancel"
**Then** no changes are saved and the edit form closes

**Given** a match has `status = 'playing'` or `status = 'complete'`
**When** the admin views that match
**Then** the Edit button is disabled — only `status = 'queued'` matches are editable

## Epic 4: Live Kiosk & Real-Time Foundation

The kiosk displays live court state on a landscape tablet. Players tap Finish to advance the single match queue and record who won. Real-time push infrastructure established — kiosk updates within ≤2 seconds of any change.

### Story 4.1: Kiosk Layout & Court Display

As a player at the venue,
I want to see both courts on the tablet in real time,
So that I can immediately see which game is on each court and what's coming next.

**Acceptance Criteria:**

**Given** the session has `status = 'in_progress'` and matches exist in the queue
**When** `/kiosk` loads on a landscape tablet
**Then** two `<CourtCard>` components render side by side in a 50/50 full-viewport split
**And** each CourtCard shows: current game number (4–6rem game-hero), the four player names, and the next queued game below it
**And** the kiosk dark theme (`.kiosk-dark`) is applied at the `KioskView` root

**Given** `KioskView` mounts
**When** `screen.orientation.type` is portrait
**Then** a "Please rotate your device" overlay covers the entire screen — no court content visible

**Given** `KioskView` is loading its first data fetch
**When** the data has not yet arrived
**Then** skeleton placeholders render inside each CourtCard — no blank screen flash

**Given** a court has no current game (between rounds or session not started)
**When** the CourtCard renders
**Then** it shows an `idle` state: "Waiting for next game" — no Finish button visible

**Given** `useCourtState` queries the match queue
**When** determining what shows on each court
**Then** the two matches with `status = 'playing'` are shown as current games (one per court)
**And** the next two matches with `status = 'queued'` (by `queue_position`) are shown as "up next"

### Story 4.2: Finish Action, Queue Advancement & Outcome Capture

As a player finishing a game,
I want to tap Finish on my court and record who won,
So that the queue advances and the result is recorded for stats.

**Acceptance Criteria:**

**Given** a match has `status = 'playing'` on a court
**When** a player taps the Finish button on that CourtCard
**Then** the button disables immediately — double-tap is prevented
**And** two "Who won?" buttons appear showing Pair 1 names vs Pair 2 names

**Given** the "Who won?" selection is shown
**When** the player taps one of the pair buttons
**Then** the current match `status` updates to `'complete'`
**And** a row is inserted into `match_results` with `match_id`, `winning_pair_index` (1 or 2), `completed_at`
**And** the next `status = 'queued'` match by `queue_position` is assigned to this court (`court_number` set, `status` → `'playing'`)
**And** the CourtCard animates the transition — completed game slides out, next game slides in (in-place, no scroll jump)

**Given** the queue has no remaining matches
**When** the last match is finished
**Then** the CourtCard shows "Session complete" — Finish button is hidden

**Given** a Finish action is in progress (waiting for server confirmation)
**When** the server write completes
**Then** the Finish button re-enables only after confirmation — preventing orphaned state

### Story 4.3: Real-Time Kiosk Updates & Manual Refresh Fallback

As a player watching the kiosk,
I want the display to update automatically when anything changes,
So that I never see stale information and the session never stops if sync fails.

**Acceptance Criteria:**

**Given** the kiosk is displaying the active session
**When** any match status changes in the DB (from any source — Finish tap, admin edit, or queue advance)
**Then** the kiosk reflects the change within ≤2 seconds — no manual refresh needed

**Given** the Supabase Realtime channel `kiosk-{sessionId}` is active
**When** a `postgres_changes` event fires on the `matches` table
**Then** `useCourtState` re-queries and both CourtCards update silently

**Given** the `<LiveIndicator>` is mounted in the top corner of KioskView
**When** the Realtime connection is healthy
**Then** the indicator is hidden — no visual noise

**Given** the Realtime connection drops or fails to connect
**When** `useRealtime` detects the disconnect
**Then** `isConnected` becomes `false`
**And** `<LiveIndicator>` shows amber pulse ("Reconnecting…")
**And** a "Refresh" button becomes visible on the kiosk

**Given** the Realtime connection cannot be restored
**When** a player taps the "Refresh" button
**Then** `refetch()` is called and the kiosk re-queries the DB directly — session continues uninterrupted

**Given** the Realtime channel cleanup
**When** `KioskView` unmounts
**Then** `supabase.removeChannel(channel)` is called — no memory leaks

## Epic 5: Player Schedule View

Any player opens a single shareable link on their phone, finds their name, and sees their full personal match schedule without logging in. Updates in real time as games finish.

### Story 5.1: Player List & Personal Schedule Navigation

As a player,
I want to open one shared link and find my name to see my schedule,
So that I can check my games without needing a personal link or login.

**Acceptance Criteria:**

**Given** the admin has shared `/player` with the group
**When** a player opens it on their phone (no login required)
**Then** the page loads and lists all registered players for the active session
**And** each player name is a tappable link

**Given** a player taps their name on the `/player` list
**When** the navigation resolves
**Then** the URL updates to `/player/:nameSlug`
**And** their personal schedule view loads

**Given** a player bookmarks `/player/:nameSlug` directly
**When** they open it on return visits
**Then** their personal schedule loads directly — no list navigation needed

**Given** no active session exists
**When** `/player` loads
**Then** a centred message shows: "No active session" — no player list rendered

### Story 5.2: Personal Match Schedule Display

As a player,
I want to see all my matches for the session with their status,
So that I can quickly find my next game and know who I'm playing.

**Acceptance Criteria:**

**Given** a player navigates to `/player/:nameSlug`
**When** the `<PlayerScheduleHeader>` renders
**Then** the player's display name, session name, and total game count are shown in the purple header

**Given** the player's matches are loaded via `usePlayerSchedule`
**When** the `<GameCard>` list renders
**Then** each card shows: game number (game-hero size), partner name, vs opponent names
**And** court assignment is not shown — intentionally omitted

**Given** a match has `status = 'complete'`
**When** that `<GameCard>` renders
**Then** it shows `done` state: muted opacity, strikethrough game number, success checkmark

**Given** a match has `status = 'playing'`
**When** that `<GameCard>` renders
**Then** it shows `active` state: `--primary-subtle` tint background, game number prominently styled
**And** a `<StatusChip>` shows "Playing"

**Given** a match has `status = 'queued'`
**When** that `<GameCard>` renders
**Then** it shows `queued` state: neutral styling, recedes visually
**And** a `<StatusChip>` shows "Up Next" for the immediately next match, "Queued" for the rest

**Given** the player schedule is loading for the first time
**When** data has not yet arrived
**Then** 3 skeleton `<GameCard>` placeholders render — no blank screen flash

### Story 5.3: Real-Time Player View Updates

As a player,
I want my schedule to update automatically as games finish,
So that I always see the current state without refreshing.

**Acceptance Criteria:**

**Given** a player has `/player/:nameSlug` open on their phone
**When** any match in the session changes status (e.g., a game finishes on the kiosk)
**Then** the affected `<GameCard>` updates within ≤2 seconds — `done` state animates in silently

**Given** the Supabase Realtime channel `player-{nameSlug}-{sessionId}` is active
**When** a `postgres_changes` event fires on `matches`
**Then** `usePlayerSchedule` re-queries and only the affected player's cards update

**Given** the `<LiveIndicator>` is mounted in the top corner of PlayerView
**When** the Realtime connection is healthy
**Then** the indicator is hidden

**Given** the Realtime connection drops
**When** `useRealtime` detects the disconnect
**Then** `<LiveIndicator>` shows amber pulse
**And** a "Refresh" button appears — player can manually sync

**Given** the player view layout
**When** rendered on a mobile phone (360–430px portrait)
**Then** single column, 16px horizontal padding, cards stack vertically with natural scroll

## Epic 6: Admin Day-of Session Management

Admin monitors live court state from their phone and makes real-time interventions. Remote changes push to the kiosk and player view within ≤2 seconds. Full bidirectional real-time sync verified.

### Story 6.1: Admin Mobile Live Court View

As an admin,
I want to see the live state of both courts and the full match queue from my phone,
So that I can monitor the session without being at the kiosk.

**Acceptance Criteria:**

**Given** the admin is signed in and navigates to `/admin` on their phone
**When** the session has `status = 'in_progress'`
**Then** `<CourtTabs>` renders with two tabs — Court 1 and Court 2
**And** the active tab shows the current game and upcoming queue for that court

**Given** the admin switches between Court 1 and Court 2 tabs
**When** the tab changes
**Then** scroll position is preserved per tab — no jump to top

**Given** the admin mobile layout loads
**When** rendered on a mobile phone
**Then** single column layout with bottom-anchored action bar renders correctly

**Given** the admin views the full match queue
**When** they scroll down in the active tab
**Then** all remaining queued matches are visible in order

**Given** the Supabase Realtime channel `admin-{sessionId}` is active
**When** a match status changes (e.g., kiosk Finish tap)
**Then** the admin view reflects the change within ≤2 seconds
**And** `<LiveIndicator>` is visible in the admin view with the same connected/disconnected states

### Story 6.2: Remote Queue Intervention

As an admin,
I want to remotely advance or edit the match queue from my phone,
So that I can fix issues during the session without touching the kiosk tablet.

**Acceptance Criteria:**

**Given** the admin sees a queued match in the Court tab
**When** they tap "Edit" on that match
**Then** an inline form opens showing the four player slots — no modal

**Given** the admin makes player changes and taps "Save"
**When** the update is written to the `matches` table
**Then** the kiosk and player view reflect the change within ≤2 seconds

**Given** the admin taps "Move Up" or "Move Down" on a queued match
**When** the reorder is saved
**Then** the `queue_position` values are swapped in the DB
**And** the kiosk "up next" panel reflects the new order within ≤2 seconds

**Given** the admin taps "Mark Done" on a currently playing match
**When** confirmed (single tap — not destructive)
**Then** the match `status` updates to `'complete'` with no `winning_pair_index` recorded (admin override, no stats impact)
**And** the next queued match advances to that court

**Given** any admin intervention is saved
**When** the write completes
**Then** the action button disables during the write and re-enables on completion — no duplicate submissions

## Epic 7: Player Statistics & Attendance

Players see their all-time win rate and attendance history. Admin sees stats and attendance across all players. Win/loss data flows from Finish actions recorded in Epic 4.

### Story 7.1: Player Stats View

As a player,
I want to see my all-time win rate and attendance history,
So that I can track my performance across all sessions.

**Acceptance Criteria:**

**Given** a player navigates to `/player/:nameSlug`
**When** the stats section renders below their match schedule
**Then** their all-time win rate is displayed as wins / total games and a percentage

**Given** `match_results` has rows for this player
**When** the win rate is calculated
**Then** it counts games where `winning_pair_index` matches the pair the player was on
**And** total games = all `match_results` rows where this player appeared in any pair

**Given** the player views their attendance section
**When** `session_registrations` is queried for this player
**Then** a list of all sessions they registered for is shown with session name and date

**Given** a player has no completed games yet
**When** the stats section renders
**Then** it shows "No games recorded yet" — no error, no division by zero

### Story 7.2: Admin Stats View

As an admin,
I want to see win rates and attendance for all players,
So that I can track overall performance and seed future match generations.

**Acceptance Criteria:**

**Given** the admin navigates to the stats section of the admin view
**When** the all-players stats table renders
**Then** each registered player is listed with: display name, total games played, wins, win rate %

**Given** the admin views the attendance section
**When** `session_registrations` is queried across all sessions
**Then** each player shows a cumulative attendance count and list of sessions attended

**Given** the admin views the stats table
**When** sorted by win rate (default: descending)
**Then** the player with the highest win rate appears first

**Given** a player has attended sessions but has no completed games
**When** the stats table renders for that player
**Then** their win rate shows "–" or "0%" — no error

**Given** the stats data is loading
**When** the query is in flight
**Then** skeleton rows render in the table — no blank flash
