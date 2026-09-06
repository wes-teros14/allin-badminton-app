import { supabase } from '@/lib/supabase'

export interface MatchResultLike {
  winning_pair_index: number
  game_number?: number | null
}

export interface MatchPlayersLike {
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
}

export interface SplitScoringSessionLike {
  split_match_scoring?: boolean | null
}

export interface NormalizedMatchResult extends MatchResultLike {
  game_number: number
}

export function isSplitMatchScoringEnabled(session: SplitScoringSessionLike | null | undefined): boolean {
  return session?.split_match_scoring === true
}

export function normalizeMatchResult(result: MatchResultLike): NormalizedMatchResult {
  return {
    ...result,
    game_number: result.game_number ?? 1,
  }
}

export function sortMatchResults(results: MatchResultLike[] | null | undefined): NormalizedMatchResult[] {
  return [...(results ?? [])]
    .map(normalizeMatchResult)
    .sort((left, right) => left.game_number - right.game_number)
}

/** How a whole match ended, once every game inside it is counted. */
export type MatchOutcome = 'team1' | 'team2' | 'draw'

/**
 * The result of a match, from all of its rows.
 *
 * A match holds one `match_results` row per game, so a split-scored match has
 * two. A pair has only *beaten* the other if it took every game; one each is a
 * draw. This is the single place that rule lives — the personal card and the
 * All Games results list both read it, because when they each derived it
 * themselves the list called a 1-1 a win for whoever happened to take game 1.
 */
export function getMatchOutcome(results: MatchResultLike[] | null | undefined): MatchOutcome | null {
  const rows = sortMatchResults(results)
  if (rows.length === 0) return null
  // Anything that is not an explicit 2 counts as team 1, matching how the rest
  // of the codebase reads winning_pair_index.
  const team1Wins = rows.filter((row) => row.winning_pair_index !== 2).length
  if (team1Wins === rows.length) return 'team1'
  if (team1Wins === 0) return 'team2'
  return 'draw'
}

export function computeStatsFromResults(
  match: MatchPlayersLike & { match_results: MatchResultLike[] | null | undefined },
): Map<string, { wins: number; games: number }> {
  const statsMap = new Map<string, { wins: number; games: number }>()
  const team1 = [match.team1_player1_id, match.team1_player2_id]
  const team2 = [match.team2_player1_id, match.team2_player2_id]

  for (const playerId of [...team1, ...team2]) {
    statsMap.set(playerId, { wins: 0, games: 0 })
  }

  for (const result of sortMatchResults(match.match_results)) {
    const winners = result.winning_pair_index === 2 ? team2 : team1
    for (const playerId of [...team1, ...team2]) {
      const stats = statsMap.get(playerId)
      if (!stats) continue
      stats.games++
      if (winners.includes(playerId)) stats.wins++
    }
  }

  return statsMap
}

export type SplitOutcome = '2-0-t1' | '1-1' | '2-0-t2'

export async function submitSplitResult(
  matchId: string,
  outcome: SplitOutcome,
): Promise<{ error: unknown }> {
  const rows: Array<{ match_id: string; winning_pair_index: 1 | 2; game_number: number }> =
    outcome === '2-0-t1'
      ? [
          { match_id: matchId, winning_pair_index: 1, game_number: 1 },
          { match_id: matchId, winning_pair_index: 1, game_number: 2 },
        ]
      : outcome === '2-0-t2'
      ? [
          { match_id: matchId, winning_pair_index: 2, game_number: 1 },
          { match_id: matchId, winning_pair_index: 2, game_number: 2 },
        ]
      : /* 1-1 */ [
          { match_id: matchId, winning_pair_index: 1, game_number: 1 },
          { match_id: matchId, winning_pair_index: 2, game_number: 2 },
        ]

  const { error } = await supabase.from('match_results').insert(rows)
  return { error }
}
