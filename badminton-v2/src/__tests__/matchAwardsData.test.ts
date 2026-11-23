import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { toHistory } from '@/lib/matchAwardsData'
import type { SeasonMatchRow } from '@/lib/seasonData'

function match(id: string, date: string): SeasonMatchRow {
  return {
    id,
    team1_player1_id: 'a',
    team1_player2_id: 'b',
    team2_player1_id: 'c',
    team2_player2_id: 'd',
    match_results: [{ id: `r-${id}`, winning_pair_index: 1, game_number: 1, completed_at: `${date}T20:00:00Z` }],
    sessions: { date, status: 'complete' },
  } as SeasonMatchRow
}

describe('toHistory', () => {
  it('replays a prior-season match for Odds but leaves it out of Win Streak', () => {
    const { matches, games } = toHistory([match('old', '2026-11-15')], '2026-11-16')
    expect(matches).toEqual([])
    expect(games).toHaveLength(1)
    expect(games[0].counts).toBe(false)
  })

  it('counts a match dated exactly on the season start', () => {
    const { matches, games } = toHistory([match('first', '2026-11-16')], '2026-11-16')
    expect(matches.map((m) => m.matchId)).toEqual(['first'])
    expect(games[0].counts).toBe(true)
  })

  it('counts everything when the season start is open', () => {
    const { matches, games } = toHistory([match('x', '2026-03-22')], null)
    expect(matches).toHaveLength(1)
    expect(games[0].counts).toBe(true)
  })
})
