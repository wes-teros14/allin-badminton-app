import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Database, TablesInsert } from '@/types/database'

export type AllocationMode = Database['public']['Enums']['shuttle_allocation_mode']

export interface ManualUsageRowInput {
  batchId: string
  shuttlesUsed: number
}

export interface ManualUsageInput {
  allocationMode: 'manual'
  rows: ManualUsageRowInput[]
}

export interface AutoUsageInput {
  allocationMode: 'auto'
  totalShuttles: number
}

export type SaveUsageInput = AutoUsageInput | ManualUsageInput

export interface UsageAllocation {
  batchId: string
  tubeId: number | null
  brand: string
  shuttlesUsed: number
  shuttlesRemaining: number
  costPerTube: number
  notes: string | null
}

export interface ManualBatchOption {
  batchId: string
  tubeId: number
  brand: string
  shuttlesRemaining: number
  costPerTube: number
  notes: string | null
}

export interface SessionFinanceData {
  sessionId: string
  sessionDate: string
  allocationMode: AllocationMode
  feePerPlayer: number | null
  courtCost: number | null
  registrationCount: number
  usageAllocations: UsageAllocation[]
  revenue: number
  shuttleCost: number
  baseProfit: number
  profit: number
  personalShareOverride: number | null
  effectivePersonalShare: number
  totalShuttlesLogged: number
  isLoading: boolean
  fetchError: string | null
  isSavingUsage: boolean
  isSavingAllocationMode: boolean
  isSavingCourtCost: boolean
  isSavingPersonalShare: boolean
  totalStockAvailable: number
  availableManualBatches: ManualBatchOption[]
  logUsage: (totalShuttles: number) => Promise<{ error: string | null }>
  saveUsageAllocation: (input: SaveUsageInput) => Promise<{ error: string | null }>
  saveAllocationMode: (mode: AllocationMode) => Promise<{ error: string | null }>
  saveCourtCost: (amount: number) => Promise<{ error: string | null }>
  savePersonalShare: (amount: number | null) => Promise<{ error: string | null }>
  refetch: () => Promise<void>
}

export interface BatchForAllocation {
  id: string
  brand: string
  shuttlesRemaining: number
  costPerTube: number
  tubeStart: number
  notes: string | null
}

interface BatchIdentity {
  id: string
  created_at: string
}

interface UsageForStock {
  session_id: string
  batch_id: string
  shuttles_used: number
}

interface SavedUsageRow {
  batch_id: string
  shuttles_used: number
}

interface SaveUsageContext {
  sessionId: string
  userId: string
  batchesForAllocation: BatchForAllocation[]
}

export interface ManualAllocationValidation {
  isValid: boolean
  formError: string | null
  rowErrors: Record<string, string[]>
}

export function compareBatchIdentity(a: BatchIdentity, b: BatchIdentity): number {
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? -1 : 1
  }
  return a.id.localeCompare(b.id)
}

export function compareAllocationOrder(a: BatchForAllocation, b: BatchForAllocation): number {
  if (a.costPerTube !== b.costPerTube) {
    return a.costPerTube - b.costPerTube
  }
  if (a.tubeStart !== b.tubeStart) {
    return a.tubeStart - b.tubeStart
  }
  return a.id.localeCompare(b.id)
}

export function calculateProfitAfterPersonalShare(
  baseProfit: number,
  personalShareOverride: number | null
): number {
  return Number((baseProfit - (personalShareOverride ?? 0)).toFixed(2))
}

export function normalizeAllocationMode(
  mode: AllocationMode | null | undefined
): AllocationMode {
  return mode === 'manual' ? 'manual' : 'auto'
}

export function buildUsageMapForAllocation(
  usageRows: UsageForStock[],
  excludedSessionId: string
): Map<string, number> {
  const usageMap = new Map<string, number>()
  for (const usage of usageRows) {
    if (usage.session_id === excludedSessionId) continue
    usageMap.set(usage.batch_id, (usageMap.get(usage.batch_id) ?? 0) + usage.shuttles_used)
  }
  return usageMap
}

export function allocateCheapestFirst(
  totalShuttles: number,
  batches: BatchForAllocation[]
): UsageAllocation[] | null {
  const result: UsageAllocation[] = []
  let remaining = totalShuttles
  const orderedBatches = [...batches].sort(compareAllocationOrder)
  for (const batch of orderedBatches) {
    if (remaining <= 0) break
    const take = Math.min(remaining, batch.shuttlesRemaining)
    if (take > 0) {
      result.push({
        batchId: batch.id,
        tubeId: batch.tubeStart,
        brand: batch.brand,
        shuttlesUsed: take,
        shuttlesRemaining: batch.shuttlesRemaining,
        costPerTube: batch.costPerTube,
        notes: batch.notes,
      })
      remaining -= take
    }
  }
  if (remaining > 0) return null
  return result
}

