import { useState, useEffect } from 'react'
import { elapsedSecondsFromStartedAt, formatElapsed } from '@/utils/matchTiming'
import type { CourtSlot } from '@/lib/courts'
import type { CourtMatchDisplay } from '@/hooks/useCourtState'

/**
 * The live two-court strip: every court in the session, whether or not the
 * viewer is playing on it.
 *
 * Shared by the match-schedule route and the session detail page. It lived
 * inside PlayerView while only one route used it; the session page linked from
 * a session card had no court overview at all, so a player who was mid-game saw
 * only the court chip on their own card, and once their game finished they saw
 * no court at all.
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

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(courts.length, 1), 2)}, minmax(0, 1fr))` }}
    >
      {courts.map((court) => {
        const match = court.current ?? court.next
        const isPlaying = !!court.current

        return (
          <div
            key={court.courtNumber}
            className={`min-h-[7rem] rounded-xl border p-3 ${
              isPlaying
                ? 'border-primary/30 bg-[var(--primary-subtle)]'
                : 'border-border bg-card'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {court.label}
              </p>
              <div className="flex items-center gap-2">
                {isPlaying && (
                  <>
                    <span className="text-[0.65rem] font-mono font-semibold text-gold-ink">
                      {formatElapsed(elapsedByCourt[court.courtNumber] ?? 0)}
                    </span>
                    <span className="flex items-center gap-1 text-[0.65rem] font-bold tracking-widest text-red-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      LIVE
                    </span>
                  </>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                <div className="h-3 w-full rounded bg-muted animate-pulse" />
                <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
              </div>
            ) : match ? (
              <div className="space-y-1">
                {isPlaying && (
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-red-500">Playing</p>
                )}
                <p className={`whitespace-nowrap text-xl font-bold ${isPlaying ? 'text-foreground' : 'text-primary'}`}>Game {match.gameNumber}</p>
                <p className={`truncate text-xs font-medium ${isPlaying ? 'text-foreground' : 'text-primary'}`}>
                  {match.t1p1} &amp; {match.t1p2}
                </p>
                <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">vs</p>
                <p className={`truncate text-xs font-medium ${isPlaying ? 'text-foreground' : 'text-primary'}`}>
                  {match.t2p1} &amp; {match.t2p2}
                </p>
              </div>
            ) : (
              <div className="flex h-14 items-center">
                <p className="text-xs text-muted-foreground">No match</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
