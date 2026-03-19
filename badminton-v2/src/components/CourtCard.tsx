import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CourtData } from '@/hooks/useCourtState'

interface Props {
  courtNumber: 1 | 2
  data: CourtData
  sessionId: string | null
  isLoading: boolean
  refresh: () => void
}

export function CourtCard({ courtNumber, data, sessionId, isLoading, refresh }: Props) {
  const { current } = data
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)

  async function handleFinish(winningPairIndex: 1 | 2 | null) {
    if (!current || !sessionId || isSaving) return
    setIsSaving(true)

    try {
      // 1. Mark current match complete
      await supabase.from('matches').update({ status: 'complete' }).eq('id', current.id)

      // 2. Record result (skip if not recording)
      if (winningPairIndex !== null) {
        await supabase.from('match_results').insert({
          match_id: current.id,
          winning_pair_index: winningPairIndex,
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
          .update({ status: 'playing', court_number: courtNumber })
          .eq('id', (nextMatch as { id: string }).id)
      } else {
        // Check if other court still has a playing match
        const { data: stillPlaying } = await supabase
          .from('matches')
          .select('id')
          .eq('session_id', sessionId)
          .eq('status', 'playing')
          .limit(1)
          .maybeSingle()

        if (!stillPlaying) {
          // All matches done — auto-close the session
          await supabase
            .from('sessions')
            .update({ status: 'complete' })
            .eq('id', sessionId)
          setSessionComplete(true)
        }
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
    <div className="flex-1 flex flex-col p-8 gap-6 border-r border-border last:border-r-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-widest text-muted-foreground">
          COURT {courtNumber}
        </h2>
        {current && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary tracking-widest">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Main content area */}
      {confirmingFinish && current ? (
        /* Who Won — takes over the full middle area */
        <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-[court-fade-in_0.3s_ease-out]">
          <p className="text-2xl font-bold uppercase tracking-widest text-yellow-400">Who won?</p>
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
          <button
            onClick={() => handleFinish(null)}
            disabled={isSaving}
            className="w-full py-3 rounded-lg border border-border text-muted-foreground text-lg font-semibold hover:text-foreground hover:border-foreground/30 disabled:opacity-50 transition-colors"
          >
            Don't Record
          </button>
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
            className="flex-1 flex flex-col items-center justify-center gap-6 animate-[court-fade-in_0.4s_ease-out]"
          >
            {sessionComplete ? (
              <p className="text-xl font-semibold text-muted-foreground">Session complete</p>
            ) : current ? (
              <>
                <p className="game-hero text-primary">{current.gameNumber}</p>
                <div className="text-center space-y-3">
                  <p className="text-2xl font-medium">{current.t1p1} &amp; {current.t1p2}</p>
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">vs</p>
                  <p className="text-2xl font-medium">{current.t2p1} &amp; {current.t2p2}</p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-lg">Waiting for next game</p>
            )}
          </div>

          {/* Finish button */}
          {current && !sessionComplete && (
            <button
              onClick={() => setConfirmingFinish(true)}
              disabled={isSaving}
              className="w-full py-5 rounded-lg bg-primary text-primary-foreground text-xl font-bold tracking-wide hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Finish
            </button>
          )}
        </>
      )}
    </div>
  )
}
