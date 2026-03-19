import { useRef, useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'
import { useAdminSession } from '@/hooks/useAdminSession'
import { useRealtime } from '@/hooks/useRealtime'
import { RegistrationURLCard } from '@/components/RegistrationURLCard'
import { RosterPanel } from '@/components/RosterPanel'
import { MatchGeneratorPanel } from '@/components/MatchGeneratorPanel'
import { CourtTabs } from '@/components/CourtTabs'
import { LiveIndicator } from '@/components/LiveIndicator'

function BackToAdmin() {
  return (
    <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
      ← Admin
    </Link>
  )
}

function LiveSessionView({ sessionId }: { sessionId: string }) {
  const { court1Current, court2Current, queued, sessionId: sid, sessionName, isLoading, refresh } =
    useAdminSession(sessionId)
  const { status } = useRealtime(sid, refresh, 'session')

  return (
    <div className="space-y-4 relative">
      <LiveIndicator status={status} onRefresh={refresh} />
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{sessionName || 'Session'}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open(`/kiosk/${sessionId}`, '_blank')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Open Kiosk ↗
          </button>
          <BackToAdmin />
        </div>
      </div>
      <CourtTabs
        court1Current={court1Current}
        court2Current={court2Current}
        queued={queued}
        isLoading={isLoading}
        sessionId={sid}
        onDone={refresh}
      />
    </div>
  )
}

export function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const {
    session, invitation, playerCount, isLoading,
    openRegistration, closeRegistration, reopenRegistration, lockSchedule, unlockSchedule, startSession,
  } = useSession(sessionId)

  const [confirmingClose, setConfirmingClose] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])

  function handleCloseRegistration() {
    if (!confirmingClose) {
      setConfirmingClose(true)
      closeTimerRef.current = setTimeout(() => setConfirmingClose(false), 5000)
    } else {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      setConfirmingClose(false)
      closeRegistration()
    }
  }

  if (isLoading) return <div className="p-6">Loading…</div>

  if (!session) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-lg">Session not found</p>
        <BackToAdmin />
      </div>
    )
  }

  if (session.status === 'complete') {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <BackToAdmin />
        <Card>
          <CardHeader><CardTitle>{session.name}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Date: {session.date}</p>
            <p className="text-muted-foreground">This session has been closed.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (session.status === 'in_progress') {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <LiveSessionView sessionId={session.id} />
      </div>
    )
  }

  // Setup / registration / match generation states
  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{session.name}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')}
          </p>
        </div>
        <BackToAdmin />
      </div>

      {session.status === 'setup' && (
        <Card>
          <CardContent className="pt-4 space-y-3 text-sm">
            <p>Date: {session.date}</p>
            <Button onClick={openRegistration} className="w-full">Open Registration</Button>
          </CardContent>
        </Card>
      )}

      {session.status === 'registration_open' && invitation && (
        <div className="space-y-4">
          <RegistrationURLCard invitation={invitation} playerCount={playerCount} />
          <RosterPanel sessionId={session.id} />
          <Button
            variant={confirmingClose ? 'destructive' : 'outline'}
            onClick={handleCloseRegistration}
            className="w-full"
          >
            {confirmingClose ? 'Confirm Close?' : 'Close Registration'}
          </Button>
        </div>
      )}

      {session.status === 'registration_closed' && (
        <div className="space-y-4">
          <RosterPanel sessionId={session.id} editable />
          <MatchGeneratorPanel sessionId={session.id} sessionStatus={session.status} onLock={lockSchedule} />
          <Button variant="outline" onClick={reopenRegistration} className="w-full">Reopen Registration</Button>
        </div>
      )}

      {session.status === 'schedule_locked' && (
        <div className="space-y-4">
          <MatchGeneratorPanel sessionId={session.id} sessionStatus={session.status} />
          <Button onClick={startSession} className="w-full">Start Session</Button>
          <Button variant="outline" onClick={() => window.open(`/kiosk/${session.id}`, '_blank')} className="w-full">Open Kiosk ↗</Button>
          <Button variant="outline" onClick={unlockSchedule} className="w-full">Unlock Schedule</Button>
        </div>
      )}

    </div>
  )
}

export default SessionView
