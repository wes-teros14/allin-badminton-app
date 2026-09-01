/**
 * Partnership tallies for the all-time pair leaderboard.
 *
 * `player_pair_stats` already counts wins together, but its companion column
 * counts losses *to an opponent*, not losses *beside a partner* — and partner
 * losses cannot be reconstructed from it. So the pair board derives both halves
 * from the match records instead, which needs no new column, no trigger change,
 * and no edit to either stat-reversal function.
 *
 * Everything here is pure: match rows in, tallies out. No Supabase, no React.
 */

import { sortMatchResults } from '@/lib/matchResults'

/**
 * The shape this module needs from a match row. Structural rather than the
 * generated database type, so tests can build fixtures without a database.
 */
export interface PairTallyMatch {
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  match_results:
    | Array<{ winning_pair_index: number; game_number?: number | null }>
    | null
    | undefined
}

export interface PairTally {
  key: string
  /** The lower-sorting of the two ids. */
  playerA: string
  /** The higher-sorting of the two ids. */
  playerB: string
  wins: number
  losses: number
  games: number
}

/** Not a character that can occur inside a UUID, so the key is unambiguous. */
const KEY_SEPARATOR = '~'

/**
 * A stable, order-independent id for a partnership: `pairKey(a, b)` and
 * `pairKey(b, a)` are the same string, so Sim & Wes is one entry rather than two.
 */
export function pairKey(playerA: string, playerB: string): string {
  return playerA < playerB
    ? `${playerA}${KEY_SEPARATOR}${playerB}`
    : `${playerB}${KEY_SEPARATOR}${playerA}`
}

interface ResolvedPair {
  key: string
  playerA: string
  playerB: string
}

/**
 * Returns null for a side that cannot be a partnership.
 *
 * Migration 079 forbids the same player in two slots of one match, but it was
 * added *after* a live session produced one ("Alexis & Alexis") and it aborts
 * rather than cleaning, so a surviving historical row would otherwise be tallied
 * as a player partnered with themselves.
 */
function resolvePair(first: string, second: string): ResolvedPair | null {
  if (!first || !second || first === second) return null

  const [playerA, playerB] = first < second ? [first, second] : [second, first]
  return { key: pairKey(playerA, playerB), playerA, playerB }
}

function record(tallies: Map<string, PairTally>, pair: ResolvedPair, won: boolean): void {
  let tally = tallies.get(pair.key)
  if (!tally) {
    tally = { key: pair.key, playerA: pair.playerA, playerB: pair.playerB, wins: 0, losses: 0, games: 0 }
    tallies.set(pair.key, tally)
  }

  tally.games++
  if (won) tally.wins++
  else tally.losses++
}

/**
 * Walks the match rows once and returns one tally per partnership.
 *
 * Counting is per recorded game, not per match — matching `computeStatsFromResults`
 * and the stats triggers — so a split-scored 1-1 gives each pair 1W and 1L.
 * A match with no recorded result contributes nothing.
 */
export function tallyPairs(matches: readonly PairTallyMatch[]): Map<string, PairTally> {
  const tallies = new Map<string, PairTally>()

  for (const match of matches) {
    const results = sortMatchResults(match.match_results)
    if (results.length === 0) continue

    const team1 = resolvePair(match.team1_player1_id, match.team1_player2_id)
    const team2 = resolvePair(match.team2_player1_id, match.team2_player2_id)
    if (!team1 && !team2) continue

    for (const result of results) {
      // Mirrors computeStatsFromResults: anything that isn't 2 means team 1 won.
      const team2Won = result.winning_pair_index === 2
      if (team1) record(tallies, team1, !team2Won)
      if (team2) record(tallies, team2, team2Won)
    }
  }

  return tallies
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export interface RankedPair extends PairTally {
  winRate: number
}

export interface RankPairsOptions {
  /** Games together a pair needs before it is ranked at all. */
  minGames?: number
  /** Both players must pass this for the pair to be ranked. */
  isEligiblePlayer?: (playerId: string) => boolean
  limit?: number
}

/**
 * The generator spreads partners deliberately (repeatPartnerPenalty), so most
 * pairs have very few games together. Without a floor a 2-0 duo outranks a
 * 12-3 one, which reads as broken rather than intentional.
 */
export const DEFAULT_MIN_GAMES_TOGETHER = 3
export const DEFAULT_PAIR_LIMIT = 10

/**
 * Applies eligibility and ordering to raw tallies.
 *
 * Kept separate from tallyPairs so the threshold can be tuned or tested without
 * touching the counting. Ordering is win rate, then wins, then the pair key —
 * the key tiebreak makes the result a property of the data rather than of the
 * order rows happened to arrive in.
 */
export function rankPairs(
  tallies: Map<string, PairTally> | readonly PairTally[],
  options: RankPairsOptions = {},
): RankedPair[] {
  const {
    minGames = DEFAULT_MIN_GAMES_TOGETHER,
    isEligiblePlayer = () => true,
    limit = DEFAULT_PAIR_LIMIT,
  } = options

  const source = tallies instanceof Map ? [...tallies.values()] : tallies

  return source
    .filter(
      (tally) =>
        tally.playerA !== tally.playerB &&
        tally.games >= minGames &&
        isEligiblePlayer(tally.playerA) &&
        isEligiblePlayer(tally.playerB),
    )
    .map((tally) => ({
      ...tally,
      winRate: tally.games > 0 ? Math.round((tally.wins / tally.games) * 100) : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || a.key.localeCompare(b.key))
    .slice(0, limit)
}
