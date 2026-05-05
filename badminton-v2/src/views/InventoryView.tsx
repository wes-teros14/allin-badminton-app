import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useShuttleBatches } from '@/hooks/useShuttleBatches'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Package, Plus } from 'lucide-react'

const formatPeso = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)

const addBatchSchema = z.object({
  brand: z.string().min(1, 'Brand is required.'),
  tubeCount: z.coerce
    .number({ invalid_type_error: 'Enter number of tubes bought.' })
    .int()
    .min(1, 'Must be at least 1 tube.'),
  costPerTube: z.coerce
    .number({ invalid_type_error: 'Enter cost per tube.' })
    .positive('Cost must be greater than 0.'),
  notes: z.string().optional(),
})
type AddBatchForm = z.infer<typeof addBatchSchema>

export default function InventoryView() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { batches, isLoading, totalStockRemaining, addBatch } = useShuttleBatches()

  const form = useForm<AddBatchForm>({
    resolver: zodResolver(addBatchSchema),
    defaultValues: { brand: '', tubeCount: 1, costPerTube: 0, notes: '' },
  })

  async function handleSubmit(data: AddBatchForm) {
    setIsSubmitting(true)
    const result = await addBatch({
      brand: data.brand,
      tubeCount: data.tubeCount,
      costPerTube: data.costPerTube,
      notes: data.notes || null,
    })
    setIsSubmitting(false)
    if (result.error) {
      toast.error('Failed to add batch. Try again.')
      return
    }
    toast.success('Batch added.')
    form.reset()
    setDialogOpen(false)
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-primary">Inventory</h1>
        <Button
          size="sm"
          aria-label="Add shuttle batch"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" />
          Add Batch
        </Button>
      </div>

      {/* Stock summary — only shown when data is loaded and batches exist */}
      {!isLoading && batches.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {totalStockRemaining} tubes in stock across {batches.length}{' '}
          batch{batches.length !== 1 ? 'es' : ''}
        </p>
      )}

      {/* Batch table card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            /* Loading state: 3 animate-pulse skeleton rows */
            <div className="p-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : batches.length === 0 ? (
            /* Empty state */
            <div className="py-12 text-center space-y-2">
              <Package
                className="size-8 text-muted-foreground mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold">No batches yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first shuttle batch to start tracking inventory.
              </p>
            </div>
          ) : (
            /* Batch table — 6 columns per D-03 */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tube ID</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Tubes Bought</TableHead>
                  <TableHead className="text-right">Stock Remaining</TableHead>
                  <TableHead className="text-right">Cost/Tube</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow
                    key={batch.id}
                    className={
                      batch.tubesRemaining === 0
                        ? 'bg-muted/30 hover:bg-muted/40'
                        : 'hover:bg-muted/20'
                    }
                  >
                    {/* Tube ID range: T-1001 – T-1012 */}
                    <TableCell className="text-sm font-mono">
                      T-{batch.tubeStart} &ndash; T-{batch.tubeEnd}
                    </TableCell>
                    <TableCell className="text-sm">{batch.brand}</TableCell>
                    <TableCell className="text-right text-sm">
                      {batch.tubeCount}
                    </TableCell>
                    {/* Stock Remaining: Badge for depleted, number otherwise */}
                    <TableCell className="text-right text-sm">
                      {batch.tubesRemaining === 0 ? (
                        <Badge
                          variant="secondary"
                          aria-label="Depleted batch"
                        >
                          Depleted
                        </Badge>
                      ) : (
                        batch.tubesRemaining
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatPeso(batch.costPerTube)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                      {batch.notes ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Batch Dialog — controlled via dialogOpen state (no DialogTrigger) */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) form.reset()
          setDialogOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Shuttle Batch</DialogTitle>
            <DialogDescription>
              Record a new shuttle purchase. Tube IDs are assigned automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Brand */}
            <div className="space-y-1">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                placeholder="e.g. Yonex Mavis 350"
                aria-invalid={!!form.formState.errors.brand}
                {...form.register('brand')}
              />
              {form.formState.errors.brand && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.brand.message}
                </p>
              )}
            </div>

            {/* Tubes Bought */}
            <div className="space-y-1">
              <Label htmlFor="tubeCount">Tubes Bought</Label>
              <Input
                id="tubeCount"
                type="number"
                placeholder="e.g. 12"
                min={1}
                aria-invalid={!!form.formState.errors.tubeCount}
                {...form.register('tubeCount')}
              />
              {form.formState.errors.tubeCount && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.tubeCount.message}
                </p>
              )}
            </div>

            {/* Cost per Tube */}
            <div className="space-y-1">
              <Label htmlFor="costPerTube">Cost per Tube (&#8369;)</Label>
              <Input
                id="costPerTube"
                type="number"
                step="0.01"
                placeholder="e.g. 85.00"
                min={0.01}
                aria-invalid={!!form.formState.errors.costPerTube}
                {...form.register('costPerTube')}
              />
              {form.formState.errors.costPerTube && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.costPerTube.message}
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Optional — e.g. bought at SM Megamall"
                {...form.register('notes')}
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Adding…' : 'Add Batch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
