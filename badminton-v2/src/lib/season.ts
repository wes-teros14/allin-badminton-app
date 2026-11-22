// Seasons: the owner's boundaries, not the calendar's. Every leaderboard and profile is per season.
// All date arithmetic is on ISO `YYYY-MM-DD` strings in UTC, so a device timezone never shifts a boundary.
// The only device-local read is `localToday()`.

export interface SeasonFloors {
  played: number
  individual: number
  cheers: number
  earlyBird: number
}

export interface Season {
  id: string
  /** ISO date, inclusive. */
  start: string
  floors: SeasonFloors
  /** Days (ending at asOf, inclusive) that floor sessions are counted over; null = lifetime. */
  floorWindowDays: number | null
}

/** ISO dates; start inclusive, end exclusive; null = open. */
export interface DateWindow {
  start: string | null
  end: string | null
}

export interface BoardScope {
  season: Season
  /** The "as of" day: today for the current season, the day before the next season for a past one. */
  asOf: string
  isCurrent: boolean
}

/** No award badge on a profile until the current season has this many completed sessions. */
export const BADGE_HOLD_SESSIONS = 4

/** Oldest first. 2026 starts at an arbitrary far-past date so any earlier session still lands in it. */
export const SEASONS: readonly Season[] = [
  {
    id: '2026',
    start: '1970-01-01',
    floors: { played: 3, individual: 4, cheers: 4, earlyBird: 8 },
    floorWindowDays: null,
  },
  {
    id: '2027',
    start: '2026-11-16',
    floors: { played: 3, individual: 3, cheers: 3, earlyBird: 8 },
    floorWindowDays: 365,
  },
]

/** Synthetic season used by `unboundedScope`: no date bounds at all. Not part of SEASONS. */
const ALL_SEASON_ID = 'all'

const DAY_MS = 86_400_000

function toUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function addDays(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

export function seasonById(id: string): Season | null {
  return SEASONS.find((s) => s.id === id) ?? null
}

/** The latest season whose start <= date (the first season for anything earlier). */
export function seasonForDate(date: string): Season {
  let found = SEASONS[0]
  for (const s of SEASONS) if (s.start <= date) found = s
  return found
}

export function currentSeason(today: string): Season {
  return seasonForDate(today)
}

/** Seasons that have ended by `today`, newest first. */
export function pastSeasons(today: string): Season[] {
  const cur = currentSeason(today)
  return SEASONS.filter((s) => s.start < cur.start).reverse()
}

function nextSeasonStart(season: Season): string | null {
  const next = SEASONS.find((s) => s.start > season.start)
  return next ? next.start : null
}

/** The dates a season covers. The first season is open at the start; the latest is open at the end. */
export function seasonWindow(season: Season): DateWindow {
  if (season.id === ALL_SEASON_ID) return { start: null, end: null }
  const idx = SEASONS.findIndex((s) => s.id === season.id)
  return { start: idx <= 0 ? null : season.start, end: nextSeasonStart(season) }
}

/** `null` or an unknown id means the current season. */
export function boardScope(seasonId: string | null, today: string): BoardScope {
  const cur = currentSeason(today)
  const season = (seasonId !== null && seasonById(seasonId)) || cur
  if (season.id === cur.id) return { season, asOf: today, isCurrent: true }
  const next = nextSeasonStart(season)
  // A season that is not current always has a successor.
  return { season, asOf: addDays(next as string, -1), isCurrent: false }
}

/** The dates over which sessions attended count toward the floors. End is exclusive (asOf + 1 day). */
export function floorWindow(scope: BoardScope): DateWindow {
  const end = addDays(scope.asOf, 1)
  const days = scope.season.floorWindowDays
  return { start: days === null ? null : addDays(scope.asOf, 1 - days), end }
}

export function inWindow(date: string, w: DateWindow): boolean {
  return (w.start === null || date >= w.start) && (w.end === null || date < w.end)
}

/** Device-local today as `YYYY-MM-DD` (deliberately not UTC). */
export function localToday(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * A scope with no season bounds and a lifetime floor window, for the parity check against the legacy
 * all-time boards. Uses the synthetic season id 'all', for which `seasonWindow` is `{ null, null }`.
 */
export function unboundedScope(floors: SeasonFloors, asOf: string): BoardScope {
  return {
    season: { id: ALL_SEASON_ID, start: SEASONS[0].start, floors, floorWindowDays: null },
    asOf,
    isCurrent: true,
  }
}
