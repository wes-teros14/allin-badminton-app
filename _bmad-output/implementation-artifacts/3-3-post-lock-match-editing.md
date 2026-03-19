# Story 3.3: Post-Lock Match Editing

## Status: review

## Story
As an admin, I want to edit individual matches after the schedule is locked, so that I can correct mistakes or swap players before the session begins.

## Acceptance Criteria

- **AC1**: Given the schedule is locked, when the admin taps "Edit" on a specific match, then an inline edit form shows the four player slots for that match.
- **AC2**: Given the admin makes changes to player assignments, when they tap "Save", then the match row in `matches` is updated with the new player IDs and the list refreshes.
- **AC3**: Given the admin is editing a match, when they tap "Cancel", then no changes are saved and the edit form closes.
- **AC4**: Given a match has `status = 'playing'` or `status = 'complete'`, when the admin views that match, then the Edit button is disabled — only `status = 'queued'` matches are editable.

## Tasks / Subtasks

- [x] Task 1: Extend locked state to track DB match IDs and statuses
  - [x] Add `lockedMatchMeta: Array<{id: string; status: string}>` state
  - [x] Update `loadLocked` useEffect to capture `id` and `status` alongside player IDs

- [x] Task 2: Add edit state and save handler
  - [x] Add `editingGameNumber: number | null` state
  - [x] Add `editForm: {t1p1, t1p2, t2p1, t2p2}` state
  - [x] Implement `handleEditSave(gameNumber)`: UPDATE matches in DB, refresh local state
  - [x] Implement `handleEditCancel()`: clear edit state, no DB write

- [x] Task 3: Render inline edit UI in locked match list
  - [x] Show "Edit" button per match row (disabled when status !== 'queued')
  - [x] When editing: show 4 player `<select>` dropdowns + Save + Cancel
  - [x] Player options sourced from `players` (useRegisteredPlayers)

- [x] Task 4: Build & lint pass clean

## Dev Notes

- `lockedMatchMeta` is parallel-indexed with `matches[]` — same order by `queue_position`
- Inline edit, not modal — edit form replaces the match row display
- After Save: update `matches[i]` in state (optimistic) to avoid full reload
- `players` from `useRegisteredPlayers` provides dropdown options — already available in panel

## Dev Agent Record

### Completion Notes
All tasks implemented. Build and lint pass clean.

## File List
- `badminton-v2/src/components/MatchGeneratorPanel.tsx` (modified)

## Change Log
- 2026-03-19: Story created and implemented (Story 3.3)
