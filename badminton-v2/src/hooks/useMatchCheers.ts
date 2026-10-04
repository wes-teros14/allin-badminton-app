import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatDisplayName } from '@/lib/formatDisplayName'
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

type PendingRow = PendingMatchCheer & { sessionId: string; queuePosition: number }

/**
 * @param sessionIds  Sessions whose finished matches may still owe cheers, in
 *                    display priority (the session on screen first).
 * @param liveSessionIds  The subset that is in progress. Only these can produce
 *                    new finished matches, so only these are listened to.
 */
export function useMatchCheers(sessionIds: string[], liveSessionIds: string[] = []): UseMatchCheersResult {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [cheerTypes, setCheerTypes] = useState<CheerType[]>([])
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  /** The fetchKey the current pendingRows belong to. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  // What to fetch depends on the SET of sessions, not their order: the order only
  // changes which pending match is shown first, and it changes on every navigation
  // into or out of a session page. Keying the fetch and the channel on the order
  // reloaded everything and resubscribed on each of those navigations.
  const fetchKey = [...new Set(sessionIds)].sort().join('|')
  const liveKey = [...new Set(liveSessionIds)].sort().join('|')
  const priorityKey = sessionIds.join('|')
  const cheerTypesLoaded = useRef(false)

  const load = useCallback(async () => {
    const ids = fetchKey ? fetchKey.split('|') : []
    if (ids.length === 0 || !userId) {
      setPendingRows([])
      setIsLoading(false)
      setLoadedKey(fetchKey)
      return
    }

    setIsLoading(true)
    try {
      // Cheer types are a fixed list; read them once, not on every reload.
      const typesQuery = cheerTypesLoaded.current
        ? Promise.resolve(null)
        : supabase.from('cheer_types').select('id, slug, name, emoji').eq('is_active', true)

      const [typesRes, matchesRes, cheersRes] = await Promise.all([
        typesQuery,
        supabase
          .from('matches')
          .select('id, session_id, queue_position, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
          .in('session_id', ids)
          .eq('status', 'complete'),
        supabase
          .from('cheers')
          .select('match_id, receiver_id')
          .eq('giver_id', userId)
          .not('match_id', 'is', null),
      ])

      if (typesRes && !typesRes.error) {
        setCheerTypes((typesRes.data ?? []) as CheerType[])
        cheerTypesLoaded.current = true
      }

      const allMatches = (matchesRes.data ?? []) as MatchRow[]
      const allCheers = (cheersRes.data ?? []) as Array<{ match_id: string; receiver_id: string }>

      // Filter to matches where user is a player
      const myMatches = allMatches.filter(m =>
        m.team1_player1_id === userId || m.team1_player2_id === userId ||
        m.team2_player1_id === userId || m.team2_player2_id === userId
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
          if (id !== userId) playerIdSet.add(id)
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
          nameMap.set(p.id, formatDisplayName(p.nickname, p.name_slug))
        }
      }

      // Game number = position among your finished matches in that session, in
      // queue order. Display priority across sessions is applied later.
      const pending: PendingRow[] = []
      const sortedMatches = [...myMatches].sort((a, b) =>
        a.session_id.localeCompare(b.session_id) || a.queue_position - b.queue_position
      )
      const completedBySession = new Map<string, number>()
      for (const m of sortedMatches) {
        const gameNumber = (completedBySession.get(m.session_id) ?? 0) + 1
        completedBySession.set(m.session_id, gameNumber)
        const otherPlayerIds = [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]
          .filter(id => id !== userId)
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
          sessionId: m.session_id,
          queuePosition: m.queue_position,
        })
      }

      setPendingRows(pending)
    } finally {
      setIsLoading(false)
      setLoadedKey(fetchKey)
    }
  }, [fetchKey, userId])

  useEffect(() => { load() }, [load])

  // Held in a ref so the channel below does not resubscribe whenever `load`
  // gets a new identity.
  const loadRef = useRef(load)
  loadRef.current = load

  // Real-time: a match finishing in a live session may open the cheers gate.
  // Filtered server-side to those sessions; this used to receive every match
  // update in the database, from every session, on every player's phone.
  useEffect(() => {
    if (!liveKey) return
    const channel = supabase
      .channel(`match-cheers-rt-${liveKey}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `session_id=in.(${liveKey.split('|').join(',')})`,
      }, (payload) => {
        const row = payload.new as { status?: string }
        if (row.status === 'complete') loadRef.current()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [liveKey])

  const pendingMatches = useMemo<PendingMatchCheer[]>(() => {
    const priority = new Map(priorityKey.split('|').map((id, index) => [id, index]))
    return [...pendingRows]
      .sort((a, b) =>
        (priority.get(a.sessionId) ?? Number.MAX_SAFE_INTEGER) -
          (priority.get(b.sessionId) ?? Number.MAX_SAFE_INTEGER) ||
        a.queuePosition - b.queuePosition
      )
      .map((row) => ({
        matchId: row.matchId,
        gameNumber: row.gameNumber,
        players: row.players,
        cheersGivenTo: row.cheersGivenTo,
      }))
  }, [pendingRows, priorityKey])

  const submitCheer = useCallback(async (matchId: string, receiverId: string, cheerTypeId: string) => {
    if (!userId) return
    const { error } = await supabase.from('cheers').insert({
      match_id: matchId,
      giver_id: userId,
      receiver_id: receiverId,
      cheer_type_id: cheerTypeId,
    } as never)
    if (error) throw error
    await load()
  }, [userId, load])

  return {
    cheerTypes,
    pendingMatches,
    hasPendingCheers: pendingMatches.length > 0,
    // Until the effect has loaded the new key, the old answer does not apply. Without
    // this, the render after the session list arrives reports "loaded, nothing
    // pending" for sessions nobody has looked at yet.
    isLoading: isLoading || loadedKey !== fetchKey,
    submitCheer,
    refresh: load,
  }
}
