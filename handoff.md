# Handoff — current snapshot

Updated: 2026-09-12. Overwrite this file on every update; it is never a running history.

## State

- **Pushed and live, twice today.** Seed matches: `origin/main` merge `60dc008` (feature commits
  `4ec1734` engine + tests, `d975a6c` panel + view, `3b0eb13` docs). Then *Use profile levels*: one
  commit on `dev`, merged non-ff to `main` — see `git log -3 main`. **Deployed to production** at
  badmintontayo.mrkws.com.
- **Rollback anchors.** Before seed matches: `main` `55c6eee`, `dev` `46fb328`. `git revert -m 1
  60dc008` backs seed matches out; `git revert -m 1 <newest merge on main>` backs the roster button out.
- `npm run build` clean, `npm run lint` clean apart from the pre-existing `ProfileView.tsx:257`
  warning, vitest **283/283** (262 + 11 pinned-game + 4 `rosterLevels` + 6 `matchSlots` tests).
- Earlier this session the local `dev` was reset to the force-pushed `origin/dev` (the 2026-09-07
  history rewrite). **Local `main` turned out to still be on the old history** and was reset to
  `origin/main` before merging — see the 2026-09-12 entry in `tasks/lessons.md`. Both local branches
  now match their upstreams.
- Working tree also carries, **from before this session**: two new `tasks/lessons.md` entries (root:
  shuttle inventory; `badminton-v2/`: migration 079 blocked by a duplicate-player row), the deletion
  of `temporary_files/*`, and untracked `temp/`. These are the user's, not part of the feature.

## Done this session

**Fixed Opening Games collapsed by default** — pushed to `dev` and `main`. `<details>` closed unless
pins exist (`pinsOpen` state + effect on `pinnedCount`), gold *N pinned* chip on the summary. Verified in
the browser: closed on open, tick Pin → close → chip reads *1 pinned*. Auto-open on locked-stage load
was not exercised (needs a lock); the effect is three lines.

**Swap instead of block in match edit forms** — pushed to `dev` and `main`. Picking a
player already in the match now trades the two slots ("Name ⇄ swap" option) in all three forms: the
generator panel's locked list, the pinned-games rows, and `CourtTabs` (court card + queue, which was a
second unguarded copy and now shares `EditFormInline`). `assignSlot` in `src/lib/matchSlots.ts`,
`MatchSlots`/`EMPTY_SLOTS` moved there, 6 tests (283 total). Verified in the browser on the locked list:
Game 4 Raych & Gellie vs Jillmarie & Tin V → pick "Tin V ⇄ swap" in Raych's slot → Tin V & Gellie vs
Jillmarie & Raych, both slots flashed, cancelled without saving. `CourtTabs` form verified by type-check
and the shared helper only — not exercised in the browser.

**Use profile levels (roster)** — pushed after seed matches. A per-session level override sticks once set,
so a preview could read L:8 for a player who is a 4 on `/players`; not a generator bug. New header button
on the Roster (editable, open) clears every stale override in one `update … in(ids)`, two-tap confirm,
teal flash on the rows that changed, success toast. `RosterPlayer.profileLevel` added,
`useRoster.resetLevelsToProfile()`, `src/lib/rosterLevels.ts` + 4 tests (277 total). Verified on the dev
session: two overrides set → *Confirm? (2)* → rows back to profile values → cold reload still shows them
(override is null in the DB). Title wraps to two lines at 375 px — known, accepted (Option A trade-off).

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
- Gellie in both pins → `toast.warning` and generation proceeded. A pinned four with spread 5 against a
  limit of 2 → `toast.warning` *"Game 1 exceeds the skill gap limit (spread 5)"* and generation proceeded.
  One empty slot → `toast.error`, no generation. Untick game 1 → game 2 cleared and disabled. Nothing pinned → 0 chips, normal output.
- Lock → *Unlock Schedule* visible; **cold reload** of `/session/:id` rebuilt rows 1–2 from the
  `matches` table in pinned order with chips (chips come from `generator_settings.pinnedGames`).
- Session **unlocked afterwards** (matches deleted, status back to `registration_closed`).
  `generator_settings.pinnedGames` on that dev session still holds the two rows — harmless, only
  read in the locked stage.

## Not verified

- Not seen on a real phone; the admin panel is phone-width but was driven from the desktop pane.
- "Pinned player removed from roster" path was not exercised in the browser; only the guard code.
- `courtCount = 1` and `> 2` rendering of the section.

## Immediate next steps

1. **Watch the first real session with pins** — the section was only driven from the desktop pane.
   Delete the merged `007-seed-matches` branch when happy.
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