export function validateManualUsageRows(
  rows: ManualUsageRowInput[],
  batches: BatchForAllocation[]
): ManualAllocationValidation {
  const batchMap = new Map(batches.map((batch) => [batch.id, batch]))
  const duplicateBatchIds = new Set<string>()
  const seenBatchIds = new Set<string>()
  const rowErrors: Record<string, string[]> = {}

  for (const row of rows) {
    if (seenBatchIds.has(row.batchId)) {
      duplicateBatchIds.add(row.batchId)
      continue
    }
    seenBatchIds.add(row.batchId)
  }

  for (const row of rows) {
    const errors: string[] = []
    const batch = batchMap.get(row.batchId)

    if (duplicateBatchIds.has(row.batchId)) {
      errors.push('Select each batch only once.')
    }

    if (!Number.isInteger(row.shuttlesUsed) || row.shuttlesUsed <= 0) {
      errors.push('Enter a whole number greater than 0.')
    } else if (!batch) {
      errors.push('Selected batch is no longer available.')
    } else if (row.shuttlesUsed > batch.shuttlesRemaining) {
      errors.push(`Only ${batch.shuttlesRemaining} shuttles available in this batch.`)
    }

    if (errors.length > 0) {
      rowErrors[row.batchId] = errors
    }
  }

  if (rows.length === 0) {
    return {
      isValid: false,
      formError: 'Add at least one batch before saving.',
      rowErrors,
    }
  }

  return {
    isValid: Object.keys(rowErrors).length === 0,
    formError: Object.keys(rowErrors).length === 0
      ? null
      : 'Fix the highlighted manual allocation rows before saving.',
    rowErrors,
  }
}

export function buildUsageRowsForSave(
  input: SaveUsageInput,
  context: SaveUsageContext
): { rows: TablesInsert<'shuttle_usage'>[]; error: string | null } {
  if (input.allocationMode === 'manual') {
    const validation = validateManualUsageRows(input.rows, context.batchesForAllocation)
    if (!validation.isValid) {
      return {
        rows: [],
        error: validation.formError,
      }
    }

    return {
      error: null,
      rows: input.rows.map((row) => ({
        session_id: context.sessionId,
        batch_id: row.batchId,
        shuttles_used: row.shuttlesUsed,
        recorded_by: context.userId,
      })),
    }
  }

  const allocation = allocateCheapestFirst(input.totalShuttles, context.batchesForAllocation)
  if (!allocation) {
    const totalAvailable = context.batchesForAllocation.reduce(
      (sum, batch) => sum + batch.shuttlesRemaining,
      0
    )
    return {
      rows: [],
      error: `Not enough stock. Only ${totalAvailable} shuttles available.`,
    }
  }

  return {
    error: null,
    rows: allocation.map((item) => ({
      session_id: context.sessionId,
      batch_id: item.batchId,
      shuttles_used: item.shuttlesUsed,
      recorded_by: context.userId,
    })),
  }
}

export function buildManualBatchOptions(
  batches: BatchForAllocation[]
): ManualBatchOption[] {
  return batches
    .filter((batch) => batch.shuttlesRemaining > 0)
    .map((batch) => ({
      batchId: batch.id,
      tubeId: batch.tubeStart,
      brand: batch.brand,
      shuttlesRemaining: batch.shuttlesRemaining,
      costPerTube: batch.costPerTube,
      notes: batch.notes,
    }))
}

export function buildManualAllocationRows(
  usageRows: SavedUsageRow[],
  batches: BatchForAllocation[]
): UsageAllocation[] {
  const batchMap = new Map(batches.map((batch) => [batch.id, batch]))

  return usageRows.map((usage) => {
    const batch = batchMap.get(usage.batch_id)

    return {
      batchId: usage.batch_id,
      tubeId: batch?.tubeStart ?? null,
      brand: batch?.brand ?? '',
      shuttlesUsed: usage.shuttles_used,
      shuttlesRemaining: batch?.shuttlesRemaining ?? 0,
      costPerTube: batch?.costPerTube ?? 0,
      notes: batch?.notes ?? null,
    }
  })
}

