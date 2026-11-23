export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

/**
 * Realtime pushes every change, so polling is only a safety net: slow while the
 * channel is subscribed (in case an event is dropped), fast only while it is
 * not. A fixed 5 s poll was about half of all database requests during the
 * Oct 4 2026 outage (docs/qa-log.html).
 */
export const POLL_CONNECTED_MS = 30_000
export const POLL_FALLBACK_MS = 5_000

export function pollIntervalFor(status: ConnectionStatus): number {
  return status === 'connected' ? POLL_CONNECTED_MS : POLL_FALLBACK_MS
}

/**
 * After a failed court reload, retry sooner than the 30 s safety poll — the
 * board is showing old data until a reload succeeds — but back off while the
 * failures continue. Every phone in the hall runs the same hook, so a flat
 * 5 s retry during a database stall would be the load that caused the
 * Oct 4 2026 outage. `failures` is how many reloads in a row have failed (1+).
 */
export const RETRY_BASE_MS = 5_000

export function retryDelayAfterFailures(failures: number): number {
  const n = Math.max(1, Math.trunc(failures) || 1)
  return Math.min(RETRY_BASE_MS * 2 ** (n - 1), POLL_CONNECTED_MS)
}

/**
 * Change events arrive in bursts: finishing one match writes the match row,
 * one or two result rows and promotes the next match, and every phone in the
 * hall receives the burst at the same moment. Coalescing waits for the burst
 * to settle; the jitter spreads the resulting refetches so a dozen phones do
 * not all hit the database in the same millisecond.
 */
export const COALESCE_MS = 300
export const JITTER_MS = 700

export function coalesceDelay(random: () => number = Math.random): number {
  return COALESCE_MS + random() * JITTER_MS
}

/**
 * Runs `run` once after `delay()` ms, however many times `schedule` is called
 * in the meantime. The first event of a burst starts the clock; the rest join it.
 */
export function createCoalescedRunner(run: () => void, delay: () => number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    schedule() {
      if (timer !== undefined) return
      timer = setTimeout(() => {
        timer = undefined
        run()
      }, delay())
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    },
  }
}

/**
 * My Profile re-reads the whole season (paged matches, attendance, cheers) on a "your stats changed"
 * message, and a recorded game sends several. Waiting longer than the court board's coalesce lets one
 * game's messages, and a quick run of games, collapse into one re-read; the jitter spreads the phones.
 */
export const PROFILE_COALESCE_MS = 4_000

export function profileRefreshDelay(random: () => number = Math.random): number {
  return PROFILE_COALESCE_MS + random() * JITTER_MS
}
