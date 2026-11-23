import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/seasonData', () => ({ fetchCompletedSessions: vi.fn() }))
vi.mock('@/lib/leaderboardData', () => ({ fetchCheerLeaderboard: vi.fn() }))
vi.mock('@/lib/awardsLeaderboard', () => ({ fetchAwardsLeaderboard: vi.fn() }))
import { badgesFor, fetchSeasonBadges } from '@/lib/seasonBadges'
import { fetchCompletedSessions } from '@/lib/seasonData'
import { fetchCheerLeaderboard } from '@/lib/leaderboardData'
import { fetchAwardsLeaderboard } from '@/lib/awardsLeaderboard'
import { boardScope } from '@/lib/season'
import { awardBoard } from '@/lib/awardBoards'
import type { CheerLeaderboardEntry } from '@/lib/leaderboardData'
import type { AwardEntry, AwardRow } from '@/lib/awardsLeaderboard'

function cheer(id: string, offense: number, total = 20): CheerLeaderboardEntry {
  return {
    player_id: id,
    displayName: id,
    cheers_received: total,
    cheers_given: 0,
    offense_received: offense,
    defense_received: 0,
    technique_received: 0,
    movement_received: 0,
    good_sport_received: 0,
    solid_effort_received: 0,
  }
}

function award(key: Parameters<typeof awardBoard>[0], rows: Array<[string, number]>): AwardEntry {
  return {
    ...awardBoard(key),
    rule: '',
    unit: () => '',
    emptyText: '',
    rows: rows.map(([playerId, rank]): AwardRow => ({ playerId, name: playerId, value: 1, rank })),
  }
}

describe('badgesFor', () => {
  it('returns nothing while the early-season hold is on', () => {
    const awards = [award('win-streak', [['a', 1]])]
    expect(badgesFor('a', { cheerRows: [cheer('a', 10)], awards, unlocked: false })).toEqual([])
  })

  it('gives a cheer badge to the sole 1st place', () => {
    const rows = [cheer('a', 10), cheer('b', 5)]
    expect(badgesFor('a', { cheerRows: rows, awards: [], unlocked: true })).toEqual([
      { emoji: '⚔️', label: 'Top Offense' },
    ])
    expect(badgesFor('b', { cheerRows: rows, awards: [], unlocked: true })).toEqual([])
  })

  it('gives no cheer badge when a category is tied for 1st', () => {
    const rows = [cheer('a', 10), cheer('b', 10)]
    expect(badgesFor('a', { cheerRows: rows, awards: [], unlocked: true })).toEqual([])
    expect(badgesFor('b', { cheerRows: rows, awards: [], unlocked: true })).toEqual([])
  })

  it('shares the Most Sessions Joined badge between players tied for 1st', () => {
    const awards = [award('joined', [['a', 1], ['b', 1], ['c', 2]])]
    const joined = { emoji: '📅', label: 'Most Sessions Joined' }
    expect(badgesFor('a', { cheerRows: [], awards, unlocked: true })).toEqual([joined])
    expect(badgesFor('b', { cheerRows: [], awards, unlocked: true })).toEqual([joined])
    expect(badgesFor('c', { cheerRows: [], awards, unlocked: true })).toEqual([])
  })

  it('badges 1st place of early bird, win streak and giant slayer, but not the attendance streak', () => {
    const awards = [
      award('early-bird', [['a', 1]]),
      award('win-streak', [['a', 1]]),
      award('giant-slayer', [['a', 1]]),
      award('attendance-streak', [['a', 1]]),
    ]
    expect(badgesFor('a', { cheerRows: [], awards, unlocked: true })).toEqual([
      { emoji: '🐦', label: 'Registration Early Bird' },
      { emoji: '⚡', label: 'Win Streak' },
      { emoji: '🎲', label: 'Against the Odds' },
    ])
  })

  it('ignores 2nd place', () => {
    const awards = [award('win-streak', [['b', 1], ['a', 2]])]
    expect(badgesFor('a', { cheerRows: [], awards, unlocked: true })).toEqual([])
  })
})

describe('fetchSeasonBadges', () => {
  const played = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, date: '2026-11-22' }))
  const current = boardScope(null, '2026-12-20')
  const past = boardScope('2026', '2026-12-20')

  beforeEach(() => {
    vi.mocked(fetchCompletedSessions).mockReset()
    vi.mocked(fetchCheerLeaderboard).mockReset().mockResolvedValue([])
    vi.mocked(fetchAwardsLeaderboard).mockReset().mockResolvedValue([award('win-streak', [['a', 1]])])
  })

  it('holds the current season at 3 played sessions, without reading the boards', async () => {
    vi.mocked(fetchCompletedSessions).mockResolvedValue(played(3))
    expect(await fetchSeasonBadges('a', current)).toEqual({ badges: [], held: true })
    expect(fetchCheerLeaderboard).not.toHaveBeenCalled()
    expect(fetchAwardsLeaderboard).not.toHaveBeenCalled()
  })

  it('releases the hold at 4 played sessions', async () => {
    vi.mocked(fetchCompletedSessions).mockResolvedValue(played(4))
    expect(await fetchSeasonBadges('a', current)).toEqual({
      badges: [{ emoji: '⚡', label: 'Win Streak' }],
      held: false,
    })
  })

  it('never holds a past season', async () => {
    vi.mocked(fetchCompletedSessions).mockResolvedValue(played(0))
    expect(await fetchSeasonBadges('a', past)).toEqual({
      badges: [{ emoji: '⚡', label: 'Win Streak' }],
      held: false,
    })
    expect(fetchCompletedSessions).not.toHaveBeenCalled()
  })
})
