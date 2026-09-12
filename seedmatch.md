# Plan — Hand-picked opening games ("seed matches") in the match generator

Status: **implemented on branch `007-seed-matches` (2026-09-12), uncommitted.** All seven tasks
done; build, lint and 273/273 tests green; browser checklist in `handoff.md` → *Verified*.
UI placement chosen: Option A of `badminton-v2/docs/visual/seed-match-options.html`. Feasibility
notes and diagram: `badminton-v2/docs/visual/match-generator-pinned-openers.html`, and the
*Match generator* entries in `badminton-v2/docs/qa-log.html`.

## Goal

The admin can fix the players **and the team split** of game 1 (and game 2, up to the session's
court count) before generating. The engine fills and optimises every other game *around* those pins.
Pins survive "Generate Again". Everything downstream (lock, boards, live board, DB constraint) is
untouched because a pinned game leaves the engine as an ordinary `GeneratedMatch`.

## Decisions taken (change here if you disagree, before Task 1)

| Decision | Choice | Why |
|---|---|---|
| Pin the four players or the exact teams? | **Exact teams** | "Matchup" means who partners whom. `formTeams` would otherwise re-split by level. |
| How many games can be pinned? | **Up to `sessions.court_count`** (default 2) | Those are the games that start at the same whistle. Game 3 is a different concept ("first on deck"). |
| Same player in pinned game 1 *and* 2 | **Warn, allow** | Admin's explicit choice. With two courts they would be double-booked, so the warning is loud. |
| Pinned four exceed `maxSpreadLimit` | **Warn, allow** | Same reasoning. The scorer charges the penalty as a constant; it cannot steer anything. |
| Partially filled pin (1–3 of 4 slots) | **Block generate** with a toast | A half pin has no meaning. Empty rows are simply "not pinned". |
| Pinned player no longer registered | **Block generate** with a toast naming the player | The roster-change effect already clears the preview; the pin must be fixed by hand. |
| Persistence | Ride in `Settings` → saved to `sessions.generator_settings` on lock (existing path) | Zero new plumbing. Note: *no* setting survives a reload before lock today; that is pre-existing and out of scope. |

## How the engine changes (reference)

`src/lib/matchGenerator.ts` works on one matrix — `string[][]`, one row per game, four ids per row —
and only mutates it two ways. Pinning is three hooks; the scorer is untouched on purpose so rest,
streaks and fairness are optimised around the pins.

| Hook | Function | Change |
|---|---|---|
| 1 Seed | `buildAssignment` (`:180`) | Push pinned rows first, subtract 1 from each pinned player's `remaining`, seed `prevMatchPlayers` from the last pin, loop from `m = k`. |
| 2 Fence | `mutateCrossSwap` (`:391`), `mutateRowSwap` (`:425`) | Draw `i`, `j` from `[k, length)` instead of `[0, length)`. |
| 3 Pass-through | `assignmentToMatches` (`:363`) | Rows `< k` skip `formTeams`; split is `[[a,b],[c,d]]` as stored. |

---

## Task 1 — Engine: types and option plumbing

**Files:** `badminton-v2/src/lib/matchGenerator.ts`

1. Add and export:
   ```ts
   export interface PinnedMatch {
     team1: [string, string]
     team2: [string, string]
   }
   ```
2. Add `pinnedMatches?: PinnedMatch[]` to `GenerateOptions` (so `OptimizeOptions` inherits it).
3. Add a private `normalisePins(pins, playerIds, numMatches): string[][]` that:
   - returns `[]` when `pins` is empty/undefined;
   - throws `Error('Pinned game N repeats a player')` if the four ids are not distinct
     (reuse `findDuplicatePlayerIds` from `src/lib/matchPlayers.ts` — import it; it is a pure lib
     module, no circularity);
   - throws `Error('Pinned game N names a player who is not in this session')` if any id is not in
     `playerIds`;
   - throws `Error('More pinned games (k) than matches (n)')` when `pins.length > numMatches`;
   - returns rows in team order: `[t1[0], t1[1], t2[0], t2[1]]`.

   Throwing (not silently dropping) is deliberate: the panel validates first and shows a toast; the
   engine throw is the last line of defence and makes tests precise.

