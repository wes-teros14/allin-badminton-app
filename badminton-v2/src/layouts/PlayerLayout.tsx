import { Outlet } from 'react-router'
import { TopNavBar } from '@/components/TopNavBar'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { useAuth } from '@/contexts/AuthContext'
import { useActiveSessions } from '@/hooks/useActiveSession'
import { useMatchCheers } from '@/hooks/useMatchCheers'
import { CheersPanel } from '@/components/CheersPanel'

export function PlayerLayout() {
  const { role } = useAuth()
  const { activeSessions } = useActiveSessions()
  const activeSessionId = activeSessions[0]?.sessionId

  const { cheerTypes, pendingMatches, hasPendingCheers, isLoading: cheerLoading, submitCheer } = useMatchCheers(activeSessionId)

  const showGate = role === 'player' && !cheerLoading && hasPendingCheers

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-background">
        <TopNavBar />
        {showGate ? (
          <CheersPanel
            cheerTypes={cheerTypes}
            pendingMatch={pendingMatches[0]}
            isLoading={cheerLoading}
            remainingCount={pendingMatches.length}
            submitCheer={submitCheer}
          />
        ) : (
          <Outlet />
        )}
      </div>
    </NotificationProvider>
  )
}

export default PlayerLayout
