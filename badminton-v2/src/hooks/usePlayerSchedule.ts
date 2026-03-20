import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface PlayerMatch {
  id: string
  gameNumber: number
  status: 'queued' | 'playing' | 'complete'
  partnerNameSlug: string
  opp1NameSlug: string
  opp2NameSlug: string
}

interface UsePlayerScheduleResult {
  matches: PlayerMatch[]
  playerDisplayName: string
  sessionName: string
  sessionId: string | null
  isLoading: boolean
  notFound: boolean
  refresh: () => void
}

type MatchRow = {
  id: string
  queue_position: number
  status: 'queued' | 'playing' | 'complete'
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
}

export function usePlayerSchedule(nameSlug: string): UsePlayerScheduleResult {
  const [matches, setMatches] = useState<PlayerMatch[]>([])
  const [playerDisplayName, setPlayerDisplayName] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const isFirstLoad = useRef(true)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isFirstLoad.current) setIsLoading(true)
      setNotFound(false)

      // 1. Resolve nameSlug → player id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name_slug')
        .eq('name_slug', nameSlug)
        .maybeSingle()

      if (cancelled) return

      if (!profile) {
        setNotFound(true)
        setIsLoading(false)
        return
      }

      const playerId = (profile as { id: string; name_slug: string }).id
      setPlayerDisplayName(nameSlug)

      // 2. Find active session
      const { data: session } = await supabase
        .from('sessions')
        .select('id, name')
        .in('status', ['schedule_locked', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (!session) {
        setMatches([])
        setSessionId(null)
        setIsLoading(false)
        return
      }

      const sid = (session as { id: string; name: string }).id
      setSessionId(sid)
      setSessionName((session as { id: string; name: string }).name)

      // 3. Fetch this player's matches
      const { data: rows } = await supabase
        .from('matches')
        .select('id, queue_position, status, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
        .eq('session_id', sid)
        .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`)
        .order('queue_position')

      if (cancelled) return

      const matchRows = (rows ?? []) as MatchRow[]

      if (matchRows.length === 0) {
        setMatches([])
        isFirstLoad.current = false
        setIsLoading(false)
        return
      }

      // 4. Resolve all player IDs → name_slugs
      const allIds = [...new Set(matchRows.flatMap((m) => [
        m.team1_player1_id, m.team1_player2_id,
        m.team2_player1_id, m.team2_player2_id,
      ]))]

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name_slug, nickname')
        .in('id', allIds)

      if (cancelled) return

      const nameMap = new Map(
        ((profiles ?? []) as Array<{ id: string; name_slug: string; nickname: string | null }>)
          .map((p) => [p.id, p.nickname ?? p.name_slug])
      )
      const name = (id: string) => nameMap.get(id) ?? id

      // 5. Build PlayerMatch array
      const result: PlayerMatch[] = matchRows.map((m) => {
        const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId

        let partnerNameSlug: string
        let opp1NameSlug: string
        let opp2NameSlug: string

        if (onTeam1) {
          partnerNameSlug = name(
            m.team1_player1_id === playerId ? m.team1_player2_id : m.team1_player1_id
          )
          opp1NameSlug = name(m.team2_player1_id)
          opp2NameSlug = name(m.team2_player2_id)
        } else {
          partnerNameSlug = name(
            m.team2_player1_id === playerId ? m.team2_player2_id : m.team2_player1_id
          )
          opp1NameSlug = name(m.team1_player1_id)
          opp2NameSlug = name(m.team1_player2_id)
        }

        return {
          id: m.id,
          gameNumber: m.queue_position,
          status: m.status,
          partnerNameSlug,
          opp1NameSlug,
          opp2NameSlug,
        }
      })

      setMatches(result)
      isFirstLoad.current = false
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [nameSlug, refreshKey])

  return { matches, playerDisplayName, sessionName, sessionId, isLoading, notFound, refresh }
}
