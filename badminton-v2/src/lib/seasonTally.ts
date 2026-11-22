/**
 * Pure tallies over the raw season rows from `seasonData.ts`. No I/O, so every number a board shows
 * can be reproduced from the rows alone.
 *
 * Each mirrors the semantics of the stored counters it replaces: `player_stats` (one game per
 * `match_results` row), `player_pair_stats`, and `player_cheer_stats` (given and received both
 * weighted by the cheer's multiplier, see migration 027).
 */

import { inWindow, type DateWindow } from '@/lib/season'
import { computeStatsFromResults, sortMatchResults } from '@/lib/matchResults'
import type { CheerStatsRow } from '@/lib/leaderboardData'
import type { AttendanceRow, CheerRow, SeasonMatchRow } from '@/lib/seasonData'

/** Games and wins per player. A match with no results contributes nothing. */
export function tallyPlayerGames(
  matches: readonly SeasonMatchRow[],
): Map<string, { games: number; wins: number }> {
  const totals = new Map<string, { games: number; wins: number }>()
  for (const match of matches) {
    for (const [playerId, s] of computeStatsFromResults(match)) {
      if (s.games === 0) continue
      const t = totals.get(playerId) ?? { games: 0, wins: 0 }
      t.games += s.games
      t.wins += s.wins
      totals.set(playerId, t)
    }
  }
  return totals
}

/** Distinct sessions per player among the rows inside `w`, optionally narrowed by `filter`. */
export function countSessions(
  rows: readonly AttendanceRow[],
  w: DateWindow,
  filter?: (r: AttendanceRow) => boolean,
): Map<string, number> {
  const seen = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!inWindow(r.sessionDate, w)) continue
    if (filter && !filter(r)) continue
    const sessions = seen.get(r.playerId) ?? new Set<string>()
    sessions.add(r.sessionId)
    seen.set(r.playerId, sessions)
  }
  return new Map([...seen].map(([playerId, sessions]) => [playerId, sessions.size]))
}

const RECEIVED_FIELD = {
  offense: 'offense_received',
  defense: 'defense_received',
  technique: 'technique_received',
  movement: 'movement_received',
  good_sport: 'good_sport_received',
  solid_effort: 'solid_effort_received',
} as const

const emptyCheerRow = (playerId: string): CheerStatsRow => ({
  player_id: playerId,
  cheers_received: 0,
  cheers_given: 0,
  offense_received: 0,
  defense_received: 0,
  technique_received: 0,
  movement_received: 0,
  good_sport_received: 0,
  solid_effort_received: 0,
})

/** Weighted cheers given and received per player, shaped like a `player_cheer_stats` row. */
export function tallyCheers(rows: readonly CheerRow[]): Map<string, CheerStatsRow> {
  const out = new Map<string, CheerStatsRow>()
  const rowFor = (playerId: string) => {
    let r = out.get(playerId)
    if (!r) {
      r = emptyCheerRow(playerId)
      out.set(playerId, r)
    }
    return r
  }

  for (const c of rows) {
    rowFor(c.giverId).cheers_given += c.weight
    const received = rowFor(c.receiverId)
    received.cheers_received += c.weight
    received[RECEIVED_FIELD[c.slug]] += c.weight
  }
  return out
}

/**
 * One player's head to head, with `player_pair_stats` semantics: `partners` counts games won together
 * with each partner; `opponents` counts games lost, +1 against each of the two winners.
 */
export function tallyHeadToHead(
  matches: readonly SeasonMatchRow[],
  playerId: string,
): { partners: Map<string, number>; opponents: Map<string, number> } {
  const partners = new Map<string, number>()
  const opponents = new Map<string, number>()
  const bump = (m: Map<string, number>, id: string) => m.set(id, (m.get(id) ?? 0) + 1)

  for (const match of matches) {
    const team1 = [match.team1_player1_id, match.team1_player2_id]
    const team2 = [match.team2_player1_id, match.team2_player2_id]
    const mine = team1.includes(playerId) ? team1 : team2.includes(playerId) ? team2 : null
    if (!mine) continue

    for (const result of sortMatchResults(match.match_results)) {
      // Anything that is not 2 means team 1 won, as in computeStatsFromResults.
      const winners = result.winning_pair_index === 2 ? team2 : team1
      if (winners === mine) {
        for (const id of mine) if (id !== playerId) bump(partners, id)
      } else {
        for (const id of winners) bump(opponents, id)
      }
    }
  }
  return { partners, opponents }
}
