import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface SessionPickerItem {
  id: string
  name: string
  date: string
  time: string | null
  duration: string | null
  venue: string | null
  status: string
  completed_at: string | null
  price: number | null
  session_notes: string | null
  registration_opens_at: string | null
  isRegistered: boolean
  paid: boolean | null
  playerCount?: number
  maxPlayers?: number | null
}

interface RegistrationSummary {
  session_id: string
  paid: boolean | null
}

type SessionRecord = Omit<SessionPickerItem, 'isRegistered' | 'paid' | 'playerCount' | 'maxPlayers'>

export function buildRegistrationPaymentMap(
  registrations: RegistrationSummary[]
): Map<string, boolean> {
  return new Map(registrations.map((registration) => [
    registration.session_id,
    registration.paid ?? false,
  ]))
}

interface UsePlayerSessionsResult {
  sessions: SessionPickerItem[]
  isLoading: boolean
}

export function usePlayerSessions(playerId: string | null): UsePlayerSessionsResult {
  const [sessions, setSessions] = useState<SessionPickerItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!playerId) {
      setSessions([])
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function load(options?: { background?: boolean }) {
      if (!options?.background) {
        setIsLoading(true)
      }

      // 1. Fetch registered session IDs + all registration_open/registration_closed sessions in parallel
      const [registrationsRes, openSessionsRes] = await Promise.all([
        supabase.from('session_registrations').select('session_id, paid').eq('player_id', playerId!),
        supabase.from('sessions').select('id, name, date, time, duration, venue, status, completed_at, price, session_notes, registration_opens_at')
          .in('status', ['registration_open', 'registration_closed']).order('date', { ascending: false }),
      ])

      if (cancelled) return

      const registeredIds = new Set(
        ((registrationsRes.data ?? []) as Array<{ session_id: string }>).map(r => r.session_id)
      )
      const paidBySessionId = buildRegistrationPaymentMap(
        (registrationsRes.data ?? []) as RegistrationSummary[]
      )

      // 2. Fetch registered sessions (all statuses)
      let registeredSessionData: SessionRecord[] = []
      if (registeredIds.size > 0) {
        const { data } = await supabase
          .from('sessions')
          .select('id, name, date, time, duration, venue, status, completed_at, price, session_notes, registration_opens_at')
          .in('id', [...registeredIds])
          .order('date', { ascending: false })
        if (!cancelled) {
          registeredSessionData = (data ?? []) as unknown as typeof registeredSessionData
        }
      }

      if (cancelled) return

      // 3. Merge: registered sessions + open sessions the player hasn't registered for
      const openSessions = (openSessionsRes.data ?? []) as unknown as SessionRecord[]
      const seen = new Set(registeredSessionData.map(s => s.id))
      const unregisteredOpen = openSessions.filter(s => !seen.has(s.id))
      const rawItems = [...registeredSessionData, ...unregisteredOpen]

      const items: SessionPickerItem[] = rawItems.map(s => ({
        ...s,
        isRegistered: registeredIds.has(s.id),
        paid: paidBySessionId.get(s.id) ?? null,
      }))

      const openItems = items.filter(s => s.status === 'registration_open')

      if (openItems.length > 0) {
        const openIds = openItems.map(s => s.id)

        const [{ data: invitations }, { data: regRows }] = await Promise.all([
          supabase
            .from('session_invitations')
            .select('session_id, max_players')
            .in('session_id', openIds)
            .eq('is_active', true),
          supabase
            .from('session_registrations')
            .select('session_id')
            .in('session_id', openIds),
        ])

        if (!cancelled) {
          const invMap: Record<string, number | null> = {}
          for (const inv of invitations ?? []) {
            invMap[(inv as { session_id: string; max_players: number | null }).session_id] =
              (inv as { session_id: string; max_players: number | null }).max_players
          }

          const countMap: Record<string, number> = {}
          for (const reg of regRows ?? []) {
            const sid = (reg as { session_id: string }).session_id
            countMap[sid] = (countMap[sid] ?? 0) + 1
          }

          const enriched = items.map(s => {
            if (s.status !== 'registration_open') return s
            return {
              ...s,
              playerCount: countMap[s.id] ?? 0,
              maxPlayers: s.id in invMap ? invMap[s.id] : null,
            }
          })

          setSessions(enriched)
          setIsLoading(false)
          return
        }
      }

      setSessions(items)
      setIsLoading(false)
    }

    load()
    const channel = supabase
      .channel(`player-sessions:${playerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_registrations', filter: `player_id=eq.${playerId}` },
        () => { void load({ background: true }) }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [playerId])

  return { sessions, isLoading }
}
