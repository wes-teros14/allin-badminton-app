import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
import { resolvePastSeason, whereYouFinished } from '@/lib/yearInReview'
import type { CheerLeaderboardEntry, LeaderboardEntry, PairLeaderboardEntry } from '@/lib/leaderboardData'

const TODAY = '2026-11-19'

describe('resolvePastSeason', () => {
  it('is null for the current season', () => {
    expect(resolvePastSeason('2027', TODAY)).toBeNull()
  })

  it('is null for a season that does not exist', () => {
    expect(resolvePastSeason('2025', TODAY)).toBeNull()
    expect(resolvePastSeason('all', TODAY)).toBeNull()
  })

  it('is null without an id', () => {
    expect(resolvePastSeason(undefined, TODAY)).toBeNull()
  })

  it('resolves a past season', () => {
    expect(resolvePastSeason('2026', TODAY)?.id).toBe('2026')
  })

  it('is null for 2026 while 2026 is still the current season', () => {
    expect(resolvePastSeason('2026', '2026-11-15')).toBeNull()
  })
})

function win(playerId: string, rank: number, winRate: number): LeaderboardEntry {
  return { rank, playerId, displayName: playerId, avatarUrl: null, wins: 1, losses: 1, winRate }
}

function pair(rank: number, a: string, b: string): PairLeaderboardEntry {
  return {
    rank,
    key: `${a}|${b}`,
    players: [
      { id: a, displayName: `${a} name`, avatarUrl: null },
      { id: b, displayName: `${b} name`, avatarUrl: null },
    ],
    wins: 3,
    losses: 1,
    games: 4,
    winRate: 75,
  }
}

function cheer(id: string, counts: { offense?: number; defense?: number }, total = 20): CheerLeaderboardEntry {
  return {
    player_id: id,
    displayName: id,
    cheers_received: total,
    cheers_given: 0,
    offense_received: counts.offense ?? 0,
    defense_received: counts.defense ?? 0,
    technique_received: 0,
    movement_received: 0,
    good_sport_received: 0,
    solid_effort_received: 0,
  }
}

describe('whereYouFinished', () => {
  it('lists each board the player placed on, naming the partner', () => {
    const rows = whereYouFinished('me', {
      wins: [win('a', 1, 70), win('me', 4, 55)],
      pairs: [pair(1, 'a', 'b'), pair(2, 'raj', 'me'), pair(5, 'me', 'kim')],
      // Defense: me 31% is 1st. Offense: x leads.
      cheers: [cheer('me', { defense: 31, offense: 2 }, 100), cheer('x', { offense: 10, defense: 5 })],
    })
    expect(rows).toEqual([
      { board: 'Individual', detail: '4th · 55%' },
      { board: 'Partners', detail: '2nd with raj name' },
      { board: 'Cheers · Iron Defense', detail: '1st · 31%' },
    ])
  })

  it('leaves out a board on which the player is unplaced', () => {
    const rows = whereYouFinished('me', {
      wins: [win('a', 1, 70)],
      pairs: [pair(1, 'raj', 'me')],
      cheers: [cheer('x', { offense: 10 })],
    })
    expect(rows).toEqual([{ board: 'Partners', detail: '1st with raj name' }])
  })

  it('is empty when the player placed nowhere', () => {
    expect(whereYouFinished('me', { wins: [], pairs: [], cheers: [] })).toEqual([])
  })
})
