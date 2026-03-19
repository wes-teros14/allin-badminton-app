import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { PlayerInput } from '@/lib/matchGenerator'

export type { PlayerInput as RegisteredPlayer }

interface RegisteredPlayersState {
  players: PlayerInput[]
  isLoading: boolean
}

export function useRegisteredPlayers(sessionId: string | undefined): RegisteredPlayersState {
  const [players, setPlayers] = useState<PlayerInput[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      if (!sessionId) return

      const { data: regs, error: regsError } = await supabase
        .from('session_registrations')
        .select('player_id')
        .eq('session_id', sessionId)

      if (regsError) {
        toast.error(regsError.message)
        setIsLoading(false)
        return
      }

      const playerIds = (regs ?? []).map((r) => (r as { player_id: string }).player_id)

      if (playerIds.length === 0) {
        setPlayers([])
        setIsLoading(false)
        return
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name_slug, gender, level')
        .in('id', playerIds)

      if (profilesError) {
        toast.error(profilesError.message)
        setIsLoading(false)
        return
      }

      const result = (profiles ?? []).map((p) => {
        const profile = p as { id: string; name_slug: string; gender: 'M' | 'F' | null; level: number | null }
        return {
          id: profile.id,
          nameSlug: profile.name_slug,
          gender: profile.gender,
          level: profile.level,
        }
      })

      setPlayers(result)
      setIsLoading(false)
    }

    fetch()
  }, [sessionId])

  return { players, isLoading }
}
