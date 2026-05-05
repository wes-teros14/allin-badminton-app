import { useParams, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { useSessionFinance } from '@/hooks/useSessionFinance'
import { formatPeso } from '@/utils/formatPeso'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const usageSchema = z.object({
  totalTubes: z.coerce
    .number({ error: 'Enter total tubes used.' })
    .int({ message: 'Enter a whole number.' })
    .min(1, 'Must be at least 1 tube.'),
})
type UsageForm = z.infer<typeof usageSchema>

const courtCostSchema = z.object({
  courtCost: z.coerce
    .number({ error: 'Enter a valid amount.' })
    .min(0, 'Cost must be 0 or more.'),
})
type CourtCostForm = z.infer<typeof courtCostSchema>

export default function FinanceDetailView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const finance = useSessionFinance(sessionId ?? '')

  const usageForm = useForm<UsageForm>({ resolver: zodResolver(usageSchema) })
  const courtForm = useForm<CourtCostForm>({ resolver: zodResolver(courtCostSchema) })

  const hasUsage = finance.usageAllocations.length > 0
  const hasCourtCost = finance.courtCost !== null
  const pnlComplete = hasUsage || hasCourtCost

  const formattedDate = finance.sessionDate
    ? new Date(finance.sessionDate + 'T00:00:00').toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : ''

  const onSaveUsage = async (values: UsageForm) => {
    if (values.totalTubes > finance.totalStockAvailable) {
      usageForm.setError('totalTubes', {
        message: `Not enough stock for ${values.totalTubes} tubes. Only ${finance.totalStockAvailable} available.`,
      })
      return
    }
    const { error } = await finance.logUsage(values.totalTubes)
    if (error) {
      toast.error('Failed to save usage. Try again.')
    } else {
      toast.success(hasUsage ? 'Shuttle usage updated.' : 'Shuttle usage saved.')
      usageForm.reset()
    }
  }

  const onSaveCourtCost = async (values: CourtCostForm) => {
    const { error } = await finance.saveCourtCost(values.courtCost)
    if (error) {
      toast.error('Failed to save court cost. Try again.')
    } else {
      toast.success('Court cost saved.')
      courtForm.reset()
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">

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

      {/* Section 1: Shuttle Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Shuttle Usage</CardTitle>
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
                  {finance.totalTubesLogged} tubes logged
                </p>
              )}
              <form onSubmit={usageForm.handleSubmit(onSaveUsage)} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="totalTubes">Total Tubes Used</Label>
                  <Input
                    id="totalTubes"
                    type="number"
                    placeholder="e.g. 6"
                    aria-invalid={!!usageForm.formState.errors.totalTubes}
                    {...usageForm.register('totalTubes')}
                  />
                  {usageForm.formState.errors.totalTubes && (
                    <p className="text-xs text-destructive mt-1">
                      {usageForm.formState.errors.totalTubes.message}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={finance.isSaving}>
                  {finance.isSaving ? 'Saving…' : hasUsage ? 'Update Usage' : 'Save Usage'}
                </Button>
              </form>
              {hasUsage && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Batch allocation</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brand</TableHead>
                        <TableHead className="text-right">Tubes</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finance.usageAllocations.map((a) => (
                        <TableRow key={a.batchId}>
                          <TableCell className="text-sm">{a.brand}</TableCell>
                          <TableCell className="text-sm text-right">{a.tubesUsed}</TableCell>
                          <TableCell className="text-sm text-right">
                            {formatPeso(a.tubesUsed * a.costPerTube)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Court Cost */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Court Cost</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {finance.isLoading ? (
            <div className="h-10 bg-muted rounded animate-pulse" />
          ) : (
            <form onSubmit={courtForm.handleSubmit(onSaveCourtCost)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="courtCost">Total Court Cost (₱)</Label>
                <Input
                  id="courtCost"
                  type="number"
                  placeholder="e.g. 400"
                  defaultValue={finance.courtCost ?? undefined}
                  aria-invalid={!!courtForm.formState.errors.courtCost}
                  {...courtForm.register('courtCost')}
                />
                {courtForm.formState.errors.courtCost && (
                  <p className="text-xs text-destructive mt-1">
                    {courtForm.formState.errors.courtCost.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={finance.isSaving}>
                {finance.isSaving ? 'Saving…' : 'Save Cost'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Section 3: P&L Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">P&L Summary</CardTitle>
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
              Log shuttle usage and court cost to see P&L.
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
              <div className="border-t border-border my-2" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">
                  {finance.profit >= 0 ? 'Net Profit' : 'Net Loss'}
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

    </div>
  )
}
