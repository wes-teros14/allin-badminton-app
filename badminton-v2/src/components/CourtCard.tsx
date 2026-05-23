import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { CourtData } from '@/hooks/useCourtState'
import { completedMatchUpdate, elapsedSecondsFromStartedAt, playingMatchUpdate } from '@/utils/matchTiming'
import { submitSplitResult, type SplitOutcome } from '@/lib/matchResults'

interface Props {
  courtNumber: 1 | 2
  data: CourtData
  sessionId: string | null
  isLoading: boolean
  refresh: () => void
  splitScoring: boolean
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CourtCard({ courtNumber, data, sessionId, isLoading, refresh, splitScoring }: Props) {
  const { current } = data
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(elapsedSecondsFromStartedAt(current?.startedAt ?? null) ?? 0)
  }, [current?.startedAt])

  useEffect(() => {
    if (!current || confirmingFinish) return

    const intervalId = setInterval(() => {
      setElapsed(elapsedSecondsFromStartedAt(current.startedAt) ?? 0)
    }, 1000)

    return () => clearInterval(intervalId)
  }, [current, confirmingFinish])

  async function handleFinish(winningPairIndex: 1 | 2 | null, splitOutcome?: SplitOutcome) {
    if (!current || !sessionId || isSaving) return
    setIsSaving(true)

    try {
      // 1. Mark current match complete — only if still 'playing' (atomic guard against concurrent double-finish)
      const { data: completed, error: e1 } = await supabase
        .from('matches')
        .update(completedMatchUpdate(current.startedAt) as never)
        .eq('id', current.id)
        .eq('status', 'playing')
        .select('id')
      if (e1 || !completed || completed.length === 0) return

      // 2. Record result (skip if not recording)
      if (splitOutcome) {
        const { error } = await submitSplitResult(current.id, splitOutcome)
        if (error) return
      } else if (winningPairIndex !== null) {
        await supabase.from('match_results').insert({
          match_id: current.id,
          winning_pair_index: winningPairIndex,
          game_number: 1,
        })
      }

      // 3. Find next queued match
      const { data: nextMatch } = await supabase
        .from('matches')
        .select('id')
        .eq('session_id', sessionId)
        .eq('status', 'queued')
        .order('queue_position')
        .limit(1)
        .maybeSingle()

      if (nextMatch) {
        // 4. Assign to this court
        await supabase
          .from('matches')
          .update(playingMatchUpdate(courtNumber))
          .eq('id', (nextMatch as { id: string }).id)
      } else {
        // Check if other court still has a playing match
        // Auto-close disabled: admin closes the session manually
      }

      refresh()
    } finally {
      setIsSaving(false)
      setConfirmingFinish(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-8 gap-6 border-r border-border last:border-r-0 animate-pulse">
        <div className="h-6 w-24 bg-muted rounded" />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="h-28 w-28 bg-muted rounded-lg" />
          <div className="space-y-3 w-full max-w-xs">
            <div className="h-6 bg-muted rounded mx-auto w-3/4" />
            <div className="h-4 bg-muted rounded mx-auto w-1/4" />
            <div className="h-6 bg-muted rounded mx-auto w-3/4" />
          </div>
        </div>
        <div className="border-t border-border pt-4 space-y-2">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-4 w-56 bg-muted rounded" />
        </div>
        <div className="h-14 bg-muted rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-8 gap-5 border-r border-border last:border-r-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-widest text-muted-foreground">
          COURT {courtNumber}
        </h2>
        {current && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-semibold text-[#FFB200]">
              {formatElapsed(elapsed)}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 tracking-widest">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          </div>
        )}
      </div>

      {/* Main content area */}
      {confirmingFinish && current ? (
        /* Who Won — takes over the full middle area */
        <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-[court-fade-in_0.3s_ease-out]">
          <p className="text-2xl font-bold uppercase tracking-widest text-[#FFB200]">Who won?</p>
          {splitScoring ? (
            <>
              <button
                onClick={() => handleFinish(null, '2-0-t1')}
                disabled={isSaving}
                className="w-full py-8 rounded-xl bg-primary/20 border border-primary/40 text-foreground text-2xl font-semibold hover:bg-primary/30 disabled:opacity-50 transition-colors"
              >
                {current.t1p1} &amp; {current.t1p2} won 2-0
              </button>
              <button
                onClick={() => handleFinish(null, '1-1')}
                disabled={isSaving}
                className="w-full py-8 rounded-xl bg-primary/20 border border-primary/40 text-foreground text-2xl font-semibold hover:bg-primary/30 disabled:opacity-50 transition-colors"
              >
                1-1 Draw
              </button>
              <button
                onClick={() => handleFinish(null, '2-0-t2')}
                disabled={isSaving}
                className="w-full py-8 rounded-xl bg-primary/20 border border-primary/40 text-foreground text-2xl font-semibold hover:bg-primary/30 disabled:opacity-50 transition-colors"
              >
                {current.t2p1} &amp; {current.t2p2} won 2-0
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleFinish(1)}
                disabled={isSaving}
                className="w-full py-8 rounded-xl bg-primary/20 border border-primary/40 text-foreground text-2xl font-semibold hover:bg-primary/30 disabled:opacity-50 transition-colors"
              >
                {current.t1p1} &amp; {current.t1p2}
              </button>
              <button
                onClick={() => handleFinish(2)}
                disabled={isSaving}
                className="w-full py-8 rounded-xl bg-primary/20 border border-primary/40 text-foreground text-2xl font-semibold hover:bg-primary/30 disabled:opacity-50 transition-colors"
              >
                {current.t2p1} &amp; {current.t2p2}
              </button>
            </>
          )}
          <button
            onClick={() => setConfirmingFinish(false)}
            disabled={isSaving}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          {/* Current game — key triggers fade-in on change */}
          <div
            key={current?.gameNumber ?? 'idle'}
            className="flex-1 flex flex-col items-center animate-[court-fade-in_0.4s_ease-out]"
          >
            {current ? (
              <>
                {/* Game number — large, anchored to top of content area */}
                <p className="game-hero whitespace-nowrap text-primary">Game {current.gameNumber}</p>

                {/* Names + finish button — tight group just below the number */}
                <div className="flex flex-col items-center gap-3 w-full mt-1">
                  <div className="text-center space-y-2">
                    <p className="text-4xl leading-tight font-medium">{current.t1p1} &amp; {current.t1p2}</p>
                    <p className="text-sm uppercase tracking-widest text-muted-foreground">vs</p>
                    <p className="text-4xl leading-tight font-medium">{current.t2p1} &amp; {current.t2p2}</p>
                  </div>

                  <button
                    onClick={() => setConfirmingFinish(true)}
                    disabled={isSaving}
                    className="w-full py-4 rounded-lg bg-primary text-primary-foreground text-xl font-bold tracking-wide hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    Finish
                  </button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-lg mt-auto mb-auto">Waiting for next game</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
