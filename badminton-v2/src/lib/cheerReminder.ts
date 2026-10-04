/**
 * Wording for the cheer reminder bar that "Cheer later" players get instead of
 * the full-page gate (migration 084). Several finished games stack into one bar.
 */

interface OwedMatch {
  gameNumber: number
  players: Array<{ playerId: string }>
  cheersGivenTo: string[]
}

/** Cheers still to give across every pending match. */
export function owedCheerCount(pending: OwedMatch[]): number {
  return pending.reduce(
    (sum, m) => sum + m.players.filter((p) => !m.cheersGivenTo.includes(p.playerId)).length,
    0,
  )
}

/**
 * "Game 3 done · 3 cheers to give" for one game, "2 games done · 6 cheers to give"
 * once they stack. Empty when nothing is owed.
 */
export function cheersReminderLabel(pending: OwedMatch[]): string {
  const owed = owedCheerCount(pending)
  if (pending.length === 0 || owed === 0) return ''
  const games = pending.length === 1 ? `Game ${pending[0].gameNumber} done` : `${pending.length} games done`
  return `${games} · ${owed} ${owed === 1 ? 'cheer' : 'cheers'} to give`
}
