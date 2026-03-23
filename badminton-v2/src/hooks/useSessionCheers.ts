import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { CheerType, CheerEntry } from '@/types/app'

export interface SessionParticipant {
  playerId: string
  displayName: string
  partnerCount: number
  opponentCount: number
}

export interface UseSessionCheersResult {
  cheerTypes: CheerType[]
  participants: SessionParticipant[]
  cheersGiven: CheerEntry[]
  cheersReceived: CheerEntry[]
  isWindowOpen: boolean
  sessionStatus: string | null
  isLoading: boolean
  submitCheer: (receiverId: string, cheerTypeId: string) => Promise<void>
  refresh: () => void
}

type MatchRow = {
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
}

export function useSessionCheers(sessionId: string | undefined): UseSessionCheersResult {
  const { user } = useAuth()
  const [cheerTypes, setCheerTypes] = useState<CheerType[]>([])
  const [participants, setParticipants] = useState<SessionParticipant[]>([])
  const [cheersGiven, setCheersGiven] = useState<CheerEntry[]>([])
  const [cheersReceived, setCheersReceived] = useState<CheerEntry[]>([])
  const [isWindowOpen, setIsWindowOpen] = useState(false)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!sessionId || !user) { setIsLoading(false); return }
    setIsLoading(true)
    try {
      const [typesRes, sessionRes, regsRes, givenRes, receivedRes, matchesRes] = await Promise.all([
        supabase.from('cheer_types').select('id, slug, name, emoji').eq('is_active', true),
        supabase.from('sessions').select('status, completed_at').eq('id', sessionId).maybeSingle(),
        supabase.from('session_registrations').select('player_id').eq('session_id', sessionId),
        supabase
          .from('cheers')
          .select('id, receiver_id, cheer_type_id, created_at, cheer_types(slug, name, emoji)')
          .eq('session_id', sessionId)
          .eq('giver_id', user.id),
        supabase
          .from('cheers')
          .select('id, giver_id, cheer_type_id, created_at, cheer_types(slug, name, emoji)')
          .eq('session_id', sessionId)
          .eq('receiver_id', user.id),
        supabase
          .from('matches')
          .select('team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
          .eq('session_id', sessionId)
          .eq('status', 'complete'),
      ])

      setCheerTypes((typesRes.data ?? []) as CheerType[])

      const session = sessionRes.data as { status: string; completed_at: string | null } | null
      setSessionStatus(session?.status ?? null)
      if (session?.completed_at) {
        const windowClose = new Date(session.completed_at).getTime() + 24 * 60 * 60 * 1000
        setIsWindowOpen(Date.now() < windowClose)
      } else {
        setIsWindowOpen(false)
      }

      // Participants — exclude self
      const playerIds = ((regsRes.data ?? []) as Array<{ player_id: string }>)
        .map(r => r.player_id)
        .filter(id => id !== user.id)

      // Compute partner/opponent counts from completed matches
      const matches = (matchesRes.data ?? []) as MatchRow[]
      const partnerMap = new Map<string, number>()
      const opponentMap = new Map<string, number>()

      for (const m of matches) {
        const myTeam1 = m.team1_player1_id === user.id || m.team1_player2_id === user.id
        const myTeam2 = m.team2_player1_id === user.id || m.team2_player2_id === user.id
        if (!myTeam1 && !myTeam2) continue

        const partners = myTeam1
          ? [m.team1_player1_id, m.team1_player2_id].filter(id => id !== user.id)
          : [m.team2_player1_id, m.team2_player2_id].filter(id => id !== user.id)
        const opponents = myTeam1
          ? [m.team2_player1_id, m.team2_player2_id]
          : [m.team1_player1_id, m.team1_player2_id]

        for (const id of partners)  partnerMap.set(id, (partnerMap.get(id) ?? 0) + 1)
        for (const id of opponents) opponentMap.set(id, (opponentMap.get(id) ?? 0) + 1)
      }

      if (playerIds.length > 0) {
        const profilesRes = await supabase
          .from('profiles')
          .select('id, nickname, name_slug')
          .in('id', playerIds)
        const profiles = (profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>
        setParticipants(
          profiles
            .map(p => ({
              playerId: p.id,
              displayName: p.nickname ?? p.name_slug,
              partnerCount: partnerMap.get(p.id) ?? 0,
              opponentCount: opponentMap.get(p.id) ?? 0,
            }))
            .filter(p => p.partnerCount + p.opponentCount > 0)
        )
      } else {
        setParticipants([])
      }

      setCheersGiven(
        ((givenRes.data ?? []) as any[]).map(c => ({
          id: c.id,
          giverId: user.id,
          receiverId: c.receiver_id,
          cheerTypeId: c.cheer_type_id,
          cheerTypeSlug: (c.cheer_types as any)?.slug ?? '',
          cheerTypeName: (c.cheer_types as any)?.name ?? '',
          cheerTypeEmoji: (c.cheer_types as any)?.emoji ?? '',
          createdAt: c.created_at,
        }))
      )

      setCheersReceived(
        ((receivedRes.data ?? []) as any[]).map(c => ({
          id: c.id,
          giverId: c.giver_id,
          receiverId: user.id,
          cheerTypeId: c.cheer_type_id,
          cheerTypeSlug: (c.cheer_types as any)?.slug ?? '',
          cheerTypeName: (c.cheer_types as any)?.name ?? '',
          cheerTypeEmoji: (c.cheer_types as any)?.emoji ?? '',
          createdAt: c.created_at,
        }))
      )
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, user])

  useEffect(() => { load() }, [load])

  const submitCheer = useCallback(async (receiverId: string, cheerTypeId: string) => {
    if (!sessionId || !user) return
    const participant = participants.find(p => p.playerId === receiverId)
    const multiplier = Math.max((participant?.partnerCount ?? 0) + (participant?.opponentCount ?? 0), 1)
    const { error } = await supabase.from('cheers').insert({
      session_id: sessionId,
      giver_id: user.id,
      receiver_id: receiverId,
      cheer_type_id: cheerTypeId,
      multiplier,
    })
    if (error) throw error
    await load()
  }, [sessionId, user, participants, load])

  return {
    cheerTypes,
    participants,
    cheersGiven,
    cheersReceived,
    isWindowOpen,
    sessionStatus,
    isLoading,
    submitCheer,
    refresh: load,
  }
}
