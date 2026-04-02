import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface SessionPickerItem {
  id: string
  name: string
  date: string
  time: string | null
  duration: string | null
  venue: string | null
  status: string
  completed_at: string | null
  price: number | null
  session_notes: string | null
  registration_opens_at: string | null
  isRegistered: boolean
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

      // 1. Fetch registered session IDs + all registration_open sessions in parallel
      const [registrationsRes, openSessionsRes] = await Promise.all([
        supabase.from('session_registrations').select('session_id').eq('player_id', playerId!),
        supabase.from('sessions').select('id, name, date, time, duration, venue, status, completed_at, price, session_notes, registration_opens_at')
          .eq('status', 'registration_open').order('date', { ascending: false }),
      ])

      if (cancelled) return

      const registeredIds = new Set(
        ((registrationsRes.data ?? []) as Array<{ session_id: string }>).map(r => r.session_id)
      )

      // 2. Fetch registered sessions (all statuses)
      let registeredSessionData: Array<Omit<SessionPickerItem, 'isRegistered'>> = []
      if (registeredIds.size > 0) {
        const { data } = await supabase
          .from('sessions')
          .select('id, name, date, time, duration, venue, status, completed_at, price, session_notes, registration_opens_at')
          .in('id', [...registeredIds])
          .order('date', { ascending: false })
        if (!cancelled) {
          registeredSessionData = (data ?? []) as unknown as typeof registeredSessionData
        }
      }

      if (cancelled) return

      // 3. Merge: registered sessions + open sessions the player hasn't registered for
      const openSessions = (openSessionsRes.data ?? []) as unknown as Array<Omit<SessionPickerItem, 'isRegistered'>>
      const seen = new Set(registeredSessionData.map(s => s.id))
      const unregisteredOpen = openSessions.filter(s => !seen.has(s.id))
      const rawItems = [...registeredSessionData, ...unregisteredOpen]

      const items: SessionPickerItem[] = rawItems.map(s => ({
        ...s,
        isRegistered: registeredIds.has(s.id),
      }))

      setSessions(items)
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [playerId])

  return { sessions, isLoading }
}
