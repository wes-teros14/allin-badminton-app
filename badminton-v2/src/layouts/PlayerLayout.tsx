import { Outlet } from 'react-router'
import { TopNavBar } from '@/components/TopNavBar'

export function PlayerLayout() {
  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />
      <Outlet />
    </div>
  )
}

export default PlayerLayout
