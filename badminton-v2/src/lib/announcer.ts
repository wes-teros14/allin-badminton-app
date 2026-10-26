/**
 * The court announcer's decisions, kept pure so they are tested in node.
 *
 * The live board reloads its courts on every realtime change and poll, building
 * new objects each time, so "a game started" is detected by comparing each
 * court's current match id with the last one seen — never by object identity.
 */

export interface AnnouncerCourt {
  courtNumber: number
  current: { id: string; team1: { id: string }[]; team2: { id: string }[] } | null
}

export interface NewGame {
  courtNumber: number
  team1: [string, string]
  team2: [string, string]
}

/** Last match id seen on each court. */
export type SeenGames = Map<number, string | null>

export const PHRASE_KEYS = {
  court: 'phrase:court',
  number: (n: number) => `phrase:number-${n}`,
  and: 'phrase:and',
  versus: 'phrase:versus',
} as const

/**
 * "Court" and each number are separate clips, so any court reads as "Court" +
 * its number: 11 recordings in all instead of one per court (owner, 2026-10-26).
 * A court above 9 has no number clip, so its call uses the computer voice.
 */
export const ANNOUNCER_COURT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export function snapshot(courts: readonly AnnouncerCourt[]): SeenGames {
  return new Map(courts.map((c) => [c.courtNumber, c.current?.id ?? null]))
}

/**
 * Games that started since `prev`. With `prev === null` (the board just opened,
 * or was reloaded) nothing is announced: those games began before anyone was
 * listening, and calling every court at once would be noise.
 */
export function detectNewGames(prev: SeenGames | null, courts: readonly AnnouncerCourt[]): NewGame[] {
  if (prev === null) return []
  const started: NewGame[] = []
  for (const court of courts) {
    const current = court.current
    if (!current || prev.get(court.courtNumber) === current.id) continue
    started.push({
      courtNumber: court.courtNumber,
      team1: [current.team1[0].id, current.team1[1].id],
      team2: [current.team2[0].id, current.team2[1].id],
    })
  }
  return started
}

/** "Court … 2 … AJ … and … Jaz … versus … Sim … and … Kurt", as clip keys. */
export function buildCall(game: NewGame): string[] {
  return [
    PHRASE_KEYS.court, PHRASE_KEYS.number(game.courtNumber),
    game.team1[0], PHRASE_KEYS.and, game.team1[1],
    PHRASE_KEYS.versus,
    game.team2[0], PHRASE_KEYS.and, game.team2[1],
  ]
}
