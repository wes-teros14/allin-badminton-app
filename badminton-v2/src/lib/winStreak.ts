/**
 * ⚡ Win Streak (chosen 2026-10-06, temporary_files/win-streak-award-options.html).
 *
 * A player's BEST run of match wins ever: the longest stretch of consecutive
 * finished matches they won. A loss ends a run and so does a draw (a split
 * 1-1), but the best run is kept. A match with no results (abandoned) is
 * skipped, and missing a session breaks nothing because no match was played.
 *
 * Counted in MATCHES, not games. From May to July matches were two games each,
 * and counting games doubled every 2-0: the longest game run on prod was 30,
 * which was only 18 matches.
 *
 * Best-ever since 2026-10-11 (owner): the current run punished one bad game —
 * the leader on 7 dropped to 0 on a single loss — and only 2 of 19 active
 * players were ever on the board. Best-ever filled it (18, 9, 7, 7, 6, 6 on
 * prod) and follows matches played only slightly among active players
 * (r = 0.26). Accepted cost: an old long run can hold 1st for a long time.
 * It is a merit award, so organisers are not excluded.
 */

import type { MatchOutcome } from '@/lib/matchResults'
import { AWARD_PLACES } from '@/lib/denseRank'

export const WIN_STREAK_PLACES = AWARD_PLACES
/** A run shorter than this is not shown. */
export const WIN_STREAK_MIN_RUN = 3

export interface WinStreakMatch {
  matchId: string
  /** When the match's last game was recorded; matches are replayed in this order. */
  endedAt: string
  team1: readonly [string, string]
  team2: readonly [string, string]
  /** null when the match has no results (abandoned). */
  outcome: MatchOutcome | null
}

export interface WinStreakEntry {
  playerId: string
  run: number
  /** 1-based; equal runs share a place. */
  place: number
}

export interface RankWinStreaksOptions {
  /** Who may appear (still active). Omit to place everyone. */
  eligible?: ReadonlySet<string>
  places?: number
  minRun?: number
}

/** Each player's run of match wins as it stands now, and their best run ever. */
export function winRuns(matches: WinStreakMatch[]): Map<string, { current: number; best: number }> {
  const ordered = matches
    .filter((m) => m.outcome !== null)
    .sort((a, b) => a.endedAt.localeCompare(b.endedAt) || a.matchId.localeCompare(b.matchId))

  const runs = new Map<string, { current: number; best: number }>()
  for (const m of ordered) {
    for (const [team, players] of [['team1', m.team1], ['team2', m.team2]] as const) {
      const won = m.outcome === team
      for (const playerId of players) {
        const r = runs.get(playerId) ?? { current: 0, best: 0 }
        const current = won ? r.current + 1 : 0
        runs.set(playerId, { current, best: Math.max(r.best, current) })
      }
    }
  }
  return runs
}

/** The top places by best run ever, dense (1, 1, 2 — never 1, 1, 3). */
export function rankWinStreaks(
  matches: WinStreakMatch[],
  { eligible, places = WIN_STREAK_PLACES, minRun = WIN_STREAK_MIN_RUN }: RankWinStreaksOptions = {},
): WinStreakEntry[] {
  const sorted = [...winRuns(matches).entries()]
    .map(([playerId, r]) => [playerId, r.best] as const)
    .filter(([playerId, run]) => run >= minRun && (!eligible || eligible.has(playerId)))
    .sort(([idA, a], [idB, b]) => b - a || idA.localeCompare(idB))

  const ranked: WinStreakEntry[] = []
  sorted.forEach(([playerId, run], i) => {
    const prev = ranked[i - 1]
    const place = !prev ? 1 : prev.run === run ? prev.place : prev.place + 1
    ranked.push({ playerId, run, place })
  })
  return ranked.filter((e) => e.place <= places)
}
