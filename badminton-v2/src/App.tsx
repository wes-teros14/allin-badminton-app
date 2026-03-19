import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Toaster } from '@/components/ui/sonner'

function AdminRoute() {
  const { user, role, isLoading } = useAuth()
  if (isLoading) return <div>Loading…</div>
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <button
          onClick={() => supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/admin` },
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

const HomeView     = lazy(() => import('@/views/HomeView'))
const ProfileView  = lazy(() => import('@/views/ProfileView'))
const KioskView    = lazy(() => import('@/views/KioskView'))
const PlayerView   = lazy(() => import('@/views/PlayerView'))
const AdminView    = lazy(() => import('@/views/AdminView'))
const SessionView  = lazy(() => import('@/views/SessionView'))
const PlayersView  = lazy(() => import('@/views/PlayersView'))
const RegisterView = lazy(() => import('@/views/RegisterView'))

function App() {
  return (
    <>
    <Toaster />
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route path="/"                 element={<HomeView />} />
        <Route path="/profile"          element={<ProfileView />} />
        <Route path="/kiosk"                      element={<KioskView />} />
        <Route path="/kiosk/:sessionId"           element={<KioskView />} />
        <Route path="/player"           element={<PlayerView />} />
        <Route path="/player/:nameSlug" element={<PlayerView />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminView />} />
          <Route path="/session/:sessionId" element={<SessionView />} />
          <Route path="/players" element={<PlayersView />} />
        </Route>
        <Route path="/register" element={<RegisterView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </>
  )
}

export default App