**Verify:** `npm run build` in `badminton-v2/` (tsc) is clean. No behaviour change yet.

---

## Task 2 — Engine: seed the assignment (Hook 1)

**Files:** `badminton-v2/src/lib/matchGenerator.ts`, `badminton-v2/src/__tests__/matchGenerator.pinned.test.ts` (new)

Write the tests first, in a **new file** — `matchGenerator.test.ts` is already ~400 lines and this is a
distinct concern. Use the same `mockRandom()` seeded LCG pattern and `FIXTURE_B` (16 players) from
`./fixtures/players`, and `countGamesPerPlayer` from `./fixtures/helpers`.

Tests (all against `generateScheduleOptimized`, small `numStarts`/`numTrials` for speed, e.g. 5×200):

- **P1** One pin → game 1 is exactly that pin, in that team order (`team1Player1 === pin.team1[0]`, etc.).
- **P2** Two pins → games 1 and 2 match, games 3..N are engine-filled and the output still has `numMatches` rows.
- **P3** Pins never drift: run 20 seeded generations with two pins; every run's games 1–2 equal the pins.
- **P4** Fairness holds by construction: 16 players / 20 matches with two pins → `countGamesPerPlayer` gap ≤ 1
  (same bound the existing Group 6 tests assert without pins).
- **P5** The engine rests pinned players: with `maxConsecutiveGames: 1` and one pin, no pinned player appears in
  game 2 (assert on the returned matches, not on the audit — the audit reports the whole schedule).
- **P6** Throws: duplicate id in a pin; id not in the roster; `pins.length > numMatches`.
- **P7** `pinnedMatches: []` and `undefined` produce identical behaviour to today (compare row count and that
  no error is thrown; do not compare exact rows — SA is seeded but any code motion changes the draw order).

Then implement in `buildAssignment`:

1. New parameter `pinnedRows: string[][] = []` (after `allowRelaxSpread`).
2. After the `remaining` map is built, for each pinned row: `remaining.set(id, Math.max(0, remaining.get(id)! - 1))`
   for its four ids. `Math.max` guards the degenerate case where `base === 0` (more players than slots).
3. `const schedule: string[][] = pinnedRows.map((r) => [...r])`.
4. Seed `prevMatchPlayers` from the **last** pinned row (if any).
5. `for (let m = pinnedRows.length; m < numMatches; m++)` — everything inside the loop is unchanged.

Thread `pinnedRows` from both public entry points: `generateSchedule` (kept for tests/API compat) and
`generateScheduleOptimized`, each calling `normalisePins` once up front.

**Verify:** `npm run test:unit -- matchGenerator.pinned` → P1, P2, P4, P5, P6, P7 pass; P3 may still
fail (SA can still move pins) — that is Task 3.

---

## Task 3 — Engine: fence the annealer (Hook 2)

**Files:** `badminton-v2/src/lib/matchGenerator.ts`

1. `mutateCrossSwap(assignment, levelMap, maxSpreadLimit, lockedRows = 0)` and
   `mutateRowSwap(assignment, lockedRows = 0)`:
   - `const free = assignment.length - lockedRows; if (free < 2) return false`
   - `i = lockedRows + floor(random() * free)`, same for `j`, with the existing `while (j === i)` retry.
   - The `assignment[j].includes(pI)` guard in `mutateCrossSwap` is unchanged — it already prevents a
     swap that would duplicate a player *within* a row; pinned rows never enter it because `i`, `j ≥ lockedRows`.
2. `optimizeAssignment` gains `lockedRows: number` and passes it to both mutators.
3. `generateScheduleOptimized` passes `pinnedRows.length`.

