import { useParams, Link } from 'react-router'
import { useAdminSession } from '@/hooks/useAdminSession'
import { useRealtime } from '@/hooks/useRealtime'
import { CourtTabs } from '@/components/CourtTabs'
import { LiveIndicator } from '@/components/LiveIndicator'

export function SessionView() {
  const { sessionId: sessionIdParam } = useParams<{ sessionId: string }>()
  const { court1Current, court2Current, queued, sessionId, sessionName, sessionStatus, isLoading, refresh } =
    useAdminSession(sessionIdParam)
  const { status } = useRealtime(sessionId, refresh, 'session')

  if (!isLoading && !sessionId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Session not found</p>
      </div>
    )
  }

  if (!isLoading && sessionStatus === 'complete') {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-lg font-semibold">{sessionName}</p>
        <p className="text-muted-foreground">This session has been closed.</p>
        <Link to="/admin" className="text-sm text-primary hover:underline">← Back to Admin</Link>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 relative">
      <LiveIndicator status={status} onRefresh={refresh} />
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{sessionName || 'Session'}</h1>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Admin
        </Link>
      </div>
      <CourtTabs
        court1Current={court1Current}
        court2Current={court2Current}
        queued={queued}
        isLoading={isLoading}
        sessionId={sessionId}
        onDone={refresh}
      />
    </div>
  )
}

export default SessionView
