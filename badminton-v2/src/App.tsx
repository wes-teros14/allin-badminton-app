import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Toaster } from '@/components/ui/sonner'

function AdminRoute() {
  const { role, isLoading } = useAuth()
  if (isLoading) return <div>Loading…</div>
  if (role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

const KioskView    = lazy(() => import('@/views/KioskView'))
const PlayerView   = lazy(() => import('@/views/PlayerView'))
const AdminView    = lazy(() => import('@/views/AdminView'))
const RegisterView = lazy(() => import('@/views/RegisterView'))

function App() {
  return (
    <>
    <Toaster />
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route path="/"                 element={<div>badminton v2</div>} />
        <Route path="/kiosk"            element={<KioskView />} />
        <Route path="/player"           element={<PlayerView />} />
        <Route path="/player/:nameSlug" element={<PlayerView />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminView />} />
        </Route>
        <Route path="/register" element={<RegisterView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </>
  )
}

export default App
