import { supabase } from '@/lib/supabase'
import { ATTENDANCE_AWARD_EXCLUDED } from '@/lib/boardEligibility'
import { EARLY_BIRD_WINDOW, rankEarlyBirds, type EarlyBirdEntry } from '@/lib/earlyBird'

/** Reads the last finished sessions' self-registrations and ranks them. */
export async function fetchEarlyBirds(): Promise<EarlyBirdEntry[]> {
  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('id')
    .eq('status', 'complete')
    .order('date', { ascending: false })
    .limit(EARLY_BIRD_WINDOW)
  if (sErr) throw sErr
  const sessionIds = ((sessions ?? []) as Array<{ id: string }>).map((s) => s.id)
  if (sessionIds.length === 0) return []

  const { data: regs, error: rErr } = await supabase
    .from('session_registrations')
    .select('session_id, player_id, registered_at')
    .in('session_id', sessionIds)
    .eq('source', 'self')
  if (rErr) throw rErr

  return rankEarlyBirds(
    ((regs ?? []) as Array<{ session_id: string; player_id: string; registered_at: string }>).map((r) => ({
      sessionId: r.session_id,
      playerId: r.player_id,
      registeredAt: r.registered_at,
    })),
    ATTENDANCE_AWARD_EXCLUDED,
  )
}
