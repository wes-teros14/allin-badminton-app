import { describe, expect, it } from 'vitest'
import {
  seasonBefore,
  SEASONS,
  boardScope,
  currentSeason,
  floorWindow,
  inWindow,
  localToday,
  pastSeasons,
  seasonById,
  seasonForDate,
  seasonWindow,
  unboundedScope,
} from '../lib/season'

describe('season boundaries', () => {
  it('assigns the boundary day to the new season', () => {
    expect(seasonForDate('2026-11-15').id).toBe('2026')
    expect(seasonForDate('2026-11-16').id).toBe('2027')
    expect(seasonForDate('2020-01-01').id).toBe('2026')
  })

  it('picks the current season from today', () => {
    expect(currentSeason('2026-11-19').id).toBe('2027')
    expect(currentSeason('2026-11-10').id).toBe('2026')
  })

  it('lists past seasons newest first', () => {
    expect(pastSeasons('2026-11-19').map((s) => s.id)).toEqual(['2026'])
    expect(pastSeasons('2026-11-10')).toEqual([])
  })

  it('looks seasons up by id', () => {
    expect(seasonById('2027')?.start).toBe('2026-11-16')
    expect(seasonById('1999')).toBeNull()
  })
})

describe('boardScope', () => {
  it('a past season is asOf the day before the next one', () => {
    const s = boardScope('2026', '2026-11-19')
    expect(s.isCurrent).toBe(false)
    expect(s.asOf).toBe('2026-11-15')
    expect(s.season.id).toBe('2026')
  })

  it('null means current, asOf today', () => {
    const s = boardScope(null, '2026-11-19')
    expect(s.isCurrent).toBe(true)
    expect(s.asOf).toBe('2026-11-19')
  })

  it('the current season id is current too', () => {
    expect(boardScope('2027', '2026-11-19').isCurrent).toBe(true)
  })

  it('an unknown id falls back to current', () => {
    expect(boardScope('1999', '2026-11-19').season.id).toBe('2027')
  })
})

describe('windows', () => {
  it('current season floor window is 365 days back, asOf inclusive', () => {
    expect(floorWindow(boardScope(null, '2027-11-20'))).toEqual({ start: '2026-11-21', end: '2027-11-21' })
  })

  it('a lifetime season has an open start, ending the day after asOf', () => {
    expect(floorWindow(boardScope('2026', '2026-11-19'))).toEqual({ start: null, end: '2026-11-16' })
  })

  it('floor window crosses a leap day by dates, not by 365 * 24h', () => {
    expect(floorWindow(boardScope(null, '2028-03-01'))).toEqual({ start: '2027-03-03', end: '2028-03-02' })
  })

  it('season windows are open at the ends only', () => {
    expect(seasonWindow(seasonById('2026')!)).toEqual({ start: null, end: '2026-11-16' })
    expect(seasonWindow(seasonById('2027')!)).toEqual({ start: '2026-11-16', end: null })
  })

  it('inWindow is start-inclusive, end-exclusive, null open', () => {
    const w = { start: '2026-11-16', end: '2026-11-20' }
    expect(inWindow('2026-11-15', w)).toBe(false)
    expect(inWindow('2026-11-16', w)).toBe(true)
    expect(inWindow('2026-11-19', w)).toBe(true)
    expect(inWindow('2026-11-20', w)).toBe(false)
    expect(inWindow('1999-01-01', { start: null, end: null })).toBe(true)
  })
})

describe('floors', () => {
  it('2026 and 2027 floors', () => {
    expect(seasonById('2026')!.floors).toEqual({ played: 3, individual: 4, cheers: 4, earlyBird: 8 })
    expect(seasonById('2027')!.floors).toEqual({ played: 3, individual: 3, cheers: 3, earlyBird: 8 })
    expect(SEASONS.map((s) => s.floorWindowDays)).toEqual([null, 365])
  })
})

describe('unboundedScope', () => {
  it('has no season bounds and a lifetime floor window', () => {
    const floors = { played: 3, individual: 4, cheers: 4, earlyBird: 8 }
    const s = unboundedScope(floors, '2026-11-19')
    expect(seasonWindow(s.season)).toEqual({ start: null, end: null })
    expect(s.season.floorWindowDays).toBeNull()
    expect(s.season.floors).toEqual(floors)
    expect(floorWindow(s)).toEqual({ start: null, end: '2026-11-20' })
  })
})

describe('localToday', () => {
  it('is a YYYY-MM-DD string', () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('seasonBefore', () => {
  it('is the season so far, ending before the given day', () => {
    expect(seasonBefore('2026-11-29')).toEqual({ start: '2026-11-16', end: '2026-11-29' })
  })

  it('stays inside the first season, open at the start', () => {
    expect(seasonBefore('2026-03-22')).toEqual({ start: null, end: '2026-03-22' })
  })

  it('on a season’s first day is empty: nothing came before it', () => {
    expect(seasonBefore('2026-11-16')).toEqual({ start: '2026-11-16', end: '2026-11-16' })
  })
})
