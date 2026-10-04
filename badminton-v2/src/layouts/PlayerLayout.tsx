import { useMemo, useState } from 'react'
import { Outlet, useParams } from 'react-router'
import { TopNavBar } from '@/components/TopNavBar'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { useCheersEligibleSessions } from '@/hooks/useActiveSession'
import { useMatchCheers } from '@/hooks/useMatchCheers'
import { useCheerLater } from '@/hooks/useCheerLater'
import { cheersReminderLabel } from '@/lib/cheerReminder'
import { CheersReminder } from '@/components/CheersReminder'
import { CheersPanel } from '@/components/CheersPanel'
import { LeaderboardCelebration } from '@/components/LeaderboardCelebration'

export function PlayerLayout() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { sessions, isLoading: sessionsLoading } = useCheersEligibleSessions()
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
  const liveSessionIds = useMemo(
    () => sessions.filter((s) => s.status === 'in_progress').map((s) => s.sessionId),
    [sessions],
  )

  const { cheerTypes, pendingMatches, hasPendingCheers, isLoading: cheerLoading, submitCheer } = useMatchCheers(cheersSessionIds, liveSessionIds)

  // "Cheer later" players (migration 084) get a bar and a sheet instead of the
  // gate, so the page they are on — usually the admin's Live page — stays mounted.
  const { isCheerLater, isLoading: cheerLaterLoading } = useCheerLater()
  const [sheetOpen, setSheetOpen] = useState(false)

  const showGate = !cheerLoading && !cheerLaterLoading && hasPendingCheers && !isCheerLater
  const showReminder = !cheerLaterLoading && hasPendingCheers && isCheerLater
  // The last cheer unmounts the sheet without closing it. Close it here, during
  // render, or the next finished game would open the sheet by itself.
  if (sheetOpen && !showReminder) setSheetOpen(false)
  // Wider than showGate on purpose: while either lookup is still loading we do not
  // yet know whether the gate is coming, and a reload between two cheers briefly
  // drops showGate without the player having finished. A "Cheer later" player's
  // celebration plays over the bar and waits only while the sheet is open, so a
  // medal is never stuck behind cheers they have chosen to give later.
  const celebrationHeld = sessionsLoading || cheerLoading || cheerLaterLoading
    || (isCheerLater ? sheetOpen && hasPendingCheers : hasPendingCheers)

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
          // Room under the page so the bar never covers its last row.
          <div className={showReminder ? 'pb-20' : undefined}>
            <Outlet />
          </div>
        )}

        {showReminder && (
          <CheersReminder
            label={cheersReminderLabel(pendingMatches)}
            open={sheetOpen}
            onOpenChange={setSheetOpen}
          >
            <CheersPanel
              cheerTypes={cheerTypes}
              pendingMatch={pendingMatches[0]}
              isLoading={cheerLoading}
              remainingCount={pendingMatches.length}
              submitCheer={submitCheer}
            />
          </CheersReminder>
        )}

        {/*
          Mounted here rather than per-view so a celebration can appear over any
          player screen. It renders nothing until there is news, and it never
          navigates on its own. Held while the cheers gate is up — cheers first.
        */}
        <LeaderboardCelebration held={celebrationHeld} />
      </div>
    </NotificationProvider>
  )
}

export default PlayerLayout
