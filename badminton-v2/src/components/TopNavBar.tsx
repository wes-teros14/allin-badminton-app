import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { isUnder } from '@/lib/navMatch'
import appLogo from '@/assets/logo-nav.png'

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
      active: isUnder(pathname, '/sessions'),
      show: true,
      badge: false,
    },
    {
      label: 'Leaderboard',
      href: '/leaderboard',
      active: isUnder(pathname, '/leaderboard'),
      show: true,
      badge: false,
    },
    {
      label: 'My Profile',
      href: '/profile',
      active: isUnder(pathname, '/profile'),
      show: true,
      badge: unreadCount > 0,
    },
    {
      // Always on the bar, never in the ☰ menu: moderators forgot it was there (2026-11-17).
      label: 'Admin',
      href: '/admin',
      active: isUnder(pathname, '/admin') || isUnder(pathname, '/session'),
      show: role === 'admin' || role === 'moderator',
      badge: false,
      accent: true,
    },
  ]

  const adminTabs = [
    {
      label: 'Players',
      href: '/players',
      active: isUnder(pathname, '/players'),
      show: role === 'admin',
      badge: false,
    },
    {
      label: 'Inventory',
      href: '/inventory',
      active: isUnder(pathname, '/inventory'),
      show: role === 'admin',
      badge: false,
    },
    {
      label: 'Finance',
      href: '/finance',
      active: isUnder(pathname, '/finance'),
      show: role === 'admin',
      badge: false,
    },
    {
      label: 'Settings',
      href: '/settings',
      active: isUnder(pathname, '/settings'),
      show: role === 'admin',
      badge: false,
    },
  ]

  const visibleAdminTabs = adminTabs.filter((tab) => tab.show)
  const hasAdminTabs = visibleAdminTabs.length > 0
  const visiblePrimaryTabs = primaryTabs.filter((tab) => tab.show)
  // Four tabs plus the ☰ need 389 px at the normal size. Below md the bar
  // tightens instead (measured: 12 px fits 360 px phones, 13 px fits 375 px).
  const compact = visiblePrimaryTabs.length > 3

  type Tab = { label: string; href: string; active: boolean; badge: boolean; accent?: boolean }
  const renderTab = (tab: Tab, onClick?: () => void) => (
    <Link
      key={tab.href}
      to={tab.href}
      onClick={onClick}
      className={`relative font-medium transition-opacity shrink-0 ${
        compact ? 'text-xs min-[372px]:text-[13px] md:text-sm' : 'text-sm'
      } ${
        // The admin tab is the brand yellow (7.6:1 on the purple bar) and never
        // dimmed, so it stands apart from the player tabs.
        tab.accent ? 'text-[#FEFE6A]' : ''
      } ${
        tab.active
          ? `border-b-2 pb-0.5 ${tab.accent ? 'border-[#FEFE6A]' : 'border-white'}`
          : tab.accent ? 'hover:opacity-80' : 'opacity-70 hover:opacity-100'
      }`}
    >
      {tab.label}
      {tab.badge && (
        <span className="absolute -top-1 -right-2 w-2 h-2 bg-[#FEFE6A] rounded-full" />
      )}
    </Link>
  )

  const renderMenuItem = (tab: Tab, onClick: () => void) => (
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
    <nav className={`relative bg-primary text-primary-foreground px-4 py-3 flex items-center ${compact ? 'gap-2 md:gap-3' : 'gap-3'}`}>
      <Link to="/" className="shrink-0">
        <img src={appLogo} alt="Badminton Tayo home" className="w-8 h-8 rounded-full object-cover" />
      </Link>
      <div className={`flex items-center flex-1 min-w-0 ${compact ? 'gap-3 md:gap-6' : 'gap-6'}`}>
        {visiblePrimaryTabs.map((tab) => renderTab(tab))}
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
