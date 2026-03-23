import { useState } from 'react'
import { toast } from 'sonner'
import type { CheerType, CheerEntry } from '@/types/app'
import type { SessionParticipant } from '@/hooks/useSessionCheers'

interface CheersPanelProps {
  cheerTypes: CheerType[]
  participants: SessionParticipant[]
  cheersGiven: CheerEntry[]
  cheersReceived: CheerEntry[]
  isWindowOpen: boolean
  sessionStatus: string | null
  isLoading: boolean
  submitCheer: (receiverId: string, cheerTypeId: string) => Promise<void>
}

export function CheersPanel({
  cheerTypes,
  participants,
  cheersGiven,
  cheersReceived,
  isWindowOpen,
  sessionStatus,
  isLoading,
  submitCheer,
}: CheersPanelProps) {
  const [submitting, setSubmitting] = useState(false)
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())

  const givenMap = new Map(cheersGiven.map(c => [c.receiverId, c]))
  const participantMap = new Map(participants.map(p => [p.playerId, p.displayName]))

  const pending = participants.filter(p => !givenMap.has(p.playerId) && !skippedIds.has(p.playerId))
  const current = pending[0] ?? null
  const isDone = participants.length > 0 && pending.length === 0

  const completedCount = participants.length - pending.length

  async function handleCheer(cheerTypeId: string) {
    if (!current || submitting) return
    setSubmitting(true)
    try {
      await submitCheer(current.playerId, cheerTypeId)
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

  if (sessionStatus !== 'complete') {
    return (
      <div className="max-w-sm mx-auto px-4 pt-10 text-center text-muted-foreground text-sm">
        Cheers open after the session ends.
      </div>
    )
  }

  if (participants.length === 0) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-10 text-center text-muted-foreground text-sm">
        No other players in this session.
      </div>
    )
  }

  // Summary screen
  if (isDone || !isWindowOpen) {
    return (
      <div className="max-w-sm mx-auto px-4 pt-6 pb-10 space-y-6">
        <div className="bg-card border border-border rounded-xl px-4 py-5 text-center space-y-1">
          {isDone ? (
            <>
              <p className="text-2xl">✅</p>
              <p className="font-semibold text-sm">All done!</p>
              <p className="text-xs text-muted-foreground">
                You gave {cheersGiven.length} cheer{cheersGiven.length !== 1 ? 's' : ''} this session.
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl">⏰</p>
              <p className="font-semibold text-sm">Cheer window closed</p>
              <p className="text-xs text-muted-foreground">
                You gave {cheersGiven.length} of {participants.length} cheers.
              </p>
            </>
          )}
        </div>

        {cheersGiven.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Cheers You Gave
            </h2>
            <div className="space-y-2">
              {cheersGiven.map(c => (
                <div key={c.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                  <span className="text-xl">{c.cheerTypeEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{c.cheerTypeName}</p>
                    <p className="text-xs text-muted-foreground">to {participantMap.get(c.receiverId) ?? 'A teammate'}</p>
                  </div>
                  {(c as any).multiplier > 1 && (
                    <span className="text-xs text-yellow-600 font-semibold shrink-0">×{(c as any).multiplier}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {cheersReceived.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Cheers You Received
            </h2>
            <div className="space-y-2">
              {cheersReceived.map(c => (
                <div key={c.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                  <span className="text-xl">{c.cheerTypeEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{c.cheerTypeName}</p>
                    <p className="text-xs text-muted-foreground">from {participantMap.get(c.giverId) ?? 'A teammate'}</p>
                  </div>
                  {(c as any).multiplier > 1 && (
                    <span className="text-xs text-yellow-600 font-semibold shrink-0">×{(c as any).multiplier}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 1-at-a-time cheer flow
  const multiplier = Math.max(current.partnerCount + current.opponentCount, 1)

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-10 space-y-4">
      {/* Progress */}
      <p className="text-xs text-muted-foreground text-center">
        {completedCount} of {participants.length}
      </p>

      {/* Player card */}
      <div className="bg-card border border-border rounded-xl px-4 py-5 space-y-4">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Give a cheer to</p>
          <p className="font-semibold text-base">{current.displayName}</p>
          {(current.partnerCount > 0 || current.opponentCount > 0) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {current.partnerCount > 0 && `🤝 Partner ${current.partnerCount}x`}
              {current.partnerCount > 0 && current.opponentCount > 0 && '  ·  '}
              {current.opponentCount > 0 && `⚔️ Opponent ${current.opponentCount}x`}
            </p>
          )}
          {multiplier > 1 && (
            <p className="text-xs text-yellow-600 font-medium mt-0.5">
              Your cheer counts ×{multiplier}
            </p>
          )}
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
