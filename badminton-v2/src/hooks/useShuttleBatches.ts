import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { compareBatchIdentity } from '@/hooks/useSessionFinance'

export interface ShuttleBatch {
  id: string
  brand: string
  tubeCount: number
  shuttlesPerTube: number
  costPerTube: number
  isArchived: boolean
  notes: string | null
  purchasedAt: string
  createdAt: string
  shuttlesRemaining: number
  tubeStart: number
  tubeEnd: number
}

export interface AddBatchInput {
  brand: string
  quantity: number
  shuttlesPerTube: number
  costPerTube: number
  notes?: string | null
}

interface ShuttleBatchState {
  batches: ShuttleBatch[]
  isLoading: boolean
  fetchError: string | null
  totalStockRemaining: number
  addBatch: (input: AddBatchInput) => Promise<{ error: string | null }>
  archiveBatch: (batchId: string) => Promise<{ error: string | null }>
}

export function useShuttleBatches(): ShuttleBatchState {
  const { user } = useAuth()
  const [batches, setBatches] = useState<ShuttleBatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchBatches = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)

    const { data: batchRows, error } = await supabase
      .from('shuttle_batches')
      .select('id, brand, tube_count, shuttles_per_tube, cost_per_tube, is_archived, notes, purchased_at, created_at')
      .order('cost_per_tube', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    if (error) {
      setFetchError(error.message)
      setIsLoading(false)
      return
    }

    const { data: usageRows, error: usageError } = await supabase
      .from('shuttle_usage')
      .select('batch_id, shuttles_used')

    if (usageError) {
      setFetchError(usageError.message)
      setIsLoading(false)
      return
    }

    const usageMap = new Map<string, number>()
    for (const usage of usageRows ?? []) {
      usageMap.set(usage.batch_id, (usageMap.get(usage.batch_id) ?? 0) + usage.shuttles_used)
    }

    // Keep display numbering stable by numbering all tubes, then filtering archived rows.
    const creationOrdered = [...(batchRows ?? [])].sort(compareBatchIdentity)
    const tubeStartMap = new Map<string, number>()
    let cursor = 1001
    for (const batch of creationOrdered) {
      tubeStartMap.set(batch.id, cursor)
      cursor += batch.tube_count
    }

    const mapped: ShuttleBatch[] = (batchRows ?? []).map((batch) => {
      const shuttlesUsed = usageMap.get(batch.id) ?? 0
      const tubeStart = tubeStartMap.get(batch.id) ?? 1001
      const maxShuttles = batch.tube_count * batch.shuttles_per_tube

      return {
        id: batch.id,
        brand: batch.brand,
        tubeCount: batch.tube_count,
        shuttlesPerTube: batch.shuttles_per_tube,
        costPerTube: Number(batch.cost_per_tube),
        isArchived: batch.is_archived,
        notes: batch.notes,
        purchasedAt: batch.purchased_at,
        createdAt: batch.created_at,
        shuttlesRemaining: Math.max(0, maxShuttles - shuttlesUsed),
        tubeStart,
        tubeEnd: tubeStart + batch.tube_count - 1,
      }
    })

    setBatches(mapped.filter((batch) => !batch.isArchived))
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  const addBatch = useCallback(async (input: AddBatchInput): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }

    const rows = Array.from({ length: input.quantity }, () => ({
      brand: input.brand,
      tube_count: 1,
      shuttles_per_tube: input.shuttlesPerTube,
      cost_per_tube: input.costPerTube,
      notes: input.notes ?? null,
      created_by: user.id,
    }))
    const { error } = await supabase.from('shuttle_batches').insert(rows)
    if (error) return { error: error.message }

    await fetchBatches()
    return { error: null }
  }, [user, fetchBatches])

  const archiveBatch = useCallback(async (batchId: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' }

    const batch = batches.find((item) => item.id === batchId)
    if (!batch) return { error: 'Tube not found' }
    if (batch.shuttlesRemaining > 0) return { error: 'Only depleted tubes can be archived' }

    const { error } = await supabase
      .from('shuttle_batches')
      .update({ is_archived: true })
      .eq('id', batchId)

    if (error) return { error: error.message }

    await fetchBatches()
    return { error: null }
  }, [user, batches, fetchBatches])

  const totalStockRemaining = batches.reduce((sum, batch) => sum + batch.shuttlesRemaining, 0)

  return { batches, isLoading, fetchError, totalStockRemaining, addBatch, archiveBatch }
}
