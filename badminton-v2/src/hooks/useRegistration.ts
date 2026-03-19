import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface RegistrationState {
  user: User | null
  isLoading: boolean
  isValidToken: boolean
  isAlreadyRegistered: boolean
  signIn: () => Promise<void>
  register: () => Promise<void>
}

export function useRegistration(token: string | null): RegistrationState {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidToken, setIsValidToken] = useState(false)
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false)
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
        .select('session_id, is_active')
        .eq('id', token)
        .maybeSingle()

      if (error) console.error('[useRegistration] token validation error:', error)

      const inv = data as { session_id: string; is_active: boolean } | null

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
      setIsLoading(false)
    }

    validateToken()
  }, [token, user])

  async function signIn() {
    if (token) sessionStorage.setItem('registration_token', token)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/register` },
    })
  }

  async function register() {
    if (!user || !sessionId) return

    // Upsert profile with Google display name so roster shows a readable name
    const displayName = (user.user_metadata?.full_name as string | undefined)
      ?? user.email
      ?? user.id
    await supabase
      .from('profiles')
      .upsert({ id: user.id, name_slug: displayName, role: 'player' }, { onConflict: 'id', ignoreDuplicates: true })

    const { error } = await supabase
      .from('session_registrations')
      .insert({ session_id: sessionId, player_id: user.id })

    if (error) {
      toast.error(error.message)
      return
    }

    setIsAlreadyRegistered(true)
  }

  return { user, isLoading, isValidToken, isAlreadyRegistered, signIn, register }
}
