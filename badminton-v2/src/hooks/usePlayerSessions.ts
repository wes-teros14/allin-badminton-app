import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface SessionPickerItem {
  id: string
  name: string
  date: string
  time: string | null
  venue: string | null
  status: string
}

interface UsePlayerSessionsResult {
  sessions: SessionPickerItem[]
  isLoading: boolean
}

export function usePlayerSessions(playerId: string | null): UsePlayerSessionsResult {
  const [sessions, setSessions] = useState<SessionPickerItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!playerId) {
      setSessions([])
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setIsLoading(true)

      // 1. Get session IDs the player is registered in
      const { data: registrations } = await supabase
        .from('session_registrations')
        .select('session_id')
        .eq('player_id', playerId!)

      if (cancelled) return

      const sessionIds = ((registrations ?? []) as Array<{ session_id: string }>)
        .map((r) => r.session_id)

      if (sessionIds.length === 0) {
        setSessions([])
        setIsLoading(false)
        return
      }

      // 2. Fetch sessions with relevant statuses
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id, name, date, time, venue, status')
        .in('id', sessionIds)
        .in('status', ['schedule_locked', 'in_progress'])
        .order('created_at', { ascending: false })

      if (cancelled) return

      const items = ((sessionData ?? []) as unknown as Array<SessionPickerItem>)

      setSessions(items)
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [playerId])

  return { sessions, isLoading }
}
