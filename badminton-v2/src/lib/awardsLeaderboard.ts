import { ATTENDANCE_AWARD_EXCLUDED, canAppearOnBoard, fetchBoardProfiles, fetchEligibility } from '@/lib/boardEligibility'
import { seasonWindow, type BoardScope } from '@/lib/season'
import { floorCount } from '@/lib/seasonCopy'
import { winRatePct } from '@/lib/matchResults'
import { fetchAttendance, fetchCompletedSessions } from '@/lib/seasonData'
import { countSessions } from '@/lib/seasonTally'
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

/** The longest run of consecutive sessions (in the order given) that the player attended. */
export function longestAttendanceRun(sessionIdsInOrder: readonly string[], attended: ReadonlySet<string>): number {
  let best = 0
  let run = 0
  for (const id of sessionIdsInOrder) {
    if (attended.has(id)) { run++; if (run > best) best = run }
    else run = 0
  }
  return best
}

/**
 * Every award's top places for one season, as the Awards tab shows them. The celebration reads
 * the same function (via fetchPlayerStandings), so the card and the tab cannot
 * disagree about a place.
 */
export async function fetchAwardsLeaderboard(scope: BoardScope): Promise<AwardEntry[]> {
  const seasonW = seasonWindow(scope.season)
  const { floors } = scope.season
  const [attendance, playedSessions, profiles, earlyBirds, { winStreaks, giantSlayers }, pool] = await Promise.all([
    fetchAttendance(seasonW),
    fetchCompletedSessions(seasonW),
    fetchBoardProfiles(),
    fetchEarlyBirds(scope),
    fetchMatchAwards(scope),
    fetchEligibility(scope),
  ])

  // Names follow the scope: a past season names players since deactivated, the current one only
  // active players (as the other tabs do).
  const present = canAppearOnBoard(profiles, scope)
  const nameMap = new Map(profiles.map((p) => [p.id, formatDisplayName(p.nickname, p.name_slug)]))
  const nameOf = (id: string) => nameMap.get(id) ?? 'Unknown player'

  // Every award is drawn from the same pool the other tabs rank: established players who are still
  // turning up. The two attendance awards are still raw counts, so the organiser who is at every
  // session would hold both permanently. Everything else is a rate.
  const holdsAttendanceAward = (id: string) =>
    present(id) && pool.qualifies(id, floors.played) && !ATTENDANCE_AWARD_EXCLUDED.has(id)

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

  const sessionsJoined = countSessions(attendance, seasonW)

  // Longest run of the season's played sessions, in date order.
  const sessionIdsInOrder = playedSessions.map((s) => s.id)
  const playerSessions = new Map<string, Set<string>>()
  for (const r of attendance) {
    if (!holdsAttendanceAward(r.playerId)) continue
    const attended = playerSessions.get(r.playerId) ?? new Set<string>()
    attended.add(r.sessionId)
    playerSessions.set(r.playerId, attended)
  }
  const streakEntries: Array<{ player_id: string; value: number }> = []
  for (const [playerId, attended] of playerSessions) {
    const value = longestAttendanceRun(sessionIdsInOrder, attended)
    if (value >= 2) streakEntries.push({ player_id: playerId, value })
  }

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

  const awards: AwardEntry[] = [
    {
      ...awardBoard('joined'),
      rule: 'Finished sessions attended',
      unit: (n) => plural(n, 'session', 'sessions'),
      rows: topPlaces([...sessionsJoined].filter(([id]) => holdsAttendanceAward(id)).map(([id, value]) => ({ player_id: id, value }))),
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
      rule: `Average points per session · first 5 to register score 5-4-3-2-1 · min. ${floorCount(scope.season, floors.earlyBird)}`,
      unit: () => 'pts per session',
      format: (avg) => avg.toFixed(2),
      rows: earlyBirds.map((e) => ({
        playerId: e.playerId,
        name: nameOf(e.playerId),
        value: e.average,
        rank: e.place,
        detail: `${e.points} pts in ${e.sessions} sessions`,
      })),
      emptyText: 'Nobody has qualified yet.',
    },
    {
      ...awardBoard('win-streak'),
      rule: 'Most matches won in a row this season · a loss or draw ends a run',
      unit: (n) => plural(n, 'win in a row', 'wins in a row'),
      rows: winStreaks.map((e) => ({ playerId: e.playerId, name: nameOf(e.playerId), value: e.run, rank: e.place })),
      emptyText: `Nobody has won ${WIN_STREAK_MIN_RUN} matches in a row yet.`,
    },
    {
      ...awardBoard('giant-slayer'),
      // Example pair: the stronger side at 50% plus half the gap, against 50% minus it (60% vs 40% at 20 points).
      rule: `Upsets: games won against a pair whose win rate was ${Math.round(GIANT_SLAYER_GAP * 100)}+ points higher than yours (e.g. ${Math.round(50 + GIANT_SLAYER_GAP * 50)}% vs your ${Math.round(50 - GIANT_SLAYER_GAP * 50)}%). Shown as a % of all such games · min. ${GIANT_SLAYER_MIN_UNDERDOG_GAMES}`,
      unit: () => '',
      format: (pct) => `${pct}%`,
      rows: giantSlayers.map((e) => ({
        playerId: e.playerId,
        name: nameOf(e.playerId),
        value: winRatePct(e.upsets, e.underdogGames),
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
