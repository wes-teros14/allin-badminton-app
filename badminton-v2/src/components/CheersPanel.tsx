import { useState } from 'react'
import { toast } from 'sonner'
import type { CheerType } from '@/types/app'
import type { PendingMatchCheer } from '@/hooks/useMatchCheers'
import { GlyphIcon } from '@/components/GlyphIcon'

interface CheersPanelProps {
  cheerTypes: CheerType[]
  pendingMatch: PendingMatchCheer
  isLoading: boolean
  remainingCount: number
  submitCheer: (matchId: string, receiverId: string, cheerTypeId: string) => Promise<void>
}

export function CheersPanel({
  cheerTypes,
  pendingMatch,
  isLoading,
  remainingCount,
  submitCheer,
}: CheersPanelProps) {
  const [submitting, setSubmitting] = useState(false)
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())

  const pending = pendingMatch.players.filter(
    p => !pendingMatch.cheersGivenTo.includes(p.playerId) && !skippedIds.has(p.playerId)
  )
  const current = pending[0] ?? null
  const totalPlayers = pendingMatch.players.length
  const cheeredCount = pendingMatch.players.length - pending.length

  async function handleCheer(cheerTypeId: string) {
    if (!current || submitting) return
    setSubmitting(true)
    try {
      await submitCheer(pendingMatch.matchId, current.playerId, cheerTypeId)
      setSkippedIds(new Set()) // reset skips on successful cheer (data reloads)
    } catch {
      toast.error('Could not send cheer. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    if (!current) return
    setSkippedIds(prev => new Set(prev).add(current.playerId))
  }

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!current) {
    // All players skipped — show a nudge
    return (
      <div className="max-w-sm mx-auto px-4 pt-10 text-center space-y-3">
        <p className="text-muted-foreground text-sm">You skipped all players for this game.</p>
        <button
          onClick={() => setSkippedIds(new Set())}
          className="text-sm text-primary font-medium hover:underline"
        >
          Go back and give cheers
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-10">
      {/* Header: where you are, then the question. No card — the rows are the content. */}
      <p className="text-xs text-muted-foreground tabular-nums">
        Game {pendingMatch.gameNumber} done · cheer {cheeredCount + 1} of {totalPlayers}
      </p>
      <h2 className="mt-1 mb-4 text-[22px] font-bold leading-tight tracking-[-0.02em] text-balance">
        What did {current.displayName} do well?
      </h2>

      <div className="border-t border-border">
        {cheerTypes.map(ct => (
          <button
            key={ct.id}
            disabled={submitting}
            onClick={() => handleCheer(ct.id)}
            className="flex w-full items-center gap-3.5 border-b border-border px-0.5 py-3 text-left text-[15px] font-medium transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
          >
            <GlyphIcon emoji={ct.emoji} swatch />
            {ct.name}
          </button>
        ))}
      </div>

      <button
        onClick={handleSkip}
        disabled={submitting}
        className="mt-1 min-h-11 text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
      >
        Skip {current.displayName}
      </button>

      {remainingCount > 1 && (
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          {remainingCount} games still to cheer
        </p>
      )}
    </div>
  )
}
