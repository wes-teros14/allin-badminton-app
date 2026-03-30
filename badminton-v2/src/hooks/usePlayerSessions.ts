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
  cheersAllGiven: boolean
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
      let registeredSessionData: Array<Omit<SessionPickerItem, 'cheersAllGiven' | 'isRegistered'>> = []
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
      const openSessions = (openSessionsRes.data ?? []) as unknown as Array<Omit<SessionPickerItem, 'cheersAllGiven' | 'isRegistered'>>
      const seen = new Set(registeredSessionData.map(s => s.id))
      const unregisteredOpen = openSessions.filter(s => !seen.has(s.id))
      const rawItems = [...registeredSessionData, ...unregisteredOpen]

      // 4. For sessions with an open cheer window, check if player has given all cheers
      const now = Date.now()
      const openWindowIds = rawItems
        .filter(s => s.status === 'complete' && s.completed_at &&
          now < new Date(s.completed_at).getTime() + 24 * 60 * 60 * 1000)
        .map(s => s.id)

      const cheersAllGivenMap = new Map<string, boolean>()

      if (openWindowIds.length > 0) {
        const [cheersRes, regsRes] = await Promise.all([
          supabase.from('cheers').select('session_id').in('session_id', openWindowIds).eq('giver_id', playerId!),
          supabase.from('session_registrations').select('session_id').in('session_id', openWindowIds).neq('player_id', playerId!),
        ])
        if (!cancelled) {
          const cheersCount = new Map<string, number>()
          for (const c of (cheersRes.data ?? []) as Array<{ session_id: string }>) {
            cheersCount.set(c.session_id, (cheersCount.get(c.session_id) ?? 0) + 1)
          }
          const participantCount = new Map<string, number>()
          for (const r of (regsRes.data ?? []) as Array<{ session_id: string }>) {
            participantCount.set(r.session_id, (participantCount.get(r.session_id) ?? 0) + 1)
          }
          for (const id of openWindowIds) {
            const given = cheersCount.get(id) ?? 0
            const total = participantCount.get(id) ?? 0
            cheersAllGivenMap.set(id, total === 0 || given >= total)
          }
        }
      }

      const items: SessionPickerItem[] = rawItems.map(s => ({
        ...s,
        cheersAllGiven: cheersAllGivenMap.get(s.id) ?? false,
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
