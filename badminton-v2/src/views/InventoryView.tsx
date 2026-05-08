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
import { formatPeso } from '@/utils/formatPeso'

const addBatchSchema = z.object({
  brand: z.string().min(1, 'Brand is required.'),
  quantity: z.coerce
    .number({ error: 'Enter number of tubes.' })
    .int()
    .min(1, 'Must be at least 1 tube.'),
  costPerTube: z.coerce
    .number({ error: 'Enter cost per tube.' })
    .positive('Cost must be greater than 0.'),
  notes: z.string().optional(),
})

type AddBatchFormInput = z.input<typeof addBatchSchema>
type AddBatchFormOutput = z.output<typeof addBatchSchema>

export default function InventoryView() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const { batches, isLoading, totalStockRemaining, addBatch, archiveBatch } = useShuttleBatches()

  const form = useForm<AddBatchFormInput, unknown, AddBatchFormOutput>({
    resolver: zodResolver(addBatchSchema),
    defaultValues: {
      brand: '',
      quantity: '' as unknown as number,
      costPerTube: '' as unknown as number,
      notes: '',
    },
  })

  async function handleSubmit(data: AddBatchFormOutput) {
    setIsSubmitting(true)
    const result = await addBatch({
      brand: data.brand,
      quantity: data.quantity,
      costPerTube: data.costPerTube,
      notes: data.notes || null,
    })
    setIsSubmitting(false)
    if (result.error) {
      toast.error('Failed to add tubes. Try again.')
      return
    }
    toast.success(`${data.quantity} tube${data.quantity !== 1 ? 's' : ''} added.`)
    form.reset()
    setDialogOpen(false)
  }

  async function handleArchive(batchId: string) {
    setArchivingId(batchId)
    const result = await archiveBatch(batchId)
    setArchivingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Tube archived.')
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-primary">Inventory</h1>
        <Button
          size="sm"
          aria-label="Add shuttle tubes"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" />
          Add Tubes
        </Button>
      </div>

      {!isLoading && batches.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {batches.length} tube{batches.length !== 1 ? 's' : ''} &middot; {totalStockRemaining} shuttles remaining
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Package
                className="size-8 text-muted-foreground mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold">No active tubes</p>
              <p className="text-sm text-muted-foreground">
                Add shuttle tubes to start tracking inventory.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tube ID</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-center whitespace-normal w-20">Shuttles Left</TableHead>
                  <TableHead className="text-right">Cost/Tube</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow
                    key={batch.id}
                    className={
                      batch.shuttlesRemaining === 0
                        ? 'bg-muted/30 hover:bg-muted/40'
                        : 'hover:bg-muted/20'
                    }
                  >
                    <TableCell className="text-sm font-mono">
                      T-{batch.tubeStart}
                    </TableCell>
                    <TableCell className="text-sm">{batch.brand}</TableCell>
                    <TableCell className="text-center text-sm">
                      {batch.shuttlesRemaining === 0 ? (
                        <Badge
                          variant="secondary"
                          aria-label="Depleted tube"
                        >
                          Depleted
                        </Badge>
                      ) : (
                        batch.shuttlesRemaining
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatPeso(batch.costPerTube)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                      {batch.notes ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.shuttlesRemaining === 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={archivingId === batch.id}
                          onClick={() => handleArchive(batch.id)}
                        >
                          {archivingId === batch.id ? 'Archiving...' : 'Archive'}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) form.reset()
          setDialogOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tubes</DialogTitle>
            <DialogDescription>
              Record a tube purchase. Each tube holds 12 shuttles. IDs are assigned automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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

            <div className="space-y-1">
              <Label htmlFor="quantity">Quantity (tubes)</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="e.g. 5"
                min={1}
                aria-invalid={!!form.formState.errors.quantity}
                {...form.register('quantity')}
              />
              {form.formState.errors.quantity && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.quantity.message}
                </p>
              )}
            </div>

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

            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Optional - e.g. bought at SM Megamall"
                {...form.register('notes')}
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Adding...' : 'Add Tubes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
