# Handoff — current snapshot

Updated: 2026-09-12. Overwrite this file on every update; it is never a running history.

## State

- **Branch `007-seed-matches`, cut from `dev` at `46fb328`. Nothing committed yet** — the whole
  feature is in the working tree, alongside pre-existing uncommitted work (see below).
- `npm run build` clean, `npm run lint` clean apart from the pre-existing `ProfileView.tsx:257`
  warning, vitest **273/273** (262 + 11 new in `matchGenerator.pinned.test.ts`).
- Earlier this session the local `dev` was reset to the force-pushed `origin/dev` (the 2026-09-07
  history rewrite). Local commits were content-identical; nothing lost.
- Working tree also carries, **from before this session**: two new `tasks/lessons.md` entries (root:
  shuttle inventory; `badminton-v2/`: migration 079 blocked by a duplicate-player row), the deletion
  of `temporary_files/*`, and untracked `temp/`. These are the user's, not part of the feature.

## Done this session

**Seed matches** — the admin can fix the players *and* the team split of games 1..`court_count`
before generating; the engine fills and optimises the rest around them. Plan: `seedmatch.md` (root).

- Engine (`src/lib/matchGenerator.ts`): `PinnedMatch`, `GenerateOptions.pinnedMatches`,
  `normalisePins` (throws on dup / unknown / too many), seeding in `buildAssignment`, `lockedRows`
  fence on both mutators, `formPinnedTeams` bypass in `assignmentToMatches`. Scorer untouched.
- Panel (`src/components/MatchGeneratorPanel.tsx`): *Fixed Opening Games* section in Settings,
  `resolvePinnedMatches` (block / warn rules), `FourSlotPicker` extracted from the duplicated edit
  form, `Pinned` chip on preview and locked lists (`appliedPinCount`), `courtCount` prop.
  `SessionView` passes `session.court_count ?? 2` at both mounts.
- Docs: `docs/visual/match-generator-pinned-openers.html` (hooks diagram),
  `docs/visual/seed-match-options.html` (the three UI options; A was chosen), two Q&A entries under
  a new *Match generator* topic in `docs/qa-log.html`, and a *Match generator* section in
  `project_memory.md`.

## Verified, and how

In the in-app browser against the dev project, session `bce6f898…` (16 players, `registration_closed`):

- Pinned game 1 (Gellie & Tin V vs Jillmarie & Cait) and game 2 (Raych & Steph vs Anthony & Gab) →
  preview rows 1–2 exact, in order, both chipped *Pinned*; game 2 rendered **L:4 vs L:8**, which
  `formTeams` would have rebalanced — proof the split was kept. Participation 5 each, 0 streaks.
- *Generate Again* ×3 → rows 1–2 unchanged, row 3 onward re-rolled.
- Gellie in both pins → `toast.warning` and generation proceeded. One empty slot → `toast.error`, no
  generation. Untick game 1 → game 2 cleared and disabled. Nothing pinned → 0 chips, normal output.
- Lock → *Unlock Schedule* visible; **cold reload** of `/session/:id` rebuilt rows 1–2 from the
  `matches` table in pinned order with chips (chips come from `generator_settings.pinnedGames`).
- Session **unlocked afterwards** (matches deleted, status back to `registration_closed`).
  `generator_settings.pinnedGames` on that dev session still holds the two rows — harmless, only
  read in the locked stage.

## Not verified

- Not seen on a real phone; the admin panel is phone-width but was driven from the desktop pane.
- Spread-limit warning was not exercised (this roster's levels made it hard to isolate).
- "Pinned player removed from roster" path was not exercised in the browser; only the guard code.
- `courtCount = 1` and `> 2` rendering of the section.

## Immediate next steps

1. **Commit** on `007-seed-matches` — engine + tests as one commit, panel + view as a second, docs as
   a third — then merge to `dev`, then non-ff to `main`. Ask before pushing.
2. Rotate the prod `service_role` key — still outstanding (see `project_memory.md` → Known warts).
   Nothing this session touched it.
3. Everything from the 2026-09-07 handoff still stands: tablet check of the 3-round-trip finish,
   `useRealtime` coalescing, the stale-game report, `useAdminActions.markDone`, `Avatar` fallback.

## Open questions

- Should pins persist before lock (a reload today loses every setting, not just pins)? Pre-existing
  gap; left alone.
- Should the `Pinned` chip also show on the player-facing boards? Currently admin panel only.
- The `graphify-out/` knowledge graph does not exist on this machine (gitignored) — `graphify update`
  was skipped.
- Still unanswered from earlier: commit the uncommitted `CLAUDE.md` additions? consolidate the two
  `tasks/lessons.md` files? `--muted-surface` token fix or delete?
