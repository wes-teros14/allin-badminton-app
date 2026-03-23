import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const ACTIVE_STATUSES = [
  'registration_open',
  'registration_closed',
  'schedule_locked',
  'in_progress',
] as const

export interface ActiveSession {
  sessionId: string
  name: string
  status: typeof ACTIVE_STATUSES[number]
}

export function useActiveSessions() {
  const { user } = useAuth()
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setActiveSessions([])
      setIsLoading(false)
      return
    }

    async function load() {
      // Get session IDs the current player is registered in
      const { data: regs } = await supabase
        .from('session_registrations')
        .select('session_id')
        .eq('player_id', user!.id)

      const registeredSessionIds = ((regs ?? []) as Array<{ session_id: string }>).map((r) => r.session_id)

      if (registeredSessionIds.length === 0) {
        setActiveSessions([])
        setIsLoading(false)
        return
      }

      const { data } = await supabase
        .from('sessions')
        .select('id, name, status')
        .in('status', ACTIVE_STATUSES)
        .in('id', registeredSessionIds)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      const rows = (data ?? []) as Array<{ id: string; name: string; status: string }>
      setActiveSessions(
        rows.map((row) => ({
          sessionId: row.id,
          name: row.name,
          status: row.status as ActiveSession['status'],
        }))
      )
      setIsLoading(false)
    }

    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { activeSessions, isLoading }
}
