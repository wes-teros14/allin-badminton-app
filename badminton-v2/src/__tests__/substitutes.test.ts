import { describe, expect, it } from 'vitest'
import { getEligibleSubstitutes } from '@/lib/substitutes'
import type { AdminMatchDisplay } from '@/hooks/useAdminSession'

function makeMatch(overrides: Partial<AdminMatchDisplay> & { gameNumber: number }): AdminMatchDisplay {
  return {
    id: `m${overrides.gameNumber}`,
    gameNumber: overrides.gameNumber,
    t1p1Id: 'a', t1p1: 'A',
    t1p2Id: 'b', t1p2: 'B',
    t2p1Id: 'c', t2p1: 'C',
    t2p2Id: 'd', t2p2: 'D',
    ...overrides,
  } as AdminMatchDisplay
}

const players = [
  { id: 'a', displayName: 'A' },
  { id: 'b', displayName: 'B' },
  { id: 'c', displayName: 'C' },
  { id: 'd', displayName: 'D' },
  { id: 'e', displayName: 'E' },
  { id: 'f', displayName: 'F' },
]

describe('getEligibleSubstitutes', () => {
  it('excludes players currently playing an in-progress match on another court', () => {
    // Game 5 is in progress on court 1 and needs a sub.
    const game5 = makeMatch({ gameNumber: 5, t1p1Id: 'x', t1p2Id: 'y', t2p1Id: 'z', t2p2Id: 'w' })
    // Game 12 is in progress right now on court 2 - not adjacent to game 5 by
    // number, so it's not "the next game", but its players are on court NOW.
    const game12 = makeMatch({ gameNumber: 12 })
    const currentlyPlaying = [game5, game12]
    const allActive = [game5, game12]

    const eligible = getEligibleSubstitutes(5, currentlyPlaying, allActive, players, ['x', 'y', 'z', 'w'])

    expect(eligible.map((p) => p.id)).not.toContain('a')
    expect(eligible.map((p) => p.id)).not.toContain('b')
    expect(eligible.map((p) => p.id)).not.toContain('c')
    expect(eligible.map((p) => p.id)).not.toContain('d')
    expect(eligible.map((p) => p.id)).toEqual(['e', 'f'])
  })

  it('still allows queued (not yet playing) players as subs', () => {
    const game5 = makeMatch({ gameNumber: 5, t1p1Id: 'x', t1p2Id: 'y', t2p1Id: 'z', t2p2Id: 'w' })
    // Queued far in the future (not "the next game" after 5, and not on court) -
    // its players are just waiting, so they remain eligible.
    const queuedGame99 = makeMatch({ gameNumber: 99 })
    const currentlyPlaying = [game5]
    const allActive = [game5, queuedGame99]

    const eligible = getEligibleSubstitutes(5, currentlyPlaying, allActive, players, ['x', 'y', 'z', 'w'])

    expect(eligible.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('still excludes players scheduled in the next game to avoid back-to-back games', () => {
    const game5 = makeMatch({ gameNumber: 5, t1p1Id: 'x', t1p2Id: 'y', t2p1Id: 'z', t2p2Id: 'w' })
    const nextGame = makeMatch({ gameNumber: 6, t1p1Id: 'a', t1p2Id: 'b', t2p1Id: 'e', t2p2Id: 'f' })
    const currentlyPlaying = [game5]
    const allActive = [game5, nextGame]

    const eligible = getEligibleSubstitutes(5, currentlyPlaying, allActive, players, ['x', 'y', 'z', 'w'])

    expect(eligible.map((p) => p.id)).toEqual(['c', 'd'])
  })
})
