import { describe, expect, it } from 'vitest'
import { buildCourtLabels, buildCourtSlots } from '@/lib/courts'

describe('dynamic court slot derivation', () => {
  it('creates one slot per configured court and assigns queued previews in order', () => {
    const currentByCourt = new Map([[2, { id: 'm2' }]])
    const queued = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]

    expect(buildCourtSlots(3, buildCourtLabels(3), currentByCourt, queued)).toEqual([
      { courtNumber: 1, label: 'Court 1', current: null, next: { id: 'q1' } },
      { courtNumber: 2, label: 'Court 2', current: { id: 'm2' }, next: { id: 'q2' } },
      { courtNumber: 3, label: 'Court 3', current: null, next: { id: 'q3' } },
    ])
  })
})