**Verify:** P3 passes. Full `npm run test:unit` — the existing generator suites (`matchGenerator.test.ts`,
`matchGenerator.scoring.test.ts`) must be unchanged: with `lockedRows = 0`, `free === length` and the
index arithmetic is identical to today.

---

## Task 4 — Engine: keep the admin's team split (Hook 3)

**Files:** `badminton-v2/src/lib/matchGenerator.ts`, `badminton-v2/src/__tests__/matchGenerator.pinned.test.ts`

Test first:

- **P8** Pin `team1: [strong, strong], team2: [weak, weak]` with levels that `formTeams` would definitely
  re-split (e.g. 9,9 vs 3,3). Assert the returned game 1 keeps `team1 = [strong, strong]`, and
  `team1Level === 18`, `team2Level === 6`, `type` computed correctly.

Implement:

1. `assignmentToMatches(assignment, levelMap, genderMap, disableGenderRules, pinnedCount = 0)`.
2. For `i < pinnedCount`, do not call `formTeams`; build the match directly:
   ```ts
   const [a, b, c, d] = group
   team1Level = round(level(a) + level(b)), team2Level = round(level(c) + level(d)),
   type = computeMatchType(a, b, c, d, genderMap)
   ```
   Put this in a small private `formPinnedTeams(group, levelMap, genderMap): FormedMatch` so it sits
   next to `formTeams` and returns the same shape.
3. Every caller of `assignmentToMatches` passes the count: the `scoreAssignment` closure inside
   `optimizeAssignment`, the trial loop in `generateSchedule`, and the best-match rebuild in
   `generateScheduleOptimized`. **The scorer must see the pinned split too**, or the rest-spacing and
   repeat-partner terms would be scored on a phantom split.

**Verify:** P8 passes; full unit suite green; `npm run build` clean.

---

## Task 5 — Panel: state, prop, and settings UI

**Files:** `badminton-v2/src/components/MatchGeneratorPanel.tsx`, `badminton-v2/src/views/SessionView.tsx`

1. **Prop.** Add `courtCount?: number` to `Props` (default `2`). In `SessionView.tsx:533` pass
   `courtCount={session.court_count ?? 2}`. The second mount (`:553`, locked view) can pass it too;
   harmless.
2. **Settings.** Add to `Settings`:
   ```ts
   pinnedGames: Array<{ t1p1: string; t1p2: string; t2p1: string; t2p2: string }>
   ```
   `DEFAULTS.pinnedGames = []`. Older `generator_settings` rows lack the key; the existing
   `{ ...prev, ...loaded }` merge in the `schedule_locked` loader keeps the default, so no migration.
3. **Extract the four-select block.** The edit form (`:750–794`) inlines the Team 1 / Team 2 selects
   twice, byte-identical. Pull it into a local `FourSlotPicker` component in the same file
   (`value`, `onChange`, `players`, `name`), with the same "already in this match" disabling. Use it
   from `handleEditStart`'s form **and** the new pin form. This is the refactor the feature earns;
   do not copy the block a third time.
4. **UI.** Inside the Settings panel, new section after *Match Rules* and before the `<hr />` to
   *Optimizer*:
   - Heading `Fixed Opening Games` with helper text: "Pick the players for the games that start
     together. The engine fills the rest around them."
   - One row per court `i in 0..courtCount-1`: label `Game {i+1}`, a checkbox `Pin`, and when
     checked a `FourSlotPicker`. Unchecking clears that row (so a row is either empty or intended).
   - If `courtCount` is 1 there is exactly one row; the section still renders.
5. Persist nothing new — `settings` already goes to `generator_settings` on lock.

**Verify:** `npm run build` clean. In the browser (dev login, lower-right): open a session in
`registration_closed`, expand Settings, tick Pin on Game 1 and Game 2, pick eight players; the
selects disable a player already chosen in the *same* game only.

---

## Task 6 — Panel: validate and pass pins on generate; mark them in the preview

**Files:** `badminton-v2/src/components/MatchGeneratorPanel.tsx`

In `handleGenerate`, after the existing missing-gender/level guard and before the timer:

