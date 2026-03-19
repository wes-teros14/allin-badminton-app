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

      // Fetch registrations with session-level gender/level overrides
      const { data: regs, error: regsError } = await supabase
        .from('session_registrations')
        .select('player_id')
        .eq('session_id', sessionId)

      if (regsError) {
        toast.error(regsError.message)
        setIsLoading(false)
        return
      }

      const regsFull = (regs ?? []) as any[]
      const playerIds = regsFull.map((r) => r.player_id as string)

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

      const profileMap = new Map(
        (profiles ?? []).map((p: any) => [p.id as string, p as { id: string; name_slug: string; gender: 'M' | 'F' | null; level: number | null }])
      )

      const result: PlayerInput[] = regsFull.map((r) => {
        const profile = profileMap.get(r.player_id)
        return {
          id: r.player_id,
          nameSlug: profile?.name_slug ?? r.player_id,
          gender: (r.gender ?? profile?.gender ?? null) as 'M' | 'F' | null,
          level: r.level ?? profile?.level ?? null,
        }
      })

      setPlayers(result)
      setIsLoading(false)
    }

    fetch()
  }, [sessionId])

  return { players, isLoading }
}
