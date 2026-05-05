import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const SHUTTLES_PER_TUBE = 12

export interface ShuttleBatch {
  id: string
  brand: string
  tubeCount: number        // always 1 — each row is one physical tube
  costPerTube: number
  notes: string | null
  purchasedAt: string
  createdAt: string
  shuttlesRemaining: number  // 0–12: SHUTTLES_PER_TUBE minus shuttles used from this tube
  tubeStart: number
  tubeEnd: number
}

export interface AddBatchInput {
  brand: string
  quantity: number          // number of tubes to add; creates `quantity` rows each with tube_count=1
  costPerTube: number
  notes?: string | null
}

interface ShuttleBatchState {
  batches: ShuttleBatch[]
  isLoading: boolean
  fetchError: string | null
  totalStockRemaining: number  // total shuttles remaining across all tubes
  addBatch: (input: AddBatchInput) => Promise<{ error: string | null }>
}

export function useShuttleBatches(): ShuttleBatchState {
  const { user } = useAuth()
  const [batches, setBatches] = useState<ShuttleBatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchBatches = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)

    // 1. Fetch batches cheapest-first (D-04)
    const { data: batchRows, error } = await supabase
      .from('shuttle_batches')
      .select('id, brand, tube_count, cost_per_tube, notes, purchased_at, created_at')
      .order('cost_per_tube', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      setFetchError(error.message)
      setIsLoading(false)
      return
    }

    // 2. Fetch all usage to compute shuttles used per batch
    const { data: usageRows, error: usageError } = await supabase
      .from('shuttle_usage')
      .select('batch_id, shuttles_used')

    if (usageError) {
      setFetchError(usageError.message)
      setIsLoading(false)
      return
    }

    // 3. Build usage map: batch_id → total shuttles used
    const usageMap = new Map<string, number>()
    for (const u of (usageRows ?? [])) {
      usageMap.set(u.batch_id, (usageMap.get(u.batch_id) ?? 0) + u.shuttles_used)
    }

    // 4. Assign sequential tube IDs (creation order)
    const creationOrdered = [...(batchRows ?? [])].sort((a, b) =>
      a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
    )
    const tubeStartMap = new Map<string, number>()
    let cursor = 1001
    for (const b of creationOrdered) {
      tubeStartMap.set(b.id, cursor)
      cursor += b.tube_count
    }

    // 5. Map to ShuttleBatch[], preserving cheapest-first order
    const mapped: ShuttleBatch[] = (batchRows ?? []).map((b) => {
      const shuttlesUsed = usageMap.get(b.id) ?? 0
      const tubeStart = tubeStartMap.get(b.id)!
      const maxShuttles = b.tube_count * SHUTTLES_PER_TUBE
      return {
        id: b.id,
        brand: b.brand,
        tubeCount: b.tube_count,
        costPerTube: Number(b.cost_per_tube),
        notes: b.notes,
        purchasedAt: b.purchased_at,
        createdAt: b.created_at,
        shuttlesRemaining: Math.max(0, maxShuttles - shuttlesUsed),
        tubeStart,
        tubeEnd: tubeStart + b.tube_count - 1,
      }
    })

    setBatches(mapped)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  // addBatch: insert `quantity` rows, each representing 1 physical tube with 12 shuttles
  const addBatch = useCallback(async (input: AddBatchInput): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }
    const rows = Array.from({ length: input.quantity }, () => ({
      brand: input.brand,
      tube_count: 1,
      cost_per_tube: input.costPerTube,
      notes: input.notes ?? null,
      created_by: user.id,
    }))
    const { error } = await supabase.from('shuttle_batches').insert(rows)
    if (error) return { error: error.message }
    await fetchBatches()
    return { error: null }
  }, [user, fetchBatches])

  // Total shuttles remaining across all tubes
  const totalStockRemaining = batches.reduce((sum, b) => sum + b.shuttlesRemaining, 0)

  return { batches, isLoading, fetchError, totalStockRemaining, addBatch }
}
