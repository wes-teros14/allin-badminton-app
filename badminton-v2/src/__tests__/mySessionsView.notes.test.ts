import { describe, expect, it, vi } from 'vitest'
import { splitSessionNotes } from '@/views/MySessionsView'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

describe('splitSessionNotes', () => {
  it('splits a pipe-separated note into trimmed rules', () => {
    expect(splitSessionNotes('6 games | 21 pts/game | 1 set/game')).toEqual([
      '6 games',
      '21 pts/game',
      '1 set/game',
    ])
  })

  it('keeps commas and @ inside a single rule', () => {
    expect(splitSessionNotes('6 games | 1 new shuttle/game @ 1st 20 games, then 1 per 2 games')).toEqual([
      '6 games',
      '1 new shuttle/game @ 1st 20 games, then 1 per 2 games',
    ])
  })

  it('drops empty segments from trailing or doubled pipes', () => {
    expect(splitSessionNotes('6 games || 21 pts/game |')).toEqual(['6 games', '21 pts/game'])
  })

  it('returns null for prose, so the card falls back to plain text', () => {
    expect(splitSessionNotes('Please arrive fifteen minutes early, we start on time.')).toBeNull()
  })

  it('returns null when the pipes leave only one real rule', () => {
    expect(splitSessionNotes('| 6 games |')).toBeNull()
  })
})
