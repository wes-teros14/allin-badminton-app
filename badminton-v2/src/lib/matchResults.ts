import { supabase } from '@/lib/supabase'

export interface MatchResultLike {
  winning_pair_index: number
  game_number?: number | null
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

export function getLegacyWinningPairIndex(results: MatchResultLike[] | null | undefined): 1 | 2 | null {
  const primaryResult = sortMatchResults(results)[0]
  if (!primaryResult) return null
  return primaryResult.winning_pair_index === 2 ? 2 : 1
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
