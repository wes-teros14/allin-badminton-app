import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { PlayerInput } from '@/lib/matchGenerator'

export type { PlayerInput as RegisteredPlayer }

interface RegistrationRow {
  player_id: string
  gender: 'M' | 'F' | null
  level: number | null
}

interface ProfileRow {
  id: string
  name_slug: string
  nickname: string | null
  gender: 'M' | 'F' | null
  level: number | null
}

interface RegisteredPlayersState {
  players: PlayerInput[]
  isLoading: boolean
}

export function buildRegisteredPlayers(
  registrations: RegistrationRow[],
  profiles: ProfileRow[]
): PlayerInput[] {
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  return registrations.map((r) => {
    const profile = profileMap.get(r.player_id)
    return {
      id: r.player_id,
      nameSlug: profile?.name_slug ?? r.player_id,
      nickname: profile?.nickname ?? null,
      gender: (r.gender ?? profile?.gender ?? null) as 'M' | 'F' | null,
      level: r.level ?? profile?.level ?? null,
    }
  })
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

    const channel = supabase
      .channel(`registered-players:${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_registrations', filter: `session_id=eq.${sessionId}` },
        () => { void fetchPlayers() }
      )
      .subscribe()

    return () => {
      isActive = false
      supabase.removeChannel(channel)
    }
  }, [sessionId, refreshKey])

  return { players, isLoading }
}