1. `const active = settings.pinnedGames.filter(row => Object.values(row).some(Boolean))`.
2. For each active row (index → "Game N"):
   - any empty slot → `toast.error('Game N: fill all four slots or untick Pin')`, return;
   - `validateMatchPlayers([...], name)` → on failure toast its `message`, return;
   - any id not in `players` → `toast.error('Game N: <name> is no longer registered')`, return.
3. Soft warnings (do **not** return):
   - overlap between two active rows → `toast.warning('<name> is in both Game 1 and Game 2 — they start at the same time')`;
   - level spread of a row `> settings.maxSpreadLimit` → `toast.warning('Game N exceeds the skill gap limit (spread S)')`.
   Compute spread the same way the engine does: `round(max) - round(min)` of `level ?? 5`.
4. Build `pinnedMatches: PinnedMatch[]` in row order and add to the `generateScheduleOptimized` call.
5. Wrap the engine call in `try/catch`; on throw, `toast.error(err.message)` and return to `idle`/`preview`
   as appropriate (this is the last-line guard from Task 1; it should be unreachable after step 2).
6. **Preview badge.** In the preview list, for `idx < pinnedMatches.length` render a small
   `Pinned` chip (reuse the muted chip styling already used for the `[Match type]` label, e.g.
   `text-xs font-semibold text-gold-ink`). Also show it in the locked list when the loaded
   `generator_settings.pinnedGames` has that many active rows, so the admin can still see what was fixed.
7. **Generate Again** needs no change: pins live in `settings`, which the regenerate path reads.

**Verify (browser, dev DB):**
- Pin game 1 and 2 → Generate → games 1 and 2 show the exact teams in the exact order, `Pinned`
  chip on both, games 3–20 engine-filled; the *Fairness* row in the scoring panel still reads gap 0.
- Generate Again three times → games 1–2 never change; the rest does.
- Untick Pin on Game 2 → Generate → only game 1 pinned.
- Put the same player in both pins → warning toast, generation proceeds.
- Leave one slot empty → error toast, no generation.
- Remove a pinned player from the roster (RosterPanel) → preview clears (existing behaviour); Generate →
  error toast naming them.
- Lock → `matches` rows with `queue_position` 1 and 2 hold the pinned ids in the pinned columns;
  `sessions.generator_settings.pinnedGames` holds the two rows.

---

## Task 7 — Docs and memory

1. `badminton-v2/docs/qa-log.html` — the *Match generator* entry already describes the design; add one
   line naming the setting and the `court_count` cap once they exist. If anything in the feasibility
   answer turns out wrong during implementation, add an amber **correction** block rather than editing it.
2. `project_memory.md` — new subsection under a *Match generator* heading: pins are exact teams, capped
   at `court_count`, warn-not-block on overlap/spread, and **the scorer deliberately sees pinned rows**.
   Record the rejected alternative (pin players only, let the engine split) and why.
3. `handoff.md` — overwrite with the current state and what was verified in the browser vs. not.
4. `tasks/lessons.md` — only if a bug is found and fixed on the way (project rule). A clean feature
   does not get an entry.
5. `graphify update .` — skip on this machine; `graphify-out/` does not exist here (it is gitignored).

---

## Final verification (before claiming done)

```bash
cd badminton-v2 && npm run build
```
```bash
cd badminton-v2 && npm run lint
```
```bash
cd badminton-v2 && npm run test:unit
```

All three clean, plus the Task 6 browser checklist actually exercised against the dev project. The
plan is not complete until the lock step has been observed writing `queue_position` 1 and 2 with the
pinned ids.

## Out of scope (deliberately)

- Persisting settings before lock (pre-existing gap, affects every slider equally).
- Pinning games beyond `court_count` ("first on deck").
- Pinning a partner pair without fixing the whole game — that is what the existing *Partner Wishlist*
  already does, as a soft reward.
- Any change to `useSession.lockSchedule`, `MatchBoard`, `useCourtState`, or the live board.
