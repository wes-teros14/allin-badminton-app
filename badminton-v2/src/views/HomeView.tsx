import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerSessions } from '@/hooks/usePlayerSessions'
import { supabase } from '@/lib/supabase'

function WelcomeHome({ userId }: { userId: string }) {
  const [nickname, setNickname] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('profiles').select('nickname, name_slug').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const p = data as { nickname: string | null; name_slug: string }
          setNickname(p.nickname ?? p.name_slug)
        }
      })
  }, [userId])

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <p className="text-5xl">🏸</p>
      <h1 className="text-2xl font-bold">
        {nickname ? `Hey, ${nickname}!` : 'Welcome!'}
      </h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        You're not registered in any upcoming sessions yet.
      </p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Ask your organizer for an invite link to join a session.
      </p>
    </div>
  )
}

export function HomeView() {
  const { user, role, isLoading: authLoading } = useAuth()
  const { sessions, isLoading: sessionsLoading } = usePlayerSessions(user?.id ?? null)
  const navigate = useNavigate()

  const isLoading = authLoading || (!!user && role !== 'admin' && sessionsLoading)

  useEffect(() => {
    if (isLoading) return
    if (!user) return
    if (role === 'admin') {
      navigate('/admin', { replace: true })
      return
    }
    // Player with sessions → go to schedule
    if (sessions.length > 0) {
      navigate('/match-schedule', { replace: true })
    }
    // Player with no sessions → stay on homepage (WelcomeHome renders below)
  }, [isLoading, user, role, sessions.length, navigate])

  function signIn() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/` },
    })
  }

  // Loading spinner
  if (isLoading || (user && role === 'admin')) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  // Not logged in → sign in screen
  if (!user) {
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

  // Logged in player with no sessions
  return <WelcomeHome userId={user.id} />
}

export default HomeView
