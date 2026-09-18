# Handoff — current snapshot

Updated: 2026-09-18. Overwrite this file on every update; it is never a running history.

## State

- On `dev`. **Everything pushed** — `dev` and `main` are level.
- `npm run lint` clean (one pre-existing unrelated warning, `ProfileView.tsx:287`).
- `npm run test:unit` **356 passed**. `tsc -b` clean. `npm run build` clean.
- `tests/leaderboard-celebration.spec.ts` **8 passed**.
- **Pre-existing e2e failure, measured not assumed**: `tests/pair-leaderboard.spec.ts` fails 3 tests.
  Reverting every change on this branch reproduces the *same* 3 at HEAD. The test expects
  "No partnership has reached"; the app says "No partnership qualifies yet", and has since before this
  branch. Not mine to fix silently.
- Working tree carries the long-standing unstaged deletions of 17 `badminton-v2/docs/visual/*.html`,
  plus untracked `.claude/launch.json` and `todo.md`. **Deliberately left alone** — I once swept them
  into a commit by using `git add badminton-v2/docs` and had to amend it back out. Stage paths, not
  directories, near that folder.

## Shipped this session

**Session notes as chips** on the `/sessions` card. **Build stamp** on the profile page
(`9eed7af`). **Leaderboard celebrations**, through the full speckit flow and then built.

### The celebration rule, as it now stands

Four gates, then a ladder of four movements per board, first match wins:

| # | Movement | Condition |
|---|---|---|
| 1 | `podium` | `rank ≤ 3 && (previousRank === null \|\| previousRank > rank)` |
| 2 | `first-appearance` | `previousRank === null && bestEver[board] === undefined` |
| 3 | `climb` | `previousRank !== null && previousRank − rank ≥ 1` |
| 4 | `drop` | `previousRank !== null && rank − previousRank ≥ 1` |

Silent: unchanged, or off the board entirely. Eight boards watched (Individual, Partners, six Cheers
categories); Awards excluded — single holder, no top 3.

### Three decisions made after the first build, each reversing something

- **Climb threshold 3 → 1.** Any improvement is worth saying.
- **`personal-best` removed entirely.** There is no rank history in the schema, so it could only know
  the best *this browser* had seen since the feature first ran — "Your best yet!" was false for anyone
  who peaked earlier. Those moments read as a climb now. `bestEver` is still tracked, because
  `first-appearance` needs it to tell an arrival from a return.
- **Drops are reported**, reversing "never report bad news". Same card, animation and confetti; the
  medal follows the player's *current standing*, so 2nd → 3rd keeps its bronze. Only punctuation
  differs: "Up 3 places!" but "Down 3 places".

## Open / worth watching

- **Volume.** With climb and drop both at 1, close to every player hears something every session —
  half the field falls whenever the other half rises. This is the first dial to turn if it gets
  tiring, and it is deliberate, not an oversight.
- **No manual light-mode pass** on the celebration card. Dark verified by screenshot.
- **The streak achievement** is deferred; it needs rank history, the same missing data that killed
  personal best. The two would naturally be built together.
- **Nobody sees a celebration until a session completes after this deploys**, because the first
  evaluation per player is silent by design.

## Notes for next session

- **Dev trigger**: `window.__celebrate([{board, kind, rank, previousRank}])`, only under
  `import.meta.env.DEV`. `kind` is `podium` | `first-appearance` | `climb` | `drop`. Without it there
  is no way to see this work by hand.
- `docs/visual/celebration-trigger-rules.html` is the current diagram of the whole rule, with thirteen
  worked cases. Regenerate it by hand if the rule changes again — it is not generated.
- Verified against real local data: the first evaluation recorded a genuine snapshot and correctly
  celebrated **nothing**.
- `tasks/todo.md` still holds the old pre-speckit plan; `specs/008-podium-celebration/` supersedes it.
