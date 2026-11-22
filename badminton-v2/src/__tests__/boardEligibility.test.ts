import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { boardPending, buildEligibility } from '@/lib/boardEligibility'
import { rankPairs, tallyPairs, type PairTallyMatch } from '@/lib/pairStats'

describe('buildEligibility', () => {
  const pool = (sessions: number, over: { recent?: string[]; guests?: string[] } = {}) =>
    buildEligibility({
      sessionCounts: new Map([['a', sessions]]),
      recentRegistrants: over.recent ?? ['a'],
      guests: over.guests ?? [],
    })

  it('qualifies a player with enough sessions and a recent registration', () => {
    expect(pool(3).qualifies('a', 3)).toBe(true)
  })

  it('does not qualify below the floor', () => {
    expect(pool(2).qualifies('a', 3)).toBe(false)
  })

  it('measures against the floor it is asked about', () => {
    expect(pool(3).qualifies('a', 4)).toBe(false)
  })

  it('drops a guest account even when it passes the other rules', () => {
    expect(pool(5, { guests: ['a'] }).qualifies('a', 3)).toBe(false)
  })

  it('drops a player who is not a recent registrant', () => {
    expect(pool(5, { recent: ['b'] }).qualifies('a', 3)).toBe(false)
  })

  it('reports 0 sessions for an unknown player', () => {
    expect(pool(3).sessionsInWindow('x')).toBe(0)
    expect(pool(3).sessionsInWindow('a')).toBe(3)
  })
})

describe('guest pairs on Partners', () => {
  it('drops a pair with the guest but keeps the real player’s other pairs', () => {
    const eligible = buildEligibility({
      sessionCounts: new Map([['a', 3], ['b', 3], ['c', 3], ['guest', 3]]),
      recentRegistrants: ['a', 'b', 'c', 'guest'],
      guests: ['guest'],
    })
    const game = (t1: [string, string], t2: [string, string]): PairTallyMatch => ({
      team1_player1_id: t1[0], team1_player2_id: t1[1], team2_player1_id: t2[0], team2_player2_id: t2[1],
      match_results: [{ winning_pair_index: 1, game_number: 1 }],
    })
    const matches = Array.from({ length: 3 }, () => [
      game(['a', 'guest'], ['b', 'c']),
      game(['a', 'b'], ['c', 'guest']),
    ]).flat()
    const pairs = rankPairs(tallyPairs(matches), { isEligiblePlayer: (id) => eligible.qualifies(id, 3) })
    const ids = pairs.map((p) => [p.playerA, p.playerB].sort().join('+'))
    expect(ids.some((k) => k.includes('guest'))).toBe(false)
    expect(ids).toContain('a+b')
  })
})

describe('boardPending', () => {
  const pool = buildEligibility({
    sessionCounts: new Map([['below', 2], ['met-not-recent', 5], ['in', 4], ['guest', 1], ['gone', 1]]),
    recentRegistrants: ['below', 'in', 'guest', 'gone'],
    guests: ['guest'],
  })
  const profiles = new Map([
    ['below', { is_guest: false, is_active: true }],
    ['met-not-recent', { is_guest: false, is_active: true }],
    ['in', { is_guest: false, is_active: true }],
    ['guest', { is_guest: true, is_active: true }],
    ['gone', { is_guest: false, is_active: false }],
  ])
  const players = ['below', 'met-not-recent', 'in', 'guest', 'gone']

  it('counts only players below the floor, never one held back by the recent-sessions rule', () => {
    expect(boardPending({ players, profiles, pool, floor: 3, isCurrent: true, viewerId: 'met-not-recent' }))
      .toEqual({ waiting: 1, viewerSessions: null })
  })

  it('gives the viewer their count only when they are below the floor', () => {
    expect(boardPending({ players, profiles, pool, floor: 3, isCurrent: true, viewerId: 'below' }))
      .toEqual({ waiting: 1, viewerSessions: 2 })
  })

  it('keeps inactive players for a past season, never guests', () => {
    expect(boardPending({ players, profiles, pool, floor: 3, isCurrent: false, viewerId: null }))
      .toEqual({ waiting: 2, viewerSessions: null })
  })
})
