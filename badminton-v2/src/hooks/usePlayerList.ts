import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface PlayerEntry {
  id: string
  nameSlug: string
}

interface UsePlayerListResult {
  players: PlayerEntry[]
  isLoading: boolean
  hasSession: boolean
}

export function usePlayerList(): UsePlayerListResult {
  const [players, setPlayers] = useState<PlayerEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)

      // 1. Find latest active session
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .in('status', ['schedule_locked', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (!session) {
        setHasSession(false)
        setPlayers([])
        setIsLoading(false)
        return
      }

      const sid = (session as { id: string }).id
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

      // 3. Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name_slug')
        .in('id', playerIds)

      if (cancelled) return

      const sorted = ((profiles ?? []) as Array<{ id: string; name_slug: string }>)
        .map((p) => ({ id: p.id, nameSlug: p.name_slug }))
        .sort((a, b) => a.nameSlug.localeCompare(b.nameSlug))

      setPlayers(sorted)
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { players, isLoading, hasSession }
}
