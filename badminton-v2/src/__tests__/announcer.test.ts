import { describe, expect, it } from 'vitest'
import { buildCall, detectNewGames, snapshot, type AnnouncerCourt } from '@/lib/announcer'

function court(courtNumber: number, matchId: string | null, players = ['a', 'b', 'c', 'd']): AnnouncerCourt {
  return {
    courtNumber,
    current: matchId
      ? { id: matchId, team1: [{ id: players[0] }, { id: players[1] }], team2: [{ id: players[2] }, { id: players[3] }] }
      : null,
  }
}

describe('detectNewGames', () => {
  it('announces nothing on first load, which also covers a reload', () => {
    expect(detectNewGames(null, [court(1, 'm1'), court(2, 'm2')])).toEqual([])
  })

  it('announces a new game on a court once', () => {
    const before = snapshot([court(1, 'm1'), court(2, 'm2')])
    const after = [court(1, 'm3', ['p', 'q', 'r', 's']), court(2, 'm2')]
    expect(detectNewGames(before, after)).toEqual([{ courtNumber: 1, team1: ['p', 'q'], team2: ['r', 's'] }])
    // The next poll returns the same courts: nothing new.
    expect(detectNewGames(snapshot(after), after)).toEqual([])
  })

  it('announces two courts that start together, in court order', () => {
    const before = snapshot([court(1, null), court(2, null)])
    const games = detectNewGames(before, [court(1, 'm1'), court(2, 'm2')])
    expect(games.map((g) => g.courtNumber)).toEqual([1, 2])
  })

  it('stays silent when a court empties', () => {
    expect(detectNewGames(snapshot([court(1, 'm1')]), [court(1, null)])).toEqual([])
  })

  it('announces a court that appears after the first load', () => {
    expect(detectNewGames(snapshot([court(1, 'm1')]), [court(1, 'm1'), court(2, 'm2')]).map((g) => g.courtNumber)).toEqual([2])
  })
})

describe('buildCall', () => {
  it('reads "Court", the number, team 1, versus, team 2', () => {
    expect(buildCall({ courtNumber: 2, team1: ['aj', 'jaz'], team2: ['sim', 'kurt'] })).toEqual([
      'phrase:court', 'phrase:number-2', 'aj', 'phrase:and', 'jaz', 'phrase:versus', 'sim', 'phrase:and', 'kurt',
    ])
  })
})
