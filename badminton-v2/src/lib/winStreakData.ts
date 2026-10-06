import { supabase } from '@/lib/supabase'
import { fetchEligiblePlayerIds } from '@/lib/boardEligibility'
import { getMatchOutcome } from '@/lib/matchResults'
import { rankWinStreaks, type WinStreakEntry, type WinStreakMatch } from '@/lib/winStreak'

/** PostgREST caps a response at 1000 rows by default, so read in pages. */
const PAGE = 1000

type MatchRow = {
  id: string
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  match_results: Array<{ winning_pair_index: number; game_number: number | null; completed_at: string }> | null
}

/**
 * Every match of every finished session, with its results. Filtered on the
 * joined session's status rather than an `in (...)` list of ids, which would
 * grow the URL by a UUID per session played.
 */
async function fetchFinishedMatches(): Promise<WinStreakMatch[]> {
  const matches: WinStreakMatch[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index, game_number, completed_at), sessions!inner(status)')
      .eq('sessions.status', 'complete')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const page = (data ?? []) as unknown as MatchRow[]
    for (const m of page) {
      const results = m.match_results ?? []
      matches.push({
        matchId: m.id,
        // The last game recorded is when the match ended.
        endedAt: results.reduce((latest, r) => (r.completed_at > latest ? r.completed_at : latest), ''),
        team1: [m.team1_player1_id, m.team1_player2_id],
        team2: [m.team2_player1_id, m.team2_player2_id],
        outcome: getMatchOutcome(results),
      })
    }
    if (page.length < PAGE) return matches
  }
}

/** Current win streaks, placed among currently active players. */
export async function fetchWinStreaks(): Promise<WinStreakEntry[]> {
  const [matches, eligible] = await Promise.all([fetchFinishedMatches(), fetchEligiblePlayerIds()])
  return rankWinStreaks(matches, { eligible })
}
