import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface AdminMatchDisplay {
  id: string
  gameNumber: number
  t1p1: string
  t1p2: string
  t2p1: string
  t2p2: string
}

interface UseAdminSessionResult {
  court1Current: AdminMatchDisplay | null
  court2Current: AdminMatchDisplay | null
  queued: AdminMatchDisplay[]
  sessionId: string | null
  sessionName: string
  sessionDate: string
  sessionStatus: string | null
  isLoading: boolean
  refresh: () => void
}

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

export function useAdminSession(sessionIdParam?: string): UseAdminSessionResult {
  const [court1Current, setCourt1Current] = useState<AdminMatchDisplay | null>(null)
  const [court2Current, setCourt2Current] = useState<AdminMatchDisplay | null>(null)
  const [queued, setQueued] = useState<AdminMatchDisplay[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const isFirstLoad = useRef(true)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isFirstLoad.current) setIsLoading(true)

      let sid: string
      let sessionLabel: string

      if (sessionIdParam) {
        // Load specific session by ID
        const { data: session } = await supabase
          .from('sessions')
          .select('id, name, status, date')
          .eq('id', sessionIdParam)
          .maybeSingle()

        if (cancelled) return

        if (!session) {
          setSessionId(null)
          setCourt1Current(null)
          setCourt2Current(null)
          setQueued([])
          isFirstLoad.current = false
          setIsLoading(false)
          return
        }

        sid = (session as { id: string; name: string; status: string; date: string }).id
        sessionLabel = (session as { id: string; name: string; status: string; date: string }).name
        setSessionStatus((session as { id: string; name: string; status: string; date: string }).status)
        setSessionDate((session as { id: string; name: string; status: string; date: string }).date)
      } else {
        // Find active session
        const { data: session } = await supabase
          .from('sessions')
          .select('id, name, status, date')
          .in('status', ['schedule_locked', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        if (!session) {
          setSessionId(null)
          setCourt1Current(null)
          setCourt2Current(null)
          setQueued([])
          isFirstLoad.current = false
          setIsLoading(false)
          return
        }

        sid = (session as { id: string; name: string; status: string; date: string }).id
        sessionLabel = (session as { id: string; name: string; status: string; date: string }).name
        setSessionStatus((session as { id: string; name: string; status: string; date: string }).status)
        setSessionDate((session as { id: string; name: string; status: string; date: string }).date)
      }

      setSessionId(sid)
      setSessionName(sessionLabel)

      // 2. Fetch all matches
      const { data: rows } = await supabase
        .from('matches')
        .select('id, queue_position, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, status, court_number')
        .eq('session_id', sid)
        .order('queue_position')

      if (cancelled) return

      const matchRows = (rows ?? []) as MatchRow[]

      if (matchRows.length === 0) {
        setCourt1Current(null)
        setCourt2Current(null)
        setQueued([])
        isFirstLoad.current = false
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

      const toDisplay = (m: MatchRow): AdminMatchDisplay => ({
        id: m.id,
        gameNumber: m.queue_position,
        t1p1: name(m.team1_player1_id),
        t1p2: name(m.team1_player2_id),
        t2p1: name(m.team2_player1_id),
        t2p2: name(m.team2_player2_id),
      })

      // 4. Derive state
      const playing1 = matchRows.find((m) => m.status === 'playing' && m.court_number === 1)
      const playing2 = matchRows.find((m) => m.status === 'playing' && m.court_number === 2)
      const queuedRows = matchRows.filter((m) => m.status === 'queued')

      setCourt1Current(playing1 ? toDisplay(playing1) : null)
      setCourt2Current(playing2 ? toDisplay(playing2) : null)
      setQueued(queuedRows.map(toDisplay))

      isFirstLoad.current = false
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [sessionIdParam, refreshKey])


  return { court1Current, court2Current, queued, sessionId, sessionName, sessionDate, sessionStatus, isLoading, refresh }
}
