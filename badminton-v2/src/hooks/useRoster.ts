import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export interface RosterPlayer {
  registrationId: string
  playerId: string
  nameSlug: string
}

export interface UnregisteredPlayer {
  id: string
  nameSlug: string
}

interface RosterState {
  players: RosterPlayer[]
  unregisteredPlayers: UnregisteredPlayer[]
  isLoading: boolean
  addPlayer: (playerId: string) => Promise<void>
  removePlayer: (registrationId: string) => Promise<void>
}

export function useRoster(sessionId: string | undefined): RosterState {
  const [players, setPlayers] = useState<RosterPlayer[]>([])
  const [unregisteredPlayers, setUnregisteredPlayers] = useState<UnregisteredPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function fetchRoster() {
    if (!sessionId) return

    // 1. Fetch session_registrations rows
    const { data: regs, error: regsError } = await supabase
      .from('session_registrations')
      .select('id, player_id')
      .eq('session_id', sessionId)

    if (regsError) {
      toast.error(regsError.message)
      return
    }

    const registrations = (regs ?? []) as { id: string; player_id: string }[]
    const registeredIds = registrations.map((r) => r.player_id)

    // 2. Fetch all player profiles
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name_slug')
      .eq('role', 'player')

    if (profilesError) {
      toast.error(profilesError.message)
      return
    }

    const profiles = (allProfiles ?? []) as { id: string; name_slug: string }[]

    // 3. Build roster: merge registrations with profile name_slug
    const rosterPlayers: RosterPlayer[] = registrations.map((r) => {
      const profile = profiles.find((p) => p.id === r.player_id)
      return {
        registrationId: r.id,
        playerId: r.player_id,
        nameSlug: profile?.name_slug ?? r.player_id,
      }
    })

    // 4. Unregistered = all players not in registeredIds
    const unregistered: UnregisteredPlayer[] = profiles
      .filter((p) => !registeredIds.includes(p.id))
      .map((p) => ({ id: p.id, nameSlug: p.name_slug }))

    setPlayers(rosterPlayers)
    setUnregisteredPlayers(unregistered)
    setIsLoading(false)
  }

  // Initial fetch
  useEffect(() => {
    fetchRoster()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Real-time subscription — refetch on any change to session_registrations for this session
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`roster:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_registrations',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchRoster()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function addPlayer(playerId: string) {
    if (!sessionId) return

    const { error } = await supabase
      .from('session_registrations')
      .insert({ session_id: sessionId, player_id: playerId })

    if (error) {
      toast.error(error.message)
    }
    // Real-time subscription triggers fetchRoster automatically
  }

  async function removePlayer(registrationId: string) {
    const { error } = await supabase
      .from('session_registrations')
      .delete()
      .eq('id', registrationId)

    if (error) {
      toast.error(error.message)
    }
    // Real-time subscription triggers fetchRoster automatically
  }

  return { players, unregisteredPlayers, isLoading, addPlayer, removePlayer }
}
