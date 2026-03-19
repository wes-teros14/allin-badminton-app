# Story 4.1: Kiosk Layout and Court Display

## Status: review

## Story
As a player at the venue, I want to see both courts on the tablet in real time, so that I can immediately see which game is on each court and what's coming next.

## Acceptance Criteria

- **AC1**: Given session has `status = 'in_progress'` (or `schedule_locked` for dev), when `/kiosk` loads, two CourtCard components render side by side in a 50/50 full-viewport split with kiosk dark theme applied.
- **AC2**: Each CourtCard shows: current game number (game-hero 4–6rem), four player names, and next queued game below.
- **AC3**: Given `KioskView` mounts in portrait orientation, a "Please rotate your device" overlay covers the entire screen.
- **AC4**: Given first data fetch is loading, skeleton placeholders render — no blank flash.
- **AC5**: Given a court has no current game, CourtCard shows idle state: "Waiting for next game".
- **AC6**: `useCourtState` assigns up to 2 `playing` matches as current (one per court) and next 2 `queued` matches as "up next".

## Tasks / Subtasks

- [x] Task 1: Create `useCourtState` hook
  - [x] Fetch latest active session (status in schedule_locked, in_progress)
  - [x] Fetch matches ordered by queue_position
  - [x] Resolve player UUIDs to name_slugs via profiles
  - [x] Derive court1/court2 state from playing + queued matches

- [x] Task 2: Create `CourtCard` component
  - [x] Loading skeleton state (animate-pulse)
  - [x] Idle state: "Waiting for next game"
  - [x] Live state: game-hero number, player names, Up Next section

- [x] Task 3: Update `KioskView`
  - [x] Portrait orientation guard (overlay)
  - [x] 50/50 split flex layout with two CourtCards
  - [x] No session fallback message

- [x] Task 4: Build & lint pass clean

## Dev Notes

- `useCourtState` queries `['schedule_locked', 'in_progress']` so it's testable before session starts
- Finish button is **NOT** part of this story — added in Story 4.2
- `game-hero` CSS utility already defined in `index.css`
- `.kiosk-dark` CSS class already applied at KioskView root
- Orientation check uses `window.matchMedia('(orientation: portrait)')` for broad browser support
- No toast on kiosk — per UX spec, ambient display has no notification recipient

## Dev Agent Record

### Completion Notes
All tasks implemented. Build and lint pass clean.

## File List
- `badminton-v2/src/hooks/useCourtState.ts` (new)
- `badminton-v2/src/components/CourtCard.tsx` (new)
- `badminton-v2/src/views/KioskView.tsx` (modified)

## Change Log
- 2026-03-19: Story created and implemented (Story 4.1)
