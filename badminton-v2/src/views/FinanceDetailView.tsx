import { useParams, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { useEffect, type FormEvent } from 'react'
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
import { RosterPanel } from '@/components/RosterPanel'

const usageSchema = z.object({
  totalShuttles: z
    .number({ error: 'Enter total shuttles used.' })
    .int({ message: 'Enter a whole number.' })
    .min(1, 'Must be at least 1 shuttle.'),
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

  const formattedDate = finance.sessionDate
    ? new Date(finance.sessionDate + 'T00:00:00').toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : ''

  useEffect(() => {
    personalShareForm.setValue('personalShare', finance.effectivePersonalShare)
  }, [finance.effectivePersonalShare, personalShareForm])

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

  const handleUsageSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void usageForm.handleSubmit(onSaveUsage)(event)
  }

  const handleCourtCostSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void courtForm.handleSubmit(onSaveCourtCost)(event)
  }

  const handlePersonalShareSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void personalShareForm.handleSubmit(onSavePersonalShare)(event)
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
                  {finance.totalShuttlesLogged} shuttles logged
                </p>
              )}
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
                  {finance.isSavingUsage ? 'Saving…' : hasUsage ? 'Update Usage' : 'Save Usage'}
                </Button>
              </form>
              {hasUsage && (
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
                      {finance.usageAllocations.map((a) => (
                        <TableRow key={a.batchId}>
                          <TableCell className="text-sm font-mono">
                            {a.tubeId !== null ? `T-${a.tubeId}` : 'T-?'}
                          </TableCell>
                          <TableCell className="text-sm">{a.brand}</TableCell>
                          <TableCell className="text-sm text-right">{a.shuttlesUsed}</TableCell>
                          <TableCell className="text-sm text-right">
                            {formatPeso(a.shuttlesUsed * (a.costPerTube / 12))}
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
            <form onSubmit={handleCourtCostSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="courtCost">Total Court Cost (₱)</Label>
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
                {finance.isSavingCourtCost ? 'Saving…' : 'Save Cost'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Your Share */}
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

      {/* Section 4: P&L Summary */}
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
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Your Share</span>
                <span className="text-sm">{formatPeso(finance.effectivePersonalShare)}</span>
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

      {/* Section 5: Payment Status */}
      <RosterPanel sessionId={sessionId ?? ''} paymentOnly />

    </div>
  )
}
