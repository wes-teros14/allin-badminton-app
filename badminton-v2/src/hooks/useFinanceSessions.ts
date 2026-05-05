import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface FinanceSessionRow {
  id: string
  date: string            // 'YYYY-MM-DD'
  name: string
  feePerPlayer: number    // sessions.price ?? 0
  courtCost: number       // sessions.court_cost ?? 0
  registrationCount: number
  revenue: number         // feePerPlayer * registrationCount
  shuttleCost: number     // SUM(tubes_used * cost_per_tube) for this session
  totalCost: number       // shuttleCost + courtCost
  profit: number          // revenue - totalCost
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

    // Parallel fetch: sessions + all registrations + all usage + all batches
    const [sessionsResult, registrationsResult, usageResult, batchesResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, date, name, price, court_cost')
        .order('date', { ascending: false }),
      supabase
        .from('session_registrations')
        .select('id, session_id, paid'),
      supabase
        .from('shuttle_usage')
        .select('session_id, batch_id, shuttles_used'),
      supabase
        .from('shuttle_batches')
        .select('id, cost_per_tube'),
    ])

    const firstError = sessionsResult.error ?? registrationsResult.error
      ?? usageResult.error ?? batchesResult.error
    if (firstError) {
      setFetchError(firstError.message)
      setIsLoading(false)
      return
    }

    const sessionRows = sessionsResult.data ?? []
    const registrationRows = registrationsResult.data ?? []
    const usageRows = usageResult.data ?? []
    const batchRows = batchesResult.data ?? []

    // registrationCount per session_id — paid players only (revenue = feePerPlayer × paid count)
    const regCountMap = new Map<string, number>()
    for (const r of registrationRows) {
      if (r.paid) regCountMap.set(r.session_id, (regCountMap.get(r.session_id) ?? 0) + 1)
    }

    // cost_per_tube per batch_id
    const batchCostMap = new Map<string, number>()
    for (const b of batchRows) {
      batchCostMap.set(b.id, Number(b.cost_per_tube))
    }

    // shuttleCost per session_id: SUM(tubes_used * cost_per_tube)
    const shuttleCostMap = new Map<string, number>()
    for (const u of usageRows) {
      const costPerTube = batchCostMap.get(u.batch_id) ?? 0
      const lineCost = u.shuttles_used * (costPerTube / 12)
      shuttleCostMap.set(u.session_id, (shuttleCostMap.get(u.session_id) ?? 0) + lineCost)
    }

    const financeRows: FinanceSessionRow[] = sessionRows.map((s) => {
      const feePerPlayer = s.price ?? 0
      const courtCost = s.court_cost ?? 0
      const registrationCount = regCountMap.get(s.id) ?? 0
      const revenue = feePerPlayer * registrationCount
      const shuttleCost = shuttleCostMap.get(s.id) ?? 0
      const totalCost = shuttleCost + courtCost
      const profit = revenue - totalCost
      return {
        id: s.id,
        date: s.date,
        name: s.name,
        feePerPlayer,
        courtCost,
        registrationCount,
        revenue,
        shuttleCost,
        totalCost,
        profit,
      }
    })

    setSessions(financeRows)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { sessions, isLoading, fetchError, refetch: fetchAll }
}
