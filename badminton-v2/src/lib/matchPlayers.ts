/**
 * Guardrails for the four player slots on a match.
 *
 * A match is 2v2: the four slots must hold four *different* players. Nothing in
 * the schema or the generator can produce a repeat, but the manual edit forms
 * (admin court view + generator panel) are four independent dropdowns over the
 * whole roster, so a mis-tap can put the same player on both sides of a team.
 * Every path that writes team1_player1_id..team2_player2_id runs through here.
 */

/** Ids that appear more than once, in first-seen order. Blank slots are ignored. */
export function findDuplicatePlayerIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []

  for (const id of ids) {
    if (!id) continue
    if (seen.has(id)) {
      if (!duplicates.includes(id)) duplicates.push(id)
    } else {
      seen.add(id)
    }
  }

  return duplicates
}

export type MatchPlayersValidation =
  | { ok: true }
  | { ok: false; duplicateIds: string[]; message: string }

/**
 * Validates the four slots of a single match.
 *
 * @param resolveName  Turns a player id into the label to show in the error.
 *                     Defaults to a generic label so the check still reads well
 *                     from call sites with no roster on hand.
 */
export function validateMatchPlayers(
  ids: readonly string[],
  resolveName: (id: string) => string = () => 'The same player',
): MatchPlayersValidation {
  const duplicateIds = findDuplicatePlayerIds(ids)
  if (duplicateIds.length === 0) return { ok: true }

  // Two ids can resolve to one label (generic default, or an unresolved name).
  const names = [...new Set(duplicateIds.map(resolveName))]
  const subject = names.length === 1
    ? `${names[0]} is`
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are`

  return {
    ok: false,
    duplicateIds,
    message: `${subject} in this match twice — all four slots must be different players.`,
  }
}

interface MatchSlots {
  team1Player1: string
  team1Player2: string
  team2Player1: string
  team2Player2: string
}

/**
 * Validates a whole schedule before it is written. Returns the first offending
 * match (1-based game number) so the admin gets a pointer, not just a rejection.
 */
export function validateSchedulePlayers(
  matches: readonly MatchSlots[],
  resolveName?: (id: string) => string,
): { ok: true } | { ok: false; gameNumber: number; duplicateIds: string[]; message: string } {
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const result = validateMatchPlayers(
      [m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2],
      resolveName,
    )
    if (!result.ok) {
      return {
        ok: false,
        gameNumber: i + 1,
        duplicateIds: result.duplicateIds,
        message: `Game ${i + 1}: ${result.message}`,
      }
    }
  }

  return { ok: true }
}
