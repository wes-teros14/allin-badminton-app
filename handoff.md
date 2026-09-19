# Handoff — current snapshot

Updated: 2026-09-19. Overwrite this file on every update; it is never a running history.

## State

- On `dev`, working tree clean except `temp/` (untracked scratch — screenshots and planning notes,
  left alone, see Open questions).
- `dev` and `main` both pushed and content-identical at `d04e9e8` (origin).

## Shipped this session

- **Fix**: Scoring Weights number inputs (`MatchGeneratorPanel.tsx:654-661`) stacked a leading zero on
  every keystroke after clearing a field (typing `150` produced `0150`). Cause: `+e.target.value`
  coerced `''` to `0` on each keystroke, snapping the controlled input back to `"0"` before the next
  digit landed. Fixed by stripping a leading zero before parsing. Verified live in the browser preview.
- **Housekeeping**: corrected a lesson I'd written to the stale `badminton-v2/tasks/lessons.md` copy —
  the live log is the root `tasks/lessons.md` (see `project_memory.md` → Repo layout). Also committed,
  at the user's request, two items that had been sitting uncommitted before this session started and
  were not mine: a `tasks/lessons.md` dedupe (removed two entries already superseded/resolved) and a
  new `supabase/maintenance/swap-player-matches.sql` script (swaps two players' queued match slots
  within a session by nickname). Also added `.claude/launch.json` (dev server preview config).

## Verified, and how

- Browser preview (`badminton-v2-dev`, port 5173): logged in via the dev-login button, opened a
  session's Match Generator → Settings → Scoring Weights, cleared the Repeat Partner Penalty field,
  typed `150` — field correctly showed `150`, not `0150`.

## Not verified

- No other numeric inputs in the app share this pattern (grepped for `type="number"` in
  `MatchGeneratorPanel.tsx` only — it's the one place this input style is used).

## Immediate next steps

- None outstanding from this session. Carry over anything still open from the previous
  (2026-09-18) session — this handoff fully replaced it, so re-check `git log` / prior specs if that
  context is needed.

## Open questions

- `temp/` (untracked, at repo root) holds screenshots and scratch docs
  (`match-engine-v3-redesign.md`, `match-engine-audit.md`, `issues_and_planned_changes.md`, etc.) —
  user chose to leave it uncommitted for now. Unclear if/when it should move into `temporary_files/`
  (the gitignored convention per `CLAUDE.md`) or be committed properly.
