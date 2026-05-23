import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  computeStatsFromResults,
  getLegacyWinningPairIndex,
  isSplitMatchScoringEnabled,
  normalizeMatchResult,
  sortMatchResults,
  submitSplitResult,
} from '@/lib/matchResults'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}))

describe('match result compatibility helpers', () => {
  it('treats missing split scoring flags as disabled', () => {
    expect(isSplitMatchScoringEnabled(null)).toBe(false)
    expect(isSplitMatchScoringEnabled({})).toBe(false)
    expect(isSplitMatchScoringEnabled({ split_match_scoring: null })).toBe(false)
    expect(isSplitMatchScoringEnabled({ split_match_scoring: false })).toBe(false)
    expect(isSplitMatchScoringEnabled({ split_match_scoring: true })).toBe(true)
  })

  it('normalizes legacy rows to game 1', () => {
    expect(normalizeMatchResult({ winning_pair_index: 2 })).toEqual({
      winning_pair_index: 2,
      game_number: 1,
    })
  })

  it('sorts results by game number', () => {
    expect(sortMatchResults([
      { winning_pair_index: 2, game_number: 2 },
      { winning_pair_index: 1 },
      { winning_pair_index: 1, game_number: 3 },
    ])).toEqual([
      { winning_pair_index: 1, game_number: 1 },
      { winning_pair_index: 2, game_number: 2 },
      { winning_pair_index: 1, game_number: 3 },
    ])
  })

  it('keeps current one-game winner semantics by reading the earliest game', () => {
    expect(getLegacyWinningPairIndex([{ winning_pair_index: 2 }])).toBe(2)
    expect(getLegacyWinningPairIndex([
      { winning_pair_index: 2, game_number: 2 },
      { winning_pair_index: 1, game_number: 1 },
    ])).toBe(1)
    expect(getLegacyWinningPairIndex([])).toBeNull()
  })

  it('aggregates legacy one-game results as one game for all four players', () => {
    const stats = computeStatsFromResults({
      team1_player1_id: 'p1',
      team1_player2_id: 'p2',
      team2_player1_id: 'p3',
      team2_player2_id: 'p4',
      match_results: [{ winning_pair_index: 1 }],
    })

    expect(stats.get('p1')).toEqual({ wins: 1, games: 1 })
    expect(stats.get('p2')).toEqual({ wins: 1, games: 1 })
    expect(stats.get('p3')).toEqual({ wins: 0, games: 1 })
    expect(stats.get('p4')).toEqual({ wins: 0, games: 1 })
  })

  it('aggregates 2-0 split results as two wins for the winning team', () => {
    const stats = computeStatsFromResults({
      team1_player1_id: 'p1',
      team1_player2_id: 'p2',
      team2_player1_id: 'p3',
      team2_player2_id: 'p4',
      match_results: [
        { winning_pair_index: 2, game_number: 2 },
        { winning_pair_index: 2, game_number: 1 },
      ],
    })

    expect(stats.get('p1')).toEqual({ wins: 0, games: 2 })
    expect(stats.get('p2')).toEqual({ wins: 0, games: 2 })
    expect(stats.get('p3')).toEqual({ wins: 2, games: 2 })
    expect(stats.get('p4')).toEqual({ wins: 2, games: 2 })
  })

  it('aggregates 1-1 split results as one win each across two games', () => {
    const stats = computeStatsFromResults({
      team1_player1_id: 'p1',
      team1_player2_id: 'p2',
      team2_player1_id: 'p3',
      team2_player2_id: 'p4',
      match_results: [
        { winning_pair_index: 1, game_number: 1 },
        { winning_pair_index: 2, game_number: 2 },
      ],
    })

    expect(stats.get('p1')).toEqual({ wins: 1, games: 2 })
    expect(stats.get('p2')).toEqual({ wins: 1, games: 2 })
    expect(stats.get('p3')).toEqual({ wins: 1, games: 2 })
    expect(stats.get('p4')).toEqual({ wins: 1, games: 2 })
  })
})

describe('submitSplitResult', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('inserts 2 rows both for team 1 on 2-0-t1', async () => {
    const { supabase } = await import('@/lib/supabase')
    const insertMock = vi.fn(() => Promise.resolve({ error: null }))
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ insert: insertMock })

    await submitSplitResult('match-1', '2-0-t1')

    expect(insertMock).toHaveBeenCalledWith([
      { match_id: 'match-1', winning_pair_index: 1, game_number: 1 },
      { match_id: 'match-1', winning_pair_index: 1, game_number: 2 },
    ])
  })

  it('inserts 2 rows both for team 2 on 2-0-t2', async () => {
    const { supabase } = await import('@/lib/supabase')
    const insertMock = vi.fn(() => Promise.resolve({ error: null }))
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ insert: insertMock })

    await submitSplitResult('match-1', '2-0-t2')

    expect(insertMock).toHaveBeenCalledWith([
      { match_id: 'match-1', winning_pair_index: 2, game_number: 1 },
      { match_id: 'match-1', winning_pair_index: 2, game_number: 2 },
    ])
  })

  it('inserts game 1 = pair 1, game 2 = pair 2 on 1-1', async () => {
    const { supabase } = await import('@/lib/supabase')
    const insertMock = vi.fn(() => Promise.resolve({ error: null }))
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ insert: insertMock })

    await submitSplitResult('match-1', '1-1')

    expect(insertMock).toHaveBeenCalledWith([
      { match_id: 'match-1', winning_pair_index: 1, game_number: 1 },
      { match_id: 'match-1', winning_pair_index: 2, game_number: 2 },
    ])
  })
})
