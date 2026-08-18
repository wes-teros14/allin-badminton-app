import { describe, expect, it, vi } from 'vitest'
import { summarizeFinanceTotals, type FinanceSessionRow } from '@/hooks/useFinanceSessions'
import type { SessionStatus } from '@/types/app'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

/** Builds a finance row where only status and profit matter to the summary. */
function row(profit: number, status: SessionStatus, id = 's'): FinanceSessionRow {
  return {
    sessionId: id,
    date: '2026-08-18',
    name: 'Session',
    feePerPlayer: 150,
    courtCost: 0,
    revenue: 0,
    shuttleCost: 0,
    totalCost: 0,
    profit,
    paidCount: 0,
    totalCount: 0,
    status,
  }
}

describe('summarizeFinanceTotals — all sessions', () => {
  it('sums profit across every session regardless of status', () => {
    const totals = summarizeFinanceTotals([
      row(1000, 'complete', 'a'),
      row(250, 'in_progress', 'b'),
      row(500, 'setup', 'c'),
    ])
    expect(totals.allSessions).toBe(1750)
  })

  it('returns zero totals for an empty list', () => {
    expect(summarizeFinanceTotals([])).toEqual({ allSessions: 0, completed: 0 })
  })

  it('includes sessions with no financial activity as zero contributors', () => {
    const totals = summarizeFinanceTotals([
      row(900, 'complete', 'a'),
      row(0, 'setup', 'b'),
      row(0, 'registration_open', 'c'),
    ])
    expect(totals.allSessions).toBe(900)
    expect(totals.completed).toBe(900)
  })

  it('preserves a negative total without clamping', () => {
    const totals = summarizeFinanceTotals([
      row(-1200.5, 'complete', 'a'),
      row(-300.25, 'in_progress', 'b'),
    ])
    expect(totals.allSessions).toBe(-1500.75)
    expect(totals.completed).toBe(-1200.5)
  })

  it('rounds to exactly two decimals so float drift does not leak out', () => {
    // 0.1 + 0.2 === 0.30000000000000004 under naive float addition.
    const totals = summarizeFinanceTotals([
      row(0.1, 'complete', 'a'),
      row(0.2, 'complete', 'b'),
    ])
    expect(totals.allSessions).toBe(0.3)
    expect(totals.completed).toBe(0.3)
  })

  it('keeps a long run of two-decimal values exact', () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(10.07, 'complete', `s${i}`))
    expect(summarizeFinanceTotals(rows).allSessions).toBe(201.4)
  })
})

describe('summarizeFinanceTotals — completed only', () => {
  it('excludes every non-complete status from the completed total', () => {
    const totals = summarizeFinanceTotals([
      row(100, 'setup', 'a'),
      row(200, 'registration_open', 'b'),
      row(400, 'registration_closed', 'c'),
      row(800, 'schedule_locked', 'd'),
      row(1600, 'in_progress', 'e'),
      row(3200, 'complete', 'f'),
    ])
    expect(totals.completed).toBe(3200)
    expect(totals.allSessions).toBe(6300)
  })

  it('matches the all-sessions total when every session is complete', () => {
    const totals = summarizeFinanceTotals([
      row(750, 'complete', 'a'),
      row(1250, 'complete', 'b'),
    ])
    expect(totals.completed).toBe(2000)
    expect(totals.completed).toBe(totals.allSessions)
  })

  it('is zero when no session has been completed, while all-sessions is not', () => {
    const totals = summarizeFinanceTotals([
      row(500, 'in_progress', 'a'),
      row(300, 'registration_open', 'b'),
    ])
    expect(totals.completed).toBe(0)
    expect(totals.allSessions).toBe(800)
  })

  it('never exceeds the all-sessions total when all profits are positive', () => {
    const totals = summarizeFinanceTotals([
      row(600, 'complete', 'a'),
      row(400, 'schedule_locked', 'b'),
    ])
    expect(totals.completed).toBeLessThanOrEqual(totals.allSessions)
  })
})
