/**
 * 🐦 Registration Early Bird — average points per session (2026-10-11).
 *
 * In every finished session since the club started, the first
 * EARLY_BIRD_SCORED players who registered *themselves* score 5, 4, 3, 2, 1
 * (6th or later: 0). A player's score is their points ÷ the sessions they
 * registered for themselves, so turning up more often no longer wins it: the
 * old points total followed attendance (r = 0.60 on prod), the average much
 * less (0.32). Admin-added registrations are not counted at all, since those
 * players had no chance to be early. At least EARLY_BIRD_MIN_SESSIONS such
 * sessions are needed, or one lucky night wins.
 *
 * Equal averages go to whoever was 1st more often; a tie on both shares the
 * place. Only players eligible for the boards (still active: in one of the
 * last 4 sessions) are placed. The top EARLY_BIRD_PLACES are shown.
 * (History: a points total from 2026-10-04, briefly over the last 8 sessions.)
 *
 * It replaced "first to register for the session with the latest date", which
 * picked the furthest-future open session (weeks away, two sign-ups) and so
 * changed hands every time a session was created.
 */
import { AWARD_PLACES } from '@/lib/denseRank'

export const EARLY_BIRD_SCORED = 5
export const EARLY_BIRD_PLACES = AWARD_PLACES
/** Self-registered finished sessions a player needs before they are ranked. */
export const EARLY_BIRD_MIN_SESSIONS = 8

export interface EarlyBirdRegistration {
  sessionId: string
  playerId: string
  registeredAt: string
}

export interface EarlyBirdEntry {
  playerId: string
  points: number
  firsts: number
  /** Finished sessions the player registered for themselves. */
  sessions: number
  /** points ÷ sessions; what the board ranks by. */
  average: number
  /** 1-based; equal for a full tie. */
  place: number
}

export interface RankEarlyBirdsOptions {
  /**
   * Never compete (organisers). Removed BEFORE each session's places are
   * counted, so the people behind them move up.
   */
  excluded?: ReadonlySet<string>
  /**
   * Who may appear on the board (still active). Applied AFTER scoring: an
   * inactive player really was first back then, so their old places are not
   * handed to anyone else — they are just not shown. Omit to place everyone.
   */
  eligible?: ReadonlySet<string>
  places?: number
  minSessions?: number
}

/** Pure scoring; see the module comment for the rules. */
export function rankEarlyBirds(
  registrations: EarlyBirdRegistration[],
  { excluded = new Set(), eligible, places = EARLY_BIRD_PLACES, minSessions = EARLY_BIRD_MIN_SESSIONS }: RankEarlyBirdsOptions = {},
): EarlyBirdEntry[] {
  const bySession = new Map<string, EarlyBirdRegistration[]>()
  for (const r of registrations) {
    if (excluded.has(r.playerId)) continue
    const list = bySession.get(r.sessionId) ?? []
    list.push(r)
    bySession.set(r.sessionId, list)
  }

  const totals = new Map<string, { points: number; firsts: number; sessions: number }>()
  for (const list of bySession.values()) {
    const ordered = [...list].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
    ordered.forEach((r, index) => {
      const t = totals.get(r.playerId) ?? { points: 0, firsts: 0, sessions: 0 }
      t.sessions += 1
      if (index < EARLY_BIRD_SCORED) t.points += EARLY_BIRD_SCORED - index
      if (index === 0) t.firsts += 1
      totals.set(r.playerId, t)
    })
  }

  // Averages are compared as exact fractions (a/b vs c/d as a*d vs c*b), so two
  // players on the same average always share a place.
  const byAverage = (a: { points: number; sessions: number }, b: { points: number; sessions: number }) =>
    b.points * a.sessions - a.points * b.sessions
  const sorted = [...totals.entries()]
    .map(([playerId, t]) => ({ playerId, ...t, average: t.points / t.sessions }))
    .filter((e) => e.points > 0 && e.sessions >= minSessions && (!eligible || eligible.has(e.playerId)))
    .sort((a, b) => byAverage(a, b) || b.firsts - a.firsts || a.playerId.localeCompare(b.playerId))

  // Dense places (1, 1, 2 — never 1, 1, 3) and a cut by places, not rows, like
  // every other board (lib/denseRank.ts).
  const ranked: EarlyBirdEntry[] = []
  sorted.forEach((e, i) => {
    const prev = ranked[i - 1]
    const place = !prev ? 1 : byAverage(prev, e) === 0 && prev.firsts === e.firsts ? prev.place : prev.place + 1
    ranked.push({ ...e, place })
  })
  return ranked.filter((e) => e.place <= places)
}
