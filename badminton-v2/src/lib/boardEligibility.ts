/**
 * Who is allowed to appear on a leaderboard or hold an award.
 *
 * Shared by the leaderboard tabs and the profile's award badges, because those
 * two surfaces have to agree: a badge on someone's profile that the Awards tab
 * does not show is a bug the reader cannot diagnose.
 */

import { supabase } from '@/lib/supabase'
import { shareInFlight } from '@/lib/inflight'
import { floorWindow, seasonWindow, type BoardScope } from '@/lib/season'
import { fetchAttendance, fetchCompletedSessions, fetchSeasonMatches } from '@/lib/seasonData'
import { countSessions, tallyPlayerGames } from '@/lib/seasonTally'

/**
 * Completed sessions that count as "recently". Raised from 4 to 5 on 2026-11-15 so a regular
 * who misses a month (Ging: 8 sessions, last 18 Oct) stays on the boards through the Xmas party.
 */
export const RECENT_SESSIONS_WINDOW = 5

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

export interface EligibilityPool {
  /** Established (>= `floor` sessions in the floor window), recently registered, and not a guest. */
  qualifies(playerId: string, floor: number): boolean
  /** Sessions attended inside the floor window; 0 for a player never seen. */
  sessionsInWindow(playerId: string): number
}

/**
 * The pure part of `fetchEligibility`. The rules every board shares: a player must be established
 * (sessions in the floor window reach the board's floor), still turning up (registered for at least
 * one of the last `RECENT_SESSIONS_WINDOW` completed sessions up to `asOf`), and not a guest account.
 * A guest (`profiles.is_guest`, migration 087) is a shared login walk-ins play on: it shows in the
 * session views but never on a board, award or badge. Its opponents' and partners' own stats still
 * count those games; pairs with a guest drop off Partners because both partners must pass this gate.
 *
 * Deliberately says nothing about the excluded accounts: that list belongs to the two attendance
 * awards, not to eligibility for a ranked board.
 */
export function buildEligibility({ sessionCounts, recentRegistrants, guests }: {
  sessionCounts: ReadonlyMap<string, number>
  recentRegistrants: Iterable<string>
  guests: Iterable<string>
}): EligibilityPool {
  const recent = new Set(recentRegistrants)
  const guestSet = new Set(guests)
  const sessionsInWindow = (playerId: string) => sessionCounts.get(playerId) ?? 0
  return {
    sessionsInWindow,
    qualifies: (playerId, floor) =>
      sessionsInWindow(playerId) >= floor && recent.has(playerId) && !guestSet.has(playerId),
  }
}

/**
 * Eligibility as of `scope.asOf`: sessions attended in `floorWindow(scope)`, registration for one of
 * the last `RECENT_SESSIONS_WINDOW` played sessions dated on or before `asOf`, and guests.
 */
export function fetchEligibility(scope: BoardScope): Promise<EligibilityPool> {
  return shareInFlight(`eligibility|${scope.season.id}|${scope.asOf}`, () => readEligibility(scope))
}

async function readEligibility(scope: BoardScope): Promise<EligibilityPool> {
  const fw = floorWindow(scope)
  // `fw.end` is asOf + 1 day, exclusive, so this is every played session dated <= asOf.
  const upToAsOf = await fetchCompletedSessions({ start: null, end: fw.end })
  const recentSessions = upToAsOf.slice(-RECENT_SESSIONS_WINDOW)
  const recentIds = new Set(recentSessions.map((s) => s.id))

  // The recent sessions can predate a rolling floor window; widen the read so their registrations
  // are included. Session counts still use the floor window only.
  const readStart = recentSessions.length > 0 && fw.start !== null && recentSessions[0].date < fw.start
    ? recentSessions[0].date
    : fw.start

  const [attendance, guestsRes] = await Promise.all([
    fetchAttendance({ start: readStart, end: fw.end }),
    supabase.from('profiles').select('id').eq('is_guest', true),
  ])
  if (guestsRes.error) throw guestsRes.error

  return buildEligibility({
    sessionCounts: countSessions(attendance, fw),
    recentRegistrants: attendance.filter((r) => recentIds.has(r.sessionId)).map((r) => r.playerId),
    guests: (guestsRes.data as Array<{ id: string }>).map((g) => g.id),
  })
}

export interface BoardPending {
  waiting: number
  viewerSessions: number | null
}

/**
 * Players who have played this season (>= 1 game) but are still below this board's `floor` in the floor
 * window. Only the floor counts: a player who has met it but is held back by the recent-sessions rule is
 * not "waiting to reach N sessions", and telling them "You: 3 of 3" would be wrong. Guests never count.
 * For the current season inactive players are left out too, since they cannot appear on a board.
 * `viewerSessions` is the viewer's floor-window count when they are one of the waiting players, otherwise null.
 */
export function boardPending({ players, profiles, pool, floor, isCurrent, viewerId }: {
  players: Iterable<string>
  profiles: ReadonlyMap<string, { is_guest: boolean; is_active: boolean }>
  pool: EligibilityPool
  floor: number
  isCurrent: boolean
  viewerId: string | null
}): BoardPending {
  const waiting = new Set<string>()
  for (const playerId of players) {
    const profile = profiles.get(playerId)
    if (!profile || profile.is_guest) continue
    if (isCurrent && !profile.is_active) continue
    if (pool.sessionsInWindow(playerId) < floor) waiting.add(playerId)
  }
  return {
    waiting: waiting.size,
    viewerSessions: viewerId !== null && waiting.has(viewerId) ? pool.sessionsInWindow(viewerId) : null,
  }
}

/** `boardPending` for one board of `scope`, from the season's games. */
export async function fetchBoardPending(
  scope: BoardScope,
  floor: number,
  viewerId: string | null,
): Promise<BoardPending> {
  const [pool, matches, profilesRes] = await Promise.all([
    fetchEligibility(scope),
    fetchSeasonMatches(seasonWindow(scope.season)),
    supabase.from('profiles').select('id, is_guest, is_active'),
  ])
  if (profilesRes.error) throw profilesRes.error

  return boardPending({
    players: tallyPlayerGames(matches).keys(),
    profiles: new Map(
      (profilesRes.data as Array<{ id: string; is_guest: boolean; is_active: boolean }>).map((p) => [p.id, p]),
    ),
    pool,
    floor,
    isCurrent: scope.isCurrent,
    viewerId,
  })
}

export interface BoardProfile {
  id: string
  nickname: string | null
  name_slug: string
  avatar_url: string | null
  is_active: boolean
}

/**
 * Every profile with its active flag. A past season keeps players who have since gone inactive, so the
 * read cannot filter on `is_active`; callers apply `scope.isCurrent` themselves (see `canAppearOnBoard`).
 */
export function fetchBoardProfiles(): Promise<BoardProfile[]> {
  return shareInFlight('board-profiles', readBoardProfiles)
}

async function readBoardProfiles(): Promise<BoardProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, name_slug, avatar_url, is_active')
  if (error) throw error
  return data as BoardProfile[]
}

/** The current season shows active players only; a past season also names players since deactivated. */
export function canAppearOnBoard(profiles: readonly BoardProfile[], scope: BoardScope): (playerId: string) => boolean {
  const byId = new Map(profiles.map((p) => [p.id, p]))
  return (playerId) => {
    const profile = byId.get(playerId)
    return profile !== undefined && (!scope.isCurrent || profile.is_active)
  }
}
