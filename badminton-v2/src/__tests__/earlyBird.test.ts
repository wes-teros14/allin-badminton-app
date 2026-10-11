import { describe, expect, it } from 'vitest'
import { rankEarlyBirds as rankWithMinimum, type EarlyBirdRegistration, type RankEarlyBirdsOptions } from '@/lib/earlyBird'

/** The scoring tests use small histories, so they lift the 8-session minimum unless they test it. */
const rankEarlyBirds = (regs: EarlyBirdRegistration[], opts: RankEarlyBirdsOptions = {}) => rankWithMinimum(regs, { minSessions: 1, ...opts })

/** Registrations for one session, in sign-up order. */
function session(id: string, players: string[]): EarlyBirdRegistration[] {
  return players.map((playerId, i) => ({
    sessionId: id,
    playerId,
    registeredAt: `2026-09-01T00:${String(i).padStart(2, '0')}:00Z`,
  }))
}

describe('rankEarlyBirds', () => {
  it('scores the first five 5-4-3-2-1 and averages over the sessions each player registered for', () => {
    const regs = [
      ...session('s1', ['a', 'b', 'c', 'd', 'e', 'f']),
      ...session('s2', ['b', 'a', 'c']),
    ]
    expect(rankEarlyBirds(regs, { places: 5 })).toEqual([
      { playerId: 'a', points: 9, firsts: 1, sessions: 2, average: 4.5, place: 1 },
      { playerId: 'b', points: 9, firsts: 1, sessions: 2, average: 4.5, place: 1 },
      { playerId: 'c', points: 6, firsts: 0, sessions: 2, average: 3, place: 2 },
      { playerId: 'd', points: 2, firsts: 0, sessions: 1, average: 2, place: 3 },
      { playerId: 'e', points: 1, firsts: 0, sessions: 1, average: 1, place: 4 },
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

  it('breaks an average tie on 1st places', () => {
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
      { playerId: 'a', points: 5, firsts: 1, sessions: 1, average: 5, place: 1 },
      { playerId: 'b', points: 4, firsts: 0, sessions: 1, average: 4, place: 2 },
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

  it('ranks the average, so coming more often does not win on its own', () => {
    // "often" is 2nd in every one of 4 sessions: 16 pts, 4.0 per session.
    // "early" is 1st in both of its 2 sessions: 10 pts, 5.0 per session.
    const regs = [
      ...session('s1', ['early', 'often']), ...session('s2', ['early', 'often']),
      ...session('s3', ['x', 'often']), ...session('s4', ['x', 'often']),
    ]
    expect(rankEarlyBirds(regs).map((e) => [e.playerId, e.average])).toEqual([['early', 5], ['x', 5], ['often', 4]])
  })

  it('counts a session with no points in the average', () => {
    const regs = [...session('s1', ['a']), ...session('s2', ['p', 'q', 'r', 's', 't', 'a'])]
    expect(rankEarlyBirds(regs).find((e) => e.playerId === 'a')).toMatchObject({ points: 5, sessions: 2, average: 2.5 })
  })

  it('needs 8 self-registered sessions by default', () => {
    const seven = Array.from({ length: 7 }, (_, i) => session(`s${i}`, ['a', 'b'])).flat()
    expect(rankWithMinimum(seven)).toEqual([])
    const eight = [...seven, ...session('s7', ['a', 'b'])]
    expect(rankWithMinimum(eight).map((e) => e.playerId)).toEqual(['a', 'b'])
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
      { playerId: 'a', points: 4, firsts: 0, sessions: 1, average: 4, place: 1 },
      { playerId: 'b', points: 3, firsts: 0, sessions: 1, average: 3, place: 2 },
    ])
  })
})
