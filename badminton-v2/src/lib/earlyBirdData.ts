import { ATTENDANCE_AWARD_EXCLUDED, canAppearOnBoard, fetchBoardProfiles, fetchEligibility } from '@/lib/boardEligibility'
import { rankEarlyBirds, type EarlyBirdEntry } from '@/lib/earlyBird'
import { floorWindow, inWindow, seasonWindow, type BoardScope, type DateWindow } from '@/lib/season'
import { fetchAttendance } from '@/lib/seasonData'
import { countSessions } from '@/lib/seasonTally'

/** The smallest window holding both; a null bound is open and stays open. */
function unionWindow(a: DateWindow, b: DateWindow): DateWindow {
  return {
    start: a.start === null || b.start === null ? null : a.start < b.start ? a.start : b.start,
    end: a.end === null || b.end === null ? null : a.end > b.end ? a.end : b.end,
  }
}

/**
 * 🐦 Early Bird for one season. Points come from the season's self-registrations; a player qualifies on
 * the self-registered sessions inside the floor window, like every other floor. Admin-added registrations
 * are not counted at all. Only played sessions are read (see `fetchAttendance`).
 */
export async function fetchEarlyBirds(scope: BoardScope): Promise<EarlyBirdEntry[]> {
  const seasonW = seasonWindow(scope.season)
  const floorW = floorWindow(scope)
  const [attendance, profiles, pool] = await Promise.all([
    // One read covers the season and the floor window; each is filtered locally.
    fetchAttendance(unionWindow(seasonW, floorW)),
    fetchBoardProfiles(),
    fetchEligibility(scope),
  ])
  const self = attendance.filter((r) => r.source === 'self')
  const floorSessions = countSessions(self, floorW)
  const present = canAppearOnBoard(profiles, scope)

  return rankEarlyBirds(
    self
      .filter((r) => inWindow(r.sessionDate, seasonW))
      .map((r) => ({ sessionId: r.sessionId, playerId: r.playerId, registeredAt: r.registeredAt })),
    {
      excluded: ATTENDANCE_AWARD_EXCLUDED,
      // `present` is part of the gate so a player who may not appear never occupies a place.
      qualifies: (id) =>
        present(id) &&
        // Floor 0: the pool contributes only its recent-registration and guest rules; the floor is
        // counted on self-registrations below.
        pool.qualifies(id, 0) &&
        (floorSessions.get(id) ?? 0) >= scope.season.floors.earlyBird,
    },
  )
}
