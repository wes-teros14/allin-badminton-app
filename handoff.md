# Handoff — current snapshot

Updated: 2026-09-13. Overwrite this file on every update; it is never a running history.

## State

- **Pushed to `dev` and `main`.** Commit `c49fd6b` on `dev`, merged non-ff as `e9c2950` on `main`.
  Rollback anchor: `git revert -m 1 e9c2950`. Local `main` was **14 commits stale** again (still on
  `55c6eee`) and was reset to `origin/main` before the merge — same trap as 2026-09-12, check this
  every time. Untracked and deliberately not committed: `todo.md` and `.claude/launch.json`.
- `npm run build` clean, `npm run lint` clean apart from the pre-existing `ProfileView.tsx:257`
  warning, vitest **288/288** (283 + 5 new `partitionBySwap` tests).
- Previous work (seed matches, *Use profile levels*, swap-instead-of-block, collapsed Fixed Opening
  Games) is all merged to `main` and deployed at badmintontayo.mrkws.com. Rollback anchor for the
  swap feature: `git revert -m 1 60dc008`.

## Done this session

**Swap rows in the player dropdowns are now visually distinct** — option D of
`badminton-v2/docs/visual/swap-option-row-styles.html`, which offers five treatments (the file is
the record of what was rejected and why). Players already in the match are:

- hoisted into their own `<optgroup>` — *In this match — picking swaps*, above *Everyone else*;
- prefixed `⇄ `;
- painted `--swap-ink` on a `--primary-subtle` band.

Three markers, not one, because the iOS and Android pickers discard `<option>` styling entirely —
only the group header and the arrow reach a phone.

- `src/components/playerOptions.tsx` (new) — `renderPlayerOptions`, shared by both edit forms.
- `src/lib/matchSlots.ts` — `partitionBySwap`, the group labels and the `⇄` prefix live here.
- `src/index.css` — `--swap-ink` (`#6F3E87` / `#D8B4F0`), `--color-swap-ink`, and the
  `select.player-select` `color-scheme` pin. **See `tasks/lessons.md` (2026-09-13)** — dark mode was
  opening *white* native popups, so the first colour I picked was at 1.8:1.
- Both call sites now render from the shared helper: `FourSlotPicker` in `MatchGeneratorPanel.tsx`
  and `PlayerSelect` in `CourtTabs.tsx`.

**Verified in the browser** on the locked list, Game 1 — the group, the arrow and the purple band
render in **both** themes; cancelled without saving. The `CourtTabs` copy was *not* exercised (needs
a live session) — it shares `renderPlayerOptions` verbatim and is covered by the type-check only.

## Next step

- Nothing outstanding. Vercel deploys `main`, so the restyle should be live at
  badmintontayo.mrkws.com — not confirmed in production yet.

## Open question

- The swapped-pair flash in `FourSlotPicker` is still `--court2` teal while the dropdown marker is
  now purple: two colours for one concept. Left alone deliberately (it ships already, and the user
  asked only about the dropdown). Worth asking whether the flash should move to `--swap-ink` too.
- `.claude/launch.json` attaches the Browser pane to an already-running dev server on 5173. Left
  untracked — delete it or commit it, whichever the user prefers.
