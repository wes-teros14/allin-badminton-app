import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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
}

interface FinanceSessionsState {
  sessions: FinanceSessionRow[]
  isLoading: boolean
  fetchError: string | null
  refetch: () => Promise<void>
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
      profit: Number(row.profit),
      paidCount: Number(row.paid_count),
      totalCount: Number(row.total_count),
    })))
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { sessions, isLoading, fetchError, refetch: fetchAll }
}
