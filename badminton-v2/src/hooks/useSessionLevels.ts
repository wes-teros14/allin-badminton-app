import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UseSessionLevelsResult {
  /** Effective level per player: session override ?? profile level (same rule as useRoster). */
  levels: Map<string, number | null>
  error: string | null
}

// Levels for the Subs ranking. Levels are private to the owner: callers must
// not render them to anyone but the admin — ordering by them is fine.
export function useSessionLevels(sessionId: string | null): UseSessionLevelsResult {
  const [levels, setLevels] = useState<Map<string, number | null>>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false

    async function load() {
      const { data: regs, error: regError } = await supabase
        .from('session_registrations')
        .select('player_id, level')
        .eq('session_id', sessionId!)
      if (cancelled) return
      if (regError) { setError(regError.message); return }

      const ids = (regs ?? []).map((r) => r.player_id)
      const { data: profiles, error: profileError } = ids.length
        ? await supabase.from('profiles').select('id, level').in('id', ids)
        : { data: [], error: null }
      if (cancelled) return
      if (profileError) { setError(profileError.message); return }

      const profileLevel = new Map((profiles ?? []).map((p) => [p.id, p.level ?? null]))
      setLevels(new Map((regs ?? []).map((r) => [r.player_id, r.level ?? profileLevel.get(r.player_id) ?? null])))
      setError(null)
    }

    void load()
    return () => { cancelled = true }
  }, [sessionId])

  return { levels, error }
}
