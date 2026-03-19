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
  const [tokenChecked, setTokenChecked] = useState(false)

  // Auth listener — synchronous callback, same pattern as useAuth to avoid JWT race condition
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

  // Validate token — anon can read session_invitations (policy allows it)
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setIsValidToken(false)
        setTokenChecked(true)
        return
      }

      const { data } = await supabase
        .from('session_invitations')
        .select('session_id, is_active')
        .eq('id', token)
        .maybeSingle()

      const inv = data as { session_id: string; is_active: boolean } | null

      if (!inv || !inv.is_active) {
        setIsValidToken(false)
      } else {
        setIsValidToken(true)
        setSessionId(inv.session_id)
        sessionStorage.removeItem('registration_token')
      }
      setTokenChecked(true)
    }

    validateToken()
  }, [token])

  // Check duplicate registration — only when both auth and token are resolved
  useEffect(() => {
    async function checkRegistration() {
      if (!tokenChecked) return

      if (!isValidToken || !sessionId) {
        setIsLoading(false)
        return
      }

      if (!user) {
        setIsLoading(false)
        return
      }

      const { data } = await supabase
        .from('session_registrations')
        .select('id')
        .eq('session_id', sessionId)
        .eq('player_id', user.id)
        .maybeSingle()

      setIsAlreadyRegistered(!!data)
      setIsLoading(false)
    }

    checkRegistration()
  }, [user, sessionId, isValidToken, tokenChecked])

  async function signIn() {
    // Save token before OAuth redirect — query params are lost after Supabase redirect back
    if (token) sessionStorage.setItem('registration_token', token)
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

  return { user, isLoading, isValidToken, isAlreadyRegistered, signIn, register }
}
