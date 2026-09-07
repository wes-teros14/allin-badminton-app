import { describe, expect, it } from 'vitest'
import { buildCourtLabels, buildCourtSlots } from '@/lib/courts'

describe('dynamic court slot derivation', () => {
  it('creates one slot per configured court and previews the queue head on every court', () => {
    const currentByCourt = new Map([[2, { id: 'm2' }]])
    const queued = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]

    // Every court shows q1: there is one shared queue, and its head goes to
    // whichever court finishes next. A per-court preview (`queued[index]`) was a
    // promise the queue never keeps.
    expect(buildCourtSlots(3, buildCourtLabels(3), currentByCourt, queued)).toEqual([
      { courtNumber: 1, label: 'Court 1', current: null, next: { id: 'q1' } },
      { courtNumber: 2, label: 'Court 2', current: { id: 'm2' }, next: { id: 'q1' } },
      { courtNumber: 3, label: 'Court 3', current: null, next: { id: 'q1' } },
    ])
  })

  it('leaves next null on every court when the queue is empty', () => {
    expect(buildCourtSlots(2, buildCourtLabels(2), new Map(), [])).toEqual([
      { courtNumber: 1, label: 'Court 1', current: null, next: null },
      { courtNumber: 2, label: 'Court 2', current: null, next: null },
    ])
  })
})
