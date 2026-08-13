import { useEffect, useState } from 'react'
import type { ManualBatchOption } from '@/hooks/useSessionFinance'
import { formatPeso } from '@/utils/formatPeso'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ManualBatchPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  batches: ManualBatchOption[]
  selectedBatchIds?: string[]
  onAddBatch: (batch: ManualBatchOption) => void
}

export function ManualBatchPickerDialog({
  open,
  onOpenChange,
  batches,
  selectedBatchIds = [],
  onAddBatch,
}: ManualBatchPickerDialogProps) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  const normalizedSearch = search.trim().toLowerCase()
  const filteredBatches = normalizedSearch
    ? batches.filter((batch) => batch.brand.toLowerCase().includes(normalizedSearch))
    : batches

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Pick Manual Batches</DialogTitle>
          <DialogDescription>
            Search available inventory by brand. Leave search empty to browse the cheapest batches first.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <Input
            className="shrink-0"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search brand"
            aria-label="Search batches by brand"
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredBatches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {batches.length === 0
                  ? 'No available batches to add right now.'
                  : 'No batches match that brand search.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tube ID</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-center whitespace-normal w-24">Shuttles Left</TableHead>
                    <TableHead className="text-right">Cost/Tube</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map((batch) => {
                    const isSelected = selectedBatchIds.includes(batch.batchId)

                    return (
                      <TableRow key={batch.batchId}>
                        <TableCell className="text-sm font-mono">T-{batch.tubeId}</TableCell>
                        <TableCell className="text-sm">{batch.brand}</TableCell>
                        <TableCell className="text-center text-sm">{batch.shuttlesRemaining}</TableCell>
                        <TableCell className="text-right text-sm">{formatPeso(batch.costPerTube)}</TableCell>
                        <TableCell className="max-w-[220px] whitespace-normal text-sm text-muted-foreground">
                          {batch.notes ?? '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={isSelected ? 'outline' : 'default'}
                            disabled={isSelected}
                            onClick={() => onAddBatch(batch)}
                          >
                            {isSelected ? 'Added' : 'Add'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
