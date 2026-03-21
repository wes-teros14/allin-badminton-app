import { Link, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useActiveSession } from '@/hooks/useActiveSession'

export function TopNavBar() {
  const { user, role } = useAuth()
  const { activeSession } = useActiveSession()
  const { pathname } = useLocation()

  if (!user || role === 'admin') return null

  const scheduleHref = activeSession
    ? `/match-schedule/session/${activeSession.sessionId}`
    : '/match-schedule'

  const tabs = [
    {
      label: '🏸 Schedule',
      href: scheduleHref,
      active: pathname.startsWith('/match-schedule'),
    },
    {
      label: '🏆 Today',
      href: '/today',
      active: pathname === '/today',
    },
    {
      label: '👤 Profile',
      href: '/profile',
      active: pathname.startsWith('/profile'),
    },
  ]

  return (
    <nav className="bg-primary text-primary-foreground px-4 py-2 flex items-center gap-6">
      {tabs.map((tab) => (
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
