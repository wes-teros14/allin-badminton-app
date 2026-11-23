import { describe, expect, it } from 'vitest'
import { SEASONS } from '@/lib/season'
import {
  floorCount,
  formatShortDate,
  pendingLine,
  seasonRange,
  seasonStartLine,
  seasonSummaryLine,
  switcherLabel,
  viewerProgress,
} from '@/lib/seasonCopy'

const [s2026, s2027] = SEASONS

describe('formatShortDate', () => {
  it('prints month and day without padding, in UTC', () => {
    expect(formatShortDate('2026-03-22')).toBe('Mar 22')
    expect(formatShortDate('2026-11-05')).toBe('Nov 5')
  })
})

describe('seasonRange', () => {
  it('spans the first and last played session with an en dash', () => {
    expect(seasonRange([{ date: '2026-03-22' }, { date: '2026-07-01' }, { date: '2026-11-15' }])).toBe('Mar 22 – Nov 15')
  })
  it('is a single date for one session and null for none', () => {
    expect(seasonRange([{ date: '2026-11-29' }])).toBe('Nov 29')
    expect(seasonRange([])).toBeNull()
  })
})

describe('floorCount', () => {
  it('names a rolling window in months and a lifetime window as sessions played', () => {
    expect(floorCount(s2027, 3)).toBe('3 sessions in the past 12 months')
    expect(floorCount(s2026, 4)).toBe('4 sessions played')
  })
  it('falls back to days for a window that is not a year', () => {
    expect(floorCount({ ...s2027, floorWindowDays: 90 }, 3)).toBe('3 sessions in the past 90 days')
  })
})

describe('pendingLine', () => {
  it('agrees in number', () => {
    expect(pendingLine(1, 3)).toBe('1 more player appears once they reach 3 sessions.')
    expect(pendingLine(4, 3)).toBe('4 more players appear once they reach 3 sessions.')
  })
})

describe('viewerProgress', () => {
  it('never shows more sessions than the floor', () => {
    expect(viewerProgress(2, 3)).toBe('You: 2 of 3')
    expect(viewerProgress(5, 3)).toBe('You: 3 of 3')
  })
})

describe('switcherLabel', () => {
  it('names the current season in full and a past one by its id', () => {
    expect(switcherLabel(s2027, true)).toBe('2027 season')
    expect(switcherLabel(s2026, false)).toBe('2026')
  })
})

describe('seasonStartLine', () => {
  it('names the first upcoming session, or says soon', () => {
    expect(seasonStartLine(s2027, '2026-11-29')).toBe('The 2027 season starts with the Nov 29 session')
    expect(seasonStartLine(s2027, null)).toBe('The 2027 season starts soon')
  })

  it('speaks to the player on My Profile', () => {
    expect(seasonStartLine(s2027, '2026-11-29', 'Your')).toBe('Your 2027 season starts with the Nov 29 session')
    expect(seasonStartLine(s2027, null, 'Your')).toBe('Your 2027 season starts soon')
  })
})

describe('seasonSummaryLine', () => {
  it('counts sessions and games, singular at one', () => {
    expect(seasonSummaryLine(21, 88)).toBe('21 sessions · 88 games')
    expect(seasonSummaryLine(1, 1)).toBe('1 session · 1 game')
  })
})
