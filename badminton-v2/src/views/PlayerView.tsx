import { useParams, Link } from 'react-router'
import { usePlayerList } from '@/hooks/usePlayerList'
import { usePlayerSchedule } from '@/hooks/usePlayerSchedule'
import { useRealtime } from '@/hooks/useRealtime'
import { PlayerScheduleHeader } from '@/components/PlayerScheduleHeader'
import { GameCard } from '@/components/GameCard'
import { LiveIndicator } from '@/components/LiveIndicator'

export function PlayerView() {
  const { nameSlug } = useParams<{ nameSlug?: string }>()

  if (nameSlug) {
    return <ScheduleView nameSlug={nameSlug} />
  }

  return <PlayerListView />
}

function PlayerListView() {
  const { players, isLoading, hasSession } = usePlayerList()

  if (!isLoading && !hasSession) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">No active session</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-sm mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Find your name</h1>

        <div className="flex flex-col gap-2">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))
            : players.map((p) => (
                <Link
                  key={p.id}
                  to={`/player/${p.nameSlug}`}
                  className="w-full h-12 flex items-center px-4 rounded-lg border border-border text-foreground font-medium hover:bg-muted/50 transition-colors"
                >
                  {p.nameSlug}
                </Link>
              ))}
        </div>
      </div>
    </div>
  )
}

function ScheduleView({ nameSlug }: { nameSlug: string }) {
  const { matches, playerDisplayName, sessionName, sessionId, isLoading, notFound, refresh } = usePlayerSchedule(nameSlug)
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
          gameCount={matches.length}
        />
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
              />
            ))}
      </div>
    </div>
  )
}

export default PlayerView
