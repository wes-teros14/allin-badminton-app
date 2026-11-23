import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { countSessions, tallyCheers, tallyHeadToHead, tallyPlayerGames } from '@/lib/seasonTally'
import type { AttendanceRow, CheerRow, SeasonMatchRow } from '@/lib/seasonData'

const result = (winning_pair_index: number, game_number: number | null = 1) => ({
  id: `r${winning_pair_index}-${game_number}`,
  winning_pair_index,
  game_number,
  completed_at: '2026-11-21T10:00:00Z',
})

const match = (
  results: ReturnType<typeof result>[],
  players: [string, string, string, string] = ['A', 'B', 'C', 'D'],
): SeasonMatchRow => ({
  id: 'm1',
  team1_player1_id: players[0],
  team1_player2_id: players[1],
  team2_player1_id: players[2],
  team2_player2_id: players[3],
  match_results: results,
  sessions: { date: '2026-11-21', status: 'complete' },
})

const reg = (sessionId: string, sessionDate: string, playerId = 'A'): AttendanceRow => ({
  sessionId,
  sessionDate,
  playerId,
  source: 'self',
  registeredAt: '2026-11-01T00:00:00Z',
})

describe('tallyPlayerGames', () => {
  it('counts one game per result row', () => {
    const t = tallyPlayerGames([match([result(1, 1), result(2, 2)])])
    for (const id of ['A', 'B', 'C', 'D']) expect(t.get(id)).toEqual({ games: 2, wins: 1 })
  })

  it('credits team 2 when the single result is winning_pair_index 2', () => {
    const t = tallyPlayerGames([match([result(2)])])
    expect(t.get('C')).toEqual({ games: 1, wins: 1 })
    expect(t.get('A')).toEqual({ games: 1, wins: 0 })
  })

  it('ignores a match with no results', () => {
    expect(tallyPlayerGames([match([])]).size).toBe(0)
  })

  it('adds up across matches', () => {
    const t = tallyPlayerGames([match([result(1)]), match([result(2)], ['A', 'C', 'B', 'D'])])
    expect(t.get('A')).toEqual({ games: 2, wins: 1 })
  })
})

describe('countSessions', () => {
  const all = { start: null, end: null }

  it('counts a player registered twice for one session once', () => {
    expect(countSessions([reg('s1', '2026-11-21'), reg('s1', '2026-11-21')], all).get('A')).toBe(1)
  })

  it('includes the start date and excludes the day before', () => {
    const w = { start: '2026-11-21', end: '2027-11-21' }
    const n = countSessions([reg('s1', '2026-11-21'), reg('s0', '2026-11-20')], w)
    expect(n.get('A')).toBe(1)
  })

  it('excludes the end date', () => {
    const w = { start: '2026-11-21', end: '2027-11-21' }
    expect(countSessions([reg('s1', '2027-11-21')], w).has('A')).toBe(false)
  })

  it('applies the filter', () => {
    const rows = [reg('s1', '2026-11-21'), { ...reg('s2', '2026-11-22'), source: 'admin' }]
    expect(countSessions(rows, all, (r) => r.source === 'admin').get('A')).toBe(1)
  })
})

describe('tallyCheers', () => {
  const cheer = (slug: CheerRow['slug'], weight: number, giverId = 'G', receiverId = 'R'): CheerRow => ({
    id: `${slug}-${weight}-${giverId}`,
    giverId,
    receiverId,
    slug,
    weight,
  })

  it('weights a defense cheer of 3', () => {
    const t = tallyCheers([cheer('defense', 3)])
    expect(t.get('R')).toMatchObject({ cheers_received: 3, defense_received: 3, offense_received: 0 })
  })

  it('weights cheers given and keeps giver and receiver separate', () => {
    const t = tallyCheers([cheer('offense', 2), cheer('solid_effort', 1)])
    expect(t.get('G')).toMatchObject({ cheers_given: 3, cheers_received: 0 })
    expect(t.get('R')).toMatchObject({ cheers_given: 0, cheers_received: 3, solid_effort_received: 1 })
  })
})

describe('tallyHeadToHead', () => {
  it('records the partner for a win and the winners as opponents for a loss', () => {
    const m = [match([result(1)])]
    const a = tallyHeadToHead(m, 'A')
    expect(a.partners.get('B')).toBe(1)
    expect(a.opponents.size).toBe(0)
    const c = tallyHeadToHead(m, 'C')
    expect(c.opponents.get('A')).toBe(1)
    expect(c.opponents.get('B')).toBe(1)
    expect(c.partners.size).toBe(0)
  })

  it('counts each game of a split match separately', () => {
    const h = tallyHeadToHead([match([result(1, 1), result(2, 2)])], 'A')
    expect(h.partners.get('B')).toBe(1)
    expect(h.opponents.get('C')).toBe(1)
    expect(h.opponents.get('D')).toBe(1)
  })

  it('ignores matches the player was not in', () => {
    const h = tallyHeadToHead([match([result(1)])], 'Z')
    expect(h.partners.size + h.opponents.size).toBe(0)
  })
})
