import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CELEBRATION_STATE_VERSION,
  clearSweepDebt,
  emptyState,
  readState,
  readSweepDebt,
  writeState,
} from '@/lib/celebrationStorage'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

/** vitest runs in the node environment here, so window/localStorage are absent. */
function installStorage() {
  const store = new Map<string, string>()
  const mock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  vi.stubGlobal('window', { localStorage: mock })
  return store
}

beforeEach(() => { installStorage() })
afterEach(() => { vi.unstubAllGlobals() })

describe('readState / writeState', () => {
  it('returns null for a player who has never been evaluated', () => {
    expect(readState('player-a')).toBeNull()
  })

  it('round-trips a state', () => {
    const state = { ...emptyState(), snapshot: { wins: 2 }, sentinel: '2026-09-18T00:00:00Z' }
    writeState('player-a', state)
    expect(readState('player-a')).toEqual(state)
  })

  // The silent first run depends on this distinction. An empty snapshot would
  // treat every current standing as newly won.
  it('distinguishes "never evaluated" from "evaluated, nothing recorded"', () => {
    expect(readState('player-a')).toBeNull()
    writeState('player-a', emptyState())
    expect(readState('player-a')).toEqual(emptyState())
  })

  it('keeps two players on one device completely separate', () => {
    writeState('player-a', { ...emptyState(), snapshot: { wins: 1 } })
    writeState('player-b', { ...emptyState(), snapshot: { wins: 9 } })

    expect(readState('player-a')?.snapshot).toEqual({ wins: 1 })
    expect(readState('player-b')?.snapshot).toEqual({ wins: 9 })
  })

  it('ignores state written under a different version rather than trusting it', () => {
    writeState('player-a', { ...emptyState(), version: CELEBRATION_STATE_VERSION + 1 })
    expect(readState('player-a')).toBeNull()
  })

  it('treats corrupt stored data as never evaluated', () => {
    window.localStorage.setItem('badminton-celebration:player-a', '{not json')
    expect(readState('player-a')).toBeNull()
  })

  it('never throws when storage itself is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('SecurityError: storage is disabled') },
        setItem: () => { throw new Error('SecurityError: storage is disabled') },
        removeItem: () => { throw new Error('SecurityError: storage is disabled') },
      },
    })

    expect(() => readState('player-a')).not.toThrow()
    expect(readState('player-a')).toBeNull()
    expect(() => writeState('player-a', emptyState())).not.toThrow()
  })

  it('does nothing for an empty player id rather than writing a shared key', () => {
    writeState('', { ...emptyState(), snapshot: { wins: 1 } })
    expect(readState('')).toBeNull()
  })
})

describe('sweep debt', () => {
  const sentinel = '2026-09-18T10:00:00Z'

  it('returns a debt raised under the current sentinel', () => {
    writeState('player-a', { ...emptyState(), sentinel, sweepOwed: { board: 'wins', sentinel } })
    expect(readSweepDebt('player-a', sentinel)).toEqual({ board: 'wins', sentinel })
  })

  // Expiry is a comparison, not a timer: the shimmer should always be about the
  // most recent result.
  it('treats a debt from before the latest session as lapsed', () => {
    writeState('player-a', { ...emptyState(), sweepOwed: { board: 'wins', sentinel } })
    expect(readSweepDebt('player-a', '2026-09-25T10:00:00Z')).toBeNull()
  })

  it('clears a debt once collected', () => {
    writeState('player-a', { ...emptyState(), sentinel, sweepOwed: { board: 'pairs', sentinel } })
    clearSweepDebt('player-a')
    expect(readSweepDebt('player-a', sentinel)).toBeNull()
  })

  it('returns null for a player with no debt', () => {
    writeState('player-a', emptyState())
    expect(readSweepDebt('player-a', sentinel)).toBeNull()
  })
})
