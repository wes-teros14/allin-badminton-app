/**
 * Who is allowed to appear on a leaderboard or hold an award.
 *
 * Shared by the leaderboard tabs and the profile's award badges, because those
 * two surfaces have to agree: a badge on someone's profile that the Awards tab
 * does not show is a bug the reader cannot diagnose.
 */

import { supabase } from '@/lib/supabase'

/** Completed sessions that count as "recently". */
export const RECENT_SESSIONS_WINDOW = 4

/**
 * Sessions a player must have attended to appear anywhere. On the partnership
 * board *both* partners must clear it, so one regular carrying a newcomer
 * through three games together cannot mint a top-ten pairing.
 */
export const MIN_SESSIONS_PLAYED = 3

/**
 * Accounts held back from the two *count-based* attendance awards only —
 * Most Sessions Joined and Attendance Streak — where an organiser who is at
 * every session wins by definition.
 *
 * They are NOT excluded from any ranked board. Every board now scores a rate:
 * win rate, or a cheer share of a player's own total. A rate cannot be won by
 * turning up more often, so there is nothing to hold back from.
 */
export const ATTENDANCE_AWARD_EXCLUDED = new Set([
  'd3def74c-7367-4553-af30-eaa58e45ddb7',
  '8e48d7bf-c7dc-45a5-a468-7ee9b81db677',
])

/**
 * The two rules every board shares: a player must be established (attended at
 * least `MIN_SESSIONS_PLAYED` sessions) and still turning up (registered for at
 * least one of the last `RECENT_SESSIONS_WINDOW` completed sessions).
 *
 * Deliberately says nothing about the excluded accounts: that list belongs to
 * the two attendance awards, not to eligibility for a ranked board.
 */
export async function fetchEligiblePlayerIds(): Promise<Set<string>> {
  const [seasonedRes, recentSessionsRes] = await Promise.all([
    supabase.from('player_stats').select('player_id').gte('sessions_attended', MIN_SESSIONS_PLAYED),
    supabase.from('sessions').select('id').eq('status', 'complete').order('date', { ascending: false }).limit(RECENT_SESSIONS_WINDOW),
  ])

  const seasoned = new Set(
    ((seasonedRes.data ?? []) as Array<{ player_id: string }>).map((s) => s.player_id),
  )
  const recentSessionIds = ((recentSessionsRes.data ?? []) as Array<{ id: string }>).map((s) => s.id)
  if (seasoned.size === 0 || recentSessionIds.length === 0) return new Set()

  const { data: registrations } = await supabase
    .from('session_registrations')
    .select('player_id')
    .in('session_id', recentSessionIds)

  const eligible = new Set<string>()
  for (const r of (registrations ?? []) as Array<{ player_id: string }>) {
    if (seasoned.has(r.player_id)) eligible.add(r.player_id)
  }
  return eligible
}
