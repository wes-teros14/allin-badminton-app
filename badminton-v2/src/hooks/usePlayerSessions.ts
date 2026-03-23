import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface SessionPickerItem {
  id: string
  name: string
  date: string
  time: string | null
  venue: string | null
  status: string
  completed_at: string | null
  cheersAllGiven: boolean
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

      // 2. Fetch all registered sessions, active first then by date desc
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id, name, date, time, venue, status, completed_at')
        .in('id', sessionIds)
        .order('date', { ascending: false })

      if (cancelled) return

      const rawItems = (sessionData ?? []) as unknown as Array<Omit<SessionPickerItem, 'cheersAllGiven'>>

      // For sessions with an open cheer window, check if player has given all cheers
      const now = Date.now()
      const openWindowIds = rawItems
        .filter(s => s.status === 'complete' && s.completed_at &&
          now < new Date(s.completed_at).getTime() + 24 * 60 * 60 * 1000)
        .map(s => s.id)

      const cheersAllGivenMap = new Map<string, boolean>()

      if (openWindowIds.length > 0) {
        const [cheersRes, regsRes] = await Promise.all([
          supabase
            .from('cheers')
            .select('session_id')
            .in('session_id', openWindowIds)
            .eq('giver_id', playerId!),
          supabase
            .from('session_registrations')
            .select('session_id')
            .in('session_id', openWindowIds)
            .neq('player_id', playerId!),
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
      }))

      setSessions(items)
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [playerId])

  return { sessions, isLoading }
}
