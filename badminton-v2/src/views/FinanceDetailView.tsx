import { useParams, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import {
  useSessionFinance,
  type AllocationMode,
  type BatchForAllocation,
  type ManualBatchOption,
  type UsageAllocation,
  validateManualUsageRows,
} from '@/hooks/useSessionFinance'
import { formatPeso } from '@/utils/formatPeso'
import { ManualAllocationEditor } from '@/components/ManualAllocationEditor'
import { ManualBatchPickerDialog } from '@/components/ManualBatchPickerDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { RosterPanel } from '@/components/RosterPanel'

const usageSchema = z.object({
  totalShuttles: z
    .number({ error: 'Enter total shuttles used.' })
    .int({ message: 'Enter a whole number.' })
    .min(0, 'Must be 0 or more.'),
})
type UsageFormOutput = z.output<typeof usageSchema>

const courtCostSchema = z.object({
  courtCost: z
    .number({ error: 'Enter a valid amount.' })
    .min(0, 'Cost must be 0 or more.'),
})
type CourtCostFormOutput = z.output<typeof courtCostSchema>

const personalShareSchema = z.object({
  personalShare: z
    .number({ error: 'Enter a valid amount.' })
    .min(0, 'Share must be 0 or more.'),
})
type PersonalShareFormOutput = z.output<typeof personalShareSchema>

export default function FinanceDetailView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const finance = useSessionFinance(sessionId ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [manualRows, setManualRows] = useState<UsageAllocation[]>([])
  const previousModeRef = useRef<AllocationMode | null>(null)

  const usageForm = useForm<UsageFormOutput>({
    resolver: zodResolver(usageSchema),
  })
  const courtForm = useForm<CourtCostFormOutput>({
    resolver: zodResolver(courtCostSchema),
  })
  const personalShareForm = useForm<PersonalShareFormOutput>({
    resolver: zodResolver(personalShareSchema),
  })

  const hasUsage = finance.usageAllocations.length > 0
  const hasCourtCost = finance.courtCost !== null
  const pnlComplete = hasUsage || hasCourtCost
  const manualValidationBatches = [
    ...finance.availableManualBatches.map<BatchForAllocation>((batch) => ({
      id: batch.batchId,
      brand: batch.brand,
      shuttlesRemaining: batch.shuttlesRemaining,
      costPerTube: batch.costPerTube,
      tubeStart: batch.tubeId,
      notes: batch.notes,
    })),
    ...manualRows.map<BatchForAllocation>((row) => ({
      id: row.batchId,
      brand: row.brand,
      shuttlesRemaining: row.shuttlesRemaining,
      costPerTube: row.costPerTube,
      tubeStart: row.tubeId ?? 0,
      notes: row.notes,
    })),
  ].filter((batch, index, allBatches) => allBatches.findIndex((candidate) => candidate.id === batch.id) === index)
  const manualValidation = validateManualUsageRows(
    manualRows.map((row) => ({
      batchId: row.batchId,
      shuttlesUsed: row.shuttlesUsed,
    })),
    manualValidationBatches
  )

  const formattedDate = finance.sessionDate
    ? new Date(finance.sessionDate + 'T00:00:00').toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : ''

  useEffect(() => {
    personalShareForm.setValue('personalShare', finance.effectivePersonalShare)
  }, [finance.effectivePersonalShare, personalShareForm])

  useEffect(() => {
    const previousMode = previousModeRef.current

    if (finance.allocationMode !== 'manual') {
      setManualRows([])
    } else if (previousMode === null) {
      setManualRows(finance.usageAllocations)
    } else if (previousMode !== finance.allocationMode) {
      setManualRows([])
    } else {
      setManualRows(finance.usageAllocations)
    }

    previousModeRef.current = finance.allocationMode
  }, [finance.allocationMode, finance.usageAllocations])

  const onSaveUsage = async (values: UsageFormOutput) => {
    if (values.totalShuttles > finance.totalStockAvailable) {
      usageForm.setError('totalShuttles', {
        message: `Not enough stock for ${values.totalShuttles} shuttles. Only ${finance.totalStockAvailable} available.`,
      })
      return
    }
    const { error } = await finance.logUsage(values.totalShuttles)
    if (error) {
      toast.error('Failed to save usage. Try again.')
    } else {
      toast.success(hasUsage ? 'Shuttle usage updated.' : 'Shuttle usage saved.')
      usageForm.reset()
    }
  }

  const onSaveCourtCost = async (values: CourtCostFormOutput) => {
    const { error } = await finance.saveCourtCost(values.courtCost)
    if (error) {
      toast.error('Failed to save court cost. Try again.')
    } else {
      toast.success('Court cost saved.')
      courtForm.reset()
    }
  }

  const onSavePersonalShare = async (values: PersonalShareFormOutput) => {
    const { error } = await finance.savePersonalShare(values.personalShare)
    if (error) {
      toast.error('Failed to save your share. Try again.')
    } else {
      toast.success('Your share saved.')
      personalShareForm.reset({ personalShare: values.personalShare })
    }
  }

  const onResetPersonalShare = async () => {
    const { error } = await finance.savePersonalShare(null)
    if (error) {
      toast.error('Failed to clear your share. Try again.')
    } else {
      toast.success('Your share cleared.')
      personalShareForm.reset({ personalShare: 0 })
    }
  }

  const handleModeChange = async (mode: AllocationMode) => {
    if (mode === finance.allocationMode) return

    const { error } = await finance.saveAllocationMode(mode)
    if (error) {
      toast.error('Failed to update allocation mode. Try again.')
      return
    }

    toast.success(mode === 'auto'
      ? 'Automatic allocation mode saved.'
      : 'Manual allocation mode saved.')
  }

  const handleUsageSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void usageForm.handleSubmit(onSaveUsage)(event)
  }

  const handleAddManualBatch = (batch: ManualBatchOption) => {
    setManualRows((currentRows) => {
      if (currentRows.some((row) => row.batchId === batch.batchId)) {
        return currentRows
      }

      return [
        ...currentRows,
        {
          batchId: batch.batchId,
          tubeId: batch.tubeId,
          brand: batch.brand,
          shuttlesUsed: 1,
          shuttlesRemaining: batch.shuttlesRemaining,
          costPerTube: batch.costPerTube,
          notes: batch.notes,
        },
      ]
    })
    setPickerOpen(false)
  }

  const handleManualRowChange = (batchId: string, shuttlesUsed: number) => {
    setManualRows((currentRows) => currentRows.map((row) => (
      row.batchId === batchId
        ? { ...row, shuttlesUsed }
        : row
    )))
  }

  const handleManualRowRemove = (batchId: string) => {
    setManualRows((currentRows) => currentRows.filter((row) => row.batchId !== batchId))
  }

  const handleManualSave = async () => {
    if (!manualValidation.isValid) {
      toast.error(manualValidation.formError ?? 'Fix the highlighted manual allocation rows before saving.')
      return
    }

    const { error } = await finance.saveUsageAllocation({
      allocationMode: 'manual',
      rows: manualRows.map((row) => ({
        batchId: row.batchId,
        shuttlesUsed: row.shuttlesUsed,
      })),
    })

    if (error) {
      toast.error(error)
      return
    }

    toast.success('Manual batch allocation saved.')
  }

  const handleCourtCostSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void courtForm.handleSubmit(onSaveCourtCost)(event)
  }

  const handlePersonalShareSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void personalShareForm.handleSubmit(onSavePersonalShare)(event)
  }

  const allocationTable = hasUsage ? (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Batch allocation</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tube ID</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead className="text-right">Shuttles</TableHead>
            <TableHead className="text-right">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {finance.usageAllocations.map((allocation) => (
            <TableRow key={allocation.batchId}>
              <TableCell className="text-sm font-mono">
                {allocation.tubeId !== null ? `T-${allocation.tubeId}` : 'T-?'}
              </TableCell>
              <TableCell className="text-sm">{allocation.brand}</TableCell>
              <TableCell className="text-sm text-right">{allocation.shuttlesUsed}</TableCell>
              <TableCell className="text-sm text-right">
                {formatPeso(allocation.shuttlesUsed * (allocation.costPerTube / 12))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ) : null

  return (
    <div className="p-6 mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          to="/finance"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to Finance
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-primary">Session Finance</h1>
        {formattedDate && (
          <p className="text-sm text-muted-foreground">{formattedDate}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold">Shuttle Usage</CardTitle>
              <p className="text-xs text-muted-foreground">
                Choose whether this session uses the current automatic flow or manual batch allocation.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={finance.allocationMode === 'auto' ? 'default' : 'outline'}
                disabled={finance.isLoading || finance.isSavingAllocationMode}
                onClick={() => void handleModeChange('auto')}
              >
                Auto
              </Button>
              <Button
                type="button"
                size="sm"
                variant={finance.allocationMode === 'manual' ? 'default' : 'outline'}
                disabled={finance.isLoading || finance.isSavingAllocationMode}
                onClick={() => void handleModeChange('manual')}
              >
                Manual
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {finance.isLoading ? (
            <>
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
            </>
          ) : (
            <>
              {hasUsage && (
                <p className="text-sm text-muted-foreground">
                  {finance.totalShuttlesLogged} shuttles logged
                </p>
              )}
              {finance.allocationMode === 'auto' ? (
                <>
                  <form onSubmit={handleUsageSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="totalShuttles">Total Shuttles Used</Label>
                      <Input
                        id="totalShuttles"
                        type="number"
                        placeholder="e.g. 20"
                        aria-invalid={!!usageForm.formState.errors.totalShuttles}
                        {...usageForm.register('totalShuttles', { valueAsNumber: true })}
                      />
                      {usageForm.formState.errors.totalShuttles && (
                        <p className="text-xs text-destructive mt-1">
                          {usageForm.formState.errors.totalShuttles.message}
                        </p>
                      )}
                    </div>
                    <Button type="submit" disabled={finance.isSavingUsage}>
                      {finance.isSavingUsage ? 'Saving...' : hasUsage ? 'Update Usage' : 'Save Usage'}
                    </Button>
                  </form>
                  {allocationTable}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Manual batch allocation</p>
                      <p className="text-sm text-muted-foreground">
                        Add batches from inventory, enter per-batch counts, and save the current manual allocation.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPickerOpen(true)}
                      >
                        Add batch
                      </Button>
                      <Button
                        type="button"
                        disabled={finance.isSavingUsage || !manualValidation.isValid}
                        onClick={() => void handleManualSave()}
                      >
                        {finance.isSavingUsage ? 'Saving...' : 'Save Allocation'}
                      </Button>
                    </div>
                  </div>

                  <ManualAllocationEditor
                    formError={manualValidation.formError}
                    rows={manualRows}
                    rowErrors={manualValidation.rowErrors}
                    onRowChange={handleManualRowChange}
                    onRemoveRow={handleManualRowRemove}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Court Cost</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {finance.isLoading ? (
            <div className="h-10 bg-muted rounded animate-pulse" />
          ) : (
            <form onSubmit={handleCourtCostSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="courtCost">Total Court Cost (PHP)</Label>
                <Input
                  id="courtCost"
                  type="number"
                  placeholder="e.g. 400"
                  defaultValue={finance.courtCost ?? undefined}
                  aria-invalid={!!courtForm.formState.errors.courtCost}
                  {...courtForm.register('courtCost', { valueAsNumber: true })}
                />
                {courtForm.formState.errors.courtCost && (
                  <p className="text-xs text-destructive mt-1">
                    {courtForm.formState.errors.courtCost.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={finance.isSavingCourtCost}>
                {finance.isSavingCourtCost ? 'Saving...' : 'Save Cost'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Your Share</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {finance.isLoading ? (
            <div className="space-y-2">
              <div className="h-10 bg-muted rounded animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Optional manual deduction if you also paid part of the session costs.
              </p>
              <form onSubmit={handlePersonalShareSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="personalShare">Your Share (PHP)</Label>
                  <Input
                    id="personalShare"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 120"
                    aria-invalid={!!personalShareForm.formState.errors.personalShare}
                    {...personalShareForm.register('personalShare', { valueAsNumber: true })}
                  />
                  {personalShareForm.formState.errors.personalShare && (
                    <p className="text-xs text-destructive mt-1">
                      {personalShareForm.formState.errors.personalShare.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={finance.isSavingPersonalShare}>
                    {finance.isSavingPersonalShare ? 'Saving...' : 'Save Share'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={finance.isSavingPersonalShare || finance.personalShareOverride === null}
                    onClick={() => void onResetPersonalShare()}
                  >
                    Clear Share
                  </Button>
                </div>
              </form>
              {finance.personalShareOverride !== null && (
                <p className="text-xs text-muted-foreground">
                  Manual share active and deducted from net profit.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Net Cash Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {finance.isLoading ? (
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded animate-pulse" />
              <div className="h-6 bg-muted rounded animate-pulse" />
              <div className="h-6 bg-muted rounded animate-pulse" />
            </div>
          ) : !pnlComplete ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Log shuttle usage and court cost to see P&amp;L.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Revenue</span>
                <span className="text-sm">{formatPeso(finance.revenue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Shuttle Cost</span>
                <span className="text-sm">{formatPeso(finance.shuttleCost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Court Cost</span>
                <span className="text-sm">{formatPeso(finance.courtCost ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Your Share</span>
                <span className="text-sm">{formatPeso(finance.effectivePersonalShare)}</span>
              </div>
              <div className="border-t border-border my-2" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">
                  {finance.profit >= 0 ? 'Net Cash In' : 'Net Cash Out'}
                </span>
                <span
                  className={`text-lg font-semibold ${
                    finance.profit >= 0 ? 'text-green-500' : 'text-destructive'
                  }`}
                >
                  {formatPeso(finance.profit)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RosterPanel sessionId={sessionId ?? ''} paymentOnly />

      <ManualBatchPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        batches={finance.availableManualBatches}
        selectedBatchIds={manualRows.map((row) => row.batchId)}
        onAddBatch={handleAddManualBatch}
      />
    </div>
  )
}
