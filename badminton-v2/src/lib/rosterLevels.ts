interface LevelledPlayer {
  level: number | null
  profileLevel: number | null
}

/**
 * Rows whose session level no longer matches /players. A player with no
 * profile level is never included — there is nothing to reset them to, and
 * blanking their level would only make the generator refuse to run.
 */
export function playersWithStaleLevel<T extends LevelledPlayer>(players: readonly T[]): T[] {
  return players.filter((p) => p.profileLevel != null && p.level !== p.profileLevel)
}
