import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export interface RosterPlayer {
  registrationId: string
  playerId: string
  nameSlug: string
  nickname: string | null
  gender: 'M' | 'F' | null
  level: number | null
  paid: boolean
}

export interface UnregisteredPlayer {
  id: string
  nameSlug: string
  nickname: string | null
}

interface RosterState {
  players: RosterPlayer[]
  unregisteredPlayers: UnregisteredPlayer[]
  isLoading: boolean
  addPlayer: (playerId: string) => Promise<void>
  removePlayer: (registrationId: string) => Promise<void>
  updateSessionOverride: (registrationId: string, gender: 'M' | 'F' | null, level: number | null) => Promise<void>
  updatePaid: (registrationId: string, paid: boolean) => Promise<void>
}

export function useRoster(sessionId: string | undefined): RosterState {
  const [players, setPlayers] = useState<RosterPlayer[]>([])
  const [unregisteredPlayers, setUnregisteredPlayers] = useState<UnregisteredPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function fetchRoster() {
    if (!sessionId) return

    // Fetch registrations including session-specific gender/level overrides
    const { data: regs, error: regsError } = await supabase
      .from('session_registrations')
      .select('id, player_id, gender, level, paid')
      .eq('session_id', sessionId)

    if (regsError) { toast.error(regsError.message); return }

    const registrations = (regs ?? []) as { id: string; player_id: string }[]
    const regsFull = (regs ?? []) as any[]
    const registeredIds = registrations.map((r) => r.player_id)

    // Profile defaults (name, gender, level)
    const registeredProfiles =
      registeredIds.length > 0
        ? ((await supabase.from('profiles').select('id, name_slug, nickname, gender, level').in('id', registeredIds)).data ?? []) as
            { id: string; name_slug: string; nickname: string | null; gender: 'M' | 'F' | null; level: number | null }[]
        : []

    // All known players for "Add player" list (includes admins who can also play)
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name_slug, nickname')

    if (profilesError) { toast.error(profilesError.message); return }

    const playerProfiles = (allProfiles ?? []) as { id: string; name_slug: string; nickname: string | null }[]
    const profileMap = new Map(registeredProfiles.map((p) => [p.id, p]))

    const rosterPlayers: RosterPlayer[] = regsFull.map((r) => {
      const p = profileMap.get(r.player_id)
      return {
        registrationId: r.id,
        playerId: r.player_id,
        nameSlug: p?.name_slug ?? r.player_id,
        nickname: p?.nickname ?? null,
        gender: (r.gender ?? p?.gender ?? null) as 'M' | 'F' | null,
        level: r.level ?? p?.level ?? null,
        paid: r.paid ?? false,
      }
    })

    const unregistered: UnregisteredPlayer[] = playerProfiles
      .filter((p) => !registeredIds.includes(p.id))
      .map((p) => ({ id: p.id, nameSlug: p.name_slug, nickname: p.nickname ?? null }))

    setPlayers(rosterPlayers)
    setUnregisteredPlayers(unregistered)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchRoster()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`roster:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_registrations', filter: `session_id=eq.${sessionId}` }, fetchRoster)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function addPlayer(playerId: string) {
    if (!sessionId) return
    const { error } = await supabase.from('session_registrations').insert({ session_id: sessionId, player_id: playerId, source: 'admin' })
    if (error) { toast.error(error.message); return }
    fetchRoster()
  }

  async function removePlayer(registrationId: string) {
    const { error } = await supabase.from('session_registrations').delete().eq('id', registrationId)
    if (error) { toast.error(error.message); return }
    fetchRoster()
  }

  // Writes session-specific gender/level override (does NOT touch profiles)
  async function updateSessionOverride(registrationId: string, gender: 'M' | 'F' | null, level: number | null) {
    const { error } = await supabase
      .from('session_registrations')
      .update({ gender, level } as never)
      .eq('id', registrationId)
    if (error) { toast.error(error.message); return }
    setPlayers((prev) => prev.map((p) => p.registrationId === registrationId ? { ...p, gender, level } : p))
  }

  async function updatePaid(registrationId: string, paid: boolean) {
    const { error } = await supabase
      .from('session_registrations')
      .update({ paid } as never)
      .eq('id', registrationId)
    if (error) { toast.error(error.message); return }
    setPlayers((prev) => prev.map((p) => p.registrationId === registrationId ? { ...p, paid } : p))
  }

  return { players, unregisteredPlayers, isLoading, addPlayer, removePlayer, updateSessionOverride, updatePaid }
}
