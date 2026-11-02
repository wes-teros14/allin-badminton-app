import { useEffect, useId, useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Session } from '@/hooks/useSession'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

/**
 * Edit a session's details after Setup (temporary_files/finance-scroll-and-session-notes-poc.html).
 * Same fields as SetupCard minus the scheduled registration open, which only
 * means anything before registration opens.
 *
 * - Court count locks once Live: games are already assigned to courts.
 * - Price warns once anyone has paid: revenue is paid count × price
 *   (get_session_finance), so it re-prices money already collected.
 * - Date warns on a finished session: it reorders history, and with it
 *   attendance streaks.
 */
export function EditSessionDialog({ session, onSaved }: { session: Session; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('')
  const [price, setPrice] = useState('')
  const [venue, setVenue] = useState('')
  const [courtCount, setCourtCount] = useState('')
  const [notes, setNotes] = useState('')
  const [paidCount, setPaidCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const ids = useId()

  const courtsLocked = session.status === 'in_progress' || session.status === 'complete'
  const originalPrice = session.price != null ? String(session.price) : ''

  // Reset the draft from the saved row on open (not on every refetch, which
  // would wipe what is being typed), so a cancelled edit never leaks into the next.
  function handleOpenChange(next: boolean) {
    if (next) {
      setName(session.name)
      setDate(session.date)
      setTime(session.time ?? '')
      setDuration(session.duration ?? '')
      setPrice(originalPrice)
      setVenue(session.venue ?? '')
      setCourtCount(String(session.court_count))
      setNotes(session.session_notes ?? '')
      setPaidCount(null)
    }
    setOpen(next)
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    supabase
      .from('session_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('paid', true)
      .then(({ count, error }) => {
        if (cancelled) return
        if (error) { toast.error(`Could not check payments: ${error.message}`); return }
        setPaidCount(count ?? 0)
      })
    return () => { cancelled = true }
  }, [open, session.id])

  async function handleSave() {
    if (!name.trim() || !date) { toast.error('Session name and date are required'); return }
    const parsedCourtCount = Number(courtCount)
    if (!courtsLocked && (!Number.isInteger(parsedCourtCount) || parsedCourtCount < 1)) {
      toast.error('Court count must be a whole number of at least 1')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('sessions')
      .update({
        name: name.trim(),
        date,
        venue: venue || null,
        time: time || null,
        duration: duration || null,
        price: price !== '' ? Number(price) : null,
        session_notes: notes.trim() || null,
        ...(courtsLocked ? {} : { court_count: parsedCourtCount }),
      })
      .eq('id', session.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Session updated')
    setOpen(false)
    onSaved()
  }

  const priceChanged = price !== originalPrice
  const dateChanged = date !== session.date

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="shrink-0" />}>
        <Pencil aria-hidden="true" />
        Edit
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit session</DialogTitle>
          <DialogDescription>Changes show to players straight away.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`${ids}-name`}>Session name</Label>
            <Input id={`${ids}-name`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 space-y-1">
              <Label htmlFor={`${ids}-date`}>Date</Label>
              <Input id={`${ids}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <Label htmlFor={`${ids}-time`}>Time</Label>
              <Input id={`${ids}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          {dateChanged && session.status === 'complete' && (
            <p role="status" className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
              This session is finished. Moving its date reorders it in history and can change attendance streaks.
            </p>
          )}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 space-y-1">
              <Label htmlFor={`${ids}-duration`}>Duration (hrs)</Label>
              <Input id={`${ids}-duration`} type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <Label htmlFor={`${ids}-price`}>Price (PHP)</Label>
              <Input id={`${ids}-price`} type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          {priceChanged && paidCount != null && paidCount > 0 && (
            <p role="status" className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
              {paidCount} {paidCount === 1 ? 'player has' : 'players have'} already paid{originalPrice ? ` ₱${originalPrice}` : ''}.
              Finance will count each of them at ₱{price || '0'} instead.
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor={`${ids}-venue`}>Venue</Label>
            <Input id={`${ids}-venue`} placeholder="e.g. Sports Hall A" value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${ids}-courts`}>Court count</Label>
            <Input
              id={`${ids}-courts`}
              type="number"
              min="1"
              step="1"
              value={courtCount}
              disabled={courtsLocked}
              aria-describedby={courtsLocked ? `${ids}-courts-why` : undefined}
              onChange={(e) => setCourtCount(e.target.value)}
            />
            {courtsLocked && (
              <p id={`${ids}-courts-why`} className="text-xs text-muted-foreground">Locked: games are already on courts.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${ids}-notes`}>Notes</Label>
            <textarea
              id={`${ids}-notes`}
              placeholder="e.g. 10 games | 21 pts/game"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
            <p className="text-xs text-muted-foreground">Separate rules with | to show them as chips to players.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
