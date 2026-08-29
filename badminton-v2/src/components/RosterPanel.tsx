import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRoster } from '@/hooks/useRoster'
import { useAuth } from '@/hooks/useAuth'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { derivePaymentState, type PaymentState } from '@/lib/paymentState'
import { ReceiptViewerDialog } from '@/components/ReceiptViewerDialog'

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      placeholder="Search players…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs rounded border border-input bg-background px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-ring"
    />
  )
}

interface Props {
  sessionId: string
  editable?: boolean
  paymentOnly?: boolean
  onRosterChange?: () => void
}

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function RosterPanel({ sessionId, editable = false, paymentOnly = false, onRosterChange }: Props) {
  const { players, unregisteredPlayers, isLoading, addPlayer, removePlayer, updateSessionOverride, updatePaid, receiptsFor, dismissReceipt } =
    useRoster(sessionId, onRosterChange)
  const { role } = useAuth()
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const [addSearch, setAddSearch] = useState('')
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null)
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Defence in depth. RLS is the real enforcement — a moderator's SELECT on
  // session_receipts returns nothing and their createSignedUrl is refused —
  // but AdminRoute (src/App.tsx:28) admits moderators to /finance, so without
  // this they would see a permanently empty, broken-looking receipt column.
  const canViewReceipts = role === 'admin'

  function handleRemoveClick(registrationId: string) {
    if (pendingRemove !== registrationId) {
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current)
      setPendingRemove(registrationId)
      removeTimerRef.current = setTimeout(() => setPendingRemove(null), 3000)
    } else {
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current)
      setPendingRemove(null)
      removePlayer(registrationId)
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading roster…</div>

  if (paymentOnly) {
    // Derived, never stored — `paid` stays the sole input to revenue.
    const states = players.map((p) => derivePaymentState({ paid: p.paid, activeReceiptCount: p.activeReceiptCount }))
    const paidCount = states.filter((s) => s === 'paid').length
    const submittedCount = states.filter((s) => s === 'submitted').length
    const unpaidCount = states.filter((s) => s === 'unpaid').length

    // Awaiting first — those are the rows that need a decision. Sort is stable,
    // so players keep their roster order within each group.
    const ORDER: Record<PaymentState, number> = { submitted: 0, paid: 1, unpaid: 2 }
    const rows = players
      .map((player, i) => ({ player, state: states[i] }))
      .sort((a, b) => ORDER[a.state] - ORDER[b.state])

    const viewingPlayer = viewingPlayerId ? players.find((p) => p.playerId === viewingPlayerId) ?? null : null

    return (
      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((v) => !v)}>
          <CardTitle className="flex items-center justify-between text-sm font-semibold">
            <span>Payment Status — {paidCount} paid · {submittedCount} awaiting · {unpaidCount} unpaid</span>
            <span className="text-muted-foreground">{open ? '▲' : '▼'}</span>
          </CardTitle>
        </CardHeader>
        {open && (
          <CardContent>
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players registered.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map(({ player, state }) => {
                  return (
                    <li key={player.registrationId} className="flex items-center gap-2 text-sm rounded-md border px-3 py-2">
                      <span
                        aria-label={state}
                        title={state === 'submitted' ? 'Awaiting confirmation' : state === 'paid' ? 'Paid' : 'Unpaid'}
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          state === 'paid' ? 'bg-green-600' : state === 'submitted' ? 'bg-amber-500' : 'bg-destructive'
                        }`}
                      />
                      <span className="flex-1 truncate font-medium">{formatDisplayName(player.nickname, player.nameSlug)}</span>

                      {/* Per-player receipt link (FR-022) */}
                      {canViewReceipts && (
                        player.totalReceiptCount > 0 ? (
                          <button
                            onClick={() => setViewingPlayerId(player.playerId)}
                            className="text-xs font-semibold text-primary hover:underline shrink-0"
                          >
                            {player.totalReceiptCount} receipt{player.totalReceiptCount === 1 ? '' : 's'} ›
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground shrink-0">no receipt</span>
                        )
                      )}

                      <div className="flex rounded overflow-hidden border text-xs shrink-0">
                        <button
                          onClick={() => updatePaid(player.registrationId, false)}
                          className={`px-2 py-1 transition-colors ${
                            player.paid ? 'bg-background text-muted-foreground hover:bg-muted' : 'bg-destructive text-white'
                          }`}
                        >
                          Unpaid
                        </button>
                        {/* Explicit confirm — the ONLY way to reach green (FR-018) */}
                        <button
                          onClick={() => updatePaid(player.registrationId, true)}
                          className={`px-2 py-1 transition-colors ${
                            player.paid ? 'bg-green-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {player.paid ? 'Paid' : 'Confirm'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        )}

        {canViewReceipts && viewingPlayer && (
          <ReceiptViewerDialog
            open
            onOpenChange={(next) => { if (!next) setViewingPlayerId(null) }}
            playerName={formatDisplayName(viewingPlayer.nickname, viewingPlayer.nameSlug)}
            receipts={receiptsFor(viewingPlayer.playerId)}
            onDismiss={(receiptId) => { void dismissReceipt(receiptId) }}
          />
        )}
      </Card>
    )
  }

  const maleCount = players.filter((p) => p.gender === 'M').length
  const femaleCount = players.filter((p) => p.gender === 'F').length

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((v) => !v)}>
        <CardTitle className="flex items-center justify-between">
          <span>Roster ({players.length}), Male ({maleCount}), Female ({femaleCount})</span>
          <span className="text-sm text-muted-foreground">{open ? '▲' : '▼'}</span>
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="pt-2 pb-3 px-3">
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players registered yet.</p>
        ) : (
          <ul>
            {players.map((player) => (
              <li key={player.registrationId} className="flex items-center gap-2 text-xs border-b last:border-0 py-1">
                <span className="flex-1 truncate font-medium min-w-0">{formatDisplayName(player.nickname, player.nameSlug)}</span>

                {!editable && player.gender && (
                  <span className="text-muted-foreground shrink-0">{player.gender}</span>
                )}
                {!editable && player.level && (
                  <span className="text-muted-foreground shrink-0">L{player.level}</span>
                )}

                {editable && (
                  <>
                    <div className="flex rounded overflow-hidden border shrink-0">
                      {(['M', 'F'] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => updateSessionOverride(player.registrationId, g, player.level)}
                          className={`px-1.5 py-0.5 transition-colors ${
                            player.gender === g
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>

                    <select
                      value={player.level ?? ''}
                      onChange={(e) => updateSessionOverride(player.registrationId, player.gender, e.target.value ? +e.target.value : null)}
                      className="h-6 rounded border border-input bg-background text-foreground px-1 w-11 shrink-0"
                    >
                      <option value="">—</option>
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>

                  </>
                )}

                <button
                  onClick={() => handleRemoveClick(player.registrationId)}
                  className={`shrink-0 px-1.5 py-0.5 rounded text-xs transition-colors ${
                    pendingRemove === player.registrationId
                      ? 'bg-destructive text-white'
                      : 'text-destructive hover:bg-destructive/10'
                  }`}
                >
                  {pendingRemove === player.registrationId ? 'Sure?' : '✕'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add Player section */}
        {unregisteredPlayers.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <button
              className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setAddOpen((v) => !v)}
            >
              <span>Add player ({unregisteredPlayers.length})</span>
              <span>{addOpen ? '▲' : '▼'}</span>
            </button>
            {addOpen && (
              <>
                <div className="mt-3">
                  <SearchInput value={addSearch} onChange={setAddSearch} />
                </div>
                <ul className="space-y-1 mt-1 max-h-48 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                  {unregisteredPlayers.filter((p) => {
                    const name = formatDisplayName(p.nickname, p.nameSlug).toLowerCase()
                    return name.includes(addSearch.toLowerCase())
                  }).map((player) => (
                    <li key={player.id} className="flex items-center justify-between text-sm">
                      <span>{formatDisplayName(player.nickname, player.nameSlug)}</span>
                      <Button variant="ghost" size="sm" onClick={() => addPlayer(player.id)}>Add</Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </CardContent>}
    </Card>
  )
}
