import { describe, expect, it } from 'vitest'
import { formatSessionDate, formatSessionStamp } from '@/lib/sessionStamp'

/**
 * The receipt toast is the only place an admin is told WHICH session a
 * payment landed on. A player can be registered for two open sessions at
 * once and pay the far one early, so a toast naming only the player is
 * genuinely ambiguous -- that ambiguity is what sent a real receipt
 * looking like a lost one (tasks/lessons.md).
 */
describe('formatSessionDate', () => {
  it('formats a DATE column value in the app-wide session style', () => {
    expect(formatSessionDate('2026-09-06')).toBe('Sep. 6, 2026')
  })

  it('parses as local midnight, so the day never slips a date backwards', () => {
    // new Date('2026-01-01') would be UTC midnight and render as Dec 31
    // anywhere west of Greenwich. The 'T00:00:00' suffix is load-bearing.
    expect(formatSessionDate('2026-01-01')).toBe('Jan. 1, 2026')
  })

  it('returns null for absent or unparseable input rather than "Invalid Date"', () => {
    expect(formatSessionDate(null)).toBeNull()
    expect(formatSessionDate(undefined)).toBeNull()
    expect(formatSessionDate('')).toBeNull()
    expect(formatSessionDate('not-a-date')).toBeNull()
  })
})

describe('formatSessionStamp', () => {
  it('joins name and date with a middot', () => {
    expect(formatSessionStamp('Ber months na 🎁', '2026-09-06')).toBe('Ber months na 🎁 · Sep. 6, 2026')
  })

  it('degrades to whichever half it has', () => {
    expect(formatSessionStamp('Ber months na 🎁', null)).toBe('Ber months na 🎁')
    expect(formatSessionStamp(null, '2026-09-06')).toBe('Sep. 6, 2026')
  })

  it('returns null with neither, so the caller omits the line entirely', () => {
    expect(formatSessionStamp(null, null)).toBeNull()
    expect(formatSessionStamp('   ', null)).toBeNull()
  })

  it('never renders a half-built separator when the date is unparseable', () => {
    expect(formatSessionStamp('Ber months na 🎁', 'not-a-date')).toBe('Ber months na 🎁')
  })
})
