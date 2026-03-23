import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export function HomeView() {
  const { user, isLoading } = useAuth()

  function signIn() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/` },
    })
  }

  if (isLoading) {
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

  // Logged in → welcome home
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <img src="/pp-logo.jpeg" alt="PP" className="w-20 h-20 rounded-full object-cover" />
      <h1 className="text-2xl font-bold">Welcome back!</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        Head to <span className="font-medium text-foreground">My Sessions</span> to see your schedule and leaderboard.
      </p>
    </div>
  )
}

export default HomeView
