import { describe, it, expect } from 'vitest'
import { rankGiantSlayers, tallyUpsets, type SlayerGame } from '@/lib/giantSlayer'

let clock = 0
/** One game, team1 vs team2, recorded after every game made before it. */
function game(team1: [string, string], team2: [string, string], winner: 1 | 2, matchId?: string, gameNumber = 1): SlayerGame {
  clock += 1
  const id = `g${clock}`
  return {
    gameId: id,
    recordedAt: new Date(Date.UTC(2026, 0, 1, 0, clock)).toISOString(),
    matchId: matchId ?? `m${clock}`,
    gameNumber,
    team1,
    team2,
    winner,
  }
}

/** Gives a pair a record: `wins` wins then `losses` losses against fillers. */
function history(pair: [string, string], wins: number, losses: number): SlayerGame[] {
  return [
    ...Array.from({ length: wins }, () => game(pair, ['F1', 'F2'], 1)),
    ...Array.from({ length: losses }, () => game(pair, ['F1', 'F2'], 2)),
  ]
}

const opts = { gap: 0.2, minPriorGames: 4 }

describe('tallyUpsets', () => {
  it('scores an upset when the pair 20+ points weaker wins', () => {
    // A, B at 25% (1 of 4); C, D at 75% (3 of 4): a 50-point gap.
    const games = [...history(['A', 'B'], 1, 3), ...history(['C', 'D'], 3, 1), game(['A', 'B'], ['C', 'D'], 1)]
    const t = tallyUpsets(games, opts)
    expect(t.get('A')).toEqual({ upsets: 1, underdogGames: 1 })
    expect(t.get('C')).toBeUndefined()
  })

  it('counts a loss as the underdog as an underdog game without an upset', () => {
    const games = [...history(['A', 'B'], 1, 3), ...history(['C', 'D'], 3, 1), game(['A', 'B'], ['C', 'D'], 2)]
    expect(tallyUpsets(games, opts).get('A')).toEqual({ upsets: 0, underdogGames: 1 })
  })

  it('ignores a gap smaller than the threshold', () => {
    // 50% vs 50% + a bit: A, B 2 of 4; C, D 2 of 4.
    const games = [...history(['A', 'B'], 2, 2), ...history(['C', 'D'], 2, 2), game(['A', 'B'], ['C', 'D'], 1)]
    expect(tallyUpsets(games, opts).get('A')).toBeUndefined()
  })

  it('counts a gap of exactly 20 points', () => {
    // 40% vs 60%, from 5 games each.
    const games = [...history(['A', 'B'], 2, 3), ...history(['C', 'D'], 3, 2), game(['A', 'B'], ['C', 'D'], 1)]
    expect(tallyUpsets(games, opts).get('A')).toEqual({ upsets: 1, underdogGames: 1 })
  })

  it('skips a game while any player has fewer than 4 earlier games', () => {
    const games = [...history(['A', 'B'], 0, 3), ...history(['C', 'D'], 3, 1), game(['A', 'B'], ['C', 'D'], 1)]
    expect(tallyUpsets(games, opts).get('A')).toBeUndefined()
  })

  it('uses only games before this one, including the first game of the same match', () => {
    // Going in, A, B are 1 of 4 (25%) against 3 of 4 (75%). Winning game 1 moves
    // them to 2 of 5 (40%) and their opponents to 3 of 5 (60%) before game 2:
    // exactly 20 points, so game 2 is still an underdog game.
    const games = [
      ...history(['A', 'B'], 1, 3),
      ...history(['C', 'D'], 3, 1),
      game(['A', 'B'], ['C', 'D'], 1, 'split', 1),
      game(['A', 'B'], ['C', 'D'], 1, 'split', 2),
    ]
    expect(tallyUpsets(games, opts).get('A')).toEqual({ upsets: 2, underdogGames: 2 })
  })
})

describe('rankGiantSlayers', () => {
  const entry = (playerId: string, upsets: number, underdogGames: number, place: number) =>
    ({ playerId, upsets, underdogGames, place })

  /** A pair with a 25% record, then `played` games as the underdog, `won` of them won. */
  function underdogRun(pair: [string, string], won: number, played: number): SlayerGame[] {
    const out = [...history(pair, 1, 3)]
    // A 100% opponent pair keeps the gap well over 20 points throughout.
    out.push(...history(['X', 'Y'], 4, 0))
    for (let i = 0; i < played; i++) out.push(game(pair, ['X', 'Y'], i < won ? 1 : 2))
    return out
  }

  it('ranks by upset rate and shares a place on an equal rate', () => {
    // 1 of 3 and 2 of 6 are both a third: one place between them.
    const ranked = rankGiantSlayers([...underdogRun(['A', 'B'], 1, 3), ...underdogRun(['C', 'D'], 2, 6)], {
      ...opts,
      eligible: new Set(['A', 'C']),
    })
    expect(ranked).toEqual([entry('C', 2, 6, 1), entry('A', 1, 3, 1)])
  })

  it('needs 3 underdog games and at least one upset', () => {
    const ranked = rankGiantSlayers(
      [...underdogRun(['A', 'B'], 2, 2), ...underdogRun(['C', 'D'], 0, 5), ...underdogRun(['E', 'G'], 1, 3)],
      { ...opts, eligible: new Set(['A', 'C', 'E']) },
    )
    expect(ranked.map((e) => e.playerId)).toEqual(['E'])
  })

  it('leaves out players who are not eligible', () => {
    const ranked = rankGiantSlayers(underdogRun(['A', 'B'], 2, 4), { ...opts, eligible: new Set(['B']) })
    expect(ranked.map((e) => e.playerId)).toEqual(['B'])
  })
})
