import { describe, expect, it } from 'vitest'
import {
  findDuplicatePlayerIds,
  validateMatchPlayers,
  validateSchedulePlayers,
} from '@/lib/matchPlayers'

const NAMES: Record<string, string> = { a: 'Alexis', b: 'Bea', c: 'Carlo', d: 'Dana' }
const resolve = (id: string) => NAMES[id] ?? id

describe('findDuplicatePlayerIds', () => {
  it('returns nothing for four distinct players', () => {
    expect(findDuplicatePlayerIds(['a', 'b', 'c', 'd'])).toEqual([])
  })

  it('reports a player used twice', () => {
    expect(findDuplicatePlayerIds(['a', 'a', 'c', 'd'])).toEqual(['a'])
  })

  it('reports each repeated player once, however many times it repeats', () => {
    expect(findDuplicatePlayerIds(['a', 'a', 'a', 'd'])).toEqual(['a'])
    expect(findDuplicatePlayerIds(['a', 'a', 'c', 'c'])).toEqual(['a', 'c'])
  })

  it('ignores blank slots — an unfilled form is not a duplicate', () => {
    expect(findDuplicatePlayerIds(['', '', 'c', 'd'])).toEqual([])
  })
})

describe('validateMatchPlayers', () => {
  it('accepts four distinct players', () => {
    expect(validateMatchPlayers(['a', 'b', 'c', 'd'], resolve)).toEqual({ ok: true })
  })

  it('rejects the same player on both sides of one team', () => {
    const result = validateMatchPlayers(['a', 'a', 'c', 'd'], resolve)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.duplicateIds).toEqual(['a'])
    expect(result.message).toContain('Alexis is in this match twice')
  })

  it('rejects the same player across opposing teams', () => {
    const result = validateMatchPlayers(['a', 'b', 'a', 'd'], resolve)
    expect(result.ok).toBe(false)
  })

  it('names every repeated player', () => {
    const result = validateMatchPlayers(['a', 'a', 'c', 'c'], resolve)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('Alexis and Carlo are in this match twice')
  })

  it('falls back to a generic label with no name resolver', () => {
    const result = validateMatchPlayers(['a', 'a', 'c', 'd'])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe(
      'The same player is in this match twice — all four slots must be different players.'
    )
  })

  it('collapses repeated labels when several ids resolve alike', () => {
    const result = validateMatchPlayers(['a', 'a', 'c', 'c'])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toBe(
      'The same player is in this match twice — all four slots must be different players.'
    )
  })
})

describe('validateSchedulePlayers', () => {
  const clean = [
    { team1Player1: 'a', team1Player2: 'b', team2Player1: 'c', team2Player2: 'd' },
    { team1Player1: 'a', team1Player2: 'c', team2Player1: 'b', team2Player2: 'd' },
  ]

  it('accepts a clean schedule', () => {
    expect(validateSchedulePlayers(clean, resolve)).toEqual({ ok: true })
  })

  it('accepts an empty schedule', () => {
    expect(validateSchedulePlayers([], resolve)).toEqual({ ok: true })
  })

  it('reports the first offending game by number', () => {
    const result = validateSchedulePlayers(
      [...clean, { team1Player1: 'a', team1Player2: 'a', team2Player1: 'c', team2Player2: 'd' }],
      resolve,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.gameNumber).toBe(3)
    expect(result.message).toContain('Game 3: Alexis is in this match twice')
  })
})
