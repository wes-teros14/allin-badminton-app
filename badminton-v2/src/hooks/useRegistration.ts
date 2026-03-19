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

  async function signIn() {
    if (token) localStorage.setItem('registration_token', token)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/register` },
    })
  }

  async function register() {
    if (!user || !sessionId) return

    // Safety net: ensure profile row exists (trigger may have failed silently).
    // First check if a profile already exists, then INSERT if missing.
    // We avoid upsert+ignoreDuplicates because ON CONFLICT DO NOTHING
    // silently swallows RLS denials, making failures invisible.
    console.log('[register] user.id:', user.id, 'user.email:', user.email)

    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    console.log('[register] existingProfile:', existingProfile, 'selectError:', selectError)

    if (!existingProfile) {
      console.log('[register] no profile found — inserting')
      const { data: insertData, error: insertError } = await supabase
        .from('profiles')
        .insert({ id: user.id, name_slug: user.id, email: user.email ?? null, role: 'player' } as never)
        .select()

      console.log('[register] insert result:', insertData, insertError)

      if (insertError) {
        console.error('[register] profile insert error:', insertError)
        toast.error('Failed to create profile: ' + insertError.message)
        return
      }
    } else {
      console.log('[register] profile exists — patching email')
      const { data: updateData, error: profileError } = await supabase
        .from('profiles')
        .update({ email: user.email ?? null } as never)
        .eq('id', user.id)
        .select()

      console.log('[register] update result:', updateData, profileError)

      if (profileError) {
        console.error('[register] profile email update error:', profileError)
        console.warn('[register] continuing despite email update failure')
      }
    }

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