export function useSessionFinance(sessionId: string): SessionFinanceData {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingUsage, setIsSavingUsage] = useState(false)
  const [isSavingAllocationMode, setIsSavingAllocationMode] = useState(false)
  const [isSavingCourtCost, setIsSavingCourtCost] = useState(false)
  const [isSavingPersonalShare, setIsSavingPersonalShare] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('auto')
  const [session, setSession] = useState<{
    date: string
    feePerPlayer: number
    courtCost: number | null
    personalShareOverride: number | null
  } | null>(null)
  const [registrationCount, setRegistrationCount] = useState(0)
  const [usageAllocations, setUsageAllocations] = useState<UsageAllocation[]>([])
  const [batchesForAllocation, setBatchesForAllocation] = useState<BatchForAllocation[]>([])
  const [revenue, setRevenue] = useState(0)
  const [shuttleCost, setShuttleCost] = useState(0)
  const [baseProfit, setBaseProfit] = useState(0)
  const [profit, setProfit] = useState(0)
  const [effectivePersonalShare, setEffectivePersonalShare] = useState(0)
  const [totalShuttlesLogged, setTotalShuttlesLogged] = useState(0)

  const fetchAll = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? false
    if (!background) {
      setIsLoading(true)
    }
    setFetchError(null)
    if (!sessionId) {
      setFetchError('Session not found')
      setIsLoading(false)
      setHasLoadedOnce(true)
      return
    }

    const { data: financeRows, error: financeErr } = await supabase.rpc('get_session_finance', {
      p_session_id: sessionId,
    })
    const financeRow = financeRows?.[0]
    if (financeErr || !financeRow) {
      setFetchError(financeErr?.message ?? 'Session not found')
      setIsLoading(false)
      setHasLoadedOnce(true)
      return
    }

    setSession({
      date: financeRow.date,
      feePerPlayer: Number(financeRow.fee_per_player),
      courtCost: financeRow.court_cost === null ? null : Number(financeRow.court_cost),
      personalShareOverride: financeRow.personal_share_override === null
        ? null
        : Number(financeRow.personal_share_override),
    })
    setAllocationMode(normalizeAllocationMode(financeRow.shuttle_allocation_mode))
    setRegistrationCount(Number(financeRow.total_count))
    setRevenue(Number(financeRow.revenue))
    setShuttleCost(Number(financeRow.shuttle_cost))
    setBaseProfit(Number(financeRow.profit))
    setProfit(Number(financeRow.profit_after_personal_share))
    setEffectivePersonalShare(Number(financeRow.effective_personal_share))
    setTotalShuttlesLogged(Number(financeRow.total_shuttles_logged))

    const { data: batchRows, error: batchErr } = await supabase
      .from('shuttle_batches')
      .select('id, brand, tube_count, shuttles_per_tube, cost_per_tube, created_at, notes')
      .order('cost_per_tube', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    if (batchErr) {
      setFetchError(batchErr.message)
      setIsLoading(false)
      setHasLoadedOnce(true)
      return
    }

    const creationOrdered = [...(batchRows ?? [])].sort(compareBatchIdentity)
    const tubeStartMap = new Map<string, number>()
    let cursor = 1001
    for (const batch of creationOrdered) {
      tubeStartMap.set(batch.id, cursor)
      cursor += batch.tube_count
    }

    const { data: usageRows, error: usageErr } = await supabase
      .from('shuttle_usage')
      .select('batch_id, shuttles_used')
      .eq('session_id', sessionId)
    if (usageErr) {
      setFetchError(usageErr.message)
      setIsLoading(false)
      setHasLoadedOnce(true)
      return
    }

    const { data: allUsage, error: allUsageErr } = await supabase
      .from('shuttle_usage')
      .select('session_id, batch_id, shuttles_used')
    if (allUsageErr) {
      setFetchError(allUsageErr.message)
      setIsLoading(false)
      setHasLoadedOnce(true)
      return
    }

    const usageMap = buildUsageMapForAllocation(allUsage ?? [], sessionId)

    const mappedBatches = (batchRows ?? []).map((batch) => ({
      id: batch.id,
      brand: batch.brand,
      shuttlesRemaining: Math.max(0, batch.tube_count * batch.shuttles_per_tube - (usageMap.get(batch.id) ?? 0)),
      costPerTube: Number(batch.cost_per_tube),
      tubeStart: tubeStartMap.get(batch.id) ?? 1001,
      notes: batch.notes,
    }))

    setUsageAllocations(buildManualAllocationRows(usageRows ?? [], mappedBatches))
    setBatchesForAllocation(mappedBatches)
    setIsLoading(false)
    setHasLoadedOnce(true)
  }, [sessionId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const saveUsageAllocation = useCallback(async (
    input: SaveUsageInput
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    setIsSavingUsage(true)

    const { rows, error: buildError } = buildUsageRowsForSave(input, {
      sessionId,
      userId: user.id,
      batchesForAllocation,
    })
    if (buildError) {
      setIsSavingUsage(false)
      return { error: buildError }
    }

    const { error: modeErr } = await supabase
      .from('sessions')
      .update({ shuttle_allocation_mode: input.allocationMode })
      .eq('id', sessionId)
    if (modeErr) {
      setIsSavingUsage(false)
      return { error: modeErr.message }
    }

    const { error: deleteErr } = await supabase
      .from('shuttle_usage')
      .delete()
      .eq('session_id', sessionId)
    if (deleteErr) {
      setIsSavingUsage(false)
      return { error: deleteErr.message }
    }

    if (rows.length === 0) {
      await fetchAll({ background: hasLoadedOnce })
      setIsSavingUsage(false)
      return { error: null }
    }

    const { error: insertErr } = await supabase.from('shuttle_usage').insert(rows)
    if (insertErr) {
      setIsSavingUsage(false)
      return { error: insertErr.message }
    }

    await fetchAll({ background: hasLoadedOnce })
    setIsSavingUsage(false)
    return { error: null }
  }, [user, sessionId, batchesForAllocation, fetchAll, hasLoadedOnce])

  const logUsage = useCallback(async (totalShuttles: number): Promise<{ error: string | null }> => (
    saveUsageAllocation({
      allocationMode: 'auto',
      totalShuttles,
    })
  ), [saveUsageAllocation])

  const saveAllocationMode = useCallback(async (
    mode: AllocationMode
  ): Promise<{ error: string | null }> => {
    setIsSavingAllocationMode(true)
    const { error } = await supabase
      .from('sessions')
      .update({ shuttle_allocation_mode: mode })
      .eq('id', sessionId)
    if (error) {
      setIsSavingAllocationMode(false)
      return { error: error.message }
    }

    await fetchAll({ background: hasLoadedOnce })
    setIsSavingAllocationMode(false)
    return { error: null }
  }, [sessionId, fetchAll, hasLoadedOnce])

  const saveCourtCost = useCallback(async (amount: number): Promise<{ error: string | null }> => {
    setIsSavingCourtCost(true)
    const { error } = await supabase
      .from('sessions')
      .update({ court_cost: amount })
      .eq('id', sessionId)
    if (error) {
      setIsSavingCourtCost(false)
      return { error: error.message }
    }

    await fetchAll({ background: hasLoadedOnce })
    setIsSavingCourtCost(false)
    return { error: null }
  }, [sessionId, fetchAll, hasLoadedOnce])

  const savePersonalShare = useCallback(async (amount: number | null): Promise<{ error: string | null }> => {
    setIsSavingPersonalShare(true)
    const { error } = await supabase
      .from('sessions')
      .update({ personal_share_override: amount })
      .eq('id', sessionId)
    if (error) {
      setIsSavingPersonalShare(false)
      return { error: error.message }
    }

    await fetchAll({ background: hasLoadedOnce })
    setIsSavingPersonalShare(false)
    return { error: null }
  }, [sessionId, fetchAll, hasLoadedOnce])

  const totalStockAvailable = batchesForAllocation.reduce((sum, batch) => sum + batch.shuttlesRemaining, 0)

  return {
    sessionId,
    sessionDate: session?.date ?? '',
    allocationMode,
    feePerPlayer: session?.feePerPlayer ?? null,
    courtCost: session?.courtCost ?? null,
    registrationCount,
    usageAllocations,
    revenue,
    shuttleCost,
    baseProfit,
    profit,
    personalShareOverride: session?.personalShareOverride ?? null,
    effectivePersonalShare,
    totalShuttlesLogged,
    isLoading,
    fetchError,
    isSavingUsage,
    isSavingAllocationMode,
    isSavingCourtCost,
    isSavingPersonalShare,
    totalStockAvailable,
    availableManualBatches: buildManualBatchOptions(batchesForAllocation),
    logUsage,
    saveUsageAllocation,
    saveAllocationMode,
    saveCourtCost,
    savePersonalShare,
    refetch: fetchAll,
  }
}
