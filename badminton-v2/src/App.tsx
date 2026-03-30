import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Toaster } from '@/components/ui/sonner'
import { PlayerLayout } from '@/layouts/PlayerLayout'
import { DevLoginPanel } from '@/components/DevLoginPanel'

function AdminRoute() {
  const { user, role, isLoading } = useAuth()
  if (isLoading) return <div>Loading…</div>
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <button
          onClick={() => supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/admin` },
          })}
          className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    )
  }
  if (role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

const HomeView                 = lazy(() => import('@/views/HomeView'))
const ProfileView              = lazy(() => import('@/views/ProfileView'))
const LiveBoardView            = lazy(() => import('@/views/LiveBoardView'))
const PlayerView               = lazy(() => import('@/views/PlayerView'))
const TodayView                = lazy(() => import('@/views/TodayView'))
const AdminView                = lazy(() => import('@/views/AdminView'))
const SessionView              = lazy(() => import('@/views/SessionView'))
const PlayersView              = lazy(() => import('@/views/PlayersView'))
const RegisterView             = lazy(() => import('@/views/RegisterView'))
const MySessionsView           = lazy(() => import('@/views/MySessionsView'))
const SessionPlayerDetailView  = lazy(() => import('@/views/SessionPlayerDetailView'))
const LeaderboardView          = lazy(() => import('@/views/LeaderboardView'))

function App() {
  return (
    <AuthProvider>
    <Toaster position="top-center" offset={52} style={{ fontSize: '1rem' }} />
    <DevLoginPanel />
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route element={<PlayerLayout />}>
          <Route path="/" element={<HomeView />} />
        </Route>
        <Route path="/live-board"            element={<LiveBoardView />} />
        <Route path="/live-board/:sessionId" element={<LiveBoardView />} />
        <Route path="/register"         element={<RegisterView />} />
        {/* Player-facing routes — wrapped in PlayerLayout for top nav bar */}
        <Route element={<PlayerLayout />}>
          <Route path="/profile"                                             element={<ProfileView />} />
          <Route path="/sessions"                                            element={<MySessionsView />} />
          <Route path="/sessions/:sessionId"                                 element={<SessionPlayerDetailView />} />
          <Route path="/leaderboard"                                         element={<LeaderboardView />} />
          {/* Legacy routes — kept for internal links (AllMatchesView, etc.) */}
          <Route path="/today"                                               element={<TodayView />} />
          <Route path="/match-schedule"                                      element={<PlayerView />} />
          <Route path="/match-schedule/:nameSlug"                            element={<PlayerView />} />
          <Route path="/match-schedule/session/:sessionId"                   element={<PlayerView />} />
          <Route path="/match-schedule/session/:sessionId/:nameSlug"         element={<PlayerView />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route element={<PlayerLayout />}>
            <Route path="/admin"              element={<AdminView />} />
            <Route path="/session/:sessionId" element={<SessionView />} />
            <Route path="/players"            element={<PlayersView />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </AuthProvider>
  )
}

export default App
