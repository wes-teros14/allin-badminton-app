/**
 * Player name/avatar cache for the live-session hooks.
 *
 * `useCourtState` refreshes every 5 seconds (and again on every realtime ping),
 * and each refresh used to re-read the same ~16 profile rows. Those rows are
 * static for practically the whole session, so the fetch is pure waste — on the
 * kiosk tablet *and* on every player's phone, since `PlayerView` and
 * `SessionPlayerDetailView` mount the same hook.
 *
 * Two cases have to keep working, and they pull in opposite directions:
 *
 *   - A player *substituted* into a match mid-session arrives as an id nobody has
 *     seen. Fetching only the ids we are missing handles that by construction.
 *   - A player who *edits* their own nickname or avatar mid-session has an id we
 *     already hold, so "fetch only what's missing" would never re-read them and
 *     the change would never appear. Hence the TTL: caching forever is the
 *     version that quietly breaks.
 */

export interface CachedProfile {
  id: string
  name_slug: string
  nickname: string | null
  avatar_url: string | null
}

export interface ProfileCache {
  entries: Map<string, CachedProfile>
  /**
   * When the last *full* re-read completed, or null if there has never been one.
   *
   * Deliberately nullable rather than 0: "0" only reads as expired because
   * `Date.now()` is a large number, so the cold-start case would silently depend
   * on the clock's magnitude and break under any injected or small clock.
   */
  fetchedAt: number | null
}

/**
 * How long a cached profile is trusted before every row is re-read.
 *
 * At 60s against the 5s refresh, 11 of every 12 ticks skip the query entirely,
 * and the worst case for an edited nickname or avatar is a minute late rather
 * than never.
 */
export const PROFILE_CACHE_TTL_MS = 60_000

export interface ProfileFetchPlan {
  /** Ids to query. Empty means skip the round trip. */
  ids: string[]
  /** True when the TTL expired and every required id is being re-read. */
  isFullRefresh: boolean
}

export function createProfileCache(): ProfileCache {
  return { entries: new Map(), fetchedAt: null }
}

export function planProfileFetch(
  cache: ProfileCache,
  requiredIds: string[],
  nowMs: number,
  ttlMs: number = PROFILE_CACHE_TTL_MS,
): ProfileFetchPlan {
  const unique = [...new Set(requiredIds)]

  if (unique.length === 0) return { ids: [], isFullRefresh: false }

  // Never read, or expired — re-read everyone so an edited nickname or avatar propagates.
  if (cache.fetchedAt === null || nowMs - cache.fetchedAt >= ttlMs) {
    return { ids: unique, isFullRefresh: true }
  }

  // Still fresh — only ids never seen before, i.e. a substituted player.
  return { ids: unique.filter((id) => !cache.entries.has(id)), isFullRefresh: false }
}

/**
 * Fold fetched rows into the cache. Call this only when the query succeeded —
 * a failed fetch must not restart the TTL, or one dropped request would extend
 * the stale window by another minute.
 */
export function commitProfileFetch(
  cache: ProfileCache,
  rows: CachedProfile[],
  plan: ProfileFetchPlan,
  nowMs: number,
): void {
  for (const row of rows) {
    cache.entries.set(row.id, row)
  }

  // Only a full refresh restarts the clock. A partial top-up must not: a steady
  // trickle of substitutions would keep pushing the window out and an edited
  // profile would never be re-read.
  if (plan.isFullRefresh) cache.fetchedAt = nowMs
}
