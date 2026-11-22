import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { rankIndividual } from '@/lib/leaderboardData'

const profile = (id: string, is_active = true) => ({
  id,
  nickname: id,
  name_slug: id.toLowerCase(),
  avatar_url: null,
  is_active,
})

const tallies = (entries: Record<string, [games: number, wins: number]>) =>
  new Map(Object.entries(entries).map(([id, [games, wins]]) => [id, { games, wins }]))

const everyone = () => true

describe('rankIndividual', () => {
  it('gives two players on 67% the same rank 1', () => {
    const out = rankIndividual(
      tallies({ A: [3, 2], B: [6, 4], C: [4, 1] }),
      [profile('A'), profile('B'), profile('C')],
      everyone,
      { includeInactive: false },
    )
    expect(out.map((e) => [e.playerId, e.rank, e.winRate])).toEqual([
      ['B', 1, 67], // more wins settles the order inside the tie
      ['A', 1, 67],
      ['C', 2, 25],
    ])
    expect(out[0]).toMatchObject({ wins: 4, losses: 2 })
  })

  it('leaves out an inactive player unless includeInactive is true', () => {
    const t = tallies({ A: [4, 3], B: [4, 2] })
    const profiles = [profile('A', false), profile('B')]
    expect(rankIndividual(t, profiles, everyone, { includeInactive: false }).map((e) => e.playerId)).toEqual(['B'])
    expect(rankIndividual(t, profiles, everyone, { includeInactive: true }).map((e) => e.playerId)).toEqual(['A', 'B'])
  })

  it('applies include before ranking, so the next player takes place 1', () => {
    const out = rankIndividual(
      tallies({ A: [4, 4], B: [4, 3] }),
      [profile('A'), profile('B')],
      (id) => id !== 'A',
      { includeInactive: false },
    )
    expect(out.map((e) => [e.playerId, e.rank])).toEqual([['B', 1]])
  })

  it('skips a player with no profile and cuts to ten places', () => {
    const entries: Record<string, [number, number]> = { GHOST: [4, 4] }
    const profiles = []
    for (let i = 0; i < 12; i++) {
      const id = `P${String(i).padStart(2, '0')}`
      entries[id] = [10, 10 - i] // 12 distinct win rates
      profiles.push(profile(id))
    }
    const out = rankIndividual(tallies(entries), profiles, everyone, { includeInactive: false })
    expect(out).toHaveLength(10)
    expect(out.some((e) => e.playerId === 'GHOST')).toBe(false)
    expect(out[0].rank).toBe(1)
    expect(out[9].rank).toBe(10)
  })
})
