# Story 3.2: Lock Schedule & Initialise Match Queue

## Status: review

## Story
As an admin, I want to save and lock the match schedule, so that the ordered match queue is ready for the kiosk to run the session.

## Acceptance Criteria

- **AC1**: Given the admin has reviewed the generated schedule preview, when they tap "Save & Lock" and confirm via the destructive 2-tap pattern, then all matches are inserted into the `matches` table with `queue_position` (1, 2, 3…), player IDs, and `status = 'queued'`, and the session `status` updates to `'schedule_locked'`.
- **AC2**: Given the schedule is locked, when the admin views the MatchGeneratorPanel, the schedule is displayed as read-only — no generate/settings controls visible.
- **AC3**: Given the admin taps "Save & Lock" then taps elsewhere within 5 seconds, when the auto-cancel fires, the button reverts — no data is written to the DB.
- **AC4**: Given the matches are saved, when the `matches` table is queried ordered by `queue_position`, the full session queue is returned as a single ordered list.

## Tasks / Subtasks

- [x] Task 1: Add `lockSchedule` to `useSession` hook
  - [x] Define `MatchInput` interface (team1Player1/2, team2Player1/2)
  - [x] Implement bulk insert into `matches` table with sequential `queue_position`
  - [x] Update session status to `schedule_locked`
  - [x] Expose `lockSchedule` in hook return value

- [x] Task 2: Add lock flow to `MatchGeneratorPanel`
  - [x] Add `sessionStatus` and `onLock` props
  - [x] Add `locking` + `locked` stages; `confirmingLock` state + 5-second auto-cancel timer
  - [x] Show "Save & Lock" button in preview stage (2-tap destructive pattern)
  - [x] On confirmed lock: call `onLock(matches)`, transition to `locked` stage on success
  - [x] Locked state: read-only match list, no settings or generate controls
  - [x] On mount: if `sessionStatus === 'schedule_locked'`, load existing matches from DB and enter locked stage

- [x] Task 3: Update `AdminView` to wire up lock flow
  - [x] Destructure `lockSchedule` from `useSession()`
  - [x] Pass `sessionStatus` and `onLock` props to `MatchGeneratorPanel`
  - [x] Add `schedule_locked` to the condition for rendering `MatchGeneratorPanel`

- [x] Task 4: Build & lint pass clean

## Dev Notes

- **No new migrations needed** — `matches` table (005) and `schedule_locked` enum value already exist in DB and `database.ts`
- **Locked state load**: When loading from DB, we only have player UUIDs (no type/team levels stored). Locked view shows player names only — type/level columns omitted.
- **`useSession` stays DB-unaware of matchGenerator** — define a local `MatchInput` interface; `GeneratedMatch` satisfies it structurally.
- **Destructive 2-tap pattern**: same UX as "Close Registration" in AdminView — first click sets confirm state + starts 5s timer, second click executes, timer cancel on cleanup.
- **`nameMap`** from `useRegisteredPlayers` is available in panel for resolving UUIDs to slugs in locked view.
- **Session status update in useSession**: after `lockSchedule` succeeds, call `setSession(updated)` so AdminView reactively renders `MatchGeneratorPanel` in locked mode on next render.

## Dev Agent Record

### Implementation Plan
- useSession: add lockSchedule (bulk insert + status update, return boolean)
- MatchGeneratorPanel: add sessionStatus/onLock props; add locked + locking stages; 2-tap confirm; DB load on mount for pre-locked sessions
- AdminView: wire up; extend condition to include schedule_locked

### Completion Notes
All tasks implemented. Build and lint pass clean. No migrations required.

## File List
- `badminton-v2/src/hooks/useSession.ts` (modified)
- `badminton-v2/src/components/MatchGeneratorPanel.tsx` (modified)
- `badminton-v2/src/views/AdminView.tsx` (modified)

## Change Log
- 2026-03-19: Story created and implemented (Story 3.2)
