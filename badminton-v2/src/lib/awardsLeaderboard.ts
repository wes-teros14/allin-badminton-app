import { supabase } from '@/lib/supabase'
import { ATTENDANCE_AWARD_EXCLUDED, fetchEligiblePlayerIds } from '@/lib/boardEligibility'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { fetchEarlyBirds } from '@/lib/earlyBirdData'
import { fetchMatchAwards } from '@/lib/matchAwardsData'
import { WIN_STREAK_MIN_RUN } from '@/lib/winStreak'
import { GIANT_SLAYER_GAP, GIANT_SLAYER_MIN_UNDERDOG_GAMES } from '@/lib/giantSlayer'
import { AWARD_PLACES, assignDenseRanks, cutToPlaces } from '@/lib/denseRank'
import { awardBoard, type AwardBoardInfo } from '@/lib/awardBoards'

export interface AwardRow {
  playerId: string
  name: string
  value: number
  /** Dense place, 1-based: equal values share it. */
  rank: number
  /** Overrides the award's unit line, e.g. "2 of 6 games as underdog". */
  detail?: string
}

/**
 * One award on the Awards tab. Every award is a ranked top AWARD_PLACES drawn through
 * RankedBoard, the same board every other tab uses.
 */
export type AwardEntry = AwardBoardInfo & {
  /** One line on how the award is decided. */
  rule: string
  /** The unit under a row's number, e.g. "sessions". */
  unit: (value: number) => string
  /** How a row's number is printed; defaults to the number itself. */
  format?: (value: number) => string
  rows: AwardRow[]
  /** What an empty board says. */
  emptyText: string
}

/**
 * Every award's top places, as the Awards tab shows them. The celebration reads
 * the same function (via fetchPlayerStandings), so the card and the tab cannot
 * disagree about a place.
 */
