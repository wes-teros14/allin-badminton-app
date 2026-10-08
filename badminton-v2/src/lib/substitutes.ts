import type { AdminMatchDisplay } from '@/hooks/useAdminSession'

export interface SubCandidate {
  id: string
  displayName: string
}

function playerIds(m: AdminMatchDisplay): string[] {
  return [m.t1p1Id, m.t1p2Id, m.t2p1Id, m.t2p2Id]
}

// The games that start right before and right after `target`, in start order.
// Start order is the queue (sorted by queue_position). A game on court has
// already started, so the game after it is simply the first queued one —
// NOT game N+1, which on 2 courts is usually on the other court already.
function neighbourGames(target: AdminMatchDisplay, queued: AdminMatchDisplay[]): AdminMatchDisplay[] {
  const idx = queued.findIndex((m) => m.id === target.id)
  if (idx === -1) return queued.slice(0, 1)
  return [queued[idx - 1], queued[idx + 1]].filter((m): m is AdminMatchDisplay => m != null)
}

// A player is excluded as a sub for `target` if they are: (1) on court right
// now in any game, (2) in the game that starts right before or right after it
// (pulling them in would mean back-to-back games), or (3) one of the target's
// own four. Everyone else in the roster is eligible.
export function getEligibleSubstitutes(
  target: AdminMatchDisplay,
  onCourt: AdminMatchDisplay[],
  queued: AdminMatchDisplay[],
  players: SubCandidate[],
): SubCandidate[] {
  const busy = new Set<string>(playerIds(target))
  for (const m of [...onCourt, ...neighbourGames(target, queued)]) {
    for (const id of playerIds(m)) busy.add(id)
  }
  return players
    .filter((p) => !busy.has(p.id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export interface RankedSub extends SubCandidate {
  isPick: boolean
  level: number | null
  /** |candidate level − level of the player who is out|; null when either is unknown or nobody is marked out. */
  levelGap: number | null
  /** Games tonight: finished + on court + queued. */
  games: number
  /** Game number of the candidate's own next game after `target`; null = done for the night. */
  nextGame: number | null
}

interface RankInput {
  target: AdminMatchDisplay
  eligible: SubCandidate[]
  /** Every match of the session: finished, on court and queued. */
  allMatches: AdminMatchDisplay[]
  queued: AdminMatchDisplay[]
  levels: Map<string, number | null>
  outPlayerId: string | null
  /** Admin's picks for the session, in pick order (max 2). */
  picks: string[]
}

// Ranking order (agreed with the owner, 2026-10-08):
//   1. admin picks, in pick order
//   2. closest level to the player who is out
//   3. fewest games tonight
//   4. most rest before their own next game (tie-break only)
// then name. A missing level sorts after every known one on rule 2.
export function rankSubstitutes(input: RankInput): RankedSub[] {
  const { target, eligible, allMatches, queued, levels, outPlayerId, picks } = input
  const outLevel = outPlayerId ? levels.get(outPlayerId) ?? null : null

  const targetIdx = queued.findIndex((m) => m.id === target.id)
  const after = queued.slice(targetIdx + 1) // targetIdx -1 (on court) → the whole queue

  const rows = eligible.map((p): RankedSub & { rest: number; pickIdx: number } => {
    const level = levels.get(p.id) ?? null
    const nextIdx = after.findIndex((m) => playerIds(m).includes(p.id))
    return {
      ...p,
      isPick: picks.includes(p.id),
      level,
      levelGap: outLevel != null && level != null ? Math.abs(level - outLevel) : null,
      games: allMatches.filter((m) => playerIds(m).includes(p.id)).length,
      nextGame: nextIdx === -1 ? null : after[nextIdx].gameNumber,
      rest: nextIdx === -1 ? Infinity : nextIdx,
      pickIdx: picks.includes(p.id) ? picks.indexOf(p.id) : Infinity,
    }
  })

  const gapKey = (r: RankedSub) => (outLevel == null ? 0 : r.levelGap ?? Infinity)

  rows.sort((a, b) =>
    a.pickIdx - b.pickIdx ||
    gapKey(a) - gapKey(b) ||
    a.games - b.games ||
    b.rest - a.rest ||
    a.displayName.localeCompare(b.displayName),
  )

  // Infinity - Infinity is NaN, which `||` treats as "tie" — the intended result.
  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    isPick: r.isPick,
    level: r.level,
    levelGap: r.levelGap,
    games: r.games,
    nextGame: r.nextGame,
  }))
}

/** Picks after toggling `id`; never more than 2. Returns null when the toggle would exceed the cap. */
export function togglePick(picks: string[], id: string): string[] | null {
  if (picks.includes(id)) return picks.filter((p) => p !== id)
  if (picks.length >= 2) return null
  return [...picks, id]
}
