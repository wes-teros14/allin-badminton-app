# Handoff — current snapshot

Updated: 2026-09-18 (leaderboard celebrations, US1 + US2). Overwrite this file on every update; it is
never a running history.

## State

- On branch `008-podium-celebration`. **Pushed to `dev` and `main`.**
- `npm run lint` clean (one pre-existing unrelated warning, `ProfileView.tsx:287`).
- `npm run test:unit` **339 passed** (was 327). `npm run build` clean.
- `tests/leaderboard-celebration.spec.ts` **4 passed**.
- **Pre-existing e2e failure, measured not assumed**: `tests/pair-leaderboard.spec.ts` fails 3 tests.
  Reverting every change on this branch and re-running produces the *same* 3 failures at HEAD. Cause
  is a copy mismatch: the test expects "No partnership has reached", the app says "No partnership
  qualifies yet", and has since before this branch. Not fixed here — it is someone's deliberate copy
  change that never updated its test.

## Done this session

**Build stamp** (commit `9eed7af`, from earlier): the running build shown at the bottom of the
profile page, `dfdbc68 · Sep 18, 2026 2:32 PM`, generated at build time from
`VERCEL_GIT_COMMIT_SHA` → `git` → `'dev'`. Tap to copy, with an `execCommand` fallback because the
async Clipboard API is refused in in-app webviews.

**Leaderboard celebrations, through the full speckit flow** — spec, plan, research, data model,
contracts, quickstart, 40 tasks, then implementation of Phases 1–4.

Shipped:
- `lib/podiumCelebration.ts` — the pure rule. Podium kinds only so far.
- `lib/celebrationStorage.ts` — per-player recorded standings in `localStorage`, 12 tests.
- `lib/leaderboardData.ts` — the board queries and ranking, **extracted out of `LeaderboardView`**
  so the celebration and the leaderboard share one definition of a rank.
- `lib/celebrationLabels.ts` — board names, ordinals, and the on/in preposition rule.
- `hooks/useLeaderboardCelebration.ts` — sentinel → compute → evaluate → persist → announce.
- `components/CelebrationCard.tsx`, `ConfettiBurst.tsx`, `LeaderboardCelebration.tsx`.
- Row sweep in `LeaderboardView`, armed when the celebration is shown.
- `public/bunny-thumbsup.png` — the non-podium icon.

**Two real bugs caught by the process, worth remembering:**

1. **`npx tsc --noEmit` typechecks nothing in this project.** `tsconfig.json` is a solution file with
   `"files": []` and only references, so it exits 0 having checked zero files. The real check is
   `tsc -b`, which `npm run build` runs. The extraction had three genuine type errors hiding behind a
   green `--noEmit`, one of which crashed the Partners tab to a blank page at runtime.
2. **A Playwright test that skips itself reports green while asserting nothing.** Two sweep tests
   called `test.skip()` when storage had not been written yet; replaced with a `waitForFunction`, so
   a missing first-run record is now a failure rather than a silent pass.

## Not built

- **US3** — non-podium achievements (first appearance, personal best, 3+ place climb). The rule
  returns podium placings only. The card already renders the bunny path and the ordinary border, so
  this is wiring the detection, not new design.
- **US4** — several achievements at once. The card already renders the multi-achievement layout and
  scales its dwell; the rule just never returns more than podium placings today.
- Polish tasks T034/T035 (light/dark and reduced-motion manual passes), T038/T039 docs, T040.

## Notes for next session

- Everything is specified: `specs/008-podium-celebration/` has spec, plan, research, data-model,
  contracts, quickstart and tasks. Tasks T023–T032 are the remaining two stories.
- **The dev trigger is `window.__celebrate([{board, rank, previousRank}])`**, installed only under
  `import.meta.env.DEV`. Without it there is no way to see this feature work — the natural trigger
  needs a session to complete *and* the first evaluation per player is deliberately silent.
- Verified against real data in the local app: the first evaluation recorded a genuine snapshot
  (wins 1st, pairs null, all six cheers 1st) and correctly celebrated **nothing**.
