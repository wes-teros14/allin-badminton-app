import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/**
 * Whether the signed-in player has a row in one of the admin-managed cheer lists. RLS lets a player read
 * only their own row, so this is a single-row lookup.
 *
 * A failed lookup falls back to `false` — the full gate, which is what every player had before the lists
 * existed — and is logged rather than hidden.
 */
function useOwnListRow(table: 'cheer_later_players' | 'no_cheer_players', what: string): { isListed: boolean; isLoading: boolean } {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [isListed, setIsListed] = useState(false)
  /** The user the current answer belongs to; anything else is still loading. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void supabase
      .from(table)
      .select('player_id')
      .eq('player_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error(`${what} lookup failed; using the full cheers gate.`, error)
        setIsListed(!error && data !== null)
        setLoadedFor(userId)
      })
    return () => { cancelled = true }
  }, [userId, table, what])

  return { isListed: userId !== null && loadedFor === userId && isListed, isLoading: userId !== null && loadedFor !== userId }
}

/** On the "Cheer later" list (migration 084): cheers wait in a bar instead of the full-page gate. */
export function useCheerLater(): { isCheerLater: boolean; isLoading: boolean } {
  const { isListed, isLoading } = useOwnListRow('cheer_later_players', 'Cheer later')
  return { isCheerLater: isListed, isLoading }
}

/**
 * On the "No cheers" list (migration 094): never asked to give cheers — no gate, no bar. For a one-off
 * substitute's login (owner, 2026-11-24). Cheers they already gave stay; others still cheer them.
 */
export function useNoCheers(): { isNoCheers: boolean; isLoading: boolean } {
  const { isListed, isLoading } = useOwnListRow('no_cheer_players', 'No cheers')
  return { isNoCheers: isListed, isLoading }
}
