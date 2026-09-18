/**
 * What the app has already told a player about their leaderboard standing.
 *
 * This is presentation history, not product data: "have we said this yet". It is
 * small, read once on launch, and worthless to anyone but the one device's user,
 * so it lives in localStorage rather than costing a table, a migration and an RLS
 * policy. The whole module is deliberately narrow so that swapping it for a
 * Supabase table later is a change to this file alone.
 *
 * Keys are namespaced per player id. That is not hypothetical tidiness — the dev
 * login panel switches between test players in one browser, and a snapshot
 * leaking between two accounts is a silently wrong answer rather than a crash.
 *
 * Every read is wrapped. Storage is unavailable in private mode, when a browser
 * blocks site data, and inside some in-app webviews; a celebration is never worth
 * failing a launch over, so all of those degrade to "no state".
 */

import type { BoardKey, RankSnapshot } from '@/lib/podiumCelebration'

/** Bumped only when the stored shape changes in a way a reader must notice. */
export const CELEBRATION_STATE_VERSION = 1

export interface SweepDebt {
  /** The board whose row still owes the player a sweep. */
  board: BoardKey
  /**
   * The sentinel this debt was created under. Expiry is then a comparison
   * rather than a timer: a debt from before the latest session has lapsed.
   */
  sentinel: string
}

export interface PlayerCelebrationState {
  version: number
  /** Standings as last shown to this player. */
  snapshot: RankSnapshot
  /** Best rank ever held per board, for the personal-best achievement. */
  bestEver: Partial<Record<BoardKey, number>>
  /** Latest session completion seen at the last evaluation. */
  sentinel: string | null
  sweepOwed: SweepDebt | null
}

const KEY_PREFIX = 'badminton-celebration:'

const keyFor = (playerId: string) => `${KEY_PREFIX}${playerId}`

export function emptyState(): PlayerCelebrationState {
  return {
    version: CELEBRATION_STATE_VERSION,
    snapshot: {},
    bestEver: {},
    sentinel: null,
    sweepOwed: null,
  }
}

/**
 * Returns null when this player has never been evaluated.
 *
 * Null and `emptyState()` mean different things and must not be conflated: null
 * triggers the silent first run, whereas an empty snapshot would treat every
 * current standing as newly won and congratulate the entire roster.
 */
export function readState(playerId: string): PlayerCelebrationState | null {
  if (!playerId) return null

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(keyFor(playerId))
  } catch {
    // Blocked or unavailable storage. Treated as "never evaluated", which is the
    // safe direction: the player misses a celebration rather than seeing a wrong
    // one, and nothing throws into the launch path.
    return null
  }
  if (raw === null) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PlayerCelebrationState>
    if (typeof parsed !== 'object' || parsed === null) return null
    if (parsed.version !== CELEBRATION_STATE_VERSION) {
      // A future shape change migrates here. Until then an unknown version is
      // treated as never evaluated, which costs one silent run and no wrong news.
      return null
    }
    return {
      version: CELEBRATION_STATE_VERSION,
      snapshot: parsed.snapshot ?? {},
      bestEver: parsed.bestEver ?? {},
      sentinel: parsed.sentinel ?? null,
      sweepOwed: parsed.sweepOwed ?? null,
    }
  } catch {
    return null
  }
}

/** Best effort. A failed write costs at most a repeated celebration next launch. */
export function writeState(playerId: string, state: PlayerCelebrationState): void {
  if (!playerId) return
  try {
    window.localStorage.setItem(keyFor(playerId), JSON.stringify(state))
  } catch {
    /* quota, private mode, blocked storage — never worth breaking the app for */
  }
}

/**
 * The sweep a player is still owed on a board, or null.
 *
 * A debt raised before the most recent session has lapsed: the shimmer should
 * always be about the latest result, never about something from three weeks ago.
 */
export function readSweepDebt(playerId: string, currentSentinel: string | null): SweepDebt | null {
  const state = readState(playerId)
  if (!state?.sweepOwed) return null
  if (currentSentinel !== null && state.sweepOwed.sentinel !== currentSentinel) return null
  return state.sweepOwed
}

/**
 * The same check, without needing a query to find the current sentinel.
 *
 * The stored sentinel is by definition the most recent completion this player's
 * app has seen, so a debt raised under an older one has already lapsed. That lets
 * the leaderboard ask "do I owe this player a sweep" for free, which matters
 * because it asks on every mount.
 */
export function readCurrentSweepDebt(playerId: string): SweepDebt | null {
  const state = readState(playerId)
  if (!state?.sweepOwed) return null
  if (state.sentinel !== null && state.sweepOwed.sentinel !== state.sentinel) return null
  return state.sweepOwed
}

export function clearSweepDebt(playerId: string): void {
  const state = readState(playerId)
  if (!state?.sweepOwed) return
  writeState(playerId, { ...state, sweepOwed: null })
}

/** Test seam. Removes one player's state without touching anyone else's. */
export function clearState(playerId: string): void {
  try {
    window.localStorage.removeItem(keyFor(playerId))
  } catch {
    /* nothing to do */
  }
}
