import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface PlayerEntry {
  id: string
  nameSlug: string
  displayName: string
}

interface SessionInfo {
  name: string
  date: string
  venue: string | null
  time: string | null
  duration: string | null
}

interface UsePlayerListResult {
  players: PlayerEntry[]
  session: SessionInfo | null
  isLoading: boolean
  hasSession: boolean
}

export function usePlayerList(sessionIdParam?: string): UsePlayerListResult {
  const [players, setPlayers] = useState<PlayerEntry[]>([])
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)

      let sid: string

      if (sessionIdParam) {
        sid = sessionIdParam
        // Fetch session details for provided id
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('id, name, date, venue, time, duration')
          .eq('id', sid)
          .maybeSingle()
        if (cancelled) return
        if (sessionData) {
          const s = sessionData as unknown as { id: string; name: string; date: string; venue: string | null; time: string | null; duration: string | null }
          setSession({ name: s.name, date: s.date, venue: s.venue, time: s.time, duration: s.duration })
        }
      } else {
        // Find latest active session
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('id, name, date, venue, time, duration')
          .in('status', ['schedule_locked', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        if (!sessionData) {
          setHasSession(false)
          setPlayers([])
          setSession(null)
          setIsLoading(false)
          return
        }
        const s = sessionData as unknown as { id: string; name: string; date: string; venue: string | null; time: string | null; duration: string | null }
        sid = s.id
        setSession({ name: s.name, date: s.date, venue: s.venue, time: s.time, duration: s.duration })
      }
      setHasSession(true)

      // 2. Get registered player IDs for this session
      const { data: registrations } = await supabase
        .from('session_registrations')
        .select('player_id')
        .eq('session_id', sid)

      if (cancelled) return

      const playerIds = ((registrations ?? []) as Array<{ player_id: string }>)
        .map((r) => r.player_id)

      if (playerIds.length === 0) {
        setPlayers([])
        setIsLoading(false)
        return
      }

      // 3. Fetch profiles (exclude inactive players)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name_slug, nickname')
        .in('id', playerIds)
        .eq('is_active', true)

      if (cancelled) return

      const sorted = ((profiles ?? []) as Array<{ id: string; name_slug: string; nickname: string | null }>)
        .map((p) => ({ id: p.id, nameSlug: p.name_slug, displayName: p.nickname ?? p.name_slug }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))

      setPlayers(sorted)
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [sessionIdParam])

  return { players, session, isLoading, hasSession }
}
