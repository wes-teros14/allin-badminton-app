import { describe, expect, it } from 'vitest'
import { buildCourtLabels, buildCourtSlots } from '@/lib/courts'

describe('dynamic court slot derivation', () => {
  it('fills idle courts in court order, and a busy court previews the first unclaimed game', () => {
    const currentByCourt = new Map([[2, { id: 'm2' }]])
    const queued = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]

    // Courts 1 and 3 are idle: they take q1 and q2, as Start Session would.
    // Court 2 is busy, so it previews q3, the first game neither idle court takes.
    expect(buildCourtSlots(3, buildCourtLabels(3), currentByCourt, queued)).toEqual([
      { courtNumber: 1, label: 'Court 1', current: null, next: { id: 'q1' } },
      { courtNumber: 2, label: 'Court 2', current: { id: 'm2' }, next: { id: 'q3' } },
      { courtNumber: 3, label: 'Court 3', current: null, next: { id: 'q2' } },
    ])
  })

  it('shows Game 1 and Game 2 on two idle courts before the session starts', () => {
    const queued = [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }]
    expect(buildCourtSlots(2, buildCourtLabels(2), new Map(), queued).map((c) => c.next)).toEqual([{ id: 'g1' }, { id: 'g2' }])
  })

  it('previews the queue head on every court while all courts are busy', () => {
    // One shared queue: its head goes to whichever court finishes next.
    const currentByCourt = new Map([[1, { id: 'm1' }], [2, { id: 'm2' }]])
    const queued = [{ id: 'q1' }, { id: 'q2' }]
    expect(buildCourtSlots(2, buildCourtLabels(2), currentByCourt, queued).map((c) => c.next)).toEqual([{ id: 'q1' }, { id: 'q1' }])
  })

  it('leaves an idle court with nothing to preview when the queue runs out', () => {
    expect(buildCourtSlots(2, buildCourtLabels(2), new Map(), [{ id: 'last' }]).map((c) => c.next)).toEqual([{ id: 'last' }, null])
  })

  it('leaves next null on every court when the queue is empty', () => {
    expect(buildCourtSlots(2, buildCourtLabels(2), new Map(), [])).toEqual([
      { courtNumber: 1, label: 'Court 1', current: null, next: null },
      { courtNumber: 2, label: 'Court 2', current: null, next: null },
    ])
  })
})
