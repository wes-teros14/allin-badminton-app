/**
 * The Payment Settings list of players who don't pay (migration 082).
 *
 * Changes save immediately, unlike the phone number and QR above it, which wait
 * for Save — so this card sits below that button and says so. Adding or removing
 * someone updates their registrations in every session that is not complete;
 * completed sessions keep the numbers they closed with.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/formatDisplayName'

interface PlayerOption {
  id: string
  name: string
}

export function PaymentExemptCard() {
  const [players, setPlayers] = useState<PlayerOption[]>([])
  const [exemptIds, setExemptIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  /** A failed load must not render as an empty list — that reads as "nobody is exempt". */
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [profilesRes, exemptRes] = await Promise.all([
      supabase.from('profiles').select('id, nickname, name_slug'),
      supabase.from('payment_exempt_players').select('player_id'),
    ])
    const error = profilesRes.error ?? exemptRes.error
    if (error) { setLoadError(error.message); return }
    setLoadError(null)

    const rows = (profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>
    setPlayers(
      rows
        .map((p) => ({ id: p.id, name: formatDisplayName(p.nickname, p.name_slug) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
    setExemptIds(new Set(((exemptRes.data ?? []) as Array<{ player_id: string }>).map((r) => r.player_id)))
  }, [])

  useEffect(() => {
    void load().finally(() => setIsLoading(false))
  }, [load])

  const nameOf = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players])
  const exempt = useMemo(
    () => [...exemptIds].map((id) => ({ id, name: nameOf.get(id) ?? 'Unknown player' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [exemptIds, nameOf],
  )
  const addable = players.filter((p) => !exemptIds.has(p.id))

  async function add(playerId: string) {
    setBusyId(playerId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('payment_exempt_players')
        .insert({ player_id: playerId, added_by: user?.id ?? null } as never)
      if (error) { toast.error(error.message); return }
      setExemptIds((prev) => new Set(prev).add(playerId))
      toast.success(`${nameOf.get(playerId) ?? 'Player'} won't be asked to pay`)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(playerId: string) {
    setBusyId(playerId)
    try {
      const { error } = await supabase.from('payment_exempt_players').delete().eq('player_id', playerId)
      if (error) { toast.error(error.message); return }
      setExemptIds((prev) => {
        const next = new Set(prev)
        next.delete(playerId)
        return next
      })
      toast.success(`${nameOf.get(playerId) ?? 'Player'} pays again from now on`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Players who don&apos;t pay</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          They skip the payment steps, and finance doesn&apos;t count them as unpaid. Applies to
          sessions that aren&apos;t finished yet. Saved as soon as you change it.
        </p>

        {isLoading ? (
          <div className="h-9 rounded-lg bg-muted animate-pulse" />
        ) : loadError ? (
          <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive">Couldn&apos;t load the list</p>
            <p className="break-words text-xs text-muted-foreground">{loadError}</p>
            <button
              type="button"
              onClick={() => { setIsLoading(true); void load().finally(() => setIsLoading(false)) }}
              className="min-h-9 text-xs font-semibold text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {exempt.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">Nobody yet. Everyone pays.</p>
            ) : (
              <ul className="flex flex-wrap gap-2" aria-label="Players who don't pay">
                {exempt.map((p) => (
                  <li
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted py-1 pl-3 pr-1 text-sm"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => void remove(p.id)}
                      disabled={busyId !== null}
                      aria-label={`Remove ${p.name}`}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-border hover:text-foreground disabled:opacity-50"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* color-scheme pinned so the native popup follows the theme instead of
                opening white with dark-theme text on it. */}
            <select
              value=""
              onChange={(e) => { if (e.target.value) void add(e.target.value) }}
              disabled={busyId !== null || addable.length === 0}
              aria-label="Add a player who doesn't pay"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm [color-scheme:light] dark:[color-scheme:dark] disabled:opacity-50"
            >
              <option value="" className="bg-background text-foreground">
                {addable.length === 0 ? 'Everyone is on the list' : '+ Add a player…'}
              </option>
              {addable.map((p) => (
                <option key={p.id} value={p.id} className="bg-background text-foreground">{p.name}</option>
              ))}
            </select>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default PaymentExemptCard
