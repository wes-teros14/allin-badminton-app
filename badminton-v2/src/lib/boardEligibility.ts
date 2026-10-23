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
 * The rules every board shares: a player must be established (attended at
 * least `MIN_SESSIONS_PLAYED` sessions), still turning up (registered for at
 * least one of the last `RECENT_SESSIONS_WINDOW` completed sessions), and not a
 * guest account. A guest (`profiles.is_guest`, migration 087) is a shared login
 * walk-ins play on: it shows in the session views but never on an all-time
 * board, award or badge. Its opponents' and partners' own stats still count
 * those games; pairs with a guest drop off Partners because both partners must
 * pass this gate.
 *
 * Deliberately says nothing about the excluded accounts: that list belongs to
 * the two attendance awards, not to eligibility for a ranked board.
 */
export async function fetchEligiblePlayerIds(): Promise<Set<string>> {
  const [seasonedRes, recentSessionsRes, guestsRes] = await Promise.all([
    supabase.from('player_stats').select('player_id').gte('sessions_attended', MIN_SESSIONS_PLAYED),
    supabase.from('sessions').select('id').eq('status', 'complete').order('date', { ascending: false }).limit(RECENT_SESSIONS_WINDOW),
    supabase.from('profiles').select('id').eq('is_guest', true),
  ])

  const seasoned = ((seasonedRes.data ?? []) as Array<{ player_id: string }>).map((s) => s.player_id)
  const recentSessionIds = ((recentSessionsRes.data ?? []) as Array<{ id: string }>).map((s) => s.id)
  if (seasoned.length === 0 || recentSessionIds.length === 0) return new Set()

  const { data: registrations } = await supabase
    .from('session_registrations')
    .select('player_id')
    .in('session_id', recentSessionIds)

  return selectEligible({
    seasoned,
    recentRegistrants: ((registrations ?? []) as Array<{ player_id: string }>).map((r) => r.player_id),
    guests: ((guestsRes.data ?? []) as Array<{ id: string }>).map((g) => g.id),
  })
}

/** The pure part of `fetchEligiblePlayerIds`: seasoned, recently registered, not a guest. */
export function selectEligible({ seasoned, recentRegistrants, guests }: {
  seasoned: Iterable<string>
  recentRegistrants: Iterable<string>
  guests: Iterable<string>
}): Set<string> {
  const seasonedSet = new Set(seasoned)
  const guestSet = new Set(guests)
  const eligible = new Set<string>()
  for (const id of recentRegistrants) {
    if (seasonedSet.has(id) && !guestSet.has(id)) eligible.add(id)
  }
  return eligible
}
