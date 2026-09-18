/**
 * Decides whether this player has news, and hands the card what to say.
 *
 * The expensive part of the feature is knowing where a player stands, and the
 * cheap part is knowing whether that could have changed. This hook keeps those
 * apart: one small query answers "has any session completed since we last
 * looked", and only a yes buys the board computation behind it. On an ordinary
 * launch the whole feature costs a single indexed lookup.
 *
 * Failure here is always silent. A missed celebration is a disappointment; an
 * exception thrown into the launch path is a broken app.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { fetchLatestSessionCompletion, fetchPlayerStandings } from '@/lib/leaderboardData'
import {
  bestPlacing,
  newPodiumPlacings,
  type NewPlacing,
  type RankSnapshot,
} from '@/lib/podiumCelebration'
import {
  emptyState,
  readState,
  writeState,
  type PlayerCelebrationState,
} from '@/lib/celebrationStorage'

export interface CelebrationAnnouncement {
  /** Ordered best first. The first is the one the toast names. */
  achievements: NewPlacing[]
}

/** Best rank per board, folded over what we already knew. */
function mergeBestEver(
  previous: PlayerCelebrationState['bestEver'],
  standings: RankSnapshot,
): PlayerCelebrationState['bestEver'] {
  const next = { ...previous }
  for (const [board, rank] of Object.entries(standings)) {
    if (rank === null || rank === undefined) continue
    const key = board as keyof typeof next
    const known = next[key]
    if (known === undefined || rank < known) next[key] = rank
  }
  return next
}

export function useLeaderboardCelebration() {
  const { user } = useAuth()
  const playerId = user?.id ?? null

  const [announcement, setAnnouncement] = useState<CelebrationAnnouncement | null>(null)
  /** Guards against a second evaluation overlapping the first. */
  const running = useRef(false)

  const evaluate = useCallback(async () => {
    if (!playerId || running.current) return
    running.current = true

    try {
      const sentinel = await fetchLatestSessionCompletion()
      const stored = readState(playerId)

      // The common case, and the whole reason the sentinel exists: nothing has
      // completed since we last looked, so nothing can have moved.
      if (stored && stored.sentinel === sentinel) return

      const standings = await fetchPlayerStandings(playerId)

      // Never evaluated before. Record and say nothing — otherwise everyone who
      // already holds a place is congratulated for it on the day this ships.
      if (!stored) {
        writeState(playerId, {
          ...emptyState(),
          snapshot: standings,
          bestEver: mergeBestEver({}, standings),
          sentinel,
        })
        return
      }

      // bestEver is passed as it was *before* this evaluation: comparing the new
      // standing against a record that already includes it would mean nobody ever
      // sets a personal best.
      const placings = newPodiumPlacings(stored.snapshot, standings, stored.bestEver)
      const best = bestPlacing(placings)

      // The snapshot advances whether or not anything was celebrated. Skipping
      // it on a quiet evaluation would let the same news be found again later.
      writeState(playerId, {
        ...stored,
        snapshot: standings,
        bestEver: mergeBestEver(stored.bestEver, standings),
        sentinel,
        // Armed when the celebration is *shown*, not when the offer is accepted:
        // the player can also reach the board under their own steam, and both
        // routes must find the same debt waiting.
        sweepOwed: best && sentinel ? { board: best.board, sentinel } : stored.sweepOwed,
      })

      if (placings.length > 0) setAnnouncement({ achievements: placings })
    } catch {
      // A failed query, a rejected read, an offline launch. Nothing is shown and
      // nothing is recorded, so the next evaluation simply tries again.
    } finally {
      running.current = false
    }
  }, [playerId])

  useEffect(() => {
    if (!playerId) {
      setAnnouncement(null)
      return
    }

    void evaluate()

    // Returning to the app is the other moment worth checking — a session
    // finalised while the player was away should not wait for a cold start.
    const onVisible = () => { if (document.visibilityState === 'visible') void evaluate() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [playerId, evaluate])

  // Development trigger (FR-027). The natural trigger needs a real session to
  // complete *and* the first evaluation per player is deliberately silent, so
  // without a way in the feedback loop is a week long. Stripped from production
  // builds by the import.meta.env.DEV guard.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as Record<string, unknown>
    w.__celebrate = (
      achievements: NewPlacing[] = [{ board: 'wins', kind: 'podium', rank: 2, previousRank: 5 }],
    ) => {
      setAnnouncement({ achievements })
    }
    return () => { delete w.__celebrate }
  }, [])

  const dismiss = useCallback(() => setAnnouncement(null), [])

  return { announcement, dismiss }
}
