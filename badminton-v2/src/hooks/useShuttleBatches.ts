import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface ShuttleBatch {
  id: string
  brand: string
  tubeCount: number
  costPerTube: number
  notes: string | null
  purchasedAt: string
  createdAt: string
  tubesRemaining: number
  tubeStart: number
  tubeEnd: number
}

export interface AddBatchInput {
  brand: string
  tubeCount: number
  costPerTube: number
  notes?: string | null
}

interface ShuttleBatchState {
  batches: ShuttleBatch[]
  isLoading: boolean
  totalStockRemaining: number
  addBatch: (input: AddBatchInput) => Promise<{ error: string | null }>
}

export function useShuttleBatches(): ShuttleBatchState {
  const { user } = useAuth()
  const [batches, setBatches] = useState<ShuttleBatch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchBatches = useCallback(async () => {
    setIsLoading(true)

    // 1. Fetch batches ordered cheapest first (D-04: cost_per_tube ASC)
    const { data: batchRows, error } = await supabase
      .from('shuttle_batches')
      .select('id, brand, tube_count, cost_per_tube, notes, purchased_at, created_at')
      .order('cost_per_tube', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      setIsLoading(false)
      return
    }

    // 2. Fetch all usage rows to compute remaining tubes per batch (INV-04)
    const { data: usageRows } = await supabase
      .from('shuttle_usage')
      .select('batch_id, tubes_used')

    // 3. Build usage map: batch_id → total tubes used
    const usageMap = new Map<string, number>()
    for (const u of (usageRows ?? [])) {
      usageMap.set(u.batch_id, (usageMap.get(u.batch_id) ?? 0) + u.tubes_used)
    }

    // 4. Fetch batches ordered by creation date to assign sequential tube IDs (INV-03)
    //    First batch ever created = T-1001 through T-1012, next batch continues from there, etc.
    const { data: orderedByCreation } = await supabase
      .from('shuttle_batches')
      .select('id, tube_count')
      .order('created_at', { ascending: true })

    const tubeStartMap = new Map<string, number>()
    let cursor = 1001
    for (const b of (orderedByCreation ?? [])) {
      tubeStartMap.set(b.id, cursor)
      cursor += b.tube_count
    }

    // 5. Map to ShuttleBatch[], preserving cheapest-first order from step 1
    const mapped: ShuttleBatch[] = (batchRows ?? []).map((b) => {
      const tubesUsed = usageMap.get(b.id) ?? 0
      const tubeStart = tubeStartMap.get(b.id) ?? 1001
      return {
        id: b.id,
        brand: b.brand,
        tubeCount: b.tube_count,
        costPerTube: Number(b.cost_per_tube),
        notes: b.notes,
        purchasedAt: b.purchased_at,
        createdAt: b.created_at,
        tubesRemaining: Math.max(0, b.tube_count - tubesUsed),
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

  // 6. addBatch mutation — inserts a new shuttle batch with auth user as created_by
  async function addBatch(input: AddBatchInput): Promise<{ error: string | null }> {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('shuttle_batches').insert({
      brand: input.brand,
      tube_count: input.tubeCount,
      cost_per_tube: input.costPerTube,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    if (error) return { error: error.message }
    await fetchBatches()
    return { error: null }
  }

  // 7. Derive total stock remaining across all batches (INV-05)
  const totalStockRemaining = batches.reduce((sum, b) => sum + b.tubesRemaining, 0)

  return { batches, isLoading, totalStockRemaining, addBatch }
}
