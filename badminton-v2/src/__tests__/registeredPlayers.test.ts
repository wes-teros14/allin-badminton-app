import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

import { buildRegisteredPlayers } from '@/hooks/useRegisteredPlayers'
import { buildRosterVersion } from '@/components/MatchGeneratorPanel'

describe('registered player helpers', () => {
  it('prefers session overrides over profile defaults', () => {
    expect(
      buildRegisteredPlayers(
        [
          { player_id: 'p1', gender: 'F', level: 7 },
        ],
        [
          { id: 'p1', name_slug: 'wes', nickname: 'Wes', gender: 'M', level: 4 },
        ]
      )
    ).toEqual([
      {
        id: 'p1',
        nameSlug: 'wes',
        nickname: 'Wes',
        gender: 'F',
        level: 7,
      },
    ])
  })

  it('falls back to profile values and player id when profile fields are missing', () => {
    expect(
      buildRegisteredPlayers(
        [
          { player_id: 'p1', gender: null, level: null },
          { player_id: 'p2', gender: null, level: null },
        ],
        [
          { id: 'p1', name_slug: 'alice', nickname: null, gender: 'F', level: 5 },
        ]
      )
    ).toEqual([
      {
        id: 'p1',
        nameSlug: 'alice',
        nickname: null,
        gender: 'F',
        level: 5,
      },
      {
        id: 'p2',
        nameSlug: 'p2',
        nickname: null,
        gender: null,
        level: null,
      },
    ])
  })

  it('builds a stable roster version regardless of player order', () => {
    const a = buildRosterVersion([
      { id: 'p2', gender: 'M', level: 4 },
      { id: 'p1', gender: 'F', level: 5 },
    ])
    const b = buildRosterVersion([
      { id: 'p1', gender: 'F', level: 5 },
      { id: 'p2', gender: 'M', level: 4 },
    ])

    expect(a).toBe(b)
  })

  it('changes roster version when a player override changes', () => {
    const before = buildRosterVersion([
      { id: 'p1', gender: 'F', level: 5 },
    ])
    const after = buildRosterVersion([
      { id: 'p1', gender: 'F', level: 6 },
    ])

    expect(after).not.toBe(before)
  })
})
