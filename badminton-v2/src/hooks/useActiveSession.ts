import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

export function useActiveSession() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('sessions')
      .select('id, name, status')
      .in('status', ACTIVE_STATUSES)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { id: string; name: string; status: string } | null
        setActiveSession(
          row
            ? { sessionId: row.id, name: row.name, status: row.status as ActiveSession['status'] }
            : null
        )
        setIsLoading(false)
      })
  }, [])

  return { activeSession, isLoading }
}
