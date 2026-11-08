import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { buildShareContent, pickFirstOnCourt, shareFileName } from '@/lib/sessionShareImage'

const BASE = {
  name: 'Badminton Nov 8',
  date: '2026-11-08',
  time: '15:00:00',
  duration: '2',
  price: 370,
  venue: 'Upper Deck Sports Complex',
  session_notes: null as string | null,
}

describe('pickFirstOnCourt', () => {
  const rows = [
    { queue_position: 4 },
    { queue_position: 1 },
    { queue_position: 7 },
    { queue_position: 2 },
  ]

  it('takes one game per court, in queue order', () => {
    expect(pickFirstOnCourt(rows, 2).map((r) => r.queue_position)).toEqual([1, 2])
    expect(pickFirstOnCourt(rows, 3).map((r) => r.queue_position)).toEqual([1, 2, 4])
  })

  it('uses queue order, not the numbers, when positions have gaps', () => {
    const gapped = [{ queue_position: 3 }, { queue_position: 5 }, { queue_position: 9 }]
    expect(pickFirstOnCourt(gapped, 2).map((r) => r.queue_position)).toEqual([3, 5])
  })

  it('takes at least one game for a bad court count', () => {
    expect(pickFirstOnCourt(rows, 0)).toHaveLength(1)
  })

  it('returns what there is when fewer games than courts', () => {
    expect(pickFirstOnCourt([{ queue_position: 1 }], 2)).toHaveLength(1)
    expect(pickFirstOnCourt([], 2)).toEqual([])
  })
})

describe('buildShareContent', () => {
  it('formats date, time, duration and price like the session card', () => {
    const c = buildShareContent(BASE, [])
    expect(c.title).toBe('Badminton Nov 8')
    expect(c.dateLine).toBe('Sun, Nov 8, 2026')
    expect(c.detailLine).toBe('3:00 PM  ·  2 hrs  ·  ₱370')
    expect(c.venue).toBe('Upper Deck Sports Complex')
  })

  it('omits missing details instead of printing blanks', () => {
    const c = buildShareContent({ ...BASE, time: null, duration: null, price: null, venue: '  ' }, [])
    expect(c.detailLine).toBeNull()
    expect(c.venue).toBeNull()
  })

  it('keeps a price of 0', () => {
    expect(buildShareContent({ ...BASE, time: null, duration: null, price: 0 }, []).detailLine).toBe('₱0')
  })

  it('has no notes when there are none', () => {
    const c = buildShareContent(BASE, [])
    expect(c.chips).toEqual([])
    expect(c.noteText).toBeNull()
  })
})

describe('shareFileName', () => {
  it('slugs the session name', () => {
    expect(shareFileName('Badminton Nov 8')).toBe('badminton-nov-8.png')
  })

  it('falls back when the name has no usable characters', () => {
    expect(shareFileName('***')).toBe('session.png')
  })
})
