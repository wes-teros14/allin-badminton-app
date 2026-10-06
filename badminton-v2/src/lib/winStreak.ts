/**
 * ⚡ Win Streak (chosen 2026-10-06, temporary_files/win-streak-award-options.html).
 *
 * A player's current run of match wins: count back from their newest finished
 * match until one they did not win. A loss ends the run and so does a draw
 * (a split 1-1). A match with no results (abandoned) is skipped, and missing a
 * session breaks nothing because no match was played.
 *
 * Counted in MATCHES, not games. From May to July matches were two games each,
 * and counting games doubled every 2-0: the longest game run on prod was 30,
 * which was only 18 matches.
 *
 * The current run rather than the all-time best, because the best follows how
 * many matches someone has played (r = 0.55 on prod) and the current run barely
 * does (r = 0.12). It is a merit award, so organisers are not excluded.
 */

import type { MatchOutcome } from '@/lib/matchResults'

export const WIN_STREAK_PLACES = 3
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

/** Each player's current run of match wins, oldest match first. */
export function currentWinRuns(matches: WinStreakMatch[]): Map<string, number> {
  const ordered = matches
    .filter((m) => m.outcome !== null)
    .sort((a, b) => a.endedAt.localeCompare(b.endedAt) || a.matchId.localeCompare(b.matchId))

  const runs = new Map<string, number>()
  for (const m of ordered) {
    for (const [team, players] of [['team1', m.team1], ['team2', m.team2]] as const) {
      const won = m.outcome === team
      for (const playerId of players) {
        runs.set(playerId, won ? (runs.get(playerId) ?? 0) + 1 : 0)
      }
    }
  }
  return runs
}

/** The top places by current run, dense (1, 1, 2 — never 1, 1, 3). */
export function rankWinStreaks(
  matches: WinStreakMatch[],
  { eligible, places = WIN_STREAK_PLACES, minRun = WIN_STREAK_MIN_RUN }: RankWinStreaksOptions = {},
): WinStreakEntry[] {
  const sorted = [...currentWinRuns(matches).entries()]
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
