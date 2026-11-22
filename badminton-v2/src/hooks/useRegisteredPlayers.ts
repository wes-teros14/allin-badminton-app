import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { sessionTopic } from '@/lib/liveChannel'
import { listenLive } from '@/hooks/useLiveChannel'
import type { PlayerInput } from '@/lib/matchGenerator'
import { buildRegisteredPlayers, type ProfileRow, type RegistrationRow } from '@/lib/registeredPlayers'

export { buildRegisteredPlayers }

export type { PlayerInput as RegisteredPlayer }

interface RegisteredPlayersState {
  players: PlayerInput[]
  isLoading: boolean
}

export function useRegisteredPlayers(sessionId: string | undefined, refreshKey?: number): RegisteredPlayersState {
  const [players, setPlayers] = useState<PlayerInput[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    async function fetchPlayers() {
      if (!sessionId) {
        if (!isActive) return
        setPlayers([])
        setIsLoading(false)
        return
      }

      // Fetch registrations with session-level gender/level overrides
      const { data: regs, error: regsError } = await supabase
        .from('session_registrations')
        .select('player_id, gender, level')
        .eq('session_id', sessionId)

      if (regsError) {
        if (!isActive) return
        toast.error(regsError.message)
        setIsLoading(false)
        return
      }

      const regsFull = (regs ?? []) as RegistrationRow[]
      const playerIds = regsFull.map((r) => r.player_id as string)

      if (playerIds.length === 0) {
        if (!isActive) return
        setPlayers([])
        setIsLoading(false)
        return
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name_slug, nickname, gender, level')
        .in('id', playerIds)

      if (profilesError) {
        if (!isActive) return
        toast.error(profilesError.message)
        setIsLoading(false)
        return
      }

      if (!isActive) return
      setPlayers(buildRegisteredPlayers(regsFull, (profiles ?? []) as ProfileRow[]))
      setIsLoading(false)
    }

    setIsLoading(true)
    fetchPlayers()

    if (!sessionId) {
      return () => {
        isActive = false
      }
    }

    const stopListening = listenLive(sessionTopic(sessionId), (message) => {
      if (message.table === 'session_registrations') void fetchPlayers()
    })

    return () => {
      isActive = false
      stopListening()
    }
  }, [sessionId, refreshKey])

  return { players, isLoading }
}
