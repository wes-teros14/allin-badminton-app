import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface AttendedSession {
  id: string
  name: string
  date: string
}

export interface PlayerStats {
  wins: number
  totalGames: number
  sessions: AttendedSession[]
}

interface UsePlayerStatsResult {
  stats: PlayerStats | null
  isLoading: boolean
}

type MatchWithResult = {
  id: string
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  match_results: { winning_pair_index: number }[]
}

type RegRow = {
  sessions: { id: string; name: string; date: string } | null
}

export function usePlayerStats(nameSlug: string): UsePlayerStatsResult {
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)

      // 1. Resolve nameSlug → playerId
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('name_slug', nameSlug)
        .maybeSingle()

      if (cancelled) return

      if (!profile) {
        setStats({ wins: 0, totalGames: 0, sessions: [] })
        setIsLoading(false)
        return
      }

      const playerId = (profile as { id: string }).id

      // 2. Fetch all matches this player appeared in, with their results
      const { data: matchRows, error: matchError } = await supabase
        .from('matches')
        .select('id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index)')
        .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`)

      if (cancelled) return
      if (matchError) {
        setStats({ wins: 0, totalGames: 0, sessions: [] })
        setIsLoading(false)
        return
      }

      // 3. Calculate win rate (only matches with recorded results count)
      const rows = (matchRows ?? []) as MatchWithResult[]
      let wins = 0
      let totalGames = 0

      for (const m of rows) {
        if (!m.match_results || m.match_results.length === 0) continue
        totalGames++
        const result = m.match_results[0]
        const onTeam1 =
          m.team1_player1_id === playerId || m.team1_player2_id === playerId
        const playerPairIndex = onTeam1 ? 1 : 2
        if (result.winning_pair_index === playerPairIndex) wins++
      }

      // 4. Fetch attendance (all sessions this player registered for)
      const { data: regRows, error: regError } = await supabase
        .from('session_registrations')
        .select('sessions(id, name, date)')
        .eq('player_id', playerId)

      if (cancelled) return

      const sessions: AttendedSession[] = regError
        ? []
        : ((regRows ?? []) as RegRow[])
            .map((r) => r.sessions)
            .filter((s): s is AttendedSession => s !== null)
            .sort((a, b) => b.date.localeCompare(a.date))

      setStats({ wins, totalGames, sessions })
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [nameSlug])

  return { stats, isLoading }
}
