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

    // 2a. Fetch profiles for registered players (no role filter — any user can register)
    const registeredProfiles =
      registeredIds.length > 0
        ? ((
            await supabase.from('profiles').select('id, name_slug').in('id', registeredIds)
          ).data ?? []) as { id: string; name_slug: string }[]
        : []

    // 2b. Fetch all known player profiles (role = player) for the "Add player" list
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name_slug')
      .eq('role', 'player')

    if (profilesError) {
      toast.error(profilesError.message)
      return
    }

    const playerProfiles = (allProfiles ?? []) as { id: string; name_slug: string }[]

    // 3. Build roster using registered-player profiles
    const nameMap = new Map(registeredProfiles.map((p) => [p.id, p.name_slug]))
    const rosterPlayers: RosterPlayer[] = registrations.map((r) => ({
      registrationId: r.id,
      playerId: r.player_id,
      nameSlug: nameMap.get(r.player_id) ?? r.player_id,
    }))

    // 4. Unregistered = known players not already registered
    const unregistered: UnregisteredPlayer[] = playerProfiles
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
      return
    }
    fetchRoster()
  }

  async function removePlayer(registrationId: string) {
    const { error } = await supabase
      .from('session_registrations')
      .delete()
      .eq('id', registrationId)

    if (error) {
      toast.error(error.message)
      return
    }
    fetchRoster()
  }

  return { players, unregisteredPlayers, isLoading, addPlayer, removePlayer }
}
