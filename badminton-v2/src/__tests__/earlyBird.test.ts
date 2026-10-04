import { describe, expect, it } from 'vitest'
import { rankEarlyBirds, type EarlyBirdRegistration } from '@/lib/earlyBird'

/** Registrations for one session, in sign-up order. */
function session(id: string, players: string[]): EarlyBirdRegistration[] {
  return players.map((playerId, i) => ({
    sessionId: id,
    playerId,
    registeredAt: `2026-09-01T00:${String(i).padStart(2, '0')}:00Z`,
  }))
}

describe('rankEarlyBirds', () => {
  it('scores the first five 5-4-3-2-1 and sums across sessions', () => {
    const regs = [
      ...session('s1', ['a', 'b', 'c', 'd', 'e', 'f']),
      ...session('s2', ['b', 'a', 'c']),
    ]
    expect(rankEarlyBirds(regs, { places: 5 })).toEqual([
      { playerId: 'a', points: 9, firsts: 1, place: 1 },
      { playerId: 'b', points: 9, firsts: 1, place: 1 },
      { playerId: 'c', points: 6, firsts: 0, place: 2 },
      { playerId: 'd', points: 2, firsts: 0, place: 3 },
      { playerId: 'e', points: 1, firsts: 0, place: 4 },
    ])
  })

  it('uses dense places, so a shared 1st is followed by 2nd', () => {
    const regs = [
      ...session('s1', ['a', 'b', 'c']),
      ...session('s2', ['b', 'a', 'c']),
    ]
    expect(rankEarlyBirds(regs).map((e) => [e.playerId, e.place])).toEqual([['a', 1], ['b', 1], ['c', 2]])
  })

  it('orders by registration time, not by input order', () => {
    const regs: EarlyBirdRegistration[] = [
      { sessionId: 's1', playerId: 'late', registeredAt: '2026-09-02T00:00:00Z' },
      { sessionId: 's1', playerId: 'early', registeredAt: '2026-09-01T00:00:00Z' },
    ]
    expect(rankEarlyBirds(regs).map((e) => [e.playerId, e.points])).toEqual([['early', 5], ['late', 4]])
  })

  it('breaks a points tie on 1st places', () => {
    // x: 1st then 5th = 6 pts, 1 first. y: 3rd twice = 6 pts, 0 firsts.
    const regs = [
      ...session('s1', ['x', 'p', 'y', 'q', 'r']),
      ...session('s2', ['p', 'q', 'y', 'r', 'x']),
    ]
    const ranked = rankEarlyBirds(regs, { places: 5 })
    const x = ranked.find((e) => e.playerId === 'x')!
    const y = ranked.find((e) => e.playerId === 'y')!
    expect(x.points).toBe(y.points)
    expect(x.place).toBeLessThan(y.place)
  })

  it('removes excluded players before counting places', () => {
    // With the organiser first, "a" must still score 5, not 4.
    const regs = session('s1', ['organiser', 'a', 'b'])
    expect(rankEarlyBirds(regs, { excluded: new Set(['organiser']) })).toEqual([
      { playerId: 'a', points: 5, firsts: 1, place: 1 },
      { playerId: 'b', points: 4, firsts: 0, place: 2 },
    ])
  })

  it('keeps only the top places, including everyone sharing the last one', () => {
    const regs = [
      ...session('s1', ['a', 'b', 'c', 'd']),
      ...session('s2', ['a', 'b', 'd', 'c']),
    ]
    // c and d: 3+2 = 5 each, no firsts → both 3rd.
    expect(rankEarlyBirds(regs, { places: 3 }).map((e) => [e.playerId, e.place])).toEqual([
      ['a', 1], ['b', 2], ['c', 3], ['d', 3],
    ])
  })

  it('returns nothing without registrations', () => {
    expect(rankEarlyBirds([])).toEqual([])
  })
})

describe('rankEarlyBirds eligibility', () => {
  it('hides inactive players without handing their points to anyone', () => {
    // "gone" was 1st; "a" keeps 4 points for 2nd, it is not promoted to 5.
    const regs = session('s1', ['gone', 'a', 'b'])
    expect(rankEarlyBirds(regs, { eligible: new Set(['a', 'b']) })).toEqual([
      { playerId: 'a', points: 4, firsts: 0, place: 1 },
      { playerId: 'b', points: 3, firsts: 0, place: 2 },
    ])
  })
})
