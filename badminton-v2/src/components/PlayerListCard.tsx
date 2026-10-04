/**
 * A Settings card holding a list of players: chips with a remove button, and a
 * picker to add one. Backs "Players who don't pay" (migration 082) and
 * "Cheer later" (migration 084), which share the table shape
 * `{ player_id, added_at, added_by }` and an admin-only write policy.
 *
 * Changes save immediately, unlike the phone number and QR on the same page,
 * which wait for Save — so the cards sit below that button and say so.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { useAuth } from '@/hooks/useAuth'

export type PlayerListTable = 'payment_exempt_players' | 'cheer_later_players'

interface PlayerListCardProps {
  table: PlayerListTable
  title: string
  description: ReactNode
  /** Shown when nobody is on the list. */
  emptyText: string
  /** Accessible name of the add picker, e.g. "Add a player who doesn't pay". */
  addLabel: string
  addedMessage: (name: string) => string
  removedMessage: (name: string) => string
}

interface PlayerOption {
  id: string
  name: string
}

export function PlayerListCard({
  table,
  title,
  description,
  emptyText,
  addLabel,
  addedMessage,
  removedMessage,
}: PlayerListCardProps) {
  const { user } = useAuth()
  const [players, setPlayers] = useState<PlayerOption[]>([])
  const [listedIds, setListedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  /** A failed load must not render as an empty list — that reads as "nobody is on it". */
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [profilesRes, listRes] = await Promise.all([
      supabase.from('profiles').select('id, nickname, name_slug'),
      supabase.from(table).select('player_id'),
    ])
    const error = profilesRes.error ?? listRes.error
    if (error) { setLoadError(error.message); return }
    setLoadError(null)

    const rows = (profilesRes.data ?? []) as Array<{ id: string; nickname: string | null; name_slug: string }>
    setPlayers(
      rows
        .map((p) => ({ id: p.id, name: formatDisplayName(p.nickname, p.name_slug) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
    setListedIds(new Set(((listRes.data ?? []) as Array<{ player_id: string }>).map((r) => r.player_id)))
  }, [table])

  useEffect(() => {
    void load().finally(() => setIsLoading(false))
  }, [load])

  const nameOf = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players])
  const listed = useMemo(
    () => [...listedIds].map((id) => ({ id, name: nameOf.get(id) ?? 'Unknown player' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [listedIds, nameOf],
  )
  const addable = players.filter((p) => !listedIds.has(p.id))

  const withId = (ids: Set<string>, id: string, present: boolean) => {
    const next = new Set(ids)
    if (present) next.add(id)
    else next.delete(id)
    return next
  }

  // Both changes paint first and roll back on failure. The write itself is ~25ms
  // server-side; what the admin once waited ~8s for was a `supabase.auth.getUser()`
  // round trip, which can queue behind the auth lock while another tab refreshes
  // the session. The signed-in user is already in AuthContext, so it is not asked for.
  async function add(playerId: string) {
    setBusyId(playerId)
    setListedIds((prev) => withId(prev, playerId, true))
    try {
      const { error } = await supabase
        .from(table)
        .insert({ player_id: playerId, added_by: user?.id ?? null } as never)
      if (error) {
        setListedIds((prev) => withId(prev, playerId, false))
        toast.error(error.message)
        return
      }
      toast.success(addedMessage(nameOf.get(playerId) ?? 'Player'))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(playerId: string) {
    setBusyId(playerId)
    setListedIds((prev) => withId(prev, playerId, false))
    try {
      const { error } = await supabase.from(table).delete().eq('player_id', playerId)
      if (error) {
        setListedIds((prev) => withId(prev, playerId, true))
        toast.error(error.message)
        return
      }
      toast.success(removedMessage(nameOf.get(playerId) ?? 'Player'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>

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
            {listed.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">{emptyText}</p>
            ) : (
              <ul className="flex flex-wrap gap-2" aria-label={title}>
                {listed.map((p) => (
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
              aria-label={addLabel}
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

export default PlayerListCard
