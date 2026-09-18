# Handoff — current snapshot

Updated: 2026-09-18. Overwrite this file on every update; it is never a running history.

## State

- On `dev`. **Everything pushed**: `dev` at `2990e10`, `main` at `5d9a471`.
- Working tree clean apart from untracked `.claude/launch.json` and `todo.md`, plus the long-standing
  deletions of 17 `badminton-v2/docs/visual/*.html`. None of that is mine; left alone deliberately.
- `npm run lint` clean (one pre-existing unrelated warning, `ProfileView.tsx:287`).
- `npm run test:unit` **348 passed**. `npm run build` clean.
- `tests/leaderboard-celebration.spec.ts` **6 passed**.
- **Pre-existing e2e failure, measured not assumed**: `tests/pair-leaderboard.spec.ts` fails 3 tests.
  Reverting every change on this branch and re-running produces the *same* 3 failures at HEAD. The
  test expects "No partnership has reached"; the app says "No partnership qualifies yet", and has
  since before this branch. Someone changed the copy and never updated the test. Not fixed here.

## Shipped this session

**Build stamp** (`9eed7af`). The running build at the bottom of the profile page, generated from
`VERCEL_GIT_COMMIT_SHA` → `git rev-parse` → `'dev'`. Tap to copy, with an `execCommand` fallback
because the async Clipboard API is refused in in-app webviews.

**Session notes as chips** on the `/sessions` card — `session_notes` is a pipe-separated list, so it
is laid out rather than clamped and cut mid-word.

**Leaderboard celebrations**, through the full speckit flow and then built. All four user stories:

- Card over whatever screen the player is on, naming the achievement. Never navigates.
- Toast offering that board; the row lifts and shimmers on arrival, by either route.
- Non-podium achievements: first appearance, personal best, three-place climb.
- Several at once collapse into one card, with a dwell that scales.

Files: `lib/podiumCelebration.ts` (the pure rule), `lib/celebrationStorage.ts`,
`lib/leaderboardData.ts` (**extracted from `LeaderboardView`** so both share one definition of a
rank), `lib/celebrationLabels.ts`, `hooks/useLeaderboardCelebration.ts`, `components/
CelebrationCard.tsx` + `ConfettiBurst.tsx` + `LeaderboardCelebration.tsx`, the row sweep in
`LeaderboardView`, and `public/bunny-thumbsup.png`.

## Open / not done

- **No manual light-mode pass on the celebration card.** Dark is verified by screenshot; light uses
  only existing tokens but has not been looked at.
- The **streak achievement** ("three sessions climbing") is deliberately deferred — it is the only
  one of five needing rank *history* rather than a single snapshot. Reasoning in the spec's
  *Clarifications*.
- Nobody will see a celebration until **a session completes after this deploys**, because the first
  evaluation per player is silent by design. That is correct, not a bug — but it means the first
  real-world sighting is a week away.
- `tasks/todo.md` still holds the old pre-speckit plan for this feature; `specs/008-podium-celebration/`
  supersedes it.

## Notes for next session

- **Dev trigger**: `window.__celebrate([{board:'wins', kind:'podium', rank:2, previousRank:5}])`,
  installed only under `import.meta.env.DEV`. `kind` is one of `podium` / `first-appearance` /
  `personal-best` / `climb`. Without this there is no way to see the feature work by hand.
- Verified against real local data: the first evaluation recorded a genuine snapshot — 1st on
  Individual, 1st in all six cheer categories, unplaced on Partners — and correctly celebrated
  **nothing**.
- If celebrations turn out noisy in practice, the first dial to turn is Cheers: six of the eight
  watched boards are cheer categories, and a placing there is a *share* of your own cheers, so it can
  move without the player doing anything differently. The fallback is first place only. This was
  raised during planning and overruled deliberately — see the spec.
