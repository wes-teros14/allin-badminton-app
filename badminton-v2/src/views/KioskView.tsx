import { useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { useCourtState } from '@/hooks/useCourtState'
import { useRealtime } from '@/hooks/useRealtime'
import { CourtCard } from '@/components/CourtCard'

export function KioskView() {
  const { sessionId: sessionIdParam } = useParams<{ sessionId?: string }>()
  const { court1, court2, sessionId, isLoading, hasSession, isClosed, refresh } = useCourtState(sessionIdParam)
  useRealtime(sessionId, refresh)
  const [isPortrait, setIsPortrait] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)')
    function check() { setIsPortrait(mql.matches) }
    check()
    mql.addEventListener('change', check)
    return () => mql.removeEventListener('change', check)
  }, [])

  return (
    <div className="kiosk-dark h-screen w-screen overflow-hidden bg-background text-foreground relative">

      {/* Portrait orientation guard */}
      {isPortrait && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <p className="text-5xl">↻</p>
            <p className="text-xl font-semibold">Please rotate your device</p>
            <p className="text-muted-foreground text-sm">Kiosk requires landscape orientation</p>
          </div>
        </div>
      )}

      {/* Session closed */}
      {!isLoading && isClosed && (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground text-lg">Session Closed</p>
        </div>
      )}

      {/* No active session */}
      {!isLoading && !hasSession && !isClosed && (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground text-lg">No active session</p>
        </div>
      )}

      {/* Court split layout */}
      {(isLoading || hasSession) && (
        <div className="h-full flex">
          <CourtCard courtNumber={1} data={court1} sessionId={sessionId} isLoading={isLoading} refresh={refresh} />
          <CourtCard courtNumber={2} data={court2} sessionId={sessionId} isLoading={isLoading} refresh={refresh} />
        </div>
      )}

    </div>
  )
}

export default KioskView
