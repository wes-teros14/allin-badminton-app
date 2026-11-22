/**
 * Windowed raw-row reads. Every board is computed at read time from these rows, filtered by the
 * session's date, so a season is just a `DateWindow` and nothing is stored per season.
 *
 * "Played session" (owner's ruling, 2026-11-23): a session with `status = 'complete'` AND at least one
 * recorded game result. A completed session with no results (the 2026-11-22 Xmas Party, deliberately
 * game-less) is ignored everywhere: it is not a session attended, and nothing in it counts.
 *
 * Every read pages at 1,000 rows on a stable order and is cross-checked against an exact count, so a
 * short read throws rather than rendering a quietly under-counted board.
 */

import { supabase } from '@/lib/supabase'
import { shareInFlight } from '@/lib/inflight'
import type { DateWindow } from '@/lib/season'
import type { PairTallyMatch } from '@/lib/pairStats'
import type { CheerTypeSlug } from '@/types/app'

const PAGE_SIZE = 1000

export interface SeasonMatchRow extends PairTallyMatch {
  id: string
  match_results: Array<{
    id: string
    winning_pair_index: number
    game_number: number | null
    completed_at: string
  }>
  sessions: { date: string; status: string }
}

export interface AttendanceRow {
  sessionId: string
  sessionDate: string
  playerId: string
  source: string
  registeredAt: string
}

export interface CheerRow {
  id: string
  giverId: string
  receiverId: string
  slug: CheerTypeSlug
  weight: number
}

interface Windowable<B> {
  gte(column: string, value: string): B
  lt(column: string, value: string): B
}

const windowKey = (w: DateWindow) => `${w.start ?? ''}|${w.end ?? ''}`

/** Adds the window's bounds on `column`; a null bound adds nothing. */
function applyWindow<B extends Windowable<B>>(query: B, column: string, w: DateWindow): B {
  let q = query
  if (w.start !== null) q = q.gte(column, w.start)
  if (w.end !== null) q = q.lt(column, w.end)
  return q
}

/** Throws when a paged read came back short of the exact count. `expected === null`: no count to check. */
export function assertComplete(fetched: number, expected: number | null, what: string): void {
  if (expected !== null && fetched !== expected) {
    throw new Error(
      `Season read of ${what} is incomplete: fetched ${fetched} of ${expected}. ` +
        'Refusing to render a partially counted board.',
    )
  }
}

type PageResult = PromiseLike<{ data: unknown[] | null; error: Error | null }>
type CountResult = PromiseLike<{ count: number | null; error: Error | null }>

async function readAll<T>(
  what: string,
  page: (from: number, to: number) => PageResult,
  count: () => CountResult,
): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await page(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    // `data` is null only alongside an error, which was thrown above.
    const chunk = data as T[]
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }

  const { count: expected, error: countError } = await count()
  if (countError) throw countError
  assertComplete(rows.length, typeof expected === 'number' ? expected : null, what)
  return rows
}

// --- Matches -----------------------------------------------------------------

const MATCH_SELECT =
  'id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, ' +
  'match_results(id, winning_pair_index, game_number, completed_at), sessions!inner(date, status)'

/**
 * Matches in sessions dated inside `w`, each with its results.
 *
 * Each caller keeps its own rule, unchanged: by default `matches.status = 'complete'` (the Partners
 * board's rule); with `finishedSessionsOnly`, `sessions.status = 'complete'` (the awards' rule).
 */
export async function fetchSeasonMatches(
  w: DateWindow,
  opts: { finishedSessionsOnly?: boolean } = {},
): Promise<SeasonMatchRow[]> {
  const scoped = <B extends Windowable<B> & { eq(column: string, value: string): B }>(q: B): B => {
    const rule = opts.finishedSessionsOnly ? q.eq('sessions.status', 'complete') : q.eq('status', 'complete')
    return applyWindow(rule, 'sessions.date', w)
  }

  return readAll<SeasonMatchRow>(
    'matches',
    (from, to) =>
      scoped(supabase.from('matches').select(MATCH_SELECT)).order('id', { ascending: true }).range(from, to),
    () => scoped(supabase.from('matches').select('id, sessions!inner(date, status)', { count: 'exact', head: true })),
  )
}

// --- Sessions and attendance -------------------------------------------------

/**
 * The "played" sessions in `w`, date ascending: `status = 'complete'` with at least one game result.
 *
 * The result test is an inner embed (`matches!inner(match_results!inner(id))`). No embedded limit: correctness
 * must not depend on how PostgREST orders a limit against the nested !inner filter. The payload is small.
 */
export function fetchCompletedSessions(w: DateWindow): Promise<Array<{ id: string; date: string }>> {
  return shareInFlight(`completed|${windowKey(w)}`, () => readCompletedSessions(w))
}

