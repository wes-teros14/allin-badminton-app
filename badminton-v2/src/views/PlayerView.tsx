import { useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router'
import { usePlayerList } from '@/hooks/usePlayerList'
import { usePlayerSchedule } from '@/hooks/usePlayerSchedule'
import { usePlayerSessions } from '@/hooks/usePlayerSessions'
import { useAuth } from '@/hooks/useAuth'
import { useRealtime } from '@/hooks/useRealtime'
import { PlayerScheduleHeader } from '@/components/PlayerScheduleHeader'
import { GameCard } from '@/components/GameCard'
import { LiveIndicator } from '@/components/LiveIndicator'
import { SessionRecapBanner } from '@/components/SessionRecapBanner'
import { supabase } from '@/lib/supabase'

export function PlayerView() {
  const { nameSlug, sessionId } = useParams<{ nameSlug?: string; sessionId?: string }>()

  if (nameSlug) {
    return <ScheduleView nameSlug={nameSlug} />
  }

  return <PlayerListView sessionId={sessionId} />
}

function SessionPickerView() {
  const { user, isLoading: authLoading } = useAuth()
  const { sessions, isLoading: sessionsLoading } = usePlayerSessions(user?.id ?? null)
  const navigate = useNavigate()

  const isLoading = authLoading || sessionsLoading

  // Auto-redirect when exactly 1 session
  useEffect(() => {
    if (!isLoading && sessions.length === 1) {
      navigate(`/match-schedule/session/${sessions[0].id}`, { replace: true })
    }
  }, [isLoading, sessions, navigate])

  // While loading, show skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-sm mx-auto px-4 py-8">
          <div className="mb-6 space-y-1">
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Not authenticated or 0 sessions: fall through to default behavior
  if (!user || sessions.length === 0) {
    return <DefaultPlayerListView />
  }

  // Auto-redirect in progress (1 session) — show nothing while navigating
  if (sessions.length === 1) {
    return null
  }

  // 2+ sessions: show picker
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

function DefaultPlayerListView() {
  return <PlayerListViewInner />
}

function PlayerListView({ sessionId }: { sessionId?: string }) {
  // When no sessionId is provided, show the session picker flow
  if (!sessionId) {
    return <SessionPickerView />
  }

  return <PlayerListViewInner sessionId={sessionId} />
}

function PlayerListViewInner({ sessionId }: { sessionId?: string } = {}) {
  const { user, isLoading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const showAll = searchParams.get('show') === 'all'

  const { players, session, isLoading, hasSession } = usePlayerList(sessionId)

  // Auto-redirect logged-in player to their own schedule (unless ?show=all)
  useEffect(() => {
    if (showAll || !sessionId || !user || authLoading) return
    let cancelled = false
    async function detect() {
      const { data: profile } = await supabase
        .from('profiles').select('name_slug').eq('id', user!.id).maybeSingle()
      if (cancelled || !profile) return
      const nameSlug = (profile as { name_slug: string }).name_slug
      const { data: reg } = await supabase
        .from('session_registrations').select('player_id')
        .eq('session_id', sessionId!).eq('player_id', user!.id).maybeSingle()
      if (cancelled || !reg) return
      navigate(`/match-schedule/session/${sessionId}/${nameSlug}`, { replace: true })
    }
    detect()
    return () => { cancelled = true }
  }, [sessionId, user, authLoading, showAll, navigate])

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

function ScheduleView({ nameSlug }: { nameSlug: string }) {
  const { matches, playerDisplayName, sessionName, sessionDate, sessionVenue, sessionTime, sessionId, isLoading, notFound, gamesAhead, refresh } = usePlayerSchedule(nameSlug)
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
            All Players ↗
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
            : `⏳ ${gamesAhead} game${gamesAhead !== 1 ? 's' : ''} ahead · ~${(gamesAhead ?? 0) * 15} min wait`
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
