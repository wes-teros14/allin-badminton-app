import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { selectEligible } from '@/lib/boardEligibility'
import { rankPairs, tallyPairs, type PairTallyMatch } from '@/lib/pairStats'

describe('selectEligible', () => {
  it('keeps players who are seasoned and registered recently', () => {
    const eligible = selectEligible({ seasoned: ['a', 'b', 'c'], recentRegistrants: ['a', 'c', 'd'], guests: [] })
    expect([...eligible].sort()).toEqual(['a', 'c'])
  })

  it('drops a guest account even when it passes the other rules', () => {
    const eligible = selectEligible({ seasoned: ['a', 'guest'], recentRegistrants: ['a', 'guest'], guests: ['guest'] })
    expect([...eligible]).toEqual(['a'])
  })
})

describe('guest pairs on Partners', () => {
  it('drops a pair with the guest but keeps the real player’s other pairs', () => {
    const eligible = selectEligible({ seasoned: ['a', 'b', 'c', 'guest'], recentRegistrants: ['a', 'b', 'c', 'guest'], guests: ['guest'] })
    const game = (t1: [string, string], t2: [string, string]): PairTallyMatch => ({
      team1_player1_id: t1[0], team1_player2_id: t1[1], team2_player1_id: t2[0], team2_player2_id: t2[1],
      match_results: [{ winning_pair_index: 1, game_number: 1 }],
    })
    const matches = Array.from({ length: 3 }, () => [
      game(['a', 'guest'], ['b', 'c']),
      game(['a', 'b'], ['c', 'guest']),
    ]).flat()
    const pairs = rankPairs(tallyPairs(matches), { isEligiblePlayer: (id) => eligible.has(id) })
    const ids = pairs.map((p) => [p.playerA, p.playerB].sort().join('+'))
    expect(ids.some((k) => k.includes('guest'))).toBe(false)
    expect(ids).toContain('a+b')
  })
})
