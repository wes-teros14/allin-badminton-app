import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProfileStats {
  sessionsAttended: number
  gamesPlayed: number
  wins: number
  winRate: number
  bestPartners: Array<{ nameSlug: string; wins: number }>
  toughestOpponents: Array<{ nameSlug: string; losses: number }>
}

function topRanked(
  countMap: Map<string, number>,
  nameMap: Map<string, string>,
): Array<{ nameSlug: string; count: number }> {
  const sorted = Array.from(countMap.entries())
    .map(([id, count]) => ({ nameSlug: nameMap.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count)
  const result: Array<{ nameSlug: string; count: number }> = []
  let i = 0
  while (i < sorted.length && result.length < 3) {
    const count = sorted[i].count
    const names: string[] = []
    while (i < sorted.length && sorted[i].count === count) {
      names.push(sorted[i].nameSlug)
      i++
    }
    result.push({ nameSlug: names.join(' & '), count })
  }
  return result
}

export function useProfileStats(userId: string | undefined) {
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setIsLoading(false); return }

    async function load() {
      setIsLoading(true)

      // Sessions attended
      const { count: sessionsAttended } = await supabase
        .from('session_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', userId!)

      // All completed matches the player was in
      const { data: matchRows } = await supabase
        .from('matches')
        .select('id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
        .eq('status', 'complete')
        .or(`team1_player1_id.eq.${userId},team1_player2_id.eq.${userId},team2_player1_id.eq.${userId},team2_player2_id.eq.${userId}`)

      const matches = (matchRows ?? []) as Array<{
        id: string
        team1_player1_id: string
        team1_player2_id: string
        team2_player1_id: string
        team2_player2_id: string
      }>

      if (matches.length === 0) {
        setStats({ sessionsAttended: sessionsAttended ?? 0, gamesPlayed: 0, wins: 0, winRate: 0, bestPartners: [], toughestOpponents: [] })
        setIsLoading(false)
        return
      }

      // Match results
      const matchIds = matches.map((m) => m.id)
      const { data: resultRows } = await supabase
        .from('match_results')
        .select('match_id, winning_pair_index')
        .in('match_id', matchIds)

      const resultMap = new Map(
        ((resultRows ?? []) as Array<{ match_id: string; winning_pair_index: number }>)
          .map((r) => [r.match_id, r.winning_pair_index])
      )

      // Calculate wins + partner/opponent counts
      let wins = 0
      const partnerWins = new Map<string, number>()
      const opponentLosses = new Map<string, number>()

      for (const m of matches) {
        const onPair1 = m.team1_player1_id === userId || m.team1_player2_id === userId
        const userPair = onPair1 ? 1 : 2
        const partner = onPair1
          ? (m.team1_player1_id === userId ? m.team1_player2_id : m.team1_player1_id)
          : (m.team2_player1_id === userId ? m.team2_player2_id : m.team2_player1_id)
        const opponents = onPair1
          ? [m.team2_player1_id, m.team2_player2_id]
          : [m.team1_player1_id, m.team1_player2_id]

        const winningPair = resultMap.get(m.id)
        if (winningPair === undefined) continue // no result recorded

        const won = winningPair === userPair
        if (won) {
          wins++
          partnerWins.set(partner, (partnerWins.get(partner) ?? 0) + 1)
        } else {
          for (const opp of opponents) {
            opponentLosses.set(opp, (opponentLosses.get(opp) ?? 0) + 1)
          }
        }
      }

      // Resolve names for best partner + toughest opponent
      const idsToResolve = [
        ...Array.from(partnerWins.keys()),
        ...Array.from(opponentLosses.keys()),
      ]

      const nameMap = new Map<string, string>()
      if (idsToResolve.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from('profiles')
          .select('id, name_slug, nickname')
          .in('id', idsToResolve)
        for (const p of (profiles ?? []) as Array<{ id: string; name_slug: string; nickname?: string | null }>) {
          nameMap.set(p.id, p.nickname ?? p.name_slug)
        }
      }

      const bestPartners = topRanked(partnerWins, nameMap)
        .map(({ nameSlug, count }) => ({ nameSlug, wins: count }))

      const toughestOpponents = topRanked(opponentLosses, nameMap)
        .map(({ nameSlug, count }) => ({ nameSlug, losses: count }))

      const gamesWithResults = matches.filter((m) => resultMap.has(m.id)).length

      setStats({
        sessionsAttended: sessionsAttended ?? 0,
        gamesPlayed: matches.length,
        wins,
        winRate: gamesWithResults > 0 ? Math.round((wins / gamesWithResults) * 100) : 0,
        bestPartners,
        toughestOpponents,
      })
      setIsLoading(false)
    }

    load()
  }, [userId])

  return { stats, isLoading }
}
