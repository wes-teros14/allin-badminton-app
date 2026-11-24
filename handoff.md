# Handoff — current snapshot

Updated: 2026-11-24 Manila. Overwrite this file on every update; it is never a running history.

## Done this session
- Audited the app against the owner's 8 banned "AI design" patterns; POC approved:
  `temporary_files/ai-pattern-ban-review-poc.html`.
- Applied all 5 POC screens (rules in `project_memory.md` → "Visual rules"):
  - Cheer picker (`CheersPanel.tsx`): flat ruled rows, drawn icons, "Skip {name}".
  - Sessions card (`MySessionsView.tsx`): no left stripe, status as dot + text, quiet admin icon buttons.
  - Session page: underline tabs (`SessionPlayerDetailView.tsx`), game count in header line
    (`PlayerScheduleHeader.tsx`), W/L/D letters + plain "Next" (`MatchBoard.tsx`).
  - Profile (`profile/SeasonSections.tsx`): plain section headings, ruled stats row, rank discs, award rows with icons.
  - Home notice board (`HomeView.tsx`) and no-schedule / no-results states (`MatchBoard.tsx`).
  - New `components/GlyphIcon.tsx` + `.glyph-ink`/`.glyph-swatch` in `index.css`.
- `tsc -b` clean, 714/714 unit tests, build pass. Checked on localhost (Neon dev) at 375 px, dark + light;
  light-theme icon contrast 5.7–8.4:1.
- Local dev was 168 commits behind origin; pulled first. Old local `handoff.md` + `cli-latest` edits are in
  `git stash` ("pre-pull local handoff/cli-latest 2026-11-24") — likely stale, not reviewed.

## Current state
- Pushed to `dev` and `main` (see git log). Vercel production deploy not checked.
- Not seen with real data: match list W/L letters (dev has no played matches), Live status dot.

## Next steps
1. Owner: look at the cheer picker and Sessions list on a phone after deploy.
2. Remaining emoji/pills (list in `project_memory.md` → "Visual rules" → Not yet): leaderboard, celebration card,
   announcer, "Your 2026 season" card, payment chips.
3. Drop the stash once confirmed stale.

## Open questions
- Carried over: Supabase 500/52x token-refresh retry (offered, undecided); iPhone Safari WebP; kiosk insert
  rule; offline-backup phone check; Nov 1 session not closed; prod `service_role` not rotated; old Neon branches.
