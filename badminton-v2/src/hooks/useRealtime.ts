import { useEffect, useRef, useCallback } from 'react'
import {
  coalesceDelay,
  createCoalescedRunner,
  pollIntervalFor,
  type ConnectionStatus,
} from '@/lib/realtimePolicy'
import { sessionTopic } from '@/lib/liveChannel'
import { useLiveChannel } from '@/hooks/useLiveChannel'

interface UseRealtimeResult {
  status: ConnectionStatus
  refresh: () => void
}

interface UseRealtimeOptions {
  /**
   * Safety-net poll (see pollIntervalFor): every 30 s while the channel is
   * subscribed, every 5 s while it is not. Also fires when the tab becomes
   * visible again, so a phone waking from sleep catches up at once. Omit to
   * disable polling.
   */
  onPoll?: () => void
}

/** What the court views show: games, their results, and the session row. */
const COURT_TABLES = ['matches', 'match_results', 'sessions'] as const

/**
 * Live updates for one session's courts, over the shared `session:<id>`
 * Broadcast channel (lib/liveChannel.ts). Bursts of changes are coalesced into
 * one `onUpdate`, with jitter so the phones in the hall do not all refetch in
 * the same millisecond. Reconnecting triggers a catch-up `onUpdate`.
 */
export function useRealtime(
  sessionId: string | null,
  onUpdate: () => void,
  options: UseRealtimeOptions = {},
): UseRealtimeResult {
  const onUpdateRef = useRef(onUpdate)
  const onPollRef = useRef(options.onPoll)
  onUpdateRef.current = onUpdate
  onPollRef.current = options.onPoll
  const hasPoll = options.onPoll != null

  const refresh = useCallback(() => {
    onUpdateRef.current()
  }, [])

  const coalescedRef = useRef<ReturnType<typeof createCoalescedRunner> | null>(null)
  useEffect(() => {
    const coalesced = createCoalescedRunner(() => onUpdateRef.current(), () => coalesceDelay())
    coalescedRef.current = coalesced
    return () => {
      coalesced.cancel()
      coalescedRef.current = null
    }
  }, [sessionId])

  const status = useLiveChannel(
    sessionId ? sessionTopic(sessionId) : null,
    COURT_TABLES,
    () => coalescedRef.current?.schedule(),
  )

  // Catch up after (re)connecting: changes made while the channel was down
  // were never delivered.
  const previousStatusRef = useRef<ConnectionStatus>('reconnecting')
  useEffect(() => {
    if (sessionId && status === 'connected' && previousStatusRef.current !== 'connected') {
      onUpdateRef.current()
    }
    previousStatusRef.current = status
  }, [sessionId, status])

  useEffect(() => {
    if (!sessionId || !hasPoll) return

    const poll = () => {
      if (document.visibilityState === 'visible') onPollRef.current?.()
    }
    const intervalId = window.setInterval(poll, pollIntervalFor(status))
    document.addEventListener('visibilitychange', poll)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [sessionId, hasPoll, status])

  return { status, refresh }
}
