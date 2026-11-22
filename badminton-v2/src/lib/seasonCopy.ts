/**
 * The words the Leaderboard uses about a season: captions, the switcher, the waiting footer. Pure, so the
 * numbers in them can only come from the season's own floors and played sessions.
 */

import type { Season } from '@/lib/season'

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** `2026-11-29` → "Nov 29". Read in UTC so a device timezone never shifts the day. */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return SHORT_DATE.format(new Date(Date.UTC(y, m - 1, d)))
}

/** First to last played session, e.g. "Mar 22 – Nov 15". `dates` is in date order. */
export function seasonRange(dates: ReadonlyArray<{ date: string }>): string | null {
  if (dates.length === 0) return null
  const first = formatShortDate(dates[0].date)
  const last = formatShortDate(dates[dates.length - 1].date)
  return first === last ? first : `${first} – ${last}`
}

/** What a season's floor counts: "sessions in the past 12 months", or "sessions played" (lifetime). */
export function floorUnit(season: Season): string {
  const days = season.floorWindowDays
  if (days === null) return 'sessions played'
  return days === 365 ? 'sessions in the past 12 months' : `sessions in the past ${days} days`
}

/** A floor as the season counts it: "3 sessions in the past 12 months", or "4 sessions played". */
export function floorCount(season: Season, floor: number): string {
  return `${floor} ${floorUnit(season)}`
}

export function pendingLine(waiting: number, floor: number): string {
  return waiting === 1
    ? `1 more player appears once they reach ${floor} sessions.`
    : `${waiting} more players appear once they reach ${floor} sessions.`
}

export function viewerProgress(sessions: number, floor: number): string {
  return `You: ${Math.min(sessions, floor)} of ${floor}`
}

export function switcherLabel(season: Season, isCurrent: boolean): string {
  return isCurrent ? `${season.id} season` : season.id
}

/** The between-seasons sentence. `nextDate` is the first upcoming session, if any. */
export function seasonStartLine(season: Season, nextDate: string | null): string {
  return nextDate === null
    ? `The ${season.id} season starts soon`
    : `The ${season.id} season starts with the ${formatShortDate(nextDate)} session`
}
