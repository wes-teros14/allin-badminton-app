import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface RegistrationState {
  user: User | null
  isLoading: boolean
  isValidToken: boolean
  isAlreadyRegistered: boolean
  isFull: boolean
  signIn: () => Promise<void>
  register: () => Promise<void>
}

export function useRegistration(token: string | null): RegistrationState {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidToken, setIsValidToken] = useState(false)
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false)
  const [isFull, setIsFull] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Validate token — only runs when user is signed in (authenticated read policy works reliably)
  useEffect(() => {
    async function validateToken() {
      setIsLoading(true)
      // No token at all — show "closed"
      if (!token) {
        setIsValidToken(false)
        setIsLoading(false)
        return
      }

      // Not signed in yet — show sign-in prompt, skip query
      if (!user) {
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('session_invitations')
        .select('session_id, is_active, max_players')
        .eq('id', token)
        .maybeSingle()

      if (error) console.error('[useRegistration] token validation error:', error)

      const inv = data as { session_id: string; is_active: boolean; max_players: number | null } | null

      if (!inv || !inv.is_active) {
        setIsValidToken(false)
        setIsLoading(false)
        return
      }

      setIsValidToken(true)
      setSessionId(inv.session_id)

      // Check duplicate registration
      const { data: existing } = await supabase
        .from('session_registrations')
        .select('id')
        .eq('session_id', inv.session_id)
        .eq('player_id', user.id)
        .maybeSingle()

      setIsAlreadyRegistered(!!existing)

      // Always ensure profile exists — decoupled from registration status.
      // Handles users whose trigger failed and who are already in session_registrations.
      await ensureProfile(user)

      // Check if session is full (only matters if not already registered)
      if (!existing && inv.max_players != null) {
        const { count } = await supabase
          .from('session_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', inv.session_id)
        setIsFull((count ?? 0) >= inv.max_players)
      }

      setIsLoading(false)
    }

    validateToken()
  }, [token, user])

  async function ensureProfile(u: User) {
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', u.id).maybeSingle()

    if (!existing) {
      const displayName = (u.user_metadata?.full_name as string | undefined) ?? u.email?.split('@')[0] ?? 'user'
      const baseSlug = displayName.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'user'

      let { error } = await supabase
        .from('profiles')
        .insert({ id: u.id, name_slug: baseSlug, email: u.email ?? null, role: 'player' } as never)

      // name_slug conflict — retry with short id suffix
      if (error?.code === '23505' && error.message.includes('name_slug')) {
        const retry = await supabase
          .from('profiles')
          .insert({ id: u.id, name_slug: `${baseSlug}-${u.id.slice(0, 6)}`, email: u.email ?? null, role: 'player' } as never)
        error = retry.error
      }

      // Primary key conflict — profile exists but SELECT was blocked by RLS, just patch email
      if (error?.code === '23505' && error.message.includes('pkey')) {
        const { error: updateErr } = await supabase.from('profiles').update({ email: u.email ?? null } as never).eq('id', u.id)
        if (updateErr) console.error('[ensureProfile] email patch error:', updateErr)
        return
      }

      if (error) console.error('[ensureProfile] insert error:', error)
    } else {
      const { error } = await supabase.from('profiles').update({ email: u.email ?? null } as never).eq('id', u.id)
      if (error) console.error('[ensureProfile] email update error:', error)
    }
  }

  async function signIn() {
    if (token) localStorage.setItem('registration_token', token)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/register` },
    })
  }

  async function register() {
    if (!user || !sessionId) return

    const { error } = await supabase
      .from('session_registrations')
      .insert({ session_id: sessionId, player_id: user.id })

    if (error) {
      toast.error(error.message)
      return
    }

    setIsAlreadyRegistered(true)
  }

  return { user, isLoading, isValidToken, isAlreadyRegistered, isFull, signIn, register }
}
