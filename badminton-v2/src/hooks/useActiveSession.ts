import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const ACTIVE_STATUSES = [
  'registration_open',
  'registration_closed',
  'schedule_locked',
  'in_progress',
] as const

const CHEERS_ELIGIBLE_STATUSES = [
  'in_progress',
  'complete',
] as const

export interface ActiveSession {
  sessionId: string
  name: string
  status: typeof ACTIVE_STATUSES[number]
}

export interface CheersEligibleSession {
  sessionId: string
  name: string
  status: typeof CHEERS_ELIGIBLE_STATUSES[number]
}

export function useActiveSessions() {
  const { user } = useAuth()
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

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

  return {
    activeSessions: user ? activeSessions : [],
    isLoading: user ? isLoading : false,
  }
}

export function useCheersEligibleSessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<CheersEligibleSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function load() {
      setIsLoading(true)

      const { data: regs } = await supabase
        .from('session_registrations')
        .select('session_id')
        .eq('player_id', user!.id)

      const registeredSessionIds = ((regs ?? []) as Array<{ session_id: string }>).map((r) => r.session_id)

      if (registeredSessionIds.length === 0) {
        setSessions([])
        setIsLoading(false)
        return
      }

      const { data } = await supabase
        .from('sessions')
        .select('id, name, status')
        .in('status', CHEERS_ELIGIBLE_STATUSES)
        .in('id', registeredSessionIds)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      const rows = (data ?? []) as Array<{ id: string; name: string; status: string }>
      setSessions(
        rows.map((row) => ({
          sessionId: row.id,
          name: row.name,
          status: row.status as CheersEligibleSession['status'],
        }))
      )
      setIsLoading(false)
    }

    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sessions: user ? sessions : [],
    isLoading: user ? isLoading : false,
  }
}
