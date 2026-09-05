import { useState, useEffect } from 'react'
import { MatchupBand } from '@/components/MatchBoard'
import { elapsedSecondsFromStartedAt, formatElapsed } from '@/utils/matchTiming'
import type { CourtSlot } from '@/lib/courts'
import type { CourtMatchDisplay } from '@/hooks/useCourtState'

/**
 * Every court in the session, one card each, whether or not the viewer is
 * playing on it.
 *
 * Shared by the match-schedule route and the session detail page. It lived
 * inside PlayerView while only one route used it; the session page linked from
 * a session card had no court overview at all, so a player who was mid-game saw
 * only the court chip on their own card, and once their game finished they saw
 * no court at all.
 *
 * A live court renders through `MatchupBand` — the same card the All matches
 * board uses for "On court now" — so a court looks identical wherever it
 * appears, and the viewer's own game needs no separate card of its own.
 */
export function PlayerCourtTabs({
  courts,
  isLoading,
}: {
  courts: CourtSlot<CourtMatchDisplay>[]
  isLoading: boolean
}) {
  const [elapsedByCourt, setElapsedByCourt] = useState<Record<number, number>>({})

  useEffect(() => {
    function updateElapsed() {
      setElapsedByCourt(Object.fromEntries(
        courts.map((court) => [court.courtNumber, elapsedSecondsFromStartedAt(court.current?.startedAt ?? null) ?? 0]),
      ))
    }

    updateElapsed()
    const intervalId = setInterval(updateElapsed, 1000)
    return () => clearInterval(intervalId)
  }, [courts])

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {courts.map((court) => (
          <div key={court.courtNumber} className="h-[168px] rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {courts.map((court) => {
        if (court.current) {
          return (
            <MatchupBand
              key={court.courtNumber}
              match={{
                id: court.current.id,
                gameNumber: court.current.gameNumber,
                status: 'playing',
                courtNumber: court.courtNumber,
                startedAt: court.current.startedAt,
                winningPairIndex: null,
                team1: court.current.team1,
                team2: court.current.team2,
              }}
              elapsed={formatElapsed(elapsedByCourt[court.courtNumber] ?? 0)}
            />
          )
        }

        // An idle court still gets a card, so the session always reads as
        // "two courts" rather than silently shrinking to whatever is running.
        return (
          <div
            key={court.courtNumber}
            className="mb-2.5 rounded-2xl border border-border bg-card p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="shrink-0 rounded-md bg-muted px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {court.label}
              </span>
            </div>
            {court.next ? (
              <p className="text-xs text-muted-foreground">
                Next up — <span className="font-semibold text-foreground">Game {court.next.gameNumber}</span>
                {' · '}{court.next.t1p1} &amp; {court.next.t1p2} vs {court.next.t2p1} &amp; {court.next.t2p2}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No match on this court.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
