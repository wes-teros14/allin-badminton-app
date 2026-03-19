import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Role = 'admin' | 'player' | null

interface AuthState {
  user: User | null
  role: Role
  isLoading: boolean
}

async function fetchRole(userId: string): Promise<Role> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  // Cast needed until `supabase gen types --linked` regenerates database.ts
  return ((data as { role?: string } | null)?.role as Role) ?? null
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 1. Set up auth state listener — only manages user state, NOT role
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (!session?.user) setIsLoading(false)
    })

    // Callback must be synchronous — do NOT make it async
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setRole(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2. Fetch role in a separate effect, triggered after user state updates.
  //    This ensures the Supabase client has the JWT stored before querying.
  useEffect(() => {
    if (user) {
      fetchRole(user.id)
        .then(setRole)
        .finally(() => setIsLoading(false))
    }
  }, [user])

  return { user, role, isLoading }
}
