import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface CourtMatchDisplay {
  id: string
  gameNumber: number
  t1p1: string
  t1p2: string
  t2p1: string
  t2p2: string
}

export interface CourtData {
  current: CourtMatchDisplay | null
  next: CourtMatchDisplay | null
}

interface UseCourtStateResult {
  court1: CourtData
  court2: CourtData
  sessionId: string | null
  isLoading: boolean
  hasSession: boolean
  refresh: () => void
}

const EMPTY: CourtData = { current: null, next: null }

type MatchRow = {
  id: string
  queue_position: number
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  status: string
  court_number: number | null
}

export function useCourtState(sessionIdParam?: string): UseCourtStateResult {
  const [court1, setCourt1] = useState<CourtData>(EMPTY)
  const [court2, setCourt2] = useState<CourtData>(EMPTY)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const isFirstLoad = useRef(true)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isFirstLoad.current) setIsLoading(true)

      // 1. Find session — by ID if provided, otherwise latest active
      let sid: string
      if (sessionIdParam) {
        const { data: session } = await supabase
          .from('sessions')
          .select('id, status')
          .eq('id', sessionIdParam)
          .maybeSingle()

        if (cancelled) return

        const s = session as { id: string; status: string } | null
        if (!s || s.status === 'complete') {
          setHasSession(false)
          setSessionId(null)
          setCourt1(EMPTY)
          setCourt2(EMPTY)
          setIsLoading(false)
          return
        }
        sid = s.id
      } else {
        const { data: session } = await supabase
          .from('sessions')
          .select('id')
          .in('status', ['schedule_locked', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        if (!session) {
          setHasSession(false)
          setSessionId(null)
          setCourt1(EMPTY)
          setCourt2(EMPTY)
          setIsLoading(false)
          return
        }
        sid = (session as { id: string }).id
      }
      setHasSession(true)
      setSessionId(sid)

      // 2. Fetch matches
      const { data: rows } = await supabase
        .from('matches')
        .select('id, queue_position, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, status, court_number')
        .eq('session_id', sid)
        .order('queue_position')

      if (cancelled) return

      const matchRows = (rows ?? []) as MatchRow[]

      if (matchRows.length === 0) {
        setCourt1(EMPTY)
        setCourt2(EMPTY)
        setIsLoading(false)
        return
      }

      // 3. Resolve UUIDs → name_slugs
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

      const toDisplay = (m: MatchRow): CourtMatchDisplay => ({
        id: m.id,
        gameNumber: m.queue_position,
        t1p1: name(m.team1_player1_id),
        t1p2: name(m.team1_player2_id),
        t2p1: name(m.team2_player1_id),
        t2p2: name(m.team2_player2_id),
      })

      // 4. Derive court state using court_number for playing matches
      const playing1 = matchRows.find((m) => m.status === 'playing' && m.court_number === 1)
      const playing2 = matchRows.find((m) => m.status === 'playing' && m.court_number === 2)
      const queued   = matchRows.filter((m) => m.status === 'queued')

      // Check if session is complete (no playing, no queued)
      const allDone = matchRows.every((m) => m.status === 'complete')

      setCourt1({
        current: playing1 ? toDisplay(playing1) : null,
        next: allDone ? null : (queued[0] ? toDisplay(queued[0]) : null),
      })
      setCourt2({
        current: playing2 ? toDisplay(playing2) : null,
        next: allDone ? null : (queued[1] ? toDisplay(queued[1]) : null),
      })
      isFirstLoad.current = false
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [refreshKey, sessionIdParam])

  return { court1, court2, sessionId, isLoading, hasSession, refresh }
}
