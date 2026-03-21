import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

interface UseRealtimeResult {
  status: ConnectionStatus
  refresh: () => void
}

export function useRealtime(
  sessionId: string | null,
  onUpdate: () => void,
  channelPrefix = 'live-board',
): UseRealtimeResult {
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting')
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const refresh = useCallback(() => {
    onUpdateRef.current()
  }, [])

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`${channelPrefix}-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          onUpdateRef.current()
        },
      )
      .subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') {
          setStatus('connected')
        } else if (
          channelStatus === 'CHANNEL_ERROR' ||
          channelStatus === 'TIMED_OUT' ||
          channelStatus === 'CLOSED'
        ) {
          setStatus('disconnected')
        } else {
          setStatus('reconnecting')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { status, refresh }
}
