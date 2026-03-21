import { Link, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useActiveSession } from '@/hooks/useActiveSession'

export function TopNavBar() {
  const { user, role } = useAuth()
  const { pathname } = useLocation()
  const { activeSession } = useActiveSession()

  if (!user) return null

  const tabs = [
    {
      label: '🏸 Schedule',
      href: '/match-schedule',
      active: pathname.startsWith('/match-schedule'),
      show: true,
    },
    {
      label: '🏆 Today',
      href: '/today',
      active: pathname === '/today',
      show: !!activeSession,
    },
    {
      label: '👤 My Profile',
      href: '/profile',
      active: pathname.startsWith('/profile'),
      show: true,
    },
    {
      label: '⚙️ Admin',
      href: '/admin',
      active: pathname.startsWith('/admin') || pathname.startsWith('/session') || pathname.startsWith('/players'),
      show: role === 'admin',
    },
  ]

  return (
    <nav className="bg-primary text-primary-foreground px-4 py-2 flex items-center gap-6">
      <div className="w-8 h-8 rounded-md bg-primary-foreground/20 flex items-center justify-center text-xs font-bold shrink-0">
        PP
      </div>
      {tabs.filter((tab) => tab.show).map((tab) => (
        <Link
          key={tab.href}
          to={tab.href}
          className={`text-sm font-medium transition-opacity ${
            tab.active
              ? 'border-b-2 border-white pb-0.5'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

export default TopNavBar
