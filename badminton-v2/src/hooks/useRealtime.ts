import { useEffect, useId, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  coalesceDelay,
  createCoalescedRunner,
  pollIntervalFor,
  type ConnectionStatus,
} from '@/lib/realtimePolicy'

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

export function useRealtime(
  sessionId: string | null,
  onUpdate: () => void,
  channelPrefix = 'live-board',
  options: UseRealtimeOptions = {},
): UseRealtimeResult {
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting')
  const onUpdateRef = useRef(onUpdate)
  const onPollRef = useRef(options.onPoll)
  const previousStatusRef = useRef<ConnectionStatus>('reconnecting')
  onUpdateRef.current = onUpdate
  onPollRef.current = options.onPoll
  const hasPoll = options.onPoll != null
  // supabase.channel() returns the EXISTING channel when a topic is reused, so
  // two components on one page subscribing to the same session (e.g. My Games
  // plus the embedded All Games tab) would share one channel and the first to
  // unmount would tear down the other's. A per-instance suffix keeps them apart.
  const instanceId = useId()

  const refresh = useCallback(() => {
    onUpdateRef.current()
  }, [])

  useEffect(() => {
    if (!sessionId) return

    const coalesced = createCoalescedRunner(
      () => onUpdateRef.current(),
      () => coalesceDelay(),
    )
    const scheduleUpdate = () => coalesced.schedule()

    const channel = supabase
      .channel(`${channelPrefix}-${sessionId}-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `session_id=eq.${sessionId}`,
        },
        scheduleUpdate,
      )
      // match_results has no session_id column, so it cannot be filtered
      // server-side. With one live session at a time that costs nothing extra,
      // and the result insert is the only event that changes the leaderboard
      // after the final match of a session.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_results',
        },
        scheduleUpdate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sessionId}`,
        },
        scheduleUpdate,
      )
      .subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') {
          if (previousStatusRef.current !== 'connected') {
            onUpdateRef.current()
          }
          previousStatusRef.current = 'connected'
          setStatus('connected')
        } else if (
          channelStatus === 'CHANNEL_ERROR' ||
          channelStatus === 'TIMED_OUT' ||
          channelStatus === 'CLOSED'
        ) {
          previousStatusRef.current = 'disconnected'
          setStatus('disconnected')
        } else {
          previousStatusRef.current = 'reconnecting'
          setStatus('reconnecting')
        }
      })

    return () => {
      coalesced.cancel()
      supabase.removeChannel(channel)
    }
  }, [channelPrefix, sessionId, instanceId])

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
