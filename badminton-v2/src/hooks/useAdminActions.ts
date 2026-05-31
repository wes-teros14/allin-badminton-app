import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { completedMatchUpdate, playingMatchUpdate, queuedMatchUpdate } from '@/utils/matchTiming'
import type { AdminMatchDisplay } from './useAdminSession'
import { submitSplitResult, type SplitOutcome } from '@/lib/matchResults'

interface EditIds {
  t1p1Id: string
  t1p2Id: string
  t2p1Id: string
  t2p2Id: string
}

export function useAdminActions(onDone: () => void) {
  const [isSaving, setIsSaving] = useState(false)

  async function editMatch(matchId: string, ids: EditIds) {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          team1_player1_id: ids.t1p1Id,
          team1_player2_id: ids.t1p2Id,
          team2_player1_id: ids.t2p1Id,
          team2_player2_id: ids.t2p2Id,
        })
        .eq('id', matchId)

      if (error) { toast.error(error.message); return }
      toast.success('Match updated')
    } finally {
      setIsSaving(false)
    }
  }

  async function moveUp(matchId: string, currentPosition: number, allQueued: AdminMatchDisplay[]) {
    const upper = allQueued.find((m) => m.gameNumber === currentPosition - 1)
    if (!upper) return
    setIsSaving(true)
    try {
      const { error: e1 } = await supabase.from('matches').update({ queue_position: 9999 }).eq('id', matchId)
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
      const { error: e1 } = await supabase.from('matches').update({ queue_position: 9999 }).eq('id', matchId)
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

  async function markDone(
    matchId: string,
    courtNumber: number,
    sessionId: string,
    winningPairIndex?: 1 | 2,
    startedAt?: string | null,
    splitOutcome?: SplitOutcome,
  ) {
    setIsSaving(true)
    try {
      const { data: completed, error: e1 } = await supabase
        .from('matches')
        .update(completedMatchUpdate(startedAt ?? null) as never)
        .eq('id', matchId)
        .eq('status', 'playing')
        .select('id')

      if (e1) { toast.error(e1.message); return }
      if (!completed || completed.length === 0) return

      if (splitOutcome) {
        const { error: eResult } = await submitSplitResult(matchId, splitOutcome)
        if (eResult) { toast.error(String(eResult)); return }
      } else if (winningPairIndex) {
        await supabase.from('match_results').insert({
          match_id: matchId,
          winning_pair_index: winningPairIndex,
          game_number: 1,
        })
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
          .update(playingMatchUpdate(courtNumber))
          .eq('id', (nextMatch as { id: string }).id)
        if (e3) { toast.error(e3.message); return }
      }
      onDone()
    } finally {
      setIsSaving(false)
    }
  }

  async function promoteTocourt(matchId: string, courtNumber: number) {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('matches')
        .update(playingMatchUpdate(courtNumber))
        .eq('id', matchId)

      if (error) { toast.error(error.message); return }
      onDone()
    } finally {
      setIsSaving(false)
    }
  }

  async function moveToCourt(matchId: string, courtNumber: number) {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('matches')
        .update({ court_number: courtNumber })
        .eq('id', matchId)

      if (error) { toast.error(error.message); return }
      onDone()
    } finally {
      setIsSaving(false)
    }
  }

  async function demoteToQueue(matchId: string, sessionId: string) {
    setIsSaving(true)
    try {
      const { data: queued } = await supabase
        .from('matches')
        .select('queue_position')
        .eq('session_id', sessionId)
        .eq('status', 'queued')
        .order('queue_position', { ascending: false })
        .limit(1)
        .maybeSingle()

      const maxPos = queued ? (queued as { queue_position: number }).queue_position : 0

      const { error } = await supabase
        .from('matches')
        .update(queuedMatchUpdate(maxPos + 1))
        .eq('id', matchId)

      if (error) { toast.error(error.message); return }
      onDone()
    } finally {
      setIsSaving(false)
    }
  }

  async function swapCourts(
    match1Id: string,
    court1Number: number,
    match2Id: string,
    court2Number: number,
  ) {
    setIsSaving(true)
    try {
      const { error: e1 } = await supabase.from('matches').update({ court_number: null }).eq('id', match1Id)
      if (e1) { toast.error(e1.message); return }

      const { error: e2 } = await supabase.from('matches').update({ court_number: court1Number }).eq('id', match2Id)
      if (e2) {
        await supabase.from('matches').update({ court_number: court1Number }).eq('id', match1Id)
        toast.error(e2.message)
        return
      }

      const { error: e3 } = await supabase.from('matches').update({ court_number: court2Number }).eq('id', match1Id)
      if (e3) {
        await supabase.from('matches').update({ court_number: court2Number }).eq('id', match1Id)
        await supabase.from('matches').update({ court_number: court1Number }).eq('id', match2Id)
        toast.error(e3.message)
        return
      }
      onDone()
    } finally {
      setIsSaving(false)
    }
  }

  return { isSaving, editMatch, moveUp, moveDown, markDone, swapCourts, demoteToQueue, promoteTocourt, moveToCourt }
}
