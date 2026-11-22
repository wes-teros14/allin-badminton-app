import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { seasonWindow, type BoardScope } from '@/lib/season'
import { fetchCompletedSessions } from '@/lib/seasonData'

/**
 * Sessions that are announced and not yet finished. `setup` is left out: it is an admin's draft, and a date
 * still being set up is not one to promise players.
 */
const UPCOMING_STATUSES = ['registration_open', 'registration_closed', 'schedule_locked', 'in_progress'] as const

export type SeasonStatus =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready'
      /** The season's played sessions, date ascending (a completed session with no results is not one). */
      played: Array<{ id: string; date: string }>
      /** Current season with nothing played yet: the first upcoming session's date, or null for none. */
      nextDate: string | null
    }

/** The first upcoming session on or after `from`. */
async function fetchNextSessionDate(from: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('date')
    .gte('date', from)
    .in('status', UPCOMING_STATUSES)
    .order('date', { ascending: true })
    .limit(1)
  if (error) throw error
  const rows = data as Array<{ date: string }>
  return rows.length > 0 ? rows[0].date : null
}

/**
 * What the Leaderboard needs to know about the season before any board: its played sessions (the caption's
 * date range, and whether the season has started at all) and, between seasons, when it starts.
 * A failure is an error state, never read as "nothing played".
 */
export function useSeasonStatus(scope: BoardScope): { status: SeasonStatus; retry: () => void } {
  const { season, isCurrent, asOf } = scope
  const key = `${season.id}|${asOf}`
  // Tagged with the scope it describes. On a season switch the scope changes a render before the effect
  // runs; an untagged status would hand the new season the old season's "ready" for that render, mounting
  // its boards (reads, and a celebration sweep collected) against the wrong status.
  const [tagged, setTagged] = useState<{ key: string; status: SeasonStatus }>({ key, status: { kind: 'loading' } })
  const request = useRef(0)

  const load = useCallback(async () => {
    const id = ++request.current
    setTagged({ key, status: { kind: 'loading' } })
    try {
      const played = await fetchCompletedSessions(seasonWindow(season))
      const nextDate = isCurrent && played.length === 0
        ? await fetchNextSessionDate(season.start > asOf ? season.start : asOf)
        : null
      if (id === request.current) setTagged({ key, status: { kind: 'ready', played, nextDate } })
    } catch (error) {
      console.error('[leaderboard] season status failed to load', error)
      if (id === request.current) setTagged({ key, status: { kind: 'error' } })
    }
  }, [key, season, isCurrent, asOf])

  useEffect(() => { load() }, [load])

  return { status: tagged.key === key ? tagged.status : { kind: 'loading' }, retry: load }
}
