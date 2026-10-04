/**
 * 🐦 Registration Early Bird — a points race (chosen 2026-10-04, option C in
 * temporary_files/early-bird-top5-options.html).
 *
 * In each of the last EARLY_BIRD_WINDOW finished sessions, the first
 * EARLY_BIRD_SCORED players who registered *themselves* score 5, 4, 3, 2, 1.
 * Totals are summed; ties go to whoever was 1st more often, and a tie on both
 * shares the place. The top EARLY_BIRD_PLACES are shown.
 *
 * It replaced "first to register for the session with the latest date", which
 * picked the furthest-future open session (weeks away, two sign-ups) and so
 * changed hands every time a session was created.
 */
export const EARLY_BIRD_WINDOW = 8
export const EARLY_BIRD_SCORED = 5
export const EARLY_BIRD_PLACES = 3

export interface EarlyBirdRegistration {
  sessionId: string
  playerId: string
  registeredAt: string
}

export interface EarlyBirdEntry {
  playerId: string
  points: number
  firsts: number
  /** 1-based; equal for a full tie. */
  place: number
}

/**
 * Pure scoring. `excluded` players are removed BEFORE places are counted, so
 * the people behind them move up — an excluded player must not occupy a place.
 */
export function rankEarlyBirds(
  registrations: EarlyBirdRegistration[],
  excluded: ReadonlySet<string> = new Set(),
  places = EARLY_BIRD_PLACES,
): EarlyBirdEntry[] {
  const bySession = new Map<string, EarlyBirdRegistration[]>()
  for (const r of registrations) {
    if (excluded.has(r.playerId)) continue
    const list = bySession.get(r.sessionId) ?? []
    list.push(r)
    bySession.set(r.sessionId, list)
  }

  const totals = new Map<string, { points: number; firsts: number }>()
  for (const list of bySession.values()) {
    const ordered = [...list].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
    ordered.slice(0, EARLY_BIRD_SCORED).forEach((r, index) => {
      const t = totals.get(r.playerId) ?? { points: 0, firsts: 0 }
      t.points += EARLY_BIRD_SCORED - index
      if (index === 0) t.firsts += 1
      totals.set(r.playerId, t)
    })
  }

  const sorted = [...totals.entries()]
    .map(([playerId, t]) => ({ playerId, ...t }))
    .sort((a, b) => b.points - a.points || b.firsts - a.firsts || a.playerId.localeCompare(b.playerId))

  // Dense places (1, 1, 2 — never 1, 1, 3) and a cut by places, not rows, like
  // every other board (lib/denseRank.ts).
  const ranked: EarlyBirdEntry[] = []
  sorted.forEach((e, i) => {
    const prev = ranked[i - 1]
    const place = !prev ? 1 : prev.points === e.points && prev.firsts === e.firsts ? prev.place : prev.place + 1
    ranked.push({ ...e, place })
  })
  return ranked.filter((e) => e.place <= places)
}
