import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import type { Invitation } from '@/hooks/useSession'

interface Props {
  invitation: Invitation
  playerCount?: number
  sessionId: string
  courtCount: number
}

export function RegistrationURLCard({ invitation, playerCount = 0, sessionId, courtCount }: Props) {
  const [copied, setCopied] = useState(false)
  const [limitInput, setLimitInput] = useState(invitation.max_players != null ? String(invitation.max_players) : '')
  const [savedLimit, setSavedLimit] = useState<number | null>(invitation.max_players)
  const [saving, setSaving] = useState(false)
  const [courtCountInput, setCourtCountInput] = useState(String(courtCount))
  const [savingCourtCount, setSavingCourtCount] = useState(false)
  const url = `${window.location.origin}/register?token=${invitation.id}`

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSaveLimit() {
    setSaving(true)
    const val = limitInput.trim() === '' ? null : Math.max(1, parseInt(limitInput))
    await supabase.from('session_invitations').update({ max_players: val } as never).eq('id', invitation.id)
    setSavedLimit(val)
    setSaving(false)
  }

  async function handleSaveCourtCount() {
    const parsed = Number(courtCountInput)
    if (!Number.isInteger(parsed) || parsed < 1) {
      toast.error('Court count must be a whole number of at least 1')
      return
    }
    setSavingCourtCount(true)
    const { error } = await supabase.from('sessions').update({ court_count: parsed }).eq('id', sessionId)
    setSavingCourtCount(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Court count updated')
  }

  const countDisplay = savedLimit != null
    ? `${playerCount} / ${savedLimit} registered`
    : `${playerCount} registered`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Open</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground break-all">{url}</p>
        <Button variant="outline" onClick={handleCopy} className="w-full">
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
        <p className="text-sm text-muted-foreground">{countDisplay}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="No limit"
            value={limitInput}
            min={1}
            onChange={(e) => setLimitInput(e.target.value)}
            className="h-8 text-sm w-28"
          />
          <Button size="sm" variant="outline" onClick={handleSaveLimit} disabled={saving} className="h-8 text-xs shrink-0">
            {saving ? 'Saving…' : 'Set Limit'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="# of courts"
            value={courtCountInput}
            min={1}
            step={1}
            onChange={(e) => setCourtCountInput(e.target.value)}
            className="h-8 text-sm w-28"
          />
          <Button size="sm" variant="outline" onClick={handleSaveCourtCount} disabled={savingCourtCount} className="h-8 text-xs shrink-0">
            {savingCourtCount ? 'Saving…' : 'Set Courts'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
