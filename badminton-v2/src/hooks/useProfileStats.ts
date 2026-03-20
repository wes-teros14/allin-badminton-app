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

      // 1. Lifetime totals
      const { data: statsRow } = await supabase
        .from('player_stats')
        .select('sessions_attended, games_played, wins')
        .eq('player_id', userId!)
        .maybeSingle()

      const sessionsAttended = (statsRow as any)?.sessions_attended ?? 0
      const gamesPlayed      = (statsRow as any)?.games_played      ?? 0
      const wins             = (statsRow as any)?.wins              ?? 0

      // 2. Best partners + toughest opponents
      const { data: pairRows } = await supabase
        .from('player_pair_stats')
        .select('other_player_id, wins_together, losses_against')
        .eq('player_id', userId!)

      const pairs = (pairRows ?? []) as Array<{
        other_player_id: string
        wins_together: number
        losses_against: number
      }>

      const partnerMap  = new Map(pairs.filter((r) => r.wins_together  > 0).map((r) => [r.other_player_id, r.wins_together]))
      const opponentMap = new Map(pairs.filter((r) => r.losses_against > 0).map((r) => [r.other_player_id, r.losses_against]))

      // Resolve names
      const allIds = [...new Set([...partnerMap.keys(), ...opponentMap.keys()])]
      const nameMap = new Map<string, string>()
      if (allIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from('profiles')
          .select('id, name_slug, nickname')
          .in('id', allIds)
        for (const p of (profiles ?? []) as Array<{ id: string; name_slug: string; nickname?: string | null }>) {
          nameMap.set(p.id, p.nickname ?? p.name_slug)
        }
      }

      const bestPartners     = topRanked(partnerMap,  nameMap).map(({ nameSlug, count }) => ({ nameSlug, wins:   count }))
      const toughestOpponents = topRanked(opponentMap, nameMap).map(({ nameSlug, count }) => ({ nameSlug, losses: count }))

      setStats({
        sessionsAttended,
        gamesPlayed,
        wins,
        winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
        bestPartners,
        toughestOpponents,
      })
      setIsLoading(false)
    }

    load()
  }, [userId])

  return { stats, isLoading }
}
