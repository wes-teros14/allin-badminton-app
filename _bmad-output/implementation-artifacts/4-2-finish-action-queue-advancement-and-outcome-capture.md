# Story 4.2: Finish Action, Queue Advancement & Outcome Capture

## Status: review

## Story
As a player finishing a game, I want to tap Finish on my court and record who won, so that the queue advances and the result is recorded for stats.

## Acceptance Criteria

- **AC1**: Given a match has `status = 'playing'`, when Finish is tapped, the button disables immediately and "Who won?" pair buttons appear.
- **AC2**: Given "Who won?" is shown, when a pair is selected, current match → complete, match_result inserted, next queued match → playing on this court, CourtCard animates transition.
- **AC3**: Given no remaining queued matches, when last match finishes, CourtCard shows "Session complete".
- **AC4**: Finish button re-enables only after server write confirmation — no double-tap.

## Tasks / Subtasks

- [x] Task 1: Create migration 007 (court_number + match_results + anon RLS for kiosk)
- [x] Task 2: Update database.ts types
- [x] Task 3: Refactor useCourtState (add id, sessionId, refresh)
- [x] Task 4: Add Finish button + Who Won picker to CourtCard
- [x] Task 5: Add startSession() to useSession + Start Session button in AdminView
- [x] Task 6: Add fade-in animation keyframe to index.css
- [x] Task 7: Build & lint pass clean

## Dev Notes

- Kiosk runs as `anon` — needs explicit RLS policies for UPDATE matches and INSERT match_results
- court_number tracks which physical court a playing match is on (1 or 2)
- startSession(): takes first 2 queued matches → playing, updates session → in_progress
- After Finish: call refresh() on useCourtState to re-fetch from DB
- No toast on kiosk per UX spec — button state is the only feedback
- Animation: CSS fade-in triggered by key={current?.gameNumber}

## Dev Agent Record

### Completion Notes
All tasks implemented. Build and lint pass clean.

## File List
- `badminton-v2/supabase/migrations/007_match_results_and_court.sql` (new)
- `badminton-v2/src/types/database.ts` (modified)
- `badminton-v2/src/hooks/useCourtState.ts` (modified)
- `badminton-v2/src/components/CourtCard.tsx` (modified)
- `badminton-v2/src/hooks/useSession.ts` (modified)
- `badminton-v2/src/views/AdminView.tsx` (modified)
- `badminton-v2/src/index.css` (modified)

## Change Log
- 2026-03-19: Story created and implemented (Story 4.2)
