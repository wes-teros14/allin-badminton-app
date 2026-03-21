import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useActiveSession } from '@/hooks/useActiveSession'

interface LeaderboardEntry {
  playerId: string
  displayName: string
  wins: number
  games: number
  winRate: number
  careerWinRate?: number
  improvement?: number
}

type MatchRow = {
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  match_results: Array<{ winning_pair_index: 1 | 2 }>
}

async function fetchSessionLeaderboard(sessionId: string): Promise<LeaderboardEntry[]> {
  const [regsRes, matchesRes] = await Promise.all([
    supabase
      .from('session_registrations')
      .select('player_id')
      .eq('session_id', sessionId),
    supabase
      .from('matches')
      .select('team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index)')
      .eq('session_id', sessionId)
      .eq('status', 'complete'),
  ])

  const playerIds = ((regsRes.data ?? []) as Array<{ player_id: string }>).map((r) => r.player_id)
  if (playerIds.length === 0) return []

  const [profilesRes, careerRes] = await Promise.all([
    supabase.from('profiles').select('id, nickname, name_slug').in('id', playerIds),
    supabase.from('player_stats').select('player_id, games_played, wins').in('player_id', playerIds),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map((p) => [p.id, p.nickname ?? p.name_slug])
  )

  const careerMap = new Map(
    ((careerRes.data ?? []) as Array<{ player_id: string; games_played: number; wins: number }>)
      .map((s) => [s.player_id, { games: s.games_played, wins: s.wins }])
  )

  const statsMap = new Map<string, { wins: number; games: number }>(
    playerIds.map((id) => [id, { wins: 0, games: 0 }])
  )

  for (const match of (matchesRes.data ?? []) as MatchRow[]) {
    const result = match.match_results[0]
    if (!result) continue
    const team1 = [match.team1_player1_id, match.team1_player2_id]
    const team2 = [match.team2_player1_id, match.team2_player2_id]
    const winners = result.winning_pair_index === 1 ? team1 : team2
    for (const id of [...team1, ...team2]) {
      const s = statsMap.get(id)
      if (!s) continue
      s.games++
      if (winners.includes(id)) s.wins++
    }
  }

  const entries: LeaderboardEntry[] = []
  for (const [playerId, s] of statsMap) {
    if (s.games === 0) continue
    const winRate = Math.round((s.wins / s.games) * 100)
    const career = careerMap.get(playerId)
    const careerWinRate = career && career.games > 0 ? Math.round((career.wins / career.games) * 100) : undefined
    entries.push({
      playerId,
      displayName: nameMap.get(playerId) ?? playerId,
      wins: s.wins,
      games: s.games,
      winRate,
      careerWinRate,
      improvement: careerWinRate !== undefined ? winRate - careerWinRate : undefined,
    })
  }

  return entries.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
}

const RANK_ICON = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1))

export function TodayView() {
  const { activeSession, isLoading: sessionLoading } = useActiveSession()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!activeSession) { setIsLoading(false); return }
    setIsLoading(true)
    try {
      const data = await fetchSessionLeaderboard(activeSession.sessionId)
      setEntries(data)
    } finally {
      setIsLoading(false)
    }
  }, [activeSession?.sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessionLoading) load()
  }, [sessionLoading, load])

  // Realtime: refetch when match_results change
  useEffect(() => {
    const channel = supabase
      .channel('today-leaderboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_results' }, () => {
        load()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const mostImproved = entries
    .filter((e) => e.improvement !== undefined && e.improvement > 0 && e.games >= 2)
    .sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0))
    .slice(0, 3)

  if (isLoading || sessionLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!activeSession) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">No active session</p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-10 space-y-6">
      <h1 className="text-xl font-bold text-primary">🏆 {activeSession.name}</h1>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No games completed yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div
                key={entry.playerId}
                className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3"
              >
                <span className="text-sm font-bold text-muted-foreground w-5 text-center shrink-0">
                  {RANK_ICON(i)}
                </span>
                <span className="flex-1 font-medium text-sm truncate">{entry.displayName}</span>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{entry.winRate}%</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.wins}W {entry.games - entry.wins}L
                  </p>
                </div>
              </div>
            ))}
          </div>

          {mostImproved.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                🔥 Most Improved Today
              </h2>
              <div className="space-y-2">
                {mostImproved.map((entry) => (
                  <div
                    key={entry.playerId}
                    className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3"
                  >
                    <span className="flex-1 font-medium text-sm truncate">{entry.displayName}</span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600">+{entry.improvement}%</p>
                      <p className="text-xs text-muted-foreground">vs {entry.careerWinRate}% career</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default TodayView
