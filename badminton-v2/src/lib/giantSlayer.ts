/**
 * 🗡️ Giant Slayer (chosen 2026-10-06, tuned in
 * temporary_files/giant-slayer-tuning-report.html against prod data).
 *
 * Every game is replayed in the order it was recorded. Going into each game,
 * a player's win rate is their record over every game they had already played
 * (counted in games, like the profile: a 1-1 match is one win and one loss).
 * A pair's strength is the average of its two players' win rates. The pair at
 * least GIANT_SLAYER_GAP weaker is the underdog, and an upset is the underdog
 * winning that game. A player's score is upsets ÷ games played as the underdog.
 *
 * Built only on public numbers. Player levels are private to the admin, so
 * "beat a higher-rated pair" was rejected: it would reveal who is rated higher.
 *
 * Why 20 points: per game on prod, the weaker pair still wins 35-43% of games
 * up to a 20-point gap, then about 21% from 20 to 25 points. Below 20 an "upset"
 * is barely one.
 */

import { AWARD_PLACES } from '@/lib/denseRank'

/** How much weaker a pair must go in, as a share (0.2 = 20 percentage points). */
export const GIANT_SLAYER_GAP = 0.2
/** Games a player must have played before their win rate is used. */
export const GIANT_SLAYER_MIN_PRIOR_GAMES = 4
/** Games as the underdog a player needs before they are ranked. */
export const GIANT_SLAYER_MIN_UNDERDOG_GAMES = 3
export const GIANT_SLAYER_PLACES = AWARD_PLACES

export interface SlayerGame {
  gameId: string
  /** When the game was recorded; games are replayed in this order. */
  recordedAt: string
  matchId: string
  gameNumber: number
  team1: readonly [string, string]
  team2: readonly [string, string]
  /** The pair that won this game. */
  winner: 1 | 2
}

export interface GiantSlayerEntry {
  playerId: string
  upsets: number
  underdogGames: number
  /** 1-based; equal scores (the same fraction) share a place. */
  place: number
}

export interface RankGiantSlayersOptions {
  /** Who may appear (still active). Omit to place everyone. */
  eligible?: ReadonlySet<string>
  gap?: number
  minPriorGames?: number
  minUnderdogGames?: number
  places?: number
}

/** Tolerance for comparing a gap of exactly 20 points computed in floating point. */
const EPSILON = 1e-9

/** Every player's upsets and underdog games, from the full game history. */
export function tallyUpsets(
  games: SlayerGame[],
  { gap = GIANT_SLAYER_GAP, minPriorGames = GIANT_SLAYER_MIN_PRIOR_GAMES }: Pick<RankGiantSlayersOptions, 'gap' | 'minPriorGames'> = {},
): Map<string, { upsets: number; underdogGames: number }> {
  const ordered = [...games].sort((a, b) =>
    a.recordedAt.localeCompare(b.recordedAt) || a.matchId.localeCompare(b.matchId) || a.gameNumber - b.gameNumber,
  )
  const record = new Map<string, { played: number; won: number }>()
  const tally = new Map<string, { upsets: number; underdogGames: number }>()
  const rec = (id: string) => record.get(id) ?? { played: 0, won: 0 }

  for (const g of ordered) {
    const four = [...g.team1, ...g.team2]
    if (four.every((id) => rec(id).played >= minPriorGames)) {
      const rate = (id: string) => rec(id).won / rec(id).played
      const strength1 = (rate(g.team1[0]) + rate(g.team1[1])) / 2
      const strength2 = (rate(g.team2[0]) + rate(g.team2[1])) / 2
      const underdog = strength2 - strength1 >= gap - EPSILON ? 1 : strength1 - strength2 >= gap - EPSILON ? 2 : null
      if (underdog) {
        const upset = g.winner === underdog
        for (const id of underdog === 1 ? g.team1 : g.team2) {
          const t = tally.get(id) ?? { upsets: 0, underdogGames: 0 }
          t.underdogGames += 1
          if (upset) t.upsets += 1
          tally.set(id, t)
        }
      }
    }
    // The record moves only AFTER the game, so a win rate is always "going in".
    for (const [team, players] of [[1, g.team1], [2, g.team2]] as const) {
      for (const id of players) {
        const r = rec(id)
        record.set(id, { played: r.played + 1, won: r.won + (g.winner === team ? 1 : 0) })
      }
    }
  }
  return tally
}

/** The top places by upset rate, dense (1, 1, 2), cut by places rather than rows. */
export function rankGiantSlayers(games: SlayerGame[], options: RankGiantSlayersOptions = {}): GiantSlayerEntry[] {
  const {
    eligible,
    minUnderdogGames = GIANT_SLAYER_MIN_UNDERDOG_GAMES,
    places = GIANT_SLAYER_PLACES,
  } = options

  const sorted = [...tallyUpsets(games, options).entries()]
    .map(([playerId, t]) => ({ playerId, ...t }))
    .filter((e) => e.upsets >= 1 && e.underdogGames >= minUnderdogGames && (!eligible || eligible.has(e.playerId)))
    // Compare fractions exactly (a/b vs c/d as a*d vs c*b): 2 of 6 and 1 of 3 must tie.
    .sort((a, b) =>
      b.upsets * a.underdogGames - a.upsets * b.underdogGames ||
      b.upsets - a.upsets ||
      a.playerId.localeCompare(b.playerId),
    )

  const ranked: GiantSlayerEntry[] = []
  sorted.forEach((e, i) => {
    const prev = ranked[i - 1]
    const same = prev && prev.upsets * e.underdogGames === e.upsets * prev.underdogGames
    ranked.push({ ...e, place: !prev ? 1 : same ? prev.place : prev.place + 1 })
  })
  return ranked.filter((e) => e.place <= places)
}
