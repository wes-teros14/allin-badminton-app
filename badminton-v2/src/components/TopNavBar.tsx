import { Link, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import ppLogo from '@/assets/pp-logo.jpeg'

export function TopNavBar() {
  const { user, role } = useAuth()
  const { pathname } = useLocation()

  if (!user) return null

  const tabs = [
    {
      label: 'My Sessions',
      href: '/sessions',
      active: pathname.startsWith('/sessions'),
      show: true,
    },
    {
      label: 'All-time Idols',
      href: '/leaderboard',
      active: pathname.startsWith('/leaderboard'),
      show: true,
    },
    {
      label: 'My Profile',
      href: '/profile',
      active: pathname.startsWith('/profile'),
      show: true,
    },
    {
      label: 'Admin',
      href: '/admin',
      active: pathname.startsWith('/admin') || pathname.startsWith('/session'),
      show: role === 'admin',
    },
    {
      label: 'Players',
      href: '/players',
      active: pathname.startsWith('/players'),
      show: role === 'admin',
    },
  ]

  return (
    <nav className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
      <Link to="/" className="shrink-0">
        <img src={ppLogo} alt="PP" className="w-8 h-8 rounded-full object-cover" />
      </Link>
      <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {tabs.filter((tab) => tab.show).map((tab) => (
        <Link
          key={tab.href}
          to={tab.href}
          className={`text-sm font-medium transition-opacity shrink-0 ${
            tab.active
              ? 'border-b-2 border-white pb-0.5'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          {tab.label}
        </Link>
      ))}
      </div>
    </nav>
  )
}

export default TopNavBar
