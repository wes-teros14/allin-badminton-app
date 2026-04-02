import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { AdminMatchDisplay } from './useAdminSession'

interface EditSlugs {
  t1p1: string
  t1p2: string
  t2p1: string
  t2p2: string
}

export function useAdminActions(onDone: () => void) {
  const [isSaving, setIsSaving] = useState(false)

  async function editMatch(matchId: string, slugs: EditSlugs) {
    setIsSaving(true)
    try {
      const slugList = [slugs.t1p1, slugs.t1p2, slugs.t2p1, slugs.t2p2]
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name_slug')
        .in('name_slug', slugList)

      if (profilesError) { toast.error(profilesError.message); return }

      const nameMap = new Map(
        ((profiles ?? []) as Array<{ id: string; name_slug: string }>)
          .map((p) => [p.name_slug, p.id])
      )

      const missing = slugList.find((s) => !nameMap.has(s))
      if (missing) { toast.error(`Player not found: ${missing}`); return }

      const { error } = await supabase
        .from('matches')
        .update({
          team1_player1_id: nameMap.get(slugs.t1p1)!,
          team1_player2_id: nameMap.get(slugs.t1p2)!,
          team2_player1_id: nameMap.get(slugs.t2p1)!,
          team2_player2_id: nameMap.get(slugs.t2p2)!,
        })
        .eq('id', matchId)

      if (error) { toast.error(error.message); return }

      toast.success('Match updated')
      onDone()
    } finally {
      setIsSaving(false)
    }
  }

  async function moveUp(matchId: string, currentPosition: number, allQueued: AdminMatchDisplay[]) {
    const upper = allQueued.find((m) => m.gameNumber === currentPosition - 1)
    if (!upper) return
    setIsSaving(true)
    try {
      // Use temp position (-1) to avoid UNIQUE constraint on (session_id, queue_position)
      const { error: e1 } = await supabase.from('matches').update({ queue_position: -1 }).eq('id', matchId)
      if (e1) { toast.error(e1.message); return }
      const { error: e2 } = await supabase.from('matches').update({ queue_position: currentPosition }).eq('id', upper.id)
      if (e2) { toast.error(e2.message); return }
      const { error: e3 } = await supabase.from('matches').update({ queue_position: currentPosition - 1 }).eq('id', matchId)
      if (e3) { toast.error(e3.message); return }
      onDone()
    } finally {
      setIsSaving(false)
    }
  }

  async function moveDown(matchId: string, currentPosition: number, allQueued: AdminMatchDisplay[]) {
    const lower = allQueued.find((m) => m.gameNumber === currentPosition + 1)
    if (!lower) return
    setIsSaving(true)
    try {
      const { error: e1 } = await supabase.from('matches').update({ queue_position: -1 }).eq('id', matchId)
      if (e1) { toast.error(e1.message); return }
      const { error: e2 } = await supabase.from('matches').update({ queue_position: currentPosition }).eq('id', lower.id)
      if (e2) { toast.error(e2.message); return }
      const { error: e3 } = await supabase.from('matches').update({ queue_position: currentPosition + 1 }).eq('id', matchId)
      if (e3) { toast.error(e3.message); return }
      onDone()
    } finally {
      setIsSaving(false)
    }
  }

  async function markDone(matchId: string, courtNumber: 1 | 2, sessionId: string, winningPairIndex?: 1 | 2, durationSeconds?: number) {
    setIsSaving(true)
    try {
      const { error: e1 } = await supabase
        .from('matches')
        .update({ status: 'complete', ...(durationSeconds != null ? { duration_seconds: durationSeconds } : {}) } as never)
        .eq('id', matchId)

      if (e1) { toast.error(e1.message); return }

      if (winningPairIndex) {
        await supabase.from('match_results').insert({ match_id: matchId, winning_pair_index: winningPairIndex })
      }

      const { data: nextMatch, error: e2 } = await supabase
        .from('matches')
        .select('id')
        .eq('session_id', sessionId)
        .eq('status', 'queued')
        .order('queue_position')
        .limit(1)
        .maybeSingle()

      if (e2) { toast.error(e2.message); return }

      if (nextMatch) {
        const { error: e3 } = await supabase
          .from('matches')
          .update({ status: 'playing', court_number: courtNumber })
          .eq('id', (nextMatch as { id: string }).id)
        if (e3) { toast.error(e3.message); return }
      }

      onDone()
    } finally {
      setIsSaving(false)
    }
  }

  return { isSaving, editMatch, moveUp, moveDown, markDone }
}
