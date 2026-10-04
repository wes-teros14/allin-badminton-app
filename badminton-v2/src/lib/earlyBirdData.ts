import { supabase } from '@/lib/supabase'
import { ATTENDANCE_AWARD_EXCLUDED, fetchEligiblePlayerIds } from '@/lib/boardEligibility'
import { rankEarlyBirds, type EarlyBirdEntry, type EarlyBirdRegistration } from '@/lib/earlyBird'

/** PostgREST caps a response at 1000 rows by default, so read in pages. */
const PAGE = 1000

/**
 * Every self-registration for every finished session, all-time. Filtered on the
 * joined session's status rather than an `in (...)` list of ids, which would
 * grow the URL by a UUID per session played.
 */
async function fetchSelfRegistrationsForFinishedSessions(): Promise<EarlyBirdRegistration[]> {
  const rows: EarlyBirdRegistration[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('session_registrations')
      .select('session_id, player_id, registered_at, sessions!inner(status)')
      .eq('source', 'self')
      .eq('sessions.status', 'complete')
      .order('registered_at', { ascending: true })
      .order('player_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const page = (data ?? []) as unknown as Array<{ session_id: string; player_id: string; registered_at: string }>
    for (const r of page) {
      rows.push({ sessionId: r.session_id, playerId: r.player_id, registeredAt: r.registered_at })
    }
    if (page.length < PAGE) return rows
  }
}

/** All-time Early Bird ranking, placed among currently active players. */
export async function fetchEarlyBirds(): Promise<EarlyBirdEntry[]> {
  const [registrations, eligible] = await Promise.all([
    fetchSelfRegistrationsForFinishedSessions(),
    fetchEligiblePlayerIds(),
  ])
  return rankEarlyBirds(registrations, { excluded: ATTENDANCE_AWARD_EXCLUDED, eligible })
}
