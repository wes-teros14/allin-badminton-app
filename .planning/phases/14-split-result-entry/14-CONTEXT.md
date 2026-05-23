# Phase 14: Split Result Entry - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin and live board finish flows support both one-game and two-game (split) result recording. Includes a session-level toggle to enable split scoring. Queue advancement and realtime updates continue working in both modes. Stats aggregation is Phase 15.

</domain>

<decisions>
## Implementation Decisions

### Toggle Placement
- **D-01:** The split-match scoring toggle is NOT in the SetupCard (setup state). It appears in `registration_closed` and `schedule_locked` states only.
- **D-02:** Rationale: admin decides to use split scoring after seeing how many players joined. Toggle becomes read-only once the session moves to `in_progress`.
- **D-03:** Toggle renders alongside the existing RosterPanel / MatchGeneratorPanel content in both states. Use a shadcn/ui Switch or Checkbox with a label "Split match scoring".

### Finish UI — Split Sessions
- **D-04:** When `split_match_scoring` is true, the finish screen shows 3 stacked buttons (full-screen takeover, same style as current "Who won?" screen):
  - Button 1: `{t1p1} & {t1p2} won 2-0`
  - Button 2: `1-1 Draw`
  - Button 3: `{t2p1} & {t2p2} won 2-0`
- **D-05:** Button labels for 2-0 outcomes use player names (consistent with the current one-game "Who won?" buttons).
- **D-06:** The middle "1-1 Draw" button is styled consistently with the team buttons (same size, same `bg-primary/20 border border-primary/40` treatment).

### Finish UI — One-Game Sessions
- **D-07:** When `split_match_scoring` is false, the finish screen is completely unchanged. No regression to the existing 2-button "Who won?" flow.

### Admin vs Live Board Consistency
- **D-08:** Both `CourtCard.tsx` (live board) and `CourtTabs.tsx` (admin court view) show the same 3-outcome finish UI when split scoring is enabled.
- **D-09:** The finish confirmation state (`confirmingFinish`) and the split-aware button rendering are handled identically in both components.

### Session Mode Propagation
- **D-10:** `splitScoring: boolean` is passed as a prop to `CourtCard` and to the court panel inside `CourtTabs`. Parent components (`LiveBoardView`, `SessionView`) fetch the session's `split_match_scoring` flag from their existing session data and pass it down — no new fetches inside the components.
- **D-11:** `useCourtState` or the relevant session hook should select `split_match_scoring` from the sessions table so it is available at the parent level.

### Split Result Submission Logic
- **D-12:** A shared helper `submitSplitResult(matchId: string, outcome: '2-0-t1' | '1-1' | '2-0-t2')` is added to `src/lib/matchResults.ts`. It inserts exactly 2 `match_results` rows:
  - `2-0-t1`: game 1 → `winning_pair_index: 1`, game 2 → `winning_pair_index: 1`
  - `2-0-t2`: game 1 → `winning_pair_index: 2`, game 2 → `winning_pair_index: 2`
  - `1-1`: game 1 → `winning_pair_index: 1`, game 2 → `winning_pair_index: 2`
- **D-13:** Both `CourtCard.handleFinish` and `CourtTabs.handleFinish` call this shared helper for split sessions, replacing the current inline single-row insert when `splitScoring` is true.

### Claude's Discretion
- Exact toggle position within the `registration_closed` and `schedule_locked` section layouts (before or after the action buttons)
- Loading/disabled state of the toggle while the Supabase update is in flight
- Toast message wording for toggle save

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 13 schema foundation
- `badminton-v2/supabase/migrations/063_add_split_scoring_schema.sql` — Adds `sessions.split_match_scoring` and `match_results.game_number`; composite unique constraint on `(match_id, game_number)`
- `badminton-v2/src/lib/matchResults.ts` — Shared result helper from Phase 13; extend with `submitSplitResult`
- `.planning/phases/13-split-scoring-schema/13-02-SUMMARY.md` — Phase 13 decisions and patterns established

### Finish flow (both need split-aware updates)
- `badminton-v2/src/components/CourtCard.tsx` — Live board finish flow; contains `handleFinish` and `confirmingFinish` UI
- `badminton-v2/src/components/CourtTabs.tsx` — Admin court finish flow; calls `useAdminActions.markDone`
- `badminton-v2/src/hooks/useAdminActions.ts` — `markDone` function; currently inserts `game_number: 1` result

### Session setup flow (toggle placement)
- `badminton-v2/src/views/SessionView.tsx` — `registration_closed` and `schedule_locked` states; where toggle renders
- `badminton-v2/src/hooks/useCourtState.ts` — Check if `split_match_scoring` needs to be added to the session query

### Requirements
- `.planning/REQUIREMENTS.md` — FMT-01, FMT-02, FMT-03, RES-01, RES-02, RES-03, COMP-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CourtCard.tsx` `confirmingFinish` pattern: boolean state + full-screen takeover div — reuse for split 3-button screen
- `CourtTabs.tsx` `confirmingFinish` pattern: same approach in the admin compact panel
- `src/lib/matchResults.ts`: already exists from Phase 13; add `submitSplitResult` here
- shadcn/ui `Switch` or `Checkbox` components: available for the session toggle

### Established Patterns
- Session flag updates follow the same supabase `.update().eq('id', sessionId)` pattern used in `SessionView.tsx` for name/date/venue
- `game_number: 1` is already written by Phase 13 in both `CourtCard` and `useAdminActions.markDone`
- `toast.error` / `toast.success` (sonner) for mutation feedback

### Integration Points
- `LiveBoardView` → `CourtCard` (needs `splitScoring` prop added)
- `SessionView` (registration_closed + schedule_locked sections) → toggle UI added inline
- `CourtTabs` finish handler → `useAdminActions.markDone` for one-game, `matchResults.submitSplitResult` for split
- `CourtCard.handleFinish` → `matchResults.submitSplitResult` for split path

</code_context>

<specifics>
## Specific Ideas

- The 3-button split finish screen should feel like a natural extension of the current "Who won?" screen — same animation, same color treatment, just a third button in the middle for the draw.
- Toggle only needs to be a simple on/off — no extra configuration.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-split-result-entry*
*Context gathered: 2026-05-23*
