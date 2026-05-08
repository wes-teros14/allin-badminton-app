import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const SHUTTLES_PER_TUBE = 12

export interface UsageAllocation {
  batchId: string
  tubeId: number | null
  brand: string
  shuttlesUsed: number
  costPerTube: number
}

export interface SessionFinanceData {
  sessionId: string
  sessionDate: string
  feePerPlayer: number | null
  courtCost: number | null
  registrationCount: number
  usageAllocations: UsageAllocation[]
  revenue: number
  shuttleCost: number
  profit: number
  totalShuttlesLogged: number
  isLoading: boolean
  fetchError: string | null
  isSaving: boolean
  totalStockAvailable: number   // total shuttles remaining across all tubes
  logUsage: (totalShuttles: number) => Promise<{ error: string | null }>
  saveCourtCost: (amount: number) => Promise<{ error: string | null }>
  refetch: () => Promise<void>
}

export interface BatchForAllocation {
  id: string
  brand: string
  shuttlesRemaining: number   // 0–12 per tube (tube_count * 12 - shuttles_used)
  costPerTube: number
  tubeStart: number
}

// Pure function — exported for testing. Batches must be pre-sorted cheapest-first.
// Returns null when totalShuttles exceeds available stock.
export function allocateCheapestFirst(
  totalShuttles: number,
  batches: BatchForAllocation[]
): UsageAllocation[] | null {
  const result: UsageAllocation[] = []
  let remaining = totalShuttles
  for (const b of batches) {
    if (remaining <= 0) break
    const take = Math.min(remaining, b.shuttlesRemaining)
    if (take > 0) {
      result.push({
        batchId: b.id,
        tubeId: b.tubeStart,
        brand: b.brand,
        shuttlesUsed: take,
        costPerTube: b.costPerTube,
      })
      remaining -= take
    }
  }
  if (remaining > 0) return null
  return result
}

