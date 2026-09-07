import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { CourtData } from '@/hooks/useCourtState'
import {
  completedMatchUpdate,
  elapsedSecondsFromStartedAt,
  formatElapsed,
  playingMatchUpdate,
} from '@/utils/matchTiming'
import { submitSplitResult, type SplitOutcome } from '@/lib/matchResults'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  courtNumber: number
  label: string
  data: CourtData
  sessionId: string | null
  isLoading: boolean
  /** True while a reload is in flight — see the promote fallback in `handleFinish`. */
  isReloading: boolean
  refresh: () => void
  splitScoring: boolean
}

export function CourtCard({ courtNumber, label, data, sessionId, isLoading, isReloading, refresh, splitScoring }: Props) {
  const { current, next } = data
  const { role } = useAuth()
  const isAdmin = role === 'admin' || role === 'moderator'
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

  /**
   * Move one queued match onto this court.
   *
   * The `.eq('status', 'queued')` guard is what makes it safe to promote an id
   * we already held rather than one we just read: if another device promoted
   * that match first, this updates zero rows and reports false instead of
   * putting the same game on two courts.
   */
  async function promoteMatch(matchId: string): Promise<boolean> {
    const { data: promoted, error } = await supabase
      .from('matches')
      .update(playingMatchUpdate(courtNumber))
      .eq('id', matchId)
      .eq('status', 'queued')
      .select('id')

    return !error && !!promoted && promoted.length > 0
  }

  /** Re-read the true queue head and promote it. One extra round trip; the fallback path only. */
  async function promoteQueueHeadFromServer(sid: string): Promise<boolean> {
    const { data: nextMatch } = await supabase
      .from('matches')
      .select('id')
      .eq('session_id', sid)
      .eq('status', 'queued')
      .order('queue_position')
      .limit(1)
      .maybeSingle()

    if (!nextMatch) return true // queue really is empty — nothing to promote
    return promoteMatch((nextMatch as { id: string }).id)
  }

  async function handleFinish(winningPairIndex: 1 | 2 | null, splitOutcome?: SplitOutcome) {
    if (!current || !sessionId || isSaving) return
    setIsSaving(true)

    try {
      // 1. Mark the match complete AND record the result, in one round trip.
      //    Neither write reads the other's outcome, so there is nothing to
      //    sequence. The `.eq('status', 'playing')` guard still protects against
      //    a concurrent double-finish, and the match_results unique index on
      //    (match_id, game_number) rejects a duplicate result row if another
      //    device recorded this match first — so firing them together cannot
      //    double-record.
      const [completeWrite, resultError] = await Promise.all([
        supabase
          .from('matches')
          .update(completedMatchUpdate(current.startedAt) as never)
          .eq('id', current.id)
          .eq('status', 'playing')
          .select('id'),
        splitOutcome
          ? submitSplitResult(current.id, splitOutcome).then(({ error }) => error)
          : winningPairIndex !== null
            ? supabase
                .from('match_results')
                .insert({ match_id: current.id, winning_pair_index: winningPairIndex, game_number: 1 })
                .then(({ error }) => error)
            : Promise.resolve(null),
      ])

      const { data: completed, error: completeError } = completeWrite

      if (completeError) {
        toast.error(`Could not finish the game — ${completeError.message}`)
        return
      }

      // Zero rows means the match was no longer 'playing': another device
      // finished it first. Benign, so say so plainly rather than showing an
      // error — but do say something. This used to return silently, so the
      // admin tapped a winner and watched nothing happen.
      if (!completed || completed.length === 0) {
        toast.info('That game was already finished')
        refresh()
        return
      }

      if (resultError) {
        // Do NOT bail — the match is already complete. Fall through to promote
        // the next match so the queue does not stall; the admin can re-enter
        // the result later.
        console.error('Failed to record result', resultError)
        toast.error('Game finished, but the result was not saved — re-enter it from the admin screen')
      }

      // 2. Promote the next game onto this court.
      //    The queue head is normally already on screen as `data.next`, so this
      //    needs no read at all. Two things can make that copy untrustworthy,
      //    and both fall back to re-reading it:
      //      - a reload is in flight, so the queue may be mid-change (e.g. the
      //        admin just reordered it from their phone, or the other court
      //        finished a moment ago and took this head)
      //      - the promote itself updates zero rows, meaning someone got there first
      if (isReloading) {
        await promoteQueueHeadFromServer(sessionId)
      } else if (next) {
        const promoted = await promoteMatch(next.id)
        if (!promoted && !(await promoteQueueHeadFromServer(sessionId))) {
          console.warn('Could not promote a next match onto court', courtNumber)
        }
      }
      // `next` null with a trusted queue means the queue is genuinely empty.
      // Auto-close stays disabled: the admin closes the session manually.

      refresh()
    } finally {
      setIsSaving(false)
      setConfirmingFinish(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-card p-8 gap-6 animate-pulse">
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
    <div className="flex h-full flex-col rounded-xl bg-card p-8 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-widest text-muted-foreground">
          {label.toUpperCase()}
        </h2>
        {current && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-semibold text-gold-ink">
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
      {isAdmin && confirmingFinish && current ? (
        /* Who Won — takes over the full middle area */
        <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-[court-fade-in_0.3s_ease-out]">
          <p className="text-2xl font-bold uppercase tracking-widest text-gold-ink">Who won?</p>
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

                  {isAdmin && (
                    <button
                      onClick={() => setConfirmingFinish(true)}
                      disabled={isSaving}
                      className="w-full py-4 rounded-lg bg-primary text-primary-foreground text-xl font-bold tracking-wide hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      Finish
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <p className="game-hero text-muted-foreground/40" aria-hidden="true">&mdash;</p>
                <p className="text-muted-foreground text-lg">Waiting for next game</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
