import type { AdminMatchDisplay } from '@/hooks/useAdminSession'

// The "next game" after game N is normally N+1. Games 1 & 2 are the exception:
// they start simultaneously (first round, all courts empty), so the game that
// follows both of them is game 3.
export function nextGameNumber(gameNumber: number): number {
  return gameNumber <= 2 ? 3 : gameNumber + 1
}

// A player is excluded as a sub for game N if they are: (1) currently playing
// an in-progress match on any court (they're on court right now — they can't
// also sub into game N), (2) scheduled in the next game (see nextGameNumber —
// pulling them in would mean back-to-back games), or (3) one of game N's own
// players (passed via excludeIds). Everyone else in the roster is eligible.
export function getEligibleSubstitutes(
  targetGameNumber: number,
  currentlyPlayingMatches: AdminMatchDisplay[],
  allActiveMatches: AdminMatchDisplay[],
  players: Array<{ id: string; displayName: string }>,
  excludeIds: string[] = []
): Array<{ id: string; displayName: string }> {
  const busyPlayerIds = new Set<string>(excludeIds)

  // currently playing on any court right now
  for (const m of currentlyPlayingMatches) {
    for (const id of [m.t1p1Id, m.t1p2Id, m.t2p1Id, m.t2p2Id]) {
      busyPlayerIds.add(id)
    }
  }

  // scheduled in the next game
  const nextGame = allActiveMatches.find((m) => m.gameNumber === nextGameNumber(targetGameNumber))
  if (nextGame) {
    for (const id of [nextGame.t1p1Id, nextGame.t1p2Id, nextGame.t2p1Id, nextGame.t2p2Id]) {
      busyPlayerIds.add(id)
    }
  }

  return players
    .filter((p) => !busyPlayerIds.has(p.id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}
