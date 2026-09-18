import { useMemo } from 'react'
import { Outlet, useParams } from 'react-router'
import { TopNavBar } from '@/components/TopNavBar'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { useCheersEligibleSessions } from '@/hooks/useActiveSession'
import { useMatchCheers } from '@/hooks/useMatchCheers'
import { CheersPanel } from '@/components/CheersPanel'
import { LeaderboardCelebration } from '@/components/LeaderboardCelebration'

export function PlayerLayout() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { sessions } = useCheersEligibleSessions()
  const cheersSessionIds = useMemo(() => {
    const routeSession = sessionId && sessions.some((s) => s.sessionId === sessionId)
      ? [sessionId]
      : []
    const inProgress = sessions
      .filter((s) => s.status === 'in_progress' && s.sessionId !== sessionId)
      .map((s) => s.sessionId)
    const complete = sessions
      .filter((s) => s.status === 'complete' && s.sessionId !== sessionId)
      .map((s) => s.sessionId)

    return [...routeSession, ...inProgress, ...complete]
  }, [sessionId, sessions])

  const { cheerTypes, pendingMatches, hasPendingCheers, isLoading: cheerLoading, submitCheer } = useMatchCheers(cheersSessionIds)

  const showGate = !cheerLoading && hasPendingCheers

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

        {/*
          Mounted here rather than per-view so a celebration can appear over any
          player screen. It renders nothing until there is news, and it never
          navigates on its own.
        */}
        <LeaderboardCelebration />
      </div>
    </NotificationProvider>
  )
}

export default PlayerLayout
