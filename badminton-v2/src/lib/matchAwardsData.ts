import { canAppearOnBoard, fetchBoardProfiles, fetchEligibility } from '@/lib/boardEligibility'
import { gameWinner, getMatchOutcome } from '@/lib/matchResults'
import { seasonWindow, type BoardScope } from '@/lib/season'
import { fetchSeasonMatches, type SeasonMatchRow } from '@/lib/seasonData'
import { rankWinStreaks, type WinStreakEntry, type WinStreakMatch } from '@/lib/winStreak'
import { rankGiantSlayers, type GiantSlayerEntry, type SlayerGame } from '@/lib/giantSlayer'

/**
 * Whole matches (Win Streak) and single games (Against the Odds) from the same rows.
 *
 * Win Streak takes only the season's matches, so a 2026 win never extends a 2027 run. Against the Odds
 * replays every game up to the season's end, because a player's win rate going in is measured over all
 * their earlier games; only games dated inside the season are marked `counts`.
 */
export function toHistory(rows: SeasonMatchRow[], seasonStart: string | null): { matches: WinStreakMatch[]; games: SlayerGame[] } {
  const matches: WinStreakMatch[] = []
  const games: SlayerGame[] = []
  for (const m of rows) {
    const results = m.match_results
    const team1 = [m.team1_player1_id, m.team1_player2_id] as const
    const team2 = [m.team2_player1_id, m.team2_player2_id] as const
    const inSeason = seasonStart === null || m.sessions.date >= seasonStart
    if (inSeason) {
      matches.push({
        matchId: m.id,
        // The last game recorded is when the match ended.
        endedAt: results.reduce((latest, r) => (r.completed_at > latest ? r.completed_at : latest), ''),
        team1,
        team2,
        outcome: getMatchOutcome(results),
      })
    }
    for (const r of results) {
      games.push({
        gameId: r.id,
        recordedAt: r.completed_at,
        matchId: m.id,
        gameNumber: r.game_number ?? 1,
        team1,
        team2,
        winner: gameWinner(r),
        counts: inSeason,
      })
    }
  }
  return { matches, games }
}

/** ⚡ Win Streak and 🎲 Against the Odds for one season, placed among the players who may appear. */
export async function fetchMatchAwards(scope: BoardScope): Promise<{ winStreaks: WinStreakEntry[]; giantSlayers: GiantSlayerEntry[] }> {
  const seasonW = seasonWindow(scope.season)
  const [rows, profiles, pool] = await Promise.all([
    // One read serves both awards: no lower bound, up to the season's end.
    fetchSeasonMatches({ start: null, end: seasonW.end }, { finishedSessionsOnly: true }),
    fetchBoardProfiles(),
    fetchEligibility(scope),
  ])
  const { matches, games } = toHistory(rows, seasonW.start)

  const present = canAppearOnBoard(profiles, scope)
  const eligible = new Set<string>()
  for (const g of games) {
    for (const id of [...g.team1, ...g.team2]) {
      if (present(id) && pool.qualifies(id, scope.season.floors.played)) eligible.add(id)
    }
  }
  return {
    winStreaks: rankWinStreaks(matches, { eligible }),
    giantSlayers: rankGiantSlayers(games, { eligible }),
  }
}