async function readCompletedSessions(w: DateWindow): Promise<Array<{ id: string; date: string }>> {
  const base = <B extends Windowable<B> & { eq(column: string, value: string): B }>(q: B): B =>
    applyWindow(q.eq('status', 'complete'), 'date', w)

  const rows = await readAll<{ id: string; date: string }>(
    'completed sessions',
    (from, to) =>
      base(supabase.from('sessions').select('id, date, matches!inner(id, match_results!inner(id))'))
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    () => base(supabase.from('sessions').select('id, matches!inner(match_results!inner(id))', { count: 'exact', head: true })),
  )
  return rows.map((r) => ({ id: r.id, date: r.date }))
}

/** Registrations in the played sessions of `w` (see `fetchCompletedSessions`). */
export function fetchAttendance(w: DateWindow): Promise<AttendanceRow[]> {
  return shareInFlight(`attendance|${windowKey(w)}`, () => readAttendance(w))
}

async function readAttendance(w: DateWindow): Promise<AttendanceRow[]> {
  const [played, rows] = await Promise.all([
    fetchCompletedSessions(w),
    readAll<{
      session_id: string
      player_id: string
      source: string
      registered_at: string
      sessions: { date: string }
    }>(
      'attendance',
      (from, to) =>
        applyWindow(
          supabase
            .from('session_registrations')
            .select('session_id, player_id, source, registered_at, sessions!inner(date, status)')
            .eq('sessions.status', 'complete'),
          'sessions.date',
          w,
        )
          .order('id', { ascending: true })
          .range(from, to),
      () =>
        applyWindow(
          supabase
            .from('session_registrations')
            .select('id, sessions!inner(date, status)', { count: 'exact', head: true })
            .eq('sessions.status', 'complete'),
          'sessions.date',
          w,
        ),
    ),
  ])

  const playedIds = new Set(played.map((s) => s.id))
  return rows
    .filter((r) => playedIds.has(r.session_id))
    .map((r) => ({
      sessionId: r.session_id,
      sessionDate: r.sessions.date,
      playerId: r.player_id,
      source: r.source,
      registeredAt: r.registered_at,
    }))
}

// --- Cheers ------------------------------------------------------------------

/** One cheer reachable by both paths (or listed twice) counts once. First occurrence wins. */
export function mergeCheerRows(a: CheerRow[], b: CheerRow[]): CheerRow[] {
  const byId = new Map<string, CheerRow>()
  for (const c of [...a, ...b]) if (!byId.has(c.id)) byId.set(c.id, c)
  return [...byId.values()]
}

interface RawCheer {
  id: string
  giver_id: string
  receiver_id: string
  multiplier: number
  cheer_types: { slug: CheerTypeSlug }
}

const toCheerRow = (r: RawCheer): CheerRow => ({
  id: r.id,
  giverId: r.giver_id,
  receiverId: r.receiver_id,
  slug: r.cheer_types.slug,
  weight: r.multiplier,
})

const CHEER_COLUMNS = 'id, giver_id, receiver_id, multiplier, cheer_types(slug)'

/**
 * Cheers given in played sessions inside `w`, weighted by `multiplier`. A cheer is tied to its session
 * through its match (`match_id`) or, for the older ones, directly (`session_id`); both paths are read
 * and merged.
 */
export async function fetchSeasonCheers(w: DateWindow): Promise<CheerRow[]> {
  const [played, viaMatch, viaSession] = await Promise.all([
    fetchCompletedSessions(w),
    readAll<RawCheer & { matches: { session_id: string } }>(
      'match-linked cheers',
      (from, to) =>
        applyWindow(
          supabase
            .from('cheers')
            .select(`${CHEER_COLUMNS}, matches!inner(session_id, sessions!inner(date, status))`)
            .eq('matches.sessions.status', 'complete'),
          'matches.sessions.date',
          w,
        )
          .order('id', { ascending: true })
          .range(from, to),
      () =>
        applyWindow(
          supabase
            .from('cheers')
            .select('id, matches!inner(sessions!inner(date, status))', { count: 'exact', head: true })
            .eq('matches.sessions.status', 'complete'),
          'matches.sessions.date',
          w,
        ),
    ),
    readAll<RawCheer & { session_id: string }>(
      'session-linked cheers',
      (from, to) =>
        applyWindow(
          supabase
            .from('cheers')
            .select(`${CHEER_COLUMNS}, session_id, sessions!inner(date, status)`)
            .eq('sessions.status', 'complete'),
          'sessions.date',
          w,
        )
          .order('id', { ascending: true })
          .range(from, to),
      () =>
        applyWindow(
          supabase
            .from('cheers')
            .select('id, sessions!inner(date, status)', { count: 'exact', head: true })
            .eq('sessions.status', 'complete'),
          'sessions.date',
          w,
        ),
    ),
  ])

  const playedIds = new Set(played.map((s) => s.id))
  return mergeCheerRows(
    viaMatch.filter((r) => playedIds.has(r.matches.session_id)).map(toCheerRow),
    viaSession.filter((r) => playedIds.has(r.session_id)).map(toCheerRow),
  )
}
