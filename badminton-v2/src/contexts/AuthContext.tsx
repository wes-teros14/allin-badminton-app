import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { ensureProfile } from '@/lib/ensureProfile'
import { ConnectionProblem } from '@/components/ConnectionProblem'

type Role = 'admin' | 'moderator' | 'player' | null

interface AuthState {
  user: User | null
  role: Role
  isLoading: boolean
}

const AuthContext = createContext<AuthState | undefined>(undefined)

/**
 * How long sign-in may wait on the backend before the app says it can't reach
 * the server. A healthy round trip is well under a second; a stalled database
 * holds requests for about a minute before the gateway gives up.
 */
const PROFILE_TIMEOUT_MS = 10_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}

async function fetchProfile(userId: string): Promise<{ role: Role; isActive: boolean }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', userId)
    .maybeSingle()
  // A missing row is an answer (no role yet); a failed request is not, and must
  // not be mistaken for "signed in as nobody".
  if (error) throw error
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
  const [connectionError, setConnectionError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // 1. Set up auth state listener — only manages user state, NOT role
  useEffect(() => {
    // getSession refreshes an expired token over the network, so it can hang
    // when the backend is down, just like the profile read below.
    withTimeout(supabase.auth.getSession(), PROFILE_TIMEOUT_MS)
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        if (!session?.user) setIsLoading(false)
      })
      .catch((err) => {
        console.error('[AuthContext] getSession failed:', err)
        setConnectionError(true)
        setIsLoading(false)
      })

    // Callback must be synchronous — do NOT make it async
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user ?? null
      // Token refreshes and tab refocus (SIGNED_IN again) hand over a new user
      // object for the same person. Keeping the old one stops every effect keyed
      // on `user` from re-running and re-reading; on Oct 4 2026 one phone read
      // its profile 107 times in 95 minutes. A real change (USER_UPDATED, or a
      // different id) still replaces it.
      setUser((prev) =>
        prev && next && prev.id === next.id && event !== 'USER_UPDATED' ? prev : next,
      )
      if (!session?.user) {
        setRole(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2. Fetch role in a separate effect, triggered after user state updates.
  //    This ensures the Supabase client has the JWT stored before querying.
  //    The profile is ensured first and inside the isLoading window, so screens
  //    that wait on isLoading never read a profile that is about to be created.
  const userId = user?.id ?? null
  const userRef = useRef(user)
  userRef.current = user
  // Keyed on the id, not the object: the profile only needs ensuring once per
  // person, not again on every metadata update. `attempt` re-runs it on Retry.
  useEffect(() => {
    const user = userRef.current
    if (!userId || !user) return
    let cancelled = false

    withTimeout(
      ensureProfile(user)
        .catch((err) => console.error('[AuthContext] ensureProfile failed:', err))
        .then(() => fetchProfile(user.id)),
      PROFILE_TIMEOUT_MS,
    )
      .then(({ role: r, isActive }) => {
        if (cancelled) return
        // Cleared only on success, so a retry keeps the message on screen
        // instead of flashing the app back up while it waits.
        setConnectionError(false)
        if (!isActive) {
          supabase.auth.signOut()
          return
        }
        setRole(r)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[AuthContext] profile load failed:', err)
        setConnectionError(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [userId, attempt])

  const retry = useCallback(() => {
    // The session itself never loaded, so there is no user to retry with;
    // start over from the top.
    if (!userRef.current) {
      window.location.reload()
      return
    }
    setIsLoading(true)
    setAttempt((n) => n + 1)
  }, [])

  if (connectionError) {
    return <ConnectionProblem onRetry={retry} isRetrying={isLoading} />
  }

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
