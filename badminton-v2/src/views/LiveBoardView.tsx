import { useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { useCourtState } from '@/hooks/useCourtState'
import { useRealtime } from '@/hooks/useRealtime'
import { CourtCard } from '@/components/CourtCard'

export function LiveBoardView() {
  const { sessionId: sessionIdParam } = useParams<{ sessionId?: string }>()
  const { courts, sessionId, isLoading, hasSession, isClosed, splitMatchScoring, refresh } = useCourtState(sessionIdParam)
  useRealtime(sessionId, refresh)
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
          <p className="text-muted-foreground text-lg">No active session</p>
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
              refresh={refresh}
              splitScoring={splitMatchScoring}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default LiveBoardView
