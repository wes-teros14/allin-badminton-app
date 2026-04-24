import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Role = 'admin' | 'player' | null

interface AuthState {
  user: User | null
  role: Role
  isLoading: boolean
}

const AuthContext = createContext<AuthState | undefined>(undefined)

async function fetchProfile(userId: string): Promise<{ role: Role; isActive: boolean }> {
  const { data } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', userId)
    .single()
  const row = data as { role?: string; is_active?: boolean } | null
  return {
    role: (row?.role as Role) ?? null,
    isActive: row?.is_active ?? true,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
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
      fetchProfile(user.id).then(({ role: r, isActive }) => {
        if (!isActive) {
          supabase.auth.signOut()
          return
        }
        setRole(r)
      }).finally(() => setIsLoading(false))
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, role, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
