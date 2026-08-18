import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { SessionStatus } from '@/types/app'

export interface FinanceSessionRow {
  sessionId: string
  date: string
  name: string
  feePerPlayer: number
  courtCost: number
  revenue: number
  shuttleCost: number
  totalCost: number
  profit: number
  paidCount: number
  totalCount: number
  status: SessionStatus
}

export interface FinanceTotals {
  allSessions: number
  completed: number
}

interface FinanceSessionsState {
  sessions: FinanceSessionRow[]
  totals: FinanceTotals
  isLoading: boolean
  fetchError: string | null
  refetch: () => Promise<void>
}

/**
 * Sums the per-session net (`profit`, i.e. profit after personal share — the
 * value rendered in the Net Cash column) across all sessions, and separately
 * across completed sessions only.
 *
 * Rounds once at the end of each reduce: NUMERIC(10,2) arrives as a JS float,
 * and accumulating many of them drifts (e.g. 4199.999999999999). Matches the
 * money convention in calculateProfitAfterPersonalShare.
 */
export function summarizeFinanceTotals(sessions: FinanceSessionRow[]): FinanceTotals {
  const sum = (rows: FinanceSessionRow[]) =>
    Number(rows.reduce((acc, row) => acc + row.profit, 0).toFixed(2))

  return {
    allSessions: sum(sessions),
    completed: sum(sessions.filter((s) => s.status === 'complete')),
  }
}

export function useFinanceSessions(): FinanceSessionsState {
  const [sessions, setSessions] = useState<FinanceSessionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)

    const { data, error } = await supabase.rpc('get_session_finance', {})
    if (error) {
      setFetchError(error.message)
      setIsLoading(false)
      return
    }

    setSessions((data ?? []).map((row) => ({
      sessionId: row.session_id,
      date: row.date,
      name: row.name,
      feePerPlayer: Number(row.fee_per_player),
      courtCost: Number(row.court_cost ?? 0),
      revenue: Number(row.revenue),
      shuttleCost: Number(row.shuttle_cost),
      totalCost: Number(row.total_cost),
      profit: Number(row.profit_after_personal_share ?? row.profit),
      paidCount: Number(row.paid_count),
      totalCount: Number(row.total_count),
      status: row.status,
    })))
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const totals = useMemo(() => summarizeFinanceTotals(sessions), [sessions])

  return { sessions, totals, isLoading, fetchError, refetch: fetchAll }
}
