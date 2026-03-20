import type { GeneratedMatch } from '@/lib/matchGenerator'

/** Returns the 4 player IDs in a match. */
export function getPlayersInMatch(m: GeneratedMatch): string[] {
  return [m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2]
}

/** Returns a map of playerId → total games played across all matches. */
export function countGamesPerPlayer(matches: GeneratedMatch[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const m of matches) {
    for (const id of getPlayersInMatch(m)) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * For each player, computes run-lengths of consecutive appearances.
 * Returns Map<playerId, number[]> where each number is the length of a streak.
 * E.g. if a player plays games 1,2,3 then sits out, then plays 5,6 → [3, 2]
 */
export function buildStreakHistory(matches: GeneratedMatch[]): Map<string, number[]> {
  const playerIds = new Set(matches.flatMap(getPlayersInMatch))
  const history = new Map<string, number[]>()
  const currentStreak = new Map<string, number>()

  for (const id of playerIds) {
    history.set(id, [])
    currentStreak.set(id, 0)
  }

  for (const m of matches) {
    const playing = new Set(getPlayersInMatch(m))
    for (const id of playerIds) {
      if (playing.has(id)) {
        currentStreak.set(id, (currentStreak.get(id) ?? 0) + 1)
      } else {
        const s = currentStreak.get(id) ?? 0
        if (s > 0) history.get(id)!.push(s)
        currentStreak.set(id, 0)
      }
    }
  }

  // flush remaining streaks
  for (const id of playerIds) {
    const s = currentStreak.get(id) ?? 0
    if (s > 0) history.get(id)!.push(s)
  }

  return history
}

/**
 * Returns a map of "id1|id2" (sorted) → number of times they were on the same team.
 */
export function buildPartnerPairCounts(matches: GeneratedMatch[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const m of matches) {
    for (const pair of [
      [m.team1Player1, m.team1Player2],
      [m.team2Player1, m.team2Player2],
    ]) {
      const key = [...pair].sort().join('|')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * For each match, computes the max-min level spread across the 4 players.
 */
export function computeSpreadPerMatch(
  matches: GeneratedMatch[],
  levelMap: Map<string, number>,
): number[] {
  return matches.map((m) => {
    const levels = getPlayersInMatch(m).map((id) => levelMap.get(id) ?? 5)
    return Math.max(...levels) - Math.min(...levels)
  })
}
