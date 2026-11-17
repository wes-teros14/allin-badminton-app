/**
 * Opens sessions whose scheduled registration time has passed (D1, Neon
 * migration, owner 2026-11-16).
 *
 * On Supabase an hourly pg_cron job does this (migration 032). Neon's pg_cron
 * only runs while the database is awake, so instead the app asks the database
 * to do it when a player loads their sessions: the first person to look after
 * the set time opens it for everyone. The database function
 * `open_due_registrations()` (scripts/neon/transform.sql) is one idempotent
 * UPDATE; the sessions trigger then tells every open screen. Players still
 * cannot register early either way: the insert policy checks the time itself
 * (migration 034).
 *
 * At most once a minute per tab, callers share one request, and a failure is
 * only logged: loading the sessions must never wait on, or fail because of, it.
 */
export const OPEN_DUE_MIN_INTERVAL_MS = 60_000

export interface OpenDueDeps {
  /** Runs the database function, e.g. `supabase.rpc('open_due_registrations')`. */
  call: () => PromiseLike<{ error: unknown }>
  /** True only when data is on Neon; on Supabase pg_cron does the job. */
  enabled: boolean
  now?: () => number
  log?: (message: string, detail: unknown) => void
}

export function createOpenDueRegistrations(deps: OpenDueDeps): () => Promise<void> {
  const now = deps.now ?? Date.now
  const log = deps.log ?? ((message, detail) => console.warn(message, detail))
  let lastStarted = -Infinity
  let inFlight: Promise<void> | null = null

  return () => {
    if (!deps.enabled) return Promise.resolve()
    if (inFlight) return inFlight
    if (now() - lastStarted < OPEN_DUE_MIN_INTERVAL_MS) return Promise.resolve()
    lastStarted = now()
    inFlight = (async () => {
      try {
        const { error } = await deps.call()
        if (error) log('[openDueRegistrations] failed', error)
      } catch (error) {
        log('[openDueRegistrations] failed', error)
      } finally {
        inFlight = null
      }
    })()
    return inFlight
  }
}
