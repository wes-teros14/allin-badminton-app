import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router'

const KioskView = lazy(() => import('@/views/KioskView'))
const PlayerView = lazy(() => import('@/views/PlayerView'))
const AdminView = lazy(() => import('@/views/AdminView'))

function App() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route path="/" element={<div>badminton v2</div>} />
        <Route path="/kiosk" element={<KioskView />} />
        <Route path="/player" element={<PlayerView />} />
        <Route path="/player/:nameSlug" element={<PlayerView />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
