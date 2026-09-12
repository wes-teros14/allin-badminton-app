import { describe, it, expect } from 'vitest'
import { playersWithStaleLevel } from '@/lib/rosterLevels'

const row = (id: string, level: number | null, profileLevel: number | null) => ({ id, level, profileLevel })

describe('playersWithStaleLevel', () => {
  it('returns only rows whose level differs from the profile level', () => {
    const players = [row('a', 3, 4), row('b', 3, 3), row('c', 4, 3)]
    expect(playersWithStaleLevel(players).map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('skips rows with no profile level, even when an override is set', () => {
    expect(playersWithStaleLevel([row('a', 3, null)])).toEqual([])
  })

  it('includes a row whose override is blank while the profile has a level', () => {
    expect(playersWithStaleLevel([row('a', null, 4)]).map((p) => p.id)).toEqual(['a'])
  })

  it('returns an empty list when everything matches', () => {
    expect(playersWithStaleLevel([row('a', 2, 2), row('b', null, null)])).toEqual([])
  })
})
