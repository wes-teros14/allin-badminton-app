import { useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { useCourtState } from '@/hooks/useCourtState'
import { useRealtime } from '@/hooks/useRealtime'
import { CourtCard } from '@/components/CourtCard'
import { AnnouncerButton } from '@/components/AnnouncerButton'
import { useAnnouncer } from '@/hooks/useAnnouncer'

export function LiveBoardView() {
  const { sessionId: sessionIdParam } = useParams<{ sessionId?: string }>()
  const { courts, sessionId, isLoading, hasSession, isClosed, splitMatchScoring, isReloading, loadFailed, refresh } = useCourtState(sessionIdParam)
  const { status } = useRealtime(sessionId, refresh, { onPoll: isClosed ? undefined : refresh })
  // The board keeps its last good data when a reload fails, so it can be out of
  // date without looking it — say so. Realtime's own 'reconnecting' is skipped:
  // it is also the state before the first subscribe, and the polls cover it.
  const showReconnecting = !isClosed && (loadFailed || status === 'disconnected')
  const announcer = useAnnouncer({ sessionId, courts, isLoading })
  const [isPortrait, setIsPortrait] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)')
    function check() { setIsPortrait(mql.matches) }
    check()
    mql.addEventListener('change', check)
    return () => mql.removeEventListener('change', check)
  }, [])

  const columnCount = Math.min(Math.max(courts.length, 1), 3)

  return (
    <div className="live-board-dark h-screen w-screen overflow-hidden bg-background text-foreground relative">
      {isPortrait && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <p className="text-5xl">^</p>
            <p className="text-xl font-semibold">Please rotate your device</p>
            <p className="text-muted-foreground text-sm">LiveBoard requires landscape orientation</p>
          </div>
        </div>
      )}

      {!isLoading && isClosed && (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground text-lg">Session Closed</p>
        </div>
      )}

      {!isLoading && !hasSession && !isClosed && (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground text-lg">
            {loadFailed ? 'Can’t reach the server — retrying…' : 'No active session'}
          </p>
        </div>
      )}

      {/* Bottom centre: the court headers (timer, LIVE) run along the top, the
          announcer button sits bottom left. */}
      {showReconnecting && hasSession && (
        <div
          role="status"
          className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400/40 bg-background/90 px-4 py-1.5 text-sm font-semibold tracking-wide text-amber-400 shadow-lg"
        >
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
          Reconnecting… board may be out of date
        </div>
      )}

      {(isLoading || hasSession) && (
        <div
          className="grid h-full gap-1 bg-border p-1"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {courts.map((court) => (
            <CourtCard
              key={court.courtNumber}
              courtNumber={court.courtNumber}
              label={court.label}
              data={{ current: court.current, next: court.next }}
              sessionId={sessionId}
              isLoading={isLoading}
              isReloading={isReloading}
              refresh={refresh}
              splitScoring={splitMatchScoring}
            />
          ))}
        </div>
      )}

      {hasSession && !isClosed && <AnnouncerButton {...announcer} />}
    </div>
  )
}

export default LiveBoardView
