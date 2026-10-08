import { describe, expect, it } from 'vitest'
import { getEligibleSubstitutes, rankSubstitutes, togglePick } from '@/lib/substitutes'
import type { AdminMatchDisplay } from '@/hooks/useAdminSession'

function makeMatch(gameNumber: number, ids: [string, string, string, string]): AdminMatchDisplay {
  const [a, b, c, d] = ids
  return {
    id: `m${gameNumber}`,
    gameNumber,
    startedAt: null,
    t1p1Id: a, t1p1: a.toUpperCase(),
    t1p2Id: b, t1p2: b.toUpperCase(),
    t2p1Id: c, t2p1: c.toUpperCase(),
    t2p2Id: d, t2p2: d.toUpperCase(),
  }
}

const roster = (ids: string[]) => ids.map((id) => ({ id, displayName: id.toUpperCase() }))
const ids = (list: Array<{ id: string }>) => list.map((p) => p.id)

describe('getEligibleSubstitutes', () => {
  it('excludes players on court in any game, and the target game\'s own four', () => {
    const game5 = makeMatch(5, ['x', 'y', 'z', 'w'])
    const game12 = makeMatch(12, ['a', 'b', 'c', 'd']) // on court 2, not adjacent by number
    const eligible = getEligibleSubstitutes(game5, [game5, game12], [], roster(['a', 'b', 'c', 'd', 'e', 'f', 'x']))
    expect(ids(eligible)).toEqual(['e', 'f'])
  })

  it('on 2 courts, blocks the first queued game — not game N+1, which is already on court', () => {
    // Games 7 and 8 on court, 9 is next to start. The old rule blocked game 8
    // (no-op: already on court) and let game 9's players sub into game 7.
    const game7 = makeMatch(7, ['j', 'b', 'c', 'n'])
    const game8 = makeMatch(8, ['e', 'g', 'h', 'f'])
    const game9 = makeMatch(9, ['ana', 'ben', 'dan', 'leo'])
    const game10 = makeMatch(10, ['ivy', 'ned', 'mia', 'j'])
    const players = roster(['ana', 'dan', 'leo', 'ivy', 'mia', 'kim'])

    const eligible = getEligibleSubstitutes(game7, [game7, game8], [game9, game10], players)

    expect(ids(eligible)).toEqual(['ivy', 'kim', 'mia'])
  })

  it('for a queued game, blocks the queued games right before and right after it', () => {
    const onCourt = makeMatch(1, ['p', 'q', 'r', 's'])
    const g2 = makeMatch(2, ['a', 'b', 'c', 'd'])
    const g3 = makeMatch(3, ['x', 'y', 'z', 'w'])
    const g4 = makeMatch(4, ['e', 'f', 'g', 'h'])
    const g5 = makeMatch(5, ['i', 'j', 'k', 'l'])
    const players = roster(['a', 'e', 'i', 'm'])

    const eligible = getEligibleSubstitutes(g3, [onCourt], [g2, g3, g4, g5], players)

    expect(ids(eligible)).toEqual(['i', 'm'])
  })

  it('keeps players queued far ahead eligible', () => {
    const game5 = makeMatch(5, ['x', 'y', 'z', 'w'])
    const next = makeMatch(6, ['p', 'q', 'r', 's'])
    const later = makeMatch(99, ['a', 'b', 'c', 'd'])
    const eligible = getEligibleSubstitutes(game5, [game5], [next, later], roster(['a', 'b', 'p']))
    expect(ids(eligible)).toEqual(['a', 'b'])
  })
})

describe('rankSubstitutes', () => {
  const target = makeMatch(1, ['out', 'b', 'c', 'd'])
  const levels = new Map<string, number | null>([['out', 5], ['p', 5], ['q', 6], ['r', 4], ['s', 8], ['n', null]])

  function rank(over: Partial<Parameters<typeof rankSubstitutes>[0]> = {}) {
    return rankSubstitutes({
      target,
      eligible: roster(['p', 'q', 'r', 's']),
      allMatches: [target],
      queued: [],
      levels,
      outPlayerId: 'out',
      picks: [],
      ...over,
    })
  }

  it('ranks by closest level to the player who is out', () => {
    // q (+1) and r (−1) tie on level and everything else, so name decides.
    expect(ids(rank())).toEqual(['p', 'q', 'r', 's'])
    expect(rank()[0].levelGap).toBe(0)
  })

  it('puts admin picks first, in pick order, regardless of level', () => {
    expect(ids(rank({ picks: ['s', 'r'] }))).toEqual(['s', 'r', 'p', 'q'])
    expect(rank({ picks: ['s'] })[0].isPick).toBe(true)
  })

  it('breaks a level tie by fewest games tonight', () => {
    const extra = makeMatch(2, ['q', 'x', 'y', 'z']) // q has one more game than r
    expect(ids(rank({ allMatches: [target, extra], eligible: roster(['q', 'r']) }))).toEqual(['r', 'q'])
  })

  it('breaks a level + games tie by most rest; done for the night ranks best', () => {
    const soon = makeMatch(2, ['q', 'x1', 'x2', 'x3'])
    const late = makeMatch(6, ['r', 'y1', 'y2', 'y3'])
    const queued = [soon, makeMatch(3, ['a1', 'a2', 'a3', 'a4']), late]
    const eligible = roster(['q', 'r', 't'])
    const lv = new Map(levels).set('t', 6).set('r', 6) // q, r, t all 1 off
    // games tie at 1 each for q/r; give t one game so all three tie on games
    const tGame = makeMatch(0, ['t', 'z1', 'z2', 'z3'])
    const rows = rank({ queued, eligible, levels: lv, allMatches: [target, tGame, ...queued] })
    expect(ids(rows)).toEqual(['t', 'r', 'q'])
    expect(rows[0].nextGame).toBeNull()
    expect(rows[1].nextGame).toBe(6)
  })

  it('without a player marked out, level is ignored', () => {
    expect(ids(rank({ outPlayerId: null }))).toEqual(['p', 'q', 'r', 's'])
    expect(rank({ outPlayerId: null })[0].levelGap).toBeNull()
  })

  it('sorts an unknown level after every known one', () => {
    expect(ids(rank({ eligible: roster(['n', 's']) }))).toEqual(['s', 'n'])
  })

  it('counts games across finished, on-court and queued matches', () => {
    const rows = rank({
      eligible: roster(['p']),
      allMatches: [target, makeMatch(2, ['p', 'a', 'b', 'c']), makeMatch(3, ['p', 'd', 'e', 'f'])],
    })
    expect(rows[0].games).toBe(2)
  })
})

describe('togglePick', () => {
  it('adds, removes, and caps at 2', () => {
    expect(togglePick([], 'a')).toEqual(['a'])
    expect(togglePick(['a'], 'b')).toEqual(['a', 'b'])
    expect(togglePick(['a', 'b'], 'c')).toBeNull()
    expect(togglePick(['a', 'b'], 'a')).toEqual(['b'])
  })
})
