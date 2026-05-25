import { describe, expect, it, vi } from 'vitest'
import {
  buildUsageRowsForSave,
  allocateCheapestFirst,
  buildManualAllocationRows,
  buildManualBatchOptions,
  buildUsageMapForAllocation,
  calculateProfitAfterPersonalShare,
  compareAllocationOrder,
  compareBatchIdentity,
  normalizeAllocationMode,
  validateManualUsageRows,
} from '@/hooks/useSessionFinance'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}))

describe('useSessionFinance helpers', () => {
  it('does not change profit when no manual share is set', () => {
    expect(calculateProfitAfterPersonalShare(900, null)).toBe(900)
  })

  it('uses the manual override when one is set', () => {
    expect(calculateProfitAfterPersonalShare(900, 150)).toBe(750)
  })

  it('normalizes missing allocation mode to auto', () => {
    expect(normalizeAllocationMode(null)).toBe('auto')
    expect(normalizeAllocationMode(undefined)).toBe('auto')
  })

  it('keeps manual allocation mode when present', () => {
    expect(normalizeAllocationMode('manual')).toBe('manual')
  })

  it('allocates across partial tubes based on remaining shuttles', () => {
    expect(
      allocateCheapestFirst(8, [
        { id: 'a', brand: 'A', shuttlesRemaining: 6, costPerTube: 80, tubeStart: 1001 },
        { id: 'b', brand: 'B', shuttlesRemaining: 12, costPerTube: 90, tubeStart: 1002 },
      ])
    ).toEqual([
      {
        batchId: 'a',
        tubeId: 1001,
        brand: 'A',
        shuttlesUsed: 6,
        shuttlesRemaining: 6,
        costPerTube: 80,
        notes: undefined,
      },
      {
        batchId: 'b',
        tubeId: 1002,
        brand: 'B',
        shuttlesUsed: 2,
        shuttlesRemaining: 12,
        costPerTube: 90,
        notes: undefined,
      },
    ])
  })

  it('returns no allocation for zero shuttles', () => {
    expect(
      allocateCheapestFirst(0, [
        { id: 'a', brand: 'A', shuttlesRemaining: 12, costPerTube: 80, tubeStart: 1001 },
      ])
    ).toEqual([])
  })

  it('excludes current session usage when computing allocation stock', () => {
    const usageMap = buildUsageMapForAllocation([
      { session_id: 'current-session', batch_id: 'tube-1006', shuttles_used: 1 },
      { session_id: 'other-session', batch_id: 'tube-1006', shuttles_used: 5 },
      { session_id: 'other-session', batch_id: 'tube-1007', shuttles_used: 2 },
    ], 'current-session')

    expect(usageMap.get('tube-1006')).toBe(5)
    expect(usageMap.get('tube-1007')).toBe(2)
  })

  it('uses the lower tube number first when same-price tubes tie', () => {
    expect(
      allocateCheapestFirst(12, [
        { id: 'b', brand: 'XP2', shuttlesRemaining: 12, costPerTube: 936, tubeStart: 1007 },
        { id: 'a', brand: 'XP2', shuttlesRemaining: 12, costPerTube: 936, tubeStart: 1006 },
      ])
    ).toEqual([
      {
        batchId: 'a',
        tubeId: 1006,
        brand: 'XP2',
        shuttlesUsed: 12,
        shuttlesRemaining: 12,
        costPerTube: 936,
        notes: undefined,
      },
    ])
  })

  it('builds auto save rows from cheapest-first allocation output', () => {
    const result = buildUsageRowsForSave(
      {
        allocationMode: 'auto',
        totalShuttles: 14,
      },
      {
        sessionId: 'session-1',
        userId: 'user-1',
        batchesForAllocation: [
          { id: 'batch-a', brand: 'A', shuttlesRemaining: 12, costPerTube: 80, tubeStart: 1001 },
          { id: 'batch-b', brand: 'B', shuttlesRemaining: 12, costPerTube: 90, tubeStart: 1002 },
        ],
      }
    )

    expect(result.error).toBeNull()
    expect(result.rows).toEqual([
      {
        session_id: 'session-1',
        batch_id: 'batch-a',
        shuttles_used: 12,
        recorded_by: 'user-1',
      },
      {
        session_id: 'session-1',
        batch_id: 'batch-b',
        shuttles_used: 2,
        recorded_by: 'user-1',
      },
    ])
  })

  it('builds manual save rows as explicit per-batch usage records', () => {
    const result = buildUsageRowsForSave(
      {
        allocationMode: 'manual',
        rows: [
          { batchId: 'batch-a', shuttlesUsed: 5 },
          { batchId: 'batch-b', shuttlesUsed: 7 },
        ],
      },
      {
        sessionId: 'session-2',
        userId: 'user-2',
        batchesForAllocation: [
          { id: 'batch-a', brand: 'A', shuttlesRemaining: 12, costPerTube: 80, tubeStart: 1001, notes: null },
          { id: 'batch-b', brand: 'B', shuttlesRemaining: 12, costPerTube: 90, tubeStart: 1002, notes: null },
        ],
      }
    )

    expect(result.error).toBeNull()
    expect(result.rows).toEqual([
      {
        session_id: 'session-2',
        batch_id: 'batch-a',
        shuttles_used: 5,
        recorded_by: 'user-2',
      },
      {
        session_id: 'session-2',
        batch_id: 'batch-b',
        shuttles_used: 7,
        recorded_by: 'user-2',
      },
    ])
  })

  it('rejects empty manual allocations before save rows are built', () => {
    const validation = validateManualUsageRows([], [
      { id: 'batch-a', brand: 'A', shuttlesRemaining: 12, costPerTube: 80, tubeStart: 1001, notes: null },
    ])

    expect(validation).toEqual({
      isValid: false,
      formError: 'Add at least one batch before saving.',
      rowErrors: {},
    })

    const result = buildUsageRowsForSave(
      {
        allocationMode: 'manual',
        rows: [],
      },
      {
        sessionId: 'session-3',
        userId: 'user-3',
        batchesForAllocation: [
          { id: 'batch-a', brand: 'A', shuttlesRemaining: 12, costPerTube: 80, tubeStart: 1001, notes: null },
        ],
      }
    )

    expect(result.rows).toEqual([])
    expect(result.error).toBe('Add at least one batch before saving.')
  })

  it('rejects duplicate manual batch rows', () => {
    const validation = validateManualUsageRows(
      [
        { batchId: 'batch-a', shuttlesUsed: 3 },
        { batchId: 'batch-a', shuttlesUsed: 4 },
      ],
      [
        { id: 'batch-a', brand: 'A', shuttlesRemaining: 12, costPerTube: 80, tubeStart: 1001, notes: null },
      ]
    )

    expect(validation.isValid).toBe(false)
    expect(validation.formError).toBe('Fix the highlighted manual allocation rows before saving.')
    expect(validation.rowErrors['batch-a']).toContain('Select each batch only once.')
  })

  it('rejects invalid manual shuttle counts', () => {
    const batches = [
      { id: 'zero', brand: 'Zero', shuttlesRemaining: 12, costPerTube: 80, tubeStart: 1001, notes: null },
      { id: 'negative', brand: 'Negative', shuttlesRemaining: 12, costPerTube: 80, tubeStart: 1002, notes: null },
      { id: 'fraction', brand: 'Fraction', shuttlesRemaining: 12, costPerTube: 80, tubeStart: 1003, notes: null },
    ]

    const validation = validateManualUsageRows(
      [
        { batchId: 'zero', shuttlesUsed: 0 },
        { batchId: 'negative', shuttlesUsed: -1 },
        { batchId: 'fraction', shuttlesUsed: 1.5 },
      ],
      batches
    )

    expect(validation.isValid).toBe(false)
    expect(validation.rowErrors.zero).toContain('Enter a whole number greater than 0.')
    expect(validation.rowErrors.negative).toContain('Enter a whole number greater than 0.')
    expect(validation.rowErrors.fraction).toContain('Enter a whole number greater than 0.')
  })

  it('rejects manual rows that exceed available stock', () => {
    const validation = validateManualUsageRows(
      [
        { batchId: 'batch-a', shuttlesUsed: 13 },
      ],
      [
        { id: 'batch-a', brand: 'A', shuttlesRemaining: 12, costPerTube: 80, tubeStart: 1001, notes: null },
      ]
    )

    expect(validation.isValid).toBe(false)
    expect(validation.rowErrors['batch-a']).toContain('Only 12 shuttles available in this batch.')
  })

  it('allows reopen-safe manual rows when this session usage is excluded from stock', () => {
    const usageMap = buildUsageMapForAllocation([
      { session_id: 'current-session', batch_id: 'batch-a', shuttles_used: 4 },
      { session_id: 'other-session', batch_id: 'batch-a', shuttles_used: 2 },
    ], 'current-session')

    const batches = [
      {
        id: 'batch-a',
        brand: 'A',
        shuttlesRemaining: 12 - (usageMap.get('batch-a') ?? 0),
        costPerTube: 80,
        tubeStart: 1001,
        notes: null,
      },
    ]

    const validation = validateManualUsageRows(
      [{ batchId: 'batch-a', shuttlesUsed: 10 }],
      batches
    )

    expect(validation).toEqual({
      isValid: true,
      formError: null,
      rowErrors: {},
    })
  })

  it('builds manual picker batches in cheapest-first order with inventory details', () => {
    expect(
      buildManualBatchOptions([
        {
          id: 'batch-b',
          brand: 'B',
          shuttlesRemaining: 0,
          costPerTube: 95,
          tubeStart: 1003,
          notes: 'depleted',
        },
        {
          id: 'batch-a',
          brand: 'A',
          shuttlesRemaining: 12,
          costPerTube: 80,
          tubeStart: 1001,
          notes: null,
        },
        {
          id: 'batch-c',
          brand: 'C',
          shuttlesRemaining: 6,
          costPerTube: 90,
          tubeStart: 1002,
          notes: 'partial',
        },
      ])
    ).toEqual([
      {
        batchId: 'batch-a',
        tubeId: 1001,
        brand: 'A',
        shuttlesRemaining: 12,
        costPerTube: 80,
        notes: null,
      },
      {
        batchId: 'batch-c',
        tubeId: 1002,
        brand: 'C',
        shuttlesRemaining: 6,
        costPerTube: 90,
        notes: 'partial',
      },
    ])
  })

  it('hydrates saved manual allocation rows with inventory-style batch details', () => {
    expect(
      buildManualAllocationRows(
        [
          { batch_id: 'batch-c', shuttles_used: 4 },
          { batch_id: 'batch-a', shuttles_used: 7 },
        ],
        [
          {
            id: 'batch-a',
            brand: 'A',
            shuttlesRemaining: 12,
            costPerTube: 80,
            tubeStart: 1001,
            notes: null,
          },
          {
            id: 'batch-c',
            brand: 'C',
            shuttlesRemaining: 5,
            costPerTube: 90,
            tubeStart: 1002,
            notes: 'partial',
          },
        ]
      )
    ).toEqual([
      {
        batchId: 'batch-c',
        tubeId: 1002,
        brand: 'C',
        shuttlesUsed: 4,
        shuttlesRemaining: 5,
        costPerTube: 90,
        notes: 'partial',
      },
      {
        batchId: 'batch-a',
        tubeId: 1001,
        brand: 'A',
        shuttlesUsed: 7,
        shuttlesRemaining: 12,
        costPerTube: 80,
        notes: null,
      },
    ])
  })

  it('breaks identical timestamps by batch id for stable numbering', () => {
    expect(compareBatchIdentity(
      { id: 'batch-a', created_at: '2026-05-11T10:00:00Z' },
      { id: 'batch-b', created_at: '2026-05-11T10:00:00Z' }
    )).toBeLessThan(0)
  })

  it('breaks same-price allocation ties by tube number before batch id', () => {
    expect(compareAllocationOrder(
      { id: 'batch-b', brand: 'XP2', shuttlesRemaining: 12, costPerTube: 936, tubeStart: 1006 },
      { id: 'batch-a', brand: 'XP2', shuttlesRemaining: 12, costPerTube: 936, tubeStart: 1007 }
    )).toBeLessThan(0)
  })
})
