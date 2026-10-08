import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { disambiguateDisplayNames, formatDisplayName } from '@/lib/formatDisplayName'

export interface SessionRegistrant {
  id: string
  name: string
  avatarUrl: string | null
}

export interface SessionPickerItem {
  id: string
  name: string
  date: string
  time: string | null
  duration: string | null
  venue: string | null
  status: string
  completed_at: string | null
  /** Set by the admin's Close; a finished session stays in Upcoming until then. */
  closed_at: string | null
  price: number | null
  session_notes: string | null
  registration_opens_at: string | null
  isRegistered: boolean
  paid: boolean | null
  /** On the "don't pay" list for this session; null when not registered. */
  paymentExempt: boolean | null
  /**
   * Non-dismissed receipts this player submitted for the session. Feeds
   * derivePaymentState so the sessions list shows the same three states as the
   * session card and the admin panel (FR-020).
   */
  activeReceiptCount: number
  playerCount?: number
  maxPlayers?: number | null
  /**
   * Who has registered, in sign-up order. Loaded alongside playerCount, for
   * sessions that are open or closed to registration (the list stays visible
   * after registration closes). null means the load failed — the card must say
   * so rather than show an empty list.
   */
  registrants?: SessionRegistrant[] | null
}

interface RegistrationSummary {
  session_id: string
  paid: boolean | null
  payment_exempt?: boolean | null
}

type SessionRecord = Omit<SessionPickerItem, 'isRegistered' | 'paid' | 'paymentExempt' | 'activeReceiptCount' | 'playerCount' | 'maxPlayers' | 'registrants'>

/**
 * Groups registrations into per-session lists in sign-up order. Names are
 * disambiguated within each session, so two "Alexis" on one card read as two
 * people rather than one entered twice — and an Alexis alone on a card keeps
 * her plain name.
 */
export function buildRegistrantsBySession(
  registrations: Array<{ session_id: string; player_id: string; registered_at: string }>,
  profiles: Array<{ id: string; name_slug: string; nickname: string | null; avatar_url: string | null }>,
): Map<string, SessionRegistrant[]> {
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const ordered = [...registrations].sort((a, b) => a.registered_at.localeCompare(b.registered_at))

  const idsBySession = new Map<string, string[]>()
  for (const r of ordered) {
    const ids = idsBySession.get(r.session_id) ?? []
    ids.push(r.player_id)
    idsBySession.set(r.session_id, ids)
  }

  const bySession = new Map<string, SessionRegistrant[]>()
  for (const [sessionId, ids] of idsBySession) {
    const labels = disambiguateDisplayNames(ids.flatMap((id) => {
      const p = profileById.get(id)
      return p ? [{ id, nameSlug: p.name_slug, displayName: formatDisplayName(p.nickname, p.name_slug) }] : []
    }))
    bySession.set(sessionId, ids.map((id) => ({
      id,
      name: labels.get(id) ?? 'Player',
      avatarUrl: profileById.get(id)?.avatar_url ?? null,
    })))
  }
  return bySession
}

/**
 * Active receipts per session for one player. Dismissed receipts are excluded
 * here exactly as they are in useRoster and useSessionReceipts — if any of the
 * three diverged, a dismissed receipt would show orange on one surface and red
 * on another.
 */
export function buildActiveReceiptCountMap(
  receipts: Array<{ session_id: string; dismissed_at: string | null }>
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of receipts) {
    if (r.dismissed_at !== null) continue
    counts.set(r.session_id, (counts.get(r.session_id) ?? 0) + 1)
  }
  return counts
}

export function buildRegistrationExemptMap(
  registrations: RegistrationSummary[]
): Map<string, boolean> {
  return new Map(registrations.map((registration) => [
    registration.session_id,
    registration.payment_exempt ?? false,
  ]))
}

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
      const [registrationsRes, openSessionsRes, receiptsRes] = await Promise.all([
        supabase.from('session_registrations').select('session_id, paid, payment_exempt').eq('player_id', playerId!),
        supabase.from('sessions').select('id, name, date, time, duration, venue, status, completed_at, closed_at, price, session_notes, registration_opens_at')
          .in('status', ['registration_open', 'registration_closed']).order('date', { ascending: false }),
        supabase.from('session_receipts').select('session_id, dismissed_at').eq('player_id', playerId!),
      ])

      if (cancelled) return

      const activeReceiptsBySessionId = buildActiveReceiptCountMap(
        (receiptsRes.data ?? []) as Array<{ session_id: string; dismissed_at: string | null }>
      )

      const registeredIds = new Set(
        ((registrationsRes.data ?? []) as Array<{ session_id: string }>).map(r => r.session_id)
      )
      const paidBySessionId = buildRegistrationPaymentMap(
        (registrationsRes.data ?? []) as RegistrationSummary[]
      )
      const exemptBySessionId = buildRegistrationExemptMap(
        (registrationsRes.data ?? []) as RegistrationSummary[]
      )

      // 2. Fetch registered sessions (all statuses)
      let registeredSessionData: SessionRecord[] = []
      if (registeredIds.size > 0) {
        const { data } = await supabase
          .from('sessions')
          .select('id, name, date, time, duration, venue, status, completed_at, closed_at, price, session_notes, registration_opens_at')
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
        paymentExempt: exemptBySessionId.get(s.id) ?? null,
        activeReceiptCount: activeReceiptsBySessionId.get(s.id) ?? 0,
      }))

      // Who joined stays visible once registration closes, so closed sessions
      // load their roster too. Only an open one can still take sign-ups, so only
      // an open one carries a slot limit.
      const rosterItems = items.filter(s => s.status === 'registration_open' || s.status === 'registration_closed')

      if (rosterItems.length > 0) {
        const openIds = rosterItems.map(s => s.id)

        const [{ data: invitations }, { data: regRows, error: regError }] = await Promise.all([
          supabase
            .from('session_invitations')
            .select('session_id, max_players')
            .in('session_id', openIds)
            .eq('is_active', true),
          supabase
            .from('session_registrations')
            .select('session_id, player_id, registered_at')
            .in('session_id', openIds),
        ])

        const registrationRows = (regRows ?? []) as Array<{ session_id: string; player_id: string; registered_at: string }>
        let registrantsBySession: Map<string, SessionRegistrant[]> | null = null
        if (!regError) {
          const playerIds = [...new Set(registrationRows.map((r) => r.player_id))]
          const { data: profiles, error: profilesError } = playerIds.length > 0
            ? await supabase.from('profiles').select('id, name_slug, nickname, avatar_url').in('id', playerIds)
            : { data: [], error: null }
          if (!profilesError) {
            registrantsBySession = buildRegistrantsBySession(
              registrationRows,
              (profiles ?? []) as Array<{ id: string; name_slug: string; nickname: string | null; avatar_url: string | null }>,
            )
          }
        }

        if (!cancelled) {
          const invMap: Record<string, number | null> = {}
          for (const inv of invitations ?? []) {
            invMap[(inv as { session_id: string; max_players: number | null }).session_id] =
              (inv as { session_id: string; max_players: number | null }).max_players
          }

          const countMap: Record<string, number> = {}
          for (const reg of registrationRows) {
            countMap[reg.session_id] = (countMap[reg.session_id] ?? 0) + 1
          }

          const enriched = items.map(s => {
            if (s.status !== 'registration_open' && s.status !== 'registration_closed') return s
            return {
              ...s,
              playerCount: countMap[s.id] ?? 0,
              maxPlayers: s.status === 'registration_open' && s.id in invMap ? invMap[s.id] : null,
              registrants: registrantsBySession ? (registrantsBySession.get(s.id) ?? []) : null,
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
