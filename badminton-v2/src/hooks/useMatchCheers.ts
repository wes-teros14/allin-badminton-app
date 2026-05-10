import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { CheerType } from '@/types/app'

export interface MatchCheerPlayer {
  playerId: string
  displayName: string
}

export interface PendingMatchCheer {
  matchId: string
  gameNumber: number
  players: MatchCheerPlayer[] // the 3 other players in the match
  cheersGivenTo: string[]     // receiver IDs already cheered for this match
}

export interface UseMatchCheersResult {
  cheerTypes: CheerType[]
  pendingMatches: PendingMatchCheer[]
  hasPendingCheers: boolean
  isLoading: boolean
  submitCheer: (matchId: string, receiverId: string, cheerTypeId: string) => Promise<void>
  refresh: () => void
}

type MatchRow = {
  id: string
  session_id: string
  queue_position: number
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
}

export function useMatchCheers(sessionId: string | string[] | undefined): UseMatchCheersResult {
  const { user } = useAuth()
  const [cheerTypes, setCheerTypes] = useState<CheerType[]>([])
  const [pendingMatches, setPendingMatches] = useState<PendingMatchCheer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const sessionKey = Array.isArray(sessionId) ? sessionId.join('|') : sessionId ?? ''

  const load = useCallback(async () => {
    const sessionIds = sessionKey ? sessionKey.split('|') : []
    if (sessionIds.length === 0 || !user) {
      setPendingMatches([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      // Fetch cheer types + completed matches where user played + cheers given by user
      const [typesRes, matchesRes, cheersRes] = await Promise.all([
        supabase.from('cheer_types').select('id, slug, name, emoji').eq('is_active', true),
        supabase
          .from('matches')
          .select('id, session_id, queue_position, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
          .in('session_id', sessionIds)
          .eq('status', 'complete'),
        supabase
          .from('cheers')
          .select('match_id, receiver_id')
          .eq('giver_id', user.id)
          .not('match_id', 'is', null),
      ])

      setCheerTypes((typesRes.data ?? []) as CheerType[])

      const allMatches = (matchesRes.data ?? []) as MatchRow[]
      const allCheers = (cheersRes.data ?? []) as Array<{ match_id: string; receiver_id: string }>
      const sessionPriority = new Map(sessionIds.map((id, index) => [id, index]))

      // Filter to matches where user is a player
      const myMatches = allMatches.filter(m =>
        m.team1_player1_id === user.id || m.team1_player2_id === user.id ||
        m.team2_player1_id === user.id || m.team2_player2_id === user.id
      )

      // Build cheers-given map: matchId → Set of receiver IDs
      const cheersMap = new Map<string, Set<string>>()
      for (const c of allCheers) {
        if (!cheersMap.has(c.match_id)) cheersMap.set(c.match_id, new Set())
        cheersMap.get(c.match_id)!.add(c.receiver_id)
      }

      // Collect all player IDs we need names for
      const playerIdSet = new Set<string>()
      for (const m of myMatches) {
        for (const id of [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]) {
          if (id !== user.id) playerIdSet.add(id)
        }
      }

      // Fetch display names
      const nameMap = new Map<string, string>()
      if (playerIdSet.size > 0) {
        const profilesRes = await supabase
          .from('profiles')
          .select('id, nickname, name_slug')
          .in('id', Array.from(playerIdSet))
        for (const p of (profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>) {
          nameMap.set(p.id, p.nickname ?? p.name_slug)
        }
      }

      // Build pending matches list (sorted by queue_position)
      const pending: PendingMatchCheer[] = []
      // Track game number per session (count of completed matches in queue order)
      const sortedMatches = [...myMatches].sort((a, b) =>
        (sessionPriority.get(a.session_id) ?? Number.MAX_SAFE_INTEGER) -
          (sessionPriority.get(b.session_id) ?? Number.MAX_SAFE_INTEGER) ||
        a.queue_position - b.queue_position
      )
      const completedBySession = new Map<string, number>()
      for (let i = 0; i < sortedMatches.length; i++) {
        const m = sortedMatches[i]
        const gameNumber = (completedBySession.get(m.session_id) ?? 0) + 1
        completedBySession.set(m.session_id, gameNumber)
        const otherPlayerIds = [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]
          .filter(id => id !== user.id)
        const givenTo = cheersMap.get(m.id) ?? new Set()

        // Check if all 3 cheers given
        if (otherPlayerIds.every(id => givenTo.has(id))) continue

        pending.push({
          matchId: m.id,
          gameNumber,
          players: otherPlayerIds.map(id => ({
            playerId: id,
            displayName: nameMap.get(id) ?? id,
          })),
          cheersGivenTo: Array.from(givenTo),
        })
      }

      setPendingMatches(pending)
    } finally {
      setIsLoading(false)
    }
  }, [sessionKey, user])

  useEffect(() => { load() }, [load])

  // Real-time: listen for match completions to trigger cheers gate
  useEffect(() => {
    const sessionIds = sessionKey ? sessionKey.split('|') : []
    if (sessionIds.length === 0) return
    const sessionIdSet = new Set(sessionIds)
    const channel = supabase
      .channel(`match-cheers-rt-${sessionKey}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
      }, (payload) => {
        const row = payload.new as { session_id?: string; status?: string }
        if (row.status === 'complete' && row.session_id && sessionIdSet.has(row.session_id)) {
          load()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionKey, load])

  const submitCheer = useCallback(async (matchId: string, receiverId: string, cheerTypeId: string) => {
    if (!user) return
    const { error } = await supabase.from('cheers').insert({
      match_id: matchId,
      giver_id: user.id,
      receiver_id: receiverId,
      cheer_type_id: cheerTypeId,
    } as never)
    if (error) throw error
    await load()
  }, [user, load])

  return {
    cheerTypes,
    pendingMatches,
    hasPendingCheers: pendingMatches.length > 0,
    isLoading,
    submitCheer,
    refresh: load,
  }
}
