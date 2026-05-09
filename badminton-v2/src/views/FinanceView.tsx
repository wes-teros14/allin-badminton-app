import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import { useFinanceSessions } from '@/hooks/useFinanceSessions'
import { formatPeso } from '@/utils/formatPeso'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export default function FinanceView() {
  const { sessions, isLoading, fetchError } = useFinanceSessions()
  const navigate = useNavigate()

  useEffect(() => {
    if (fetchError) toast.error('Could not load finance data. Try refreshing.')
  }, [fetchError])

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
    })

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-primary">Finance</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ReceiptText className="size-8 text-muted-foreground mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold">No sessions yet</p>
              <p className="text-sm text-muted-foreground">
                Finance data will appear here once sessions are created.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Net Cash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow
                    key={s.sessionId}
                    className="cursor-pointer hover:bg-muted/20"
                    onClick={() => navigate(`/finance/${s.sessionId}`)}
                  >
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm">{formatDate(s.date)}</p>
                        <p className="text-xs text-muted-foreground">{s.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">
                      {s.paidCount} / {s.totalCount}
                    </TableCell>
                    <TableCell className="text-sm text-right">{formatPeso(s.revenue)}</TableCell>
                    <TableCell className="text-sm text-right">{formatPeso(s.totalCost)}</TableCell>
                    <TableCell
                      className={`text-sm text-right font-medium ${
                        s.profit >= 0 ? 'text-green-500' : 'text-destructive'
                      }`}
                    >
                      {formatPeso(s.profit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
