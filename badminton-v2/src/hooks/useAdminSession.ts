import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { buildCourtLabels, normalizeCourtCount } from '@/lib/courts'

export interface AdminMatchDisplay {
  id: string
  gameNumber: number
  startedAt: string | null
  t1p1: string
  t1p2: string
  t2p1: string
  t2p2: string
  t1p1Id: string
  t1p2Id: string
  t2p1Id: string
  t2p2Id: string
}

export interface AdminCourtSlot {
  courtNumber: number
  label: string
  current: AdminMatchDisplay | null
}

interface UseAdminSessionResult {
  courts: AdminCourtSlot[]
  courtCount: number
  queued: AdminMatchDisplay[]
  finished: AdminMatchDisplay[]
  sessionId: string | null
  sessionName: string
  sessionDate: string
  sessionStatus: string | null
  isLoading: boolean
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

export function useAdminSession(sessionIdParam?: string): UseAdminSessionResult {
  const [courts, setCourts] = useState<AdminCourtSlot[]>([])
  const [courtCount, setCourtCount] = useState(DEFAULT_COURT_COUNT)
  const [queued, setQueued] = useState<AdminMatchDisplay[]>([])
  const [finished, setFinished] = useState<AdminMatchDisplay[]>([])
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
      let activeCourtCount = DEFAULT_COURT_COUNT
      let activeCourtLabels = buildCourtLabels(DEFAULT_COURT_COUNT)

      if (sessionIdParam) {
        const { data: session } = await supabase
          .from('sessions')
          .select('id, name, status, date, court_count, court_1_label, court_2_label')
          .eq('id', sessionIdParam)
          .maybeSingle()

        if (cancelled) return

        if (!session) {
          setSessionId(null)
          setCourtCount(DEFAULT_COURT_COUNT)
          setCourts([])
          setQueued([])
          setFinished([])
          isFirstLoad.current = false
          setIsLoading(false)
          return
        }

        sid = (session as { id: string; name: string; status: string; date: string }).id
        sessionLabel = (session as { id: string; name: string; status: string; date: string }).name
        setSessionStatus((session as { status: string }).status)
        setSessionDate((session as { date: string }).date)
        activeCourtCount = normalizeCourtCount((session as { court_count?: number | null }).court_count)
        activeCourtLabels = buildCourtLabels(activeCourtCount, session)
      } else {
        const { data: session } = await supabase
          .from('sessions')
          .select('id, name, status, date, court_count, court_1_label, court_2_label')
          .in('status', ['schedule_locked', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        if (!session) {
          setSessionId(null)
          setCourtCount(DEFAULT_COURT_COUNT)
          setCourts([])
          setQueued([])
          setFinished([])
          isFirstLoad.current = false
          setIsLoading(false)
          return
        }

        sid = (session as { id: string; name: string; status: string; date: string }).id
        sessionLabel = (session as { id: string; name: string; status: string; date: string }).name
        setSessionStatus((session as { status: string }).status)
        setSessionDate((session as { date: string }).date)
        activeCourtCount = normalizeCourtCount((session as { court_count?: number | null }).court_count)
        activeCourtLabels = buildCourtLabels(activeCourtCount, session)
      }

      setSessionId(sid)
      setSessionName(sessionLabel)
      setCourtCount(activeCourtCount)

      const { data: rows } = await supabase
        .from('matches')
        .select('id, queue_position, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, status, court_number, started_at')
        .eq('session_id', sid)
        .order('queue_position')

      if (cancelled) return

      const matchRows = (rows ?? []) as MatchRow[]

      if (matchRows.length === 0) {
        setCourts(Array.from({ length: activeCourtCount }, (_, index) => ({
          courtNumber: index + 1,
          label: activeCourtLabels[index + 1],
          current: null,
        })))
        setQueued([])
        setFinished([])
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

      const toDisplay = (m: MatchRow): AdminMatchDisplay => ({
        id: m.id,
        gameNumber: m.queue_position,
        startedAt: m.started_at,
        t1p1: name(m.team1_player1_id),
        t1p2: name(m.team1_player2_id),
        t2p1: name(m.team2_player1_id),
        t2p2: name(m.team2_player2_id),
        t1p1Id: m.team1_player1_id,
        t1p2Id: m.team1_player2_id,
        t2p1Id: m.team2_player1_id,
        t2p2Id: m.team2_player2_id,
      })

      const currentByCourt = new Map<number, AdminMatchDisplay>()
      for (const match of matchRows) {
        if (match.status !== 'playing' || match.court_number == null || match.court_number > activeCourtCount) continue
        currentByCourt.set(match.court_number, toDisplay(match))
      }

      const queuedRows = matchRows.filter((m) => m.status === 'queued')
      const finishedRows = matchRows.filter((m) => m.status === 'complete')

      setCourts(Array.from({ length: activeCourtCount }, (_, index) => {
        const courtNumber = index + 1

        return {
          courtNumber,
          label: activeCourtLabels[courtNumber],
          current: currentByCourt.get(courtNumber) ?? null,
        }
      }))
      setQueued(queuedRows.map(toDisplay))
      setFinished(finishedRows.map(toDisplay))

      isFirstLoad.current = false
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [sessionIdParam, refreshKey])

  return { courts, courtCount, queued, finished, sessionId, sessionName, sessionDate, sessionStatus, isLoading, refresh }
}
