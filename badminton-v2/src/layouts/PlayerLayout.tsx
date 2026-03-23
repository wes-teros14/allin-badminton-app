import { Outlet } from 'react-router'
import { TopNavBar } from '@/components/TopNavBar'
import { NotificationProvider } from '@/contexts/NotificationContext'

export function PlayerLayout() {
  return (
    <NotificationProvider>
      <div className="min-h-screen bg-background">
        <TopNavBar />
        <Outlet />
      </div>
    </NotificationProvider>
  )
}

export default PlayerLayout