export function useSessionFinance(sessionId: string): SessionFinanceData {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [session, setSession] = useState<{ date: string; price: number | null; court_cost: number | null } | null>(null)
  const [registrationCount, setRegistrationCount] = useState(0)
  const [usageAllocations, setUsageAllocations] = useState<UsageAllocation[]>([])
  const [batchesForAllocation, setBatchesForAllocation] = useState<BatchForAllocation[]>([])

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)

    const { data: sessionRow, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, date, price, court_cost')
      .eq('id', sessionId)
      .single()
    if (sessionErr || !sessionRow) {
      setFetchError(sessionErr?.message ?? 'Session not found')
      setIsLoading(false)
      return
    }
    setSession({ date: sessionRow.date, price: sessionRow.price, court_cost: sessionRow.court_cost })

    // Count paid registrations only — revenue = feePerPlayer × paid count
    const { count, error: regErr } = await supabase
      .from('session_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('paid', true)
    if (regErr) {
      setFetchError(regErr.message)
      setIsLoading(false)
      return
    }
    setRegistrationCount(count ?? 0)

    // Fetch all batches cheapest-first for allocation + stock check
    const { data: batchRows, error: batchErr } = await supabase
      .from('shuttle_batches')
      .select('id, brand, tube_count, cost_per_tube, created_at')
      .order('cost_per_tube', { ascending: true })
      .order('created_at', { ascending: true })
    if (batchErr) {
      setFetchError(batchErr.message)
      setIsLoading(false)
      return
    }

    const creationOrdered = [...(batchRows ?? [])].sort((a, b) =>
      a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
    )
    const tubeStartMap = new Map<string, number>()
    let cursor = 1001
    for (const b of creationOrdered) {
      tubeStartMap.set(b.id, cursor)
      cursor += b.tube_count
    }

    // Fetch shuttle_usage for this session joined to shuttle_batches for brand + cost_per_tube
    const { data: usageRows, error: usageErr } = await supabase
      .from('shuttle_usage')
      .select('batch_id, shuttles_used, shuttle_batches(brand, cost_per_tube)')
      .eq('session_id', sessionId)
    if (usageErr) {
      setFetchError(usageErr.message)
      setIsLoading(false)
      return
    }
    const allocations: UsageAllocation[] = (usageRows ?? []).map((u) => {
      const batchData = u.shuttle_batches as { brand: string; cost_per_tube: number } | null
      return {
        batchId: u.batch_id,
        tubeId: tubeStartMap.get(u.batch_id) ?? null,
        brand: batchData?.brand ?? '',
        shuttlesUsed: u.shuttles_used,
        costPerTube: Number(batchData?.cost_per_tube ?? 0),
      }
    })
    setUsageAllocations(allocations)

    // Fetch ALL shuttle_usage to compute remaining shuttles per batch
    const { data: allUsage, error: allUsageErr } = await supabase
      .from('shuttle_usage')
      .select('batch_id, shuttles_used')
    if (allUsageErr) {
      setFetchError(allUsageErr.message)
      setIsLoading(false)
      return
    }
    const usageMap = new Map<string, number>()
    for (const u of (allUsage ?? [])) {
      usageMap.set(u.batch_id, (usageMap.get(u.batch_id) ?? 0) + u.shuttles_used)
    }
    const batchesForAlloc: BatchForAllocation[] = (batchRows ?? []).map((b) => ({
      id: b.id,
      brand: b.brand,
      shuttlesRemaining: Math.max(0, b.tube_count * SHUTTLES_PER_TUBE - (usageMap.get(b.id) ?? 0)),
      costPerTube: Number(b.cost_per_tube),
      tubeStart: tubeStartMap.get(b.id) ?? 1001,
    }))
    setBatchesForAllocation(batchesForAlloc)
    setIsLoading(false)
  }, [sessionId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // logUsage: delete-then-insert (D-05). Allocates cheapest-first in shuttles.
  const logUsage = useCallback(async (totalShuttles: number): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    const allocation = allocateCheapestFirst(totalShuttles, batchesForAllocation)
    if (!allocation) {
      const totalAvailable = batchesForAllocation.reduce((s, b) => s + b.shuttlesRemaining, 0)
      return { error: `Not enough stock. Only ${totalAvailable} shuttles available.` }
    }
    setIsSaving(true)
    const { error: deleteErr } = await supabase
      .from('shuttle_usage')
      .delete()
      .eq('session_id', sessionId)
    if (deleteErr) {
      setIsSaving(false)
      return { error: deleteErr.message }
    }
    const insertRows = allocation.map((a) => ({
      session_id: sessionId,
      batch_id: a.batchId,
      shuttles_used: a.shuttlesUsed,
      recorded_by: user.id,
    }))
    const { error: insertErr } = await supabase.from('shuttle_usage').insert(insertRows)
    setIsSaving(false)
    if (insertErr) return { error: insertErr.message }
    await fetchAll()
    return { error: null }
  }, [user, sessionId, batchesForAllocation, fetchAll])

  const saveCourtCost = useCallback(async (amount: number): Promise<{ error: string | null }> => {
    setIsSaving(true)
    const { error } = await supabase
      .from('sessions')
      .update({ court_cost: amount })
      .eq('id', sessionId)
    setIsSaving(false)
    if (error) return { error: error.message }
    await fetchAll()
    return { error: null }
  }, [sessionId, fetchAll])

  // Cost per shuttle = costPerTube / SHUTTLES_PER_TUBE
  const feePerPlayer = session?.price ?? 0
  const revenue = feePerPlayer * registrationCount
  const shuttleCost = usageAllocations.reduce(
    (sum, a) => sum + a.shuttlesUsed * (a.costPerTube / SHUTTLES_PER_TUBE),
    0
  )
  const courtCostValue = session?.court_cost ?? 0
  const profit = revenue - shuttleCost - courtCostValue
  const totalShuttlesLogged = usageAllocations.reduce((sum, a) => sum + a.shuttlesUsed, 0)
  const totalStockAvailable = batchesForAllocation.reduce((sum, b) => sum + b.shuttlesRemaining, 0)

  return {
    sessionId,
    sessionDate: session?.date ?? '',
    feePerPlayer: session?.price ?? null,
    courtCost: session?.court_cost ?? null,
    registrationCount,
    usageAllocations,
    revenue,
    shuttleCost,
    profit,
    totalShuttlesLogged,
    isLoading,
    fetchError,
    isSaving,
    totalStockAvailable,
    logUsage,
    saveCourtCost,
    refetch: fetchAll,
  }
}
