import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export function HomeView() {
  const { user, role, isLoading } = useAuth()

  function signIn() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Badminton Gang</h1>
        <p className="text-muted-foreground text-sm">Game Na Kahit Hindi Ready</p>
      </div>

      {isLoading ? (
        <div className="h-12 w-48 bg-muted rounded-lg animate-pulse" />
      ) : !user ? (
        <button
          onClick={signIn}
          className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          Sign in with Google
        </button>
      ) : (
        <div className="flex flex-col gap-3 w-48">
          <Link
            to="/profile"
            className="text-center px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            My Profile
          </Link>
          {role === 'admin' && (
            <Link
              to="/admin"
              className="text-center px-8 py-3 rounded-lg border border-border text-foreground font-semibold hover:bg-muted transition-colors"
            >
              Admin
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default HomeView
