import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router'
import { usePlayerList } from '@/hooks/usePlayerList'
import { usePlayerSchedule } from '@/hooks/usePlayerSchedule'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSessions } from '@/hooks/usePlayerSessions'
import { useRealtime } from '@/hooks/useRealtime'
import { PlayerScheduleHeader } from '@/components/PlayerScheduleHeader'
import { GameCard } from '@/components/GameCard'
import { LiveIndicator } from '@/components/LiveIndicator'
import { SessionRecapBanner } from '@/components/SessionRecapBanner'
import { supabase } from '@/lib/supabase'

interface AllMatch {
  id: string
  gameNumber: number
  status: 'queued' | 'playing' | 'complete'
  team1: string
  team2: string
}

export function PlayerView() {
  const { nameSlug, sessionId } = useParams<{ nameSlug?: string; sessionId?: string }>()

  if (nameSlug) {
    return <ScheduleView nameSlug={nameSlug} sessionId={sessionId} />
  }

  return <PlayerListView sessionId={sessionId} />
}

function SessionPickerView() {
  const { user, isLoading: authLoading } = useAuth()
  const { sessions, isLoading: sessionsLoading } = usePlayerSessions(user?.id ?? null)

  const isLoading = authLoading || sessionsLoading

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-sm mx-auto px-4 py-8">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">No active session</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SessionRecapBanner />
      <div className="max-w-sm mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground mb-3">Select Session</p>
        <div className="flex flex-col gap-2">
          {sessions.map((s) => {
            const formattedDate = new Date(s.date + 'T00:00:00')
              .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              .replace(/^(\w{3})/, '$1.')
            const formattedTime = s.time
              ? new Date(`1970-01-01T${s.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              : null
            return (
              <Link
                key={s.id}
                to={`/match-schedule/session/${s.id}`}
                className="w-full flex items-center px-4 py-3 rounded-lg border border-border text-foreground font-medium hover:bg-muted/50 transition-colors"
              >
                <div>
                  <div className="font-bold">{s.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formattedDate}
                    {formattedTime && <span> · {formattedTime}</span>}
                    {s.duration && <span> · {s.duration}</span>}
                    {s.venue && <span> · {s.venue}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PlayerListView({ sessionId }: { sessionId?: string }) {
  const [searchParams] = useSearchParams()
  const showAll = searchParams.get('show') === 'all'

  if (!sessionId) return <SessionPickerView />
  if (showAll) return <AllMatchesView sessionId={sessionId} />
  return <PlayerListViewInner sessionId={sessionId} />
}

function PlayerListViewInner({ sessionId }: { sessionId?: string } = {}) {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  const { players, session, isLoading, hasSession } = usePlayerList(sessionId)

  // Auto-redirect logged-in player to their own schedule
  useEffect(() => {
    if (!sessionId || !user || authLoading) return
    let cancelled = false
    async function detect() {
      const { data: profile } = await supabase
        .from('profiles').select('name_slug').eq('id', user!.id).maybeSingle()
      if (cancelled || !profile) return
      const nameSlug = (profile as { name_slug: string | null }).name_slug
      if (!nameSlug) return
      const { data: reg } = await supabase
        .from('session_registrations').select('player_id')
        .eq('session_id', sessionId!).eq('player_id', user!.id).maybeSingle()
      if (cancelled || !reg) return
      navigate(`/match-schedule/session/${sessionId}/${nameSlug}`, { replace: true })
    }
    detect()
    return () => { cancelled = true }
  }, [sessionId, user, authLoading, navigate])

  if (!isLoading && !hasSession) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">No active session</p>
      </div>
    )
  }

  const formattedDate = session?.date
    ? new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')
    : ''

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-sm mx-auto px-4 py-8">
        {isLoading ? (
          <div className="mb-6 space-y-1">
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          </div>
        ) : session ? (
          <div className="mb-6">
            <h1 className="text-xl font-bold">{session.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formattedDate}
              {session.time && <span> · {session.time}</span>}
              {session.duration && <span> · {session.duration}</span>}
              {session.venue && <span> · {session.venue}</span>}
            </p>
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground mb-3">Select a player to view their schedule</p>

        <div className="flex flex-col gap-2">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))
            : players.map((p) => (
                <Link
                  key={p.id}
                  to={sessionId
                    ? `/match-schedule/session/${sessionId}/${p.nameSlug}`
                    : `/match-schedule/${p.nameSlug}`}
                  className="w-full h-12 flex items-center px-4 rounded-lg border border-border text-foreground font-medium hover:bg-muted/50 transition-colors"
                >
                  {p.displayName}
                </Link>
              ))}
        </div>
      </div>
    </div>
  )
}

function AllMatchesView({ sessionId }: { sessionId: string }) {
  const [matches, setMatches] = useState<AllMatch[]>([])
  const [sessionName, setSessionName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  const { status } = useRealtime(sessionId, refresh)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    async function load() {
      // Fetch session info
      const { data: sess } = await supabase
        .from('sessions').select('name').eq('id', sessionId).maybeSingle()
      if (cancelled) return
      if (sess) setSessionName((sess as { name: string }).name)

      // Fetch all matches
      const { data: rows } = await supabase
        .from('matches')
        .select('id, queue_position, status, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
        .eq('session_id', sessionId)
        .order('queue_position')
      if (cancelled || !rows) { setIsLoading(false); return }

      const matchRows = rows as Array<{ id: string; queue_position: number; status: string; team1_player1_id: string; team1_player2_id: string; team2_player1_id: string; team2_player2_id: string }>

      // Collect all player IDs and resolve names
      const allIds = [...new Set(matchRows.flatMap(m => [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]))]
      const { data: profiles } = await supabase.from('profiles').select('id, name_slug, nickname').in('id', allIds)
      if (cancelled) return
      const nameMap = new Map(((profiles ?? []) as Array<{ id: string; name_slug: string; nickname: string | null }>).map(p => [p.id, p.nickname ?? p.name_slug]))
      const name = (id: string) => nameMap.get(id) ?? '?'

      setMatches(matchRows.map(m => ({
        id: m.id,
        gameNumber: m.queue_position,
        status: m.status as 'queued' | 'playing' | 'complete',
        team1: `${name(m.team1_player1_id)} & ${name(m.team1_player2_id)}`,
        team2: `${name(m.team2_player1_id)} & ${name(m.team2_player2_id)}`,
      })))
      setIsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [sessionId, tick])

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <LiveIndicator status={status} onRefresh={refresh} />
      <div className="max-w-sm mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">{sessionName || 'All Matches'}</h1>
          <Link
            to={`/match-schedule/session/${sessionId}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← My Matches
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
              ))
            : matches.map(m => (
                <div
                  key={m.id}
                  className={`rounded-xl border border-border p-4 ${m.status === 'complete' ? 'opacity-50' : ''} ${m.status === 'playing' ? 'border-primary/30 bg-[var(--primary-subtle)]' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-3xl font-bold tabular-nums ${m.status === 'complete' ? 'line-through' : ''}`}>{m.gameNumber}</span>
                    {m.status === 'playing' && <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Playing</span>}
                    {m.status === 'complete' && <span className="text-[var(--success)] text-lg">✓</span>}
                  </div>
                  <p className="text-sm text-foreground/80 font-medium">{m.team1}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">vs {m.team2}</p>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}

function ScheduleView({ nameSlug, sessionId: sessionIdParam }: { nameSlug: string; sessionId?: string }) {
  const { matches, playerDisplayName, sessionName, sessionDate, sessionVenue, sessionTime, sessionDuration, sessionId, isLoading, notFound, gamesAhead, refresh } = usePlayerSchedule(nameSlug, sessionIdParam)
  const { status } = useRealtime(sessionId, refresh)

  if (!isLoading && notFound) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Player not found</p>
      </div>
    )
  }

  // Find the first queued match index to mark as "up next"
  const firstQueuedIndex = matches.findIndex((m) => m.status === 'queued')
  const playingMatch = matches.find((m) => m.status === 'playing')
  const nextUpMatch = firstQueuedIndex >= 0 ? matches[firstQueuedIndex] : null

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <LiveIndicator status={status} onRefresh={refresh} />
      <SessionRecapBanner />
      {isLoading ? (
        <div className="bg-primary px-4 py-5 animate-pulse">
          <div className="h-7 w-32 bg-primary-foreground/30 rounded mb-1" />
          <div className="h-4 w-48 bg-primary-foreground/20 rounded" />
        </div>
      ) : (
        <PlayerScheduleHeader
          nameSlug={playerDisplayName}
          sessionName={sessionName}
          sessionDate={sessionDate}
          sessionVenue={sessionVenue}
          sessionTime={sessionTime}
          sessionDuration={sessionDuration}
          gameCount={matches.length}
          sessionId={sessionId}
        />
      )}

      {!isLoading && sessionId && (
        <div className="flex justify-end px-4 mt-2">
          <Link
            to={`/match-schedule/session/${sessionId}?show=all`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            All Matches ↗
          </Link>
        </div>
      )}

      {!isLoading && (playingMatch || nextUpMatch) && (
        <div className={`mx-4 mt-3 mb-1 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
          playingMatch
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}>
          {playingMatch
            ? '🏸 You\'re on court now!'
            : gamesAhead === 0
            ? '⏳ You\'re up next!'
            : `⏳ ${gamesAhead} game${gamesAhead !== 1 ? 's' : ''} until your next game (~${(gamesAhead ?? 0) * 10} mins wait time)`
          }
        </div>
      )}

      <div className="max-w-sm mx-auto px-4 py-4 flex flex-col gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <GameCard
                key={i}
                gameNumber={0}
                partnerNameSlug=""
                opp1NameSlug=""
                opp2NameSlug=""
                status="queued"
                isNextUp={false}
                isLoading
              />
            ))
          : matches.map((m, i) => (
              <GameCard
                key={m.id}
                gameNumber={m.gameNumber}
                partnerNameSlug={m.partnerNameSlug}
                opp1NameSlug={m.opp1NameSlug}
                opp2NameSlug={m.opp2NameSlug}
                status={m.status}
                isNextUp={i === firstQueuedIndex}
                won={m.won}
              />
            ))}
      </div>
    </div>
  )
}

export default PlayerView
