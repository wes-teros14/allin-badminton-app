import { describe, it, expect } from 'vitest'
import { assignSlot, type MatchSlots } from '@/lib/matchSlots'

const base: MatchSlots = { t1p1: 'bogs', t1p2: 'wes', t2p1: 'john', t2p2: 'steph' }

describe('assignSlot', () => {
  it('swaps across teams when the chosen player already holds a slot', () => {
    const { next, swappedWith } = assignSlot(base, 't1p1', 'steph')
    expect(next).toEqual({ t1p1: 'steph', t1p2: 'wes', t2p1: 'john', t2p2: 'bogs' })
    expect(swappedWith).toBe('t2p2')
  })

  it('swaps within a team too', () => {
    const { next, swappedWith } = assignSlot(base, 't1p1', 'wes')
    expect(next).toEqual({ ...base, t1p1: 'wes', t1p2: 'bogs' })
    expect(swappedWith).toBe('t1p2')
  })

  it('substitutes when the chosen player is not in the match', () => {
    const { next, swappedWith } = assignSlot(base, 't2p1', 'anthony')
    expect(next).toEqual({ ...base, t2p1: 'anthony' })
    expect(swappedWith).toBeNull()
  })

  it('re-selecting the current occupant is a no-op', () => {
    const { next, swappedWith } = assignSlot(base, 't1p1', 'bogs')
    expect(next).toEqual(base)
    expect(swappedWith).toBeNull()
  })

  it('clearing a slot never swaps, even when other slots are blank', () => {
    const half: MatchSlots = { t1p1: 'bogs', t1p2: '', t2p1: '', t2p2: 'steph' }
    const { next, swappedWith } = assignSlot(half, 't1p1', '')
    expect(next).toEqual({ ...half, t1p1: '' })
    expect(swappedWith).toBeNull()
  })

  it('a swap keeps the same four players, so the distinct-players rule cannot break', () => {
    const { next } = assignSlot(base, 't2p2', 'bogs')
    expect(new Set(Object.values(next))).toEqual(new Set(Object.values(base)))
  })
})
