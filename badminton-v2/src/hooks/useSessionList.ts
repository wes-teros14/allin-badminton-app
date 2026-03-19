import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from './useSession'

interface UseSessionListResult {
  sessions: Session[]
  isLoading: boolean
  refresh: () => void
}

export function useSessionList(): UseSessionListResult {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })
      setSessions((data ?? []) as Session[])
      setIsLoading(false)
    }
    load()
  }, [refreshKey])

  return { sessions, isLoading, refresh }
}