export async function fetchAwardsLeaderboard(): Promise<AwardEntry[]> {
  const [statsRes, profilesRes, sessionsRes, earlyBirds, { winStreaks, giantSlayers }, eligibleIds] = await Promise.all([
    supabase.from('player_stats').select('player_id, sessions_attended'),
    supabase.from('profiles').select('id, nickname, name_slug').eq('is_active', true),
    supabase.from('sessions').select('id').eq('status', 'complete').order('date', { ascending: true }),
    fetchEarlyBirds(),
    fetchMatchAwards(),
    fetchEligiblePlayerIds(),
  ])

  const nameMap = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>)
      .map(p => [p.id, formatDisplayName(p.nickname, p.name_slug)])
  )

  // Every award is drawn from the same pool the other tabs rank: established
  // players who are still turning up.
  const isRankable = (id: string) => nameMap.has(id) && eligibleIds.has(id)
  // The two attendance awards are still raw counts, so the organiser who is at
  // every session would hold both permanently. Everything else is a rate.
  const holdsAttendanceAward = (id: string) => isRankable(id) && !ATTENDANCE_AWARD_EXCLUDED.has(id)

  const stats = ((statsRes.data ?? []) as Array<{ player_id: string; sessions_attended: number }>)
    .filter(s => isRankable(s.player_id))
  // nameMap holds active profiles only; a placed player who has since been
  // deactivated is still named, as before.
  const missingNames = [...earlyBirds, ...winStreaks, ...giantSlayers].map((e) => e.playerId).filter((id) => !nameMap.has(id))
  if (missingNames.length > 0) {
    const pRes = await supabase.from('profiles').select('id, nickname, name_slug').in('id', missingNames)
    for (const p of (pRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>) {
      nameMap.set(p.id, formatDisplayName(p.nickname, p.name_slug))
    }
  }
  const nameOf = (id: string) => nameMap.get(id) ?? 'Unknown player'

  /**
   * The top places of a count award, dense like every other board
   * (1, 1, 2 — never 1, 1, 3), cut by places rather than rows.
   */
  function topPlaces(arr: Array<{ player_id: string; value: number }>) {
    const ordered = arr
      .filter((a) => a.value > 0)
      .sort((a, b) => b.value - a.value || a.player_id.localeCompare(b.player_id))
    return cutToPlaces(assignDenseRanks(ordered, (a) => a.value), AWARD_PLACES).map((a): AwardRow => ({
      playerId: a.player_id,
      name: nameOf(a.player_id),
      value: a.value,
      rank: a.rank,
    }))
  }

  // Consecutive sessions streak per player
  const completedSessionIds = ((sessionsRes.data ?? []) as Array<{ id: string }>).map(s => s.id)
  const allRegsRes = await supabase.from('session_registrations').select('session_id, player_id').in('session_id', completedSessionIds)
  const playerSessions = new Map<string, Set<string>>()
  for (const r of (allRegsRes.data ?? []) as Array<{ session_id: string; player_id: string }>) {
    if (!holdsAttendanceAward(r.player_id)) continue
    if (!playerSessions.has(r.player_id)) playerSessions.set(r.player_id, new Set())
    playerSessions.get(r.player_id)!.add(r.session_id)
  }
  const streakEntries: Array<{ player_id: string; value: number }> = []
  for (const [playerId, attended] of playerSessions) {
    let maxStreak = 0
    let streak = 0
    for (const sid of completedSessionIds) {
      if (attended.has(sid)) { streak++; if (streak > maxStreak) maxStreak = streak }
      else streak = 0
    }
    if (maxStreak >= 2) streakEntries.push({ player_id: playerId, value: maxStreak })
  }

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

  const awards: AwardEntry[] = [
    {
      ...awardBoard('joined'),
      rule: 'Finished sessions attended',
      unit: (n) => plural(n, 'session', 'sessions'),
      rows: topPlaces(stats.filter(s => holdsAttendanceAward(s.player_id)).map(s => ({ player_id: s.player_id, value: s.sessions_attended }))),
      emptyText: 'Nobody has qualified yet.',
    },
    {
      ...awardBoard('attendance-streak'),
      rule: 'Most finished sessions in a row',
      unit: () => 'in a row',
      rows: topPlaces(streakEntries),
      emptyText: 'Nobody has a streak of 2 sessions yet.',
    },
    {
      ...awardBoard('early-bird'),
      rule: 'All sessions · first 5 to register score 5-4-3-2-1',
      unit: (n) => plural(n, 'point', 'points'),
      rows: earlyBirds.map((e) => ({ playerId: e.playerId, name: nameOf(e.playerId), value: e.points, rank: e.place })),
      emptyText: 'Nobody has qualified yet.',
    },
    {
      ...awardBoard('win-streak'),
      rule: 'Matches won in a row right now · a loss or draw ends it',
      unit: (n) => plural(n, 'win in a row', 'wins in a row'),
      rows: winStreaks.map((e) => ({ playerId: e.playerId, name: nameOf(e.playerId), value: e.run, rank: e.place })),
      emptyText: `Nobody is on a run of ${WIN_STREAK_MIN_RUN} or more right now.`,
    },
    {
      ...awardBoard('giant-slayer'),
      rule: `Games won as the pair ${Math.round(GIANT_SLAYER_GAP * 100)}+ points weaker on win rate going in · min. ${GIANT_SLAYER_MIN_UNDERDOG_GAMES} such games`,
      unit: () => '',
      format: (pct) => `${pct}%`,
      rows: giantSlayers.map((e) => ({
        playerId: e.playerId,
        name: nameOf(e.playerId),
        value: Math.round((100 * e.upsets) / e.underdogGames),
        rank: e.place,
        detail: `${e.upsets} of ${e.underdogGames} games as underdog`,
      })),
      emptyText: 'Nobody has beaten a much stronger pair often enough yet.',
    },
    // The six cheer awards (Top Fierce Offense etc.) left this tab on 2026-10-06:
    // the Cheers tab already ranks every category. Their badges stay on My Profile.
  ]

  return awards
}
