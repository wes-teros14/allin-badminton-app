# Handoff — current snapshot

Updated: 2026-09-07. Overwrite this file on every update; it is never a running history.

## State

- **Pushed and live.** `origin/dev` = `80e9ba8`, `origin/main` = `5608908` (non-ff merge:
  *"Merge branch 'dev' into main — live-board finish cut from 7 round trips to 3"*). This means
  **it is deployed to production** at badmintontayo.mrkws.com.
- `tsc -b` clean, `vite build` clean, vitest **262/262** (was 251; +11 new). eslint unchanged — the
  single `ProfileView.tsx:257` warning is pre-existing, confirmed against a stashed tree.
- Working tree clean apart from the untracked `todo.md`, which this session did not create or touch.
- **Rollback anchors.** The local branch `007-live-board-latency` is kept at `80e9ba8` as a marker;
  the pre-change point is `f6c4547`. To back out on production:
  `git revert -m 1 5608908` on `main` undoes the whole merge, or revert the three commits
  newest-first (`0df6c0f` → `6835fec` → `63a3443`) to drop one layer at a time. All four states were
  built and tested before pushing — see *Verified*.

## Done this session

Live-board finish latency: **7 sequential round trips → 3.** Measured 526 ms end to end against the
dev project, down from the reported 3–5 s. Three commits, layered so they revert newest-first.

1. `63a3443` `fix(live-board)` — `next` is the shared queue head, not a per-court reservation.
   `buildCourtSlots` gave court N `queued[N-1]`, so court 2 previewed a game that could never land
   there next. Copy: *Next up* → *Next in queue*. **Player-visible**, on an idle court. This had to
   land first, or deleting the "next queued" query would promote the wrong game on court 2.
2. `6835fec` `perf(live-board)` — profiles from a 60 s TTL cache (`src/lib/profileCache.ts`, new);
   `sessions` and `matches` read in parallel; `settle()` moved into `.finally` so a thrown load
   cannot wedge `isReloading` or `isLoading`.
3. `0df6c0f` `perf(live-board)` — the complete-match and record-result writes now overlap; the
   "find next queued match" SELECT deleted in favour of the `data.next` prop, guarded by
   `isReloading` and a new `.eq('status','queued')` on the promote; a rejected finish now says so
   (`toast.info`) instead of silently doing nothing; dropped the duplicate local `formatElapsed`.

Writing the profile-cache tests caught a real bug before it shipped: "never fetched" was
`fetchedAt === 0` compared as a timestamp, so cold start only read as expired because `Date.now()`
is large — fine in production, wrong under any injected clock. Now `number | null`.

Docs: `badminton-v2/docs/visual/finish-match-latency.html` (new), a **Live board & performance**
topic in `docs/qa-log.html` with a correction callout for the `queued[index]` bug, three
`tasks/lessons.md` entries, and `project_memory.md` updated.

## Verified, and how

- **3 round trips**, in the browser against dev Supabase: `t+0ms` POST match_results ‖ PATCH matches
  (complete), `t+334ms` PATCH matches (promote), `t+526ms` GET matches ‖ GET sessions — with no
  profiles query. Board advanced to the correct next game.
- **A poll tick is now one round trip** (`GET matches` ‖ `GET sessions`, same millisecond, profiles
  absent) rather than three sequential reads.
- **Both courts read "Next in queue — Game 1"** on `/sessions/:id`; court 2 previously said Game 2.
- **Rollback tested, not assumed.** Reverting commit 3 alone → builds, 262 pass. Reverting 3+2 →
  builds, 252 pass. Reverting all three → builds, 251 pass, and `git diff dev -- badminton-v2/src`
  is **empty**, so a full revert is byte-identical to `dev`.
- Dev data was modified to run the live test (promoted game 1 to court 1, finished it) and
  **restored exactly**: `unfinish_match` to reverse `player_stats`/`player_pair_stats` and delete the
  result rows, then every match reset from a pre-captured snapshot. Confirmed all 20 back to
  `queued`, 0 result rows, snapshot-identical.

## Not verified

- **Nothing seen on the actual tablet or a physical phone.** All measurement was in the in-app
  browser against the dev project.
- **Neither sync guard has been exercised live.** The two tests that matter: (a) reorder the queue on
  the admin phone, then tap Finish on the tablet within a second — the promoted game must be the new
  head, not the old one; (b) change a nickname or avatar mid-session — it must appear on tablet and
  phone within about a minute.
- **Split scoring is untested against this change.** The dev session has `split_match_scoring: false`,
  so the two-row `submitSplitResult` path inside the new `Promise.all` never ran. It is the one
  branch of `handleFinish` with no live coverage.
