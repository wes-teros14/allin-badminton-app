# Match generator — the First-on-court rule

**Status:** implemented and verified 2026-09-13, **uncommitted**.

Scope note: a court-aware rest model (scaling `idealGap` by court count) and a hard block on
double-booking were built first, then **reverted in full at the user's direction**. `MatchBoard.tsx`,
`courts.ts` and the general rest maths are untouched — `git diff` shows only the engine, the panel,
and tests. What ships is the rule below and the minimum `courtCount` plumbing it needs.

Diagrams (written during the reverted work; the arithmetic still holds, the fix described in them
does not): `badminton-v2/docs/visual/rest-spacing-vs-parallel-courts.html`,
`badminton-v2/docs/visual/rest-rules-scaling-by-court-count.html`.
Q&A trail: `badminton-v2/docs/qa-log.html`, Match generator section.

## The rule

```
firstOnCourt = games 1 .. courtCount        // they all start together
gameLimit    = courtCount * 2               // the first two rounds

penalise P if P is in firstOnCourt AND appears again at or below gameLimit
```

1 court → games 1 & 2 · 2 courts → games 1–4 · 3 courts → {1,2,3} against {4,5,6}.

`MatchBoard.tsx:355` already captions these games **"First on court"**; the rule reuses that
definition rather than inventing a second one.

## What shipped

- [x] `GenerateOptions.courtCount`, **default 1**, threaded through `generateSchedule`,
      `generateScheduleOptimized`, `optimizeAssignment`, `buildAssignment` and the final re-score.
- [x] `firstOnCourtGames(courtCount)` and `openingGameLimit(courtCount)` exported.
- [x] Configurable weight `openingRepeatPenalty`, default **400**, with a slider and a
      `disabledWeights` checkbox like every other tunable weight.
- [x] **Graded by gap** — cost is `openingRepeatPenalty × (gameLimit − gap)`, so game 1 → 4 costs 400
      and game 1 → 3 costs 800. Required: with 14–15 players the window holds 16 seats so a repeat is
      forced, and a flat penalty would let the optimiser pick the worse one.
- [x] **Enforced during construction as well as priced.** `buildAssignment` filters openers out of the
      candidate pool inside the window, so the rule never has to outbid the gender weights (100–250)
      on score. A gender/spread-valid group is sought in the filtered pool *then* the full one before
      any fallback slice — otherwise at 8 players the filter leaves exactly 4 candidates and the slice
      returns a gender-invalid row.
- [x] Audit counter `openingRepeats`, counted **unconditionally** (not inside the weight guard), shown
      as the tile *First-on-Court Repeats (by game N)* plus a Scoring Math row.

## Why the default is 400

The general rest target is court-blind, so `earlyRestReward` still pays **+300** for a gap-3 pairing
at 2 courts. Anything at or below 300 leaves that pairing profitable and changes no decision. 400 is
the smallest round value that clears it; test F2.6 pins the relationship. 600 was tried first and cost
more repeat partnerships for the same result.

## Verification

- [x] **303 tests passing**, build clean, lint clean apart from the pre-existing
      `ProfileView.tsx:257` warning. 15 new tests in `matchGenerator.firstOnCourt.test.ts`.
- [x] Measured, 15 players / 15 matches / 2 courts, 8 runs per weight. The window holds 16 seats
      against 15 players, so **1 repeat is forced — that is the floor**:

      | openingRepeatPenalty | openingRepeats |
      |---|---|
      | 0 (off) | **1.63** |
      | 200 | 1.00 |
      | **400 (default)** | **1.00** |
      | 1200 | 1.00 |

- [x] **Exercised end to end** against the 15-player dev session. Tile reads
      *First-on-Court Repeats (by game 4): 1*, and hand-checking the breakdown confirms it (Jax in
      game 1 and game 4). Back-compat confirmed: that session's stored `generator_settings` predate
      `openingRepeatPenalty` and the spread merge supplied the default — no migration needed.

## Two pre-existing tests changed, and why

- **S2** (`matchGenerator.scoring.test.ts`) — expected value moved by exactly
  `4 players × openingRepeatPenalty`. At 1 court the window is games 1–2, so the rule fires on that
  fixture by design. Intended behaviour change, not a test bent to pass.
- **5.6** (gender composition) — was `expect(...).toBe(true)` under one seeded LCG. Gender is **not** a
  hard guarantee: when no gender-valid group exists in any pool, `buildAssignment` falls back to an
  unfiltered slice. Measured across seeds 1..40 that fires for exactly **1 seed — and for the same 1
  seed on the pre-change engine**, verified by restoring `HEAD`'s `matchGenerator.ts` and re-running.
  Identical rate; the change only moved seed 42 from the lucky side to the unlucky side. Now sweeps
  and asserts ≥ 95% valid, with the measurement recorded inline.

## Not done

- [ ] **Surcharge when the short gap is a repeated partnership.** Never requested, and it rests on one
      reading of a 5-row screenshot — short gaps clustering on repeat partnerships has not been
      confirmed against a full session.
- [ ] Show the arithmetic floor beside the count (*"1 repeat — minimum possible is 1"*), so a
      non-zero tile can be read as optimal rather than as a failure.
- [ ] Extend the `resolvePinnedMatches` warning for a pinned player landing inside `gameLimit`, which
      cannot be optimised away because pinned rows are locked.

## Open questions

- [ ] **Today's actual session has not been inspected** — only the 5-row screenshot. The Supabase MCP
      server failed auth (`AUTH_HEADER_REJECTED`) this session. Need either the MCP token fixed or a
      screenshot of the generator's Rest Spacing chart to confirm: how many players had gap 3, whether
      any had gap 2, and whether short gaps cluster on repeated partnerships.
- [ ] The screenshot showed **15 distinct names** across games 1–5, but sessions are usually 14. If
      today really had 15 players, only **1** repeat was forced in games 1–4, not 2 — meaning the
      generator used one more than it needed. Was Ronwald or Steph a late sub?
- [ ] Where the unavoidable short gaps should sit. Front-loading them (players are fresh) is at least
      as defensible as protecting the opening. Not decided.
