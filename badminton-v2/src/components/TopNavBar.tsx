import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import ppLogo from '@/assets/pp-logo.jpeg'

export function TopNavBar() {
  const { user, role } = useAuth()
  const { pathname } = useLocation()
  const { unreadCount } = useNotifications()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) return null

  const primaryTabs = [
    {
      label: 'Sessions',
      href: '/sessions',
      active: pathname.startsWith('/sessions'),
      show: true,
      badge: false,
    },
    {
      label: 'All-time Idols',
      href: '/leaderboard',
      active: pathname.startsWith('/leaderboard'),
      show: true,
      badge: false,
    },
    {
      label: 'My Profile',
      href: '/profile',
      active: pathname.startsWith('/profile'),
      show: true,
      badge: unreadCount > 0,
    },
  ]

  const adminTabs = [
    {
      label: 'Admin',
      href: '/admin',
      active: pathname.startsWith('/admin') || pathname.startsWith('/session'),
      show: role === 'admin' || role === 'moderator',
      badge: false,
    },
    {
      label: 'Players',
      href: '/players',
      active: pathname.startsWith('/players'),
      show: role === 'admin',
      badge: false,
    },
    {
      label: 'Inventory',
      href: '/inventory',
      active: pathname.startsWith('/inventory'),
      show: role === 'admin',
      badge: false,
    },
    {
      label: 'Finance',
      href: '/finance',
      active: pathname.startsWith('/finance'),
      show: role === 'admin',
      badge: false,
    },
    {
      label: 'Payment Settings',
      href: '/payment-settings',
      active: pathname.startsWith('/payment-settings'),
      show: role === 'admin',
      badge: false,
    },
  ]

  const visibleAdminTabs = adminTabs.filter((tab) => tab.show)
  const hasAdminTabs = visibleAdminTabs.length > 0

  const renderTab = (tab: (typeof primaryTabs)[number], onClick?: () => void) => (
    <Link
      key={tab.href}
      to={tab.href}
      onClick={onClick}
      className={`relative text-sm font-medium transition-opacity shrink-0 ${
        tab.active
          ? 'border-b-2 border-white pb-0.5'
          : 'opacity-70 hover:opacity-100'
      }`}
    >
      {tab.label}
      {tab.badge && (
        <span className="absolute -top-1 -right-2 w-2 h-2 bg-[#FEFE6A] rounded-full" />
      )}
    </Link>
  )

  const renderMenuItem = (tab: (typeof adminTabs)[number], onClick: () => void) => (
    <Link
      key={tab.href}
      to={tab.href}
      onClick={onClick}
      className={`relative text-sm font-medium px-4 py-3 min-h-[48px] flex items-center transition-colors ${
        tab.active ? 'bg-white/15' : 'opacity-80 hover:opacity-100 hover:bg-white/10'
      }`}
    >
      {tab.label}
      {tab.badge && (
        <span className="absolute top-1/2 -translate-y-1/2 right-4 w-2 h-2 bg-[#FEFE6A] rounded-full" />
      )}
    </Link>
  )

  return (
    <nav className="relative bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
      <Link to="/" className="shrink-0">
        <img src={ppLogo} alt="PP" className="w-8 h-8 rounded-full object-cover" />
      </Link>
      <div className="flex items-center gap-6 flex-1 min-w-0">
        {primaryTabs.filter((tab) => tab.show).map((tab) => renderTab(tab))}
        {hasAdminTabs && (
          <div className="hidden md:flex items-center gap-6">
            {visibleAdminTabs.map((tab) => renderTab(tab))}
          </div>
        )}
      </div>
      {hasAdminTabs && (
        <button
          type="button"
          aria-label={menuOpen ? 'Close admin menu' : 'Open admin menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="md:hidden shrink-0 p-1.5 -mr-1.5"
        >
          {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      )}
      {hasAdminTabs && menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-primary text-primary-foreground border-t border-white/20 flex flex-col py-1 shadow-lg z-50">
          {visibleAdminTabs.map((tab) => renderMenuItem(tab, () => setMenuOpen(false)))}
        </div>
      )}
    </nav>
  )
}

export default TopNavBar