- Two courts finishing within a second of each other (the `isReloading` fallback) was not staged.

## Immediate next steps

1. **Rotate the prod `service_role` key — still outstanding, and the key is live.** A read-only probe
   on 2026-09-07 authenticated successfully as `service_role` against the prod project (issued
   2026-03-18, expires 2036-03-18). It leaked via `.claude/settings.local.json`, Claude Code's
   permission allowlist, which had recorded an approved one-off command with the key inline.
   - The history rewrite is **not** remediation: GitHub keeps unreachable objects fetchable by old
     SHA until it garbage-collects, and every existing clone still holds them.
   - **Creating new API keys does not disable the legacy ones.** Only "deactivate legacy keys" in
     the Supabase dashboard does, and that step has not been taken. This is why it may feel handled.
   - Re-probe after rotating before believing it is fixed. See commits `e1b14fb`, `8664315`,
     `532f6e1`.
2. **Run the live board on the tablet during a real session** and judge whether ~1.5 s is enough. If
   it still drags, the recorded next step is applying the confirmed write outcome locally instead of
   refetching — `project_memory.md` → Decisions, "Deferred step 1". Do **not** jump to optimistic
   painting without the `finish_match` RPC; optimism turns the double-promotion race into a board
   confidently showing a game nobody is playing.
3. **Test the split-scoring finish path on production** (needs a session with `split_match_scoring`
   on). This is the one branch of `handleFinish` that is live but has never been run — see
   *Not verified*. Worth doing before a session that uses split scoring, not during one.
4. **The stale-game report is still open and undiagnosed.** On `/session/cb4ba170-…` one surface kept
   showing game 2 after game 3 had gone live. Mark was asked which pair of screens disagreed
   (`/admin` vs `/session/:id`, or `/session/:id` vs `/sessions/:id`) and never answered, so nothing
   was touched. **New lead from this session:** `PlayerView.tsx` mounts `useRealtime` twice (`:216`
   and `:411`) on the same default channel topic `live-board-${sessionId}`. If both mount together
   that is two subscriptions on one topic, which is the right shape for a surface that stops
   updating.
5. Decide on `useAdminActions.markDone` (`:77-130`) — it still holds a duplicate of the old
   four-step finish and keeps the double-promotion race. Natural pair to the deferred RPC.
6. Open the board on a real phone with real data, especially a live session.
7. Decide on the `Avatar` fallback and the light-hostile palette list.
8. Delete the merged `006-pair-winrate-leaderboard` branch.
9. Sanity-check `MIN_CHEERS_RECEIVED = 15` (`src/lib/cheerShare.ts`) against the real spread of
    `player_cheer_stats.cheers_received` — it was an estimate, not a measurement.

## Known, not fixed

- **`Avatar.tsx` fallback is weak** — `bg-muted` + one initial, so every Ana/Ate/Alex is the same
  grey circle. Mock of the fix is in `docs/visual/match-schedule-a1-progressive.html`.
- **Nine Tailwind palette text colours are light-hostile** on admin screens — `text-amber-400`
  1.72:1, `text-green-500` 2.22:1, etc. Mostly `MatchGeneratorPanel`, plus `FinanceView`,
  `CourtTabs`, `CourtCard`, `PlayerView`, `LiveIndicator`.
- **Light mode has never been reviewed on the leaderboard screens.**
- **The kiosk has no connection indicator** — `LiveBoardView.tsx:10` discards `useRealtime`'s
  `status`, which every other consumer destructures. If the gym wifi drops, the tablet shows a stale
  board with a pulsing LIVE badge and no warning.
- The `supabase` MCP server has failed to connect all session (HTTP 401, `AUTH_HEADER_REJECTED`), so
  DB inspection went through the app's own client in the browser instead.

## Open questions

- **Should the uncommitted `CLAUDE.md` additions be committed?** Still held back, still undecided.
  Raised three times now.
- Should the `Draw` chip on My Games read `Tied`, now that the All Games row says "tied with"?
- Should `ScheduleView` get the empty state and the payment banner?
- Should the theme orb also go on the nav bar?
- Should `/sessions` show `setup` sessions to admins?
- Should the two `tasks/lessons.md` files be consolidated into the root one?
- `--muted-surface` is defined only in `:root`, never in `.dark`, so it resolves near-white in dark
  mode. Nothing in `src/` uses it — fix the token or delete it?
- A community post announcing the cheers revamp **and** the theme was drafted in the 2026-09-06 chat
  but never saved to a file. Ask for it again if still wanted.
