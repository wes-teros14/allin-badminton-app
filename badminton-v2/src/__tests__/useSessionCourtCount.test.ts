import { describe, expect, it } from 'vitest'
import { buildCourtLabels, defaultCourtLabel, normalizeCourtCount } from '@/lib/courts'

describe('session court count helpers', () => {
  it('defaults invalid or missing persisted values to two courts', () => {
    expect(normalizeCourtCount(undefined)).toBe(2)
    expect(normalizeCourtCount(null)).toBe(2)
    expect(normalizeCourtCount(0)).toBe(1)
  })

  it('preserves whole-number court counts above zero', () => {
    expect(normalizeCourtCount(1)).toBe(1)
    expect(normalizeCourtCount(4)).toBe(4)
  })

  it('builds labels from persisted values for courts one and two and defaults beyond that', () => {
    expect(buildCourtLabels(4, {
      court_1_label: 'Main Court',
      court_2_label: 'Practice Court',
    })).toEqual({
      1: 'Main Court',
      2: 'Practice Court',
      3: 'Court 3',
      4: 'Court 4',
    })
    expect(defaultCourtLabel(5)).toBe('Court 5')
  })
})
