import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type SessionStatus =
  | 'setup'
  | 'registration_open'
  | 'registration_closed'
  | 'schedule_locked'
  | 'in_progress'
  | 'complete'

export interface Session {
  id: string
  name: string
  date: string
  venue: string | null
  time: string | null
  duration: string | null
  status: SessionStatus
  created_by: string
  created_at: string
  price: number | null
  session_notes: string | null
  registration_opens_at: string | null
}

export interface Invitation {
  id: string
  session_id: string
  is_active: boolean
  max_players: number | null
  created_at: string
}

export interface MatchInput {
  team1Player1: string
  team1Player2: string
  team2Player1: string
  team2Player2: string
}

interface SessionState {
  session: Session | null
  invitation: Invitation | null
  playerCount: number
  isLoading: boolean
  createSession: (name: string, date: string) => Promise<Session | null>
  openRegistration: () => Promise<void>
  closeRegistration: () => Promise<void>
  reopenRegistration: () => Promise<void>
  lockSchedule: (matches: MatchInput[]) => Promise<boolean>
  unlockSchedule: () => Promise<void>
  startSession: () => Promise<void>
  closeSession: () => Promise<void>
}

export function useSession(sessionId?: string): SessionState {
  const [session, setSession] = useState<Session | null>(null)
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [playerCount, setPlayerCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchSession() {
      setIsLoading(true)
      let query = supabase.from('sessions').select('*')

      if (sessionId) {
        query = query.eq('id', sessionId)
      } else {
        query = query.order('created_at', { ascending: false }).limit(1)
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        toast.error(error.message)
      } else {
        setSession(data as Session | null)

        if (data && (data as Session).status === 'registration_open') {
          const { data: inv } = await supabase
            .from('session_invitations')
            .select('*')
            .eq('session_id', (data as Session).id)
            .eq('is_active', true)
            .maybeSingle()
          setInvitation(inv as Invitation | null)

          const { count } = await supabase
            .from('session_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', (data as Session).id)
          setPlayerCount(count ?? 0)
        }
      }
      setIsLoading(false)
    }

    fetchSession()
  }, [sessionId])

  async function createSession(name: string, date: string): Promise<Session | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Not authenticated')
      return null
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({ name, date, created_by: user.id })
      .select()
      .single()

    if (error) {
      toast.error(error.message)
      return null
    }

    const newSession = data as Session
    setSession(newSession)
    return newSession
  }

  async function openRegistration(): Promise<void> {
    if (!session) return

    // 1. Insert invitation row (id = the shareable UUID token)
    const { data: inv, error: invError } = await supabase
      .from('session_invitations')
      .insert({ session_id: session.id })
      .select()
      .single()

    if (invError) {
      toast.error(invError.message)
      return
    }

    // 2. Update session status to registration_open
    const { data: updated, error: sessionError } = await supabase
      .from('sessions')
      .update({ status: 'registration_open' })
      .eq('id', session.id)
      .select()
      .single()

    if (sessionError) {
      toast.error(sessionError.message)
      return
    }

    setInvitation(inv as Invitation)
    setSession(updated as Session)
  }

  async function reopenRegistration(): Promise<void> {
    if (!session) return

    const { data: inv, error: invError } = await supabase
      .from('session_invitations')
      .insert({ session_id: session.id })
      .select()
      .single()

    if (invError) { toast.error(invError.message); return }

    const { data: updated, error: sessionError } = await supabase
      .from('sessions')
      .update({ status: 'registration_open' })
      .eq('id', session.id)
      .select()
      .single()

    if (sessionError) { toast.error(sessionError.message); return }

    setInvitation(inv as Invitation)
    setSession(updated as Session)
  }

  async function closeRegistration(): Promise<void> {
    if (!session || !invitation) return

    // 1. Deactivate the invitation token
    const { error: invError } = await supabase
      .from('session_invitations')
      .update({ is_active: false })
      .eq('id', invitation.id)

    if (invError) {
      toast.error(invError.message)
      return
    }

    // 2. Update session status to registration_closed
    const { data: updated, error: sessionError } = await supabase
      .from('sessions')
      .update({ status: 'registration_closed' })
      .eq('id', session.id)
      .select()
      .single()

    if (sessionError) {
      toast.error(sessionError.message)
      return
    }

    setSession(updated as Session)
    setInvitation(null)
  }

  async function lockSchedule(matches: MatchInput[]): Promise<boolean> {
    if (!session) return false

    // 1. Bulk insert all matches with sequential queue_position
    const insertData = matches.map((m, i) => ({
      session_id: session.id,
      queue_position: i + 1,
      team1_player1_id: m.team1Player1,
      team1_player2_id: m.team1Player2,
      team2_player1_id: m.team2Player1,
      team2_player2_id: m.team2Player2,
    }))

    const { error: matchError } = await supabase.from('matches').insert(insertData)
    if (matchError) {
      toast.error(matchError.message)
      return false
    }

    // 2. Update session status to schedule_locked
    const { data: updated, error: sessionError } = await supabase
      .from('sessions')
      .update({ status: 'schedule_locked' })
      .eq('id', session.id)
      .select()
      .single()

    if (sessionError) {
      toast.error(sessionError.message)
      return false
    }

    setSession(updated as Session)
    return true
  }

  async function unlockSchedule(): Promise<void> {
    if (!session) return

    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .eq('session_id', session.id)

    if (deleteError) { toast.error(deleteError.message); return }

    const { data: updated, error } = await supabase
      .from('sessions')
      .update({ status: 'registration_closed' })
      .eq('id', session.id)
      .select()
      .single()

    if (error) { toast.error(error.message); return }
    setSession(updated as Session)
  }

  async function startSession(): Promise<void> {
    if (!session) return

    // Take first 2 queued matches and set them playing on court 1 & 2
    const { data: queued } = await supabase
      .from('matches')
      .select('id')
      .eq('session_id', session.id)
      .eq('status', 'queued')
      .order('queue_position')
      .limit(2)

    if (!queued || queued.length === 0) {
      toast.error('No queued matches found')
      return
    }

    const updates = (queued as Array<{ id: string }>).map((m, i) =>
      supabase.from('matches').update({ status: 'playing', court_number: i + 1 }).eq('id', m.id)
    )
    await Promise.all(updates)

    const { data: updated, error } = await supabase
      .from('sessions')
      .update({ status: 'in_progress' })
      .eq('id', session.id)
      .select()
      .single()

    if (error) { toast.error(error.message); return }
    setSession(updated as Session)
  }

  async function closeSession(): Promise<void> {
    if (!session) return
    const { data: updated, error } = await supabase
      .from('sessions')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', session.id)
      .select()
      .single()
    if (error) { toast.error(error.message); return }
    setSession(updated as Session)
  }

  return { session, invitation, playerCount, isLoading, createSession, openRegistration, closeRegistration, reopenRegistration, lockSchedule, unlockSchedule, startSession, closeSession }
}
