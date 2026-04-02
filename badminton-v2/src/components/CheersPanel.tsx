import { useState } from 'react'
import { toast } from 'sonner'
import type { CheerType } from '@/types/app'
import type { PendingMatchCheer } from '@/hooks/useMatchCheers'

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
    <div className="max-w-sm mx-auto px-4 pt-6 pb-10 space-y-4">
      {/* Header */}
      <div className="text-center space-y-0.5">
        <p className="text-sm font-semibold">🎉 Game {pendingMatch.gameNumber} complete!</p>
        {remainingCount > 1 && (
          <p className="text-xs text-muted-foreground">
            {remainingCount} game{remainingCount !== 1 ? 's' : ''} to cheer
          </p>
        )}
      </div>

      {/* Progress */}
      <p className="text-xs text-muted-foreground text-center">
        {cheeredCount + 1} of {totalPlayers}
      </p>

      {/* Player card */}
      <div className="bg-card border border-border rounded-xl px-4 py-5 space-y-4">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Give a cheer to</p>
          <p className="font-semibold text-base">{current.displayName}</p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {cheerTypes.map(ct => (
            <button
              key={ct.id}
              disabled={submitting}
              onClick={() => handleCheer(ct.id)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-muted hover:border-primary/30 transition-colors disabled:opacity-50 text-left"
            >
              <span className="text-xl shrink-0">{ct.emoji}</span>
              <span className="font-medium text-sm">{ct.name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleSkip}
          disabled={submitting}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 disabled:opacity-50"
        >
          Skip →
        </button>
      </div>
    </div>
  )
}
