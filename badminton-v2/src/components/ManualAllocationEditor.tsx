import { useEffect, useRef, useState } from 'react'
import type { UsageAllocation } from '@/hooks/useSessionFinance'
import { formatPeso } from '@/utils/formatPeso'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ManualAllocationEditorProps {
  formError: string | null
  rows: UsageAllocation[]
  rowErrors: Record<string, string[]>
  onRowChange: (batchId: string, shuttlesUsed: number) => void
  onRemoveRow: (batchId: string) => void
}

export function ManualAllocationEditor({
  formError,
  rows,
  rowErrors,
  onRowChange,
  onRemoveRow,
}: ManualAllocationEditorProps) {
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (removeTimerRef.current) {
      clearTimeout(removeTimerRef.current)
    }
  }, [])

  const totalShuttles = rows.reduce(
    (sum, row) => sum + (Number.isFinite(row.shuttlesUsed) && row.shuttlesUsed > 0 ? row.shuttlesUsed : 0),
    0
  )

  function handleRemoveClick(batchId: string) {
    if (pendingRemove !== batchId) {
      if (removeTimerRef.current) {
        clearTimeout(removeTimerRef.current)
      }
      setPendingRemove(batchId)
      removeTimerRef.current = setTimeout(() => setPendingRemove(null), 3000)
      return
    }

    if (removeTimerRef.current) {
      clearTimeout(removeTimerRef.current)
    }
    setPendingRemove(null)
    onRemoveRow(batchId)
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        {formError && (
          <p className="text-sm text-destructive">{formError}</p>
        )}
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No manual batches selected yet.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {formError && (
        <p className="text-sm text-destructive">{formError}</p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tube ID</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead className="text-center whitespace-normal w-24">Shuttles Left</TableHead>
            <TableHead className="w-32 text-right">Used</TableHead>
            <TableHead className="text-right">Cost/Tube</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const inputValue = Number.isFinite(row.shuttlesUsed) ? row.shuttlesUsed : ''
            const errors = rowErrors[row.batchId] ?? []

            return (
            <TableRow key={row.batchId}>
              <TableCell className="text-sm font-mono">
                {row.tubeId !== null ? `T-${row.tubeId}` : 'T-?'}
              </TableCell>
              <TableCell className="text-sm">{row.brand}</TableCell>
              <TableCell className="text-center text-sm">{row.shuttlesRemaining}</TableCell>
              <TableCell className="text-right">
                <div className="space-y-1">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={inputValue}
                    aria-invalid={errors.length > 0}
                    className={`ml-auto w-24 text-right ${errors.length > 0 ? 'border-destructive focus-visible:ring-destructive/40' : ''}`}
                    onChange={(event) => {
                      const nextValue = Number.parseFloat(event.target.value)
                      onRowChange(row.batchId, nextValue)
                    }}
                  />
                  {errors.map((error) => (
                    <p key={`${row.batchId}-${error}`} className="text-left text-xs text-destructive">
                      {error}
                    </p>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right text-sm">{formatPeso(row.costPerTube)}</TableCell>
              <TableCell className="max-w-[220px] whitespace-normal text-sm text-muted-foreground">
                {row.notes ?? '-'}
              </TableCell>
              <TableCell className="text-right">
                <button
                  type="button"
                  onClick={() => handleRemoveClick(row.batchId)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    pendingRemove === row.batchId
                      ? 'bg-destructive text-white'
                      : 'text-destructive hover:bg-destructive/10'
                  }`}
                >
                  {pendingRemove === row.batchId ? 'Sure?' : 'Remove'}
                </button>
              </TableCell>
            </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm">
        <span className="font-medium">Total logged shuttles</span>
        <span>{totalShuttles}</span>
      </div>
    </div>
  )
}
