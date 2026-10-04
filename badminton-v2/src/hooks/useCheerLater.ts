import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/**
 * Whether the signed-in player is on the "Cheer later" list (migration 084).
 * RLS lets a player read only their own row, so this is a single-row lookup.
 *
 * A failed lookup falls back to `false` — the full gate, which is what every
 * player had before the list existed — and is logged rather than hidden.
 */
export function useCheerLater(): { isCheerLater: boolean; isLoading: boolean } {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [isCheerLater, setIsCheerLater] = useState(false)
  /** The user the current answer belongs to; anything else is still loading. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void supabase
      .from('cheer_later_players')
      .select('player_id')
      .eq('player_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Cheer later lookup failed; using the full cheers gate.', error)
        setIsCheerLater(!error && data !== null)
        setLoadedFor(userId)
      })
    return () => { cancelled = true }
  }, [userId])

  return { isCheerLater: userId !== null && loadedFor === userId && isCheerLater, isLoading: userId !== null && loadedFor !== userId }
}
