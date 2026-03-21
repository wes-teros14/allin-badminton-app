import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export function HomeView() {
  const { user, role, isLoading } = useAuth()
  const navigate = useNavigate()

  // Auto-redirect authenticated users — they never need to see this page
  useEffect(() => {
    if (isLoading) return
    if (!user) return
    if (role === 'admin') {
      navigate('/admin', { replace: true })
    } else {
      navigate('/match-schedule', { replace: true })
    }
  }, [isLoading, user, role, navigate])

  function signIn() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/` },
    })
  }

  // Show spinner while auth is resolving or redirect is in flight
  if (isLoading || user) {
    return <div className="h-screen flex items-center justify-center"><div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Badminton Gang</h1>
        <p className="text-muted-foreground text-sm">Game Na Kahit Walang Warm Up</p>
      </div>
      <button
        onClick={signIn}
        className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
      >
        Sign in with Google
      </button>
    </div>
  )
}

export default HomeView
