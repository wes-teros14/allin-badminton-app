import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { buildCourtLabels, buildCourtSlots, type CourtSlot, normalizeCourtCount } from '@/lib/courts'

export interface CourtMatchDisplay {
  id: string
  gameNumber: number
  startedAt: string | null
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
  courts: CourtSlot<CourtMatchDisplay>[]
  courtCount: number
  sessionId: string | null
  isLoading: boolean
  hasSession: boolean
  isClosed: boolean
  splitMatchScoring: boolean
  refresh: () => void
}

const DEFAULT_COURT_COUNT = 2

type MatchRow = {
  id: string
  queue_position: number
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  status: string
  court_number: number | null
  started_at: string | null
}

function buildEmptyCourts(courtCount = DEFAULT_COURT_COUNT) {
  return buildCourtSlots(courtCount, buildCourtLabels(courtCount), new Map(), [])
}

export function useCourtState(sessionIdParam?: string): UseCourtStateResult {
  const [courts, setCourts] = useState<CourtSlot<CourtMatchDisplay>[]>(() => buildEmptyCourts())
  const [courtCount, setCourtCount] = useState(DEFAULT_COURT_COUNT)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [splitMatchScoring, setSplitMatchScoring] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const isFirstLoad = useRef(true)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    if (!sessionId || isClosed) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }, 5000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isClosed, refresh, sessionId])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isFirstLoad.current) setIsLoading(true)

      let sid: string
      let activeCourtCount = DEFAULT_COURT_COUNT
      let activeCourtLabels = buildCourtLabels(DEFAULT_COURT_COUNT)

      if (sessionIdParam) {
        const { data: session } = await supabase
          .from('sessions')
          .select('id, status, court_count, court_1_label, court_2_label, split_match_scoring')
          .eq('id', sessionIdParam)
          .maybeSingle()

        if (cancelled) return

        const s = session as { id: string; status: string; court_count?: number | null } | null
        if (!s) {
          setHasSession(false)
          setIsClosed(false)
          setSessionId(null)
          setCourtCount(DEFAULT_COURT_COUNT)
          setCourts(buildEmptyCourts())
          setSplitMatchScoring(false)
          isFirstLoad.current = false
          setIsLoading(false)
          return
        }

        activeCourtCount = normalizeCourtCount(s.court_count)
        activeCourtLabels = buildCourtLabels(activeCourtCount, session)

        if (s.status === 'complete') {
          setHasSession(false)
          setIsClosed(true)
          setSessionId(null)
          setCourtCount(activeCourtCount)
          setCourts(buildCourtSlots(activeCourtCount, activeCourtLabels, new Map(), []))
          setSplitMatchScoring(false)
          isFirstLoad.current = false
          setIsLoading(false)
          return
        }

        sid = s.id
        setSplitMatchScoring((session as { split_match_scoring?: boolean | null }).split_match_scoring === true)
      } else {
        const { data: session } = await supabase
          .from('sessions')
          .select('id, court_count, court_1_label, court_2_label, split_match_scoring')
          .in('status', ['schedule_locked', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        if (!session) {
          setHasSession(false)
          setSessionId(null)
          setCourtCount(DEFAULT_COURT_COUNT)
          setCourts(buildEmptyCourts())
          setSplitMatchScoring(false)
          isFirstLoad.current = false
          setIsLoading(false)
          return
        }

        sid = (session as { id: string }).id
        activeCourtCount = normalizeCourtCount((session as { court_count?: number | null }).court_count)
        activeCourtLabels = buildCourtLabels(activeCourtCount, session)
        setSplitMatchScoring((session as { split_match_scoring?: boolean | null }).split_match_scoring === true)
      }

      setHasSession(true)
      setIsClosed(false)
      setSessionId(sid)
      setCourtCount(activeCourtCount)

      const { data: rows } = await supabase
        .from('matches')
        .select('id, queue_position, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, status, court_number, started_at')
        .eq('session_id', sid)
        .order('queue_position')

      if (cancelled) return

      const matchRows = (rows ?? []) as MatchRow[]

      if (matchRows.length === 0) {
        setCourts(buildCourtSlots(activeCourtCount, activeCourtLabels, new Map(), []))
        isFirstLoad.current = false
        setIsLoading(false)
        return
      }

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
        startedAt: m.started_at,
        t1p1: name(m.team1_player1_id),
        t1p2: name(m.team1_player2_id),
        t2p1: name(m.team2_player1_id),
        t2p2: name(m.team2_player2_id),
      })

      const currentByCourt = new Map<number, CourtMatchDisplay>()
      for (const match of matchRows) {
        if (match.status !== 'playing' || match.court_number == null || match.court_number > activeCourtCount) continue
        currentByCourt.set(match.court_number, toDisplay(match))
      }

      const queued = matchRows.filter((m) => m.status === 'queued').map(toDisplay)
      const allDone = matchRows.every((m) => m.status === 'complete')

      setCourts(buildCourtSlots(activeCourtCount, activeCourtLabels, currentByCourt, allDone ? [] : queued))
      isFirstLoad.current = false
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [refreshKey, sessionIdParam])

  return { courts, courtCount, sessionId, isLoading, hasSession, isClosed, splitMatchScoring, refresh }
}
