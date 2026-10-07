import { supabase } from '@/lib/supabase'
import { fetchEligiblePlayerIds } from '@/lib/boardEligibility'
import { getMatchOutcome } from '@/lib/matchResults'
import { rankWinStreaks, type WinStreakEntry, type WinStreakMatch } from '@/lib/winStreak'
import { rankGiantSlayers, type GiantSlayerEntry, type SlayerGame } from '@/lib/giantSlayer'

/** PostgREST caps a response at 1000 rows by default, so read in pages. */
const PAGE = 1000

type MatchRow = {
  id: string
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  match_results: Array<{ id: string; winning_pair_index: number; game_number: number | null; completed_at: string }> | null
}

/**
 * Every match of every finished session, with its results, as both shapes the
 * match-based awards need: whole matches (Win Streak) and single games (Giant
 * Slayer). One read for both, since they come from the same rows.
 *
 * Filtered on the joined session's status rather than an `in (...)` list of
 * ids, which would grow the URL by a UUID per session played.
 */
async function fetchFinishedMatchHistory(): Promise<{ matches: WinStreakMatch[]; games: SlayerGame[] }> {
  const matches: WinStreakMatch[] = []
  const games: SlayerGame[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(id, winning_pair_index, game_number, completed_at), sessions!inner(status)')
      .eq('sessions.status', 'complete')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const page = (data ?? []) as unknown as MatchRow[]
    for (const m of page) {
      const results = m.match_results ?? []
      const team1 = [m.team1_player1_id, m.team1_player2_id] as const
      const team2 = [m.team2_player1_id, m.team2_player2_id] as const
      matches.push({
        matchId: m.id,
        // The last game recorded is when the match ended.
        endedAt: results.reduce((latest, r) => (r.completed_at > latest ? r.completed_at : latest), ''),
        team1,
        team2,
        outcome: getMatchOutcome(results),
      })
      for (const r of results) {
        games.push({
          gameId: r.id,
          recordedAt: r.completed_at,
          matchId: m.id,
          gameNumber: r.game_number ?? 1,
          team1,
          team2,
          // Anything that is not an explicit 2 counts as team 1, as getMatchOutcome reads it.
          winner: r.winning_pair_index === 2 ? 2 : 1,
        })
      }
    }
    if (page.length < PAGE) return { matches, games }
  }
}

/** ⚡ Win Streak and 🎲 Against the Odds, placed among currently active players. */
export async function fetchMatchAwards(): Promise<{ winStreaks: WinStreakEntry[]; giantSlayers: GiantSlayerEntry[] }> {
  const [{ matches, games }, eligible] = await Promise.all([fetchFinishedMatchHistory(), fetchEligiblePlayerIds()])
  return {
    winStreaks: rankWinStreaks(matches, { eligible }),
    giantSlayers: rankGiantSlayers(games, { eligible }),
  }
}
