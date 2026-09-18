# Quickstart — Leaderboard Celebrations

How to work on this feature, and in particular how to see it at all — which is the first problem you
will hit.

---

## The awkward bit, first

**The natural trigger only fires after a real session completes.** Worse, the first evaluation for any
player is deliberately silent, so even completing a session gives you nothing until the *second* time.
Without a way in, the development loop is "play a badminton session, then wait a week".

This is why FR-027 exists. Before building anything else, build the dev trigger.

**Local environment notes** (learned the hard way):

- The dev login panel is the bottom-right **DEV** button. Click it, then a player.
- The dev session does not survive a full page reload cleanly — navigate by clicking nav links rather
  than reloading a URL.
- The local database has **no session with a real `session_notes` value** and its sessions are test
  data; do not assume realistic standings.
- The preview pane serves local HTML as a `data:` URL, so relative asset paths do not resolve there.
  Prototypes must inline their assets.
- `requestAnimationFrame` is starved while the preview pane is not painting, so canvas animation
  **cannot** be verified by reading pixels back — only by screenshot. Instrumented pixel counts will
  read zero and look like a bug that is not there.

---

## Build order

Follow the user story priorities; each stops at a shippable point.

### 1. The rule (US1 foundation)

`src/lib/podiumCelebration.ts` — pure, no React, no Supabase. Write the table in
`contracts/celebration-contract.md#C1` as tests first; it is fully specified and has no dependencies.

Pay attention to the three silences. They are the difference between a feature that delights and one
that congratulates the entire roster on launch day:

- no previous snapshot at all → nothing
- board absent from the previous snapshot → nothing for that board
- unchanged or worsened → nothing

The present-null versus absent-key distinction is the subtle one. `null` means "watched, not placed"
and is news later; a missing key means "not watched" and is not.

```bash
npx vitest run src/__tests__/podiumCelebration.test.ts
```

### 2. Storage

`src/lib/celebrationStorage.ts`. Namespace by player id — two accounts share a browser here because of
the dev login panel, and a leaked snapshot between them is a silent wrong answer. Every read wrapped
so blocked or cleared storage degrades to "no state" rather than throwing on launch.

### 3. Shared board data

`src/lib/leaderboardData.ts` is **already extracted from `LeaderboardView.tsx` but unverified** — it
typechecks, but its lint and full test run were interrupted. Finish that before building on it:

```bash
cd badminton-v2
npm run lint
npm run test:unit
npx playwright test tests/pair-leaderboard.spec.ts
```

The leaderboard must render identically before and after. It is a pure move.

### 4. The hook, then the card

`hooks/useLeaderboardCelebration.ts`, then `components/CelebrationCard.tsx` and `ConfettiBurst.tsx`,
hosted from `layouts/PlayerLayout.tsx` so a celebration can appear over any screen.

Confetti trap, already paid for once: an emitter that seeds its first particles on a timer gets killed
by a loop that stops when the particle array is empty — the loop runs once, sees nothing, and shuts
down before the first batch lands. Keep the loop alive while an emitter is still producing.

### 5. Toast and sweep (US2)

Arm the sweep **when the celebration is shown**, not when the player accepts the offer. There are two
routes to the leaderboard and both must find the debt waiting. A prototype armed it only on the
ignoring path; the main route silently did nothing and looked perfectly fine.

### 6. Non-podium (US3) and several-at-once (US4)

Independent of each other. The bunny asset is `temporary_files/bunny-thumbsup.png` (192×261, RGBA,
already keyed, cropped and colour-corrected) and moves to `badminton-v2/public/`.

---

## Prototypes to work from

These are working, not sketches. Open them in a browser directly from disk.

| File | Shows |
|---|---|
| `temporary_files/podium-celebration-flow.html` | The three beats end to end, plus the ignore-the-toast path |
| `temporary_files/podium-celebration-multiple-medals.html` | Several at once, at 2, 3 and 5 |
| `temporary_files/non-podium-celebration-options.html` | The non-podium card, bunny icon, border rule |
| `temporary_files/leaderboard-podium-celebration-options.html` | The row sweep and the original animation styles |

---

## Validation before merge

Per Constitution Principle V, proportional to impact — and this feature touches player-facing
navigation and state, so it needs the browser level too.

```bash
cd badminton-v2
npm run lint
npm run test:unit
npx playwright test tests/leaderboard-celebration.spec.ts
```

The Playwright spec **must cover both arrival routes** — accepting the offer, and arriving at the
leaderboard unprompted. A test that only exercises the toast would have passed against the broken
prototype.

Manually confirm, since they are hard to assert and easy to get wrong:

- Light and dark: card border colours, and the bunny against both card backgrounds.
- Reduced motion: card content still readable, no particles, no sweep.
- That a launch with no newly completed session issues no board queries — check the network panel.

If an unrelated pre-existing failure blocks a full green run, name it explicitly and state what did
pass. The constitution asks for honest validation rather than an implied green suite.
