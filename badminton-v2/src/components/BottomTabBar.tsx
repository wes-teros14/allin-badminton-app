/**
 * The app's main navigation (owner, 2026-11-21: B1 + X1 + D3). Replaces the old purple top bar.
 *
 *   Sessions · Leaderboard · [rabbit → Home] · Gallery · Profile   (+ Admin for staff)
 *
 * The rabbit sits raised in the middle and goes to the home page (Welcome back + Notice Board).
 * Admin: tapping Admin opens a sheet of the five admin pages. A moderator has only the Admin page,
 * so their Admin tab goes straight there. Profile keeps the unread-notification dot.
 *
 * Height: --tabbar-h in index.css. PlayerLayout pads the page by it and the "Cheer later" bar sits
 * above it, so nothing is hidden behind the bar.
 */
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { CalendarDays, Camera, Package, Settings, Shield, Trophy, UserRound, Users, Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { isUnder } from '@/lib/navMatch'
import { BottomSheet } from '@/components/BottomSheet'
import appLogo from '@/assets/logo-nav.png'

const ADMIN_PAGES = [
  { label: 'Admin home', href: '/admin', icon: Shield, match: ['/admin', '/session'] },
  { label: 'Players', href: '/players', icon: Users, match: ['/players'] },
  { label: 'Inventory', href: '/inventory', icon: Package, match: ['/inventory'] },
  { label: 'Finance', href: '/finance', icon: Wallet, match: ['/finance'] },
  { label: 'Settings', href: '/settings', icon: Settings, match: ['/settings'] },
] as const

const tabClass = (active: boolean, accent = false) =>
  `relative flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-1.5 text-[11px] leading-tight whitespace-nowrap transition-colors ${
    active ? `font-bold ${accent ? 'text-gold-ink' : 'text-primary-ink'}` : accent ? 'font-medium text-gold-ink' : 'font-medium text-muted-foreground hover:text-foreground'
  }`

export function BottomTabBar() {
  const { user, role } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { unreadCount } = useNotifications()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) return null
  const staff = role === 'admin' || role === 'moderator'
  const adminActive = ADMIN_PAGES.some((p) => p.match.some((m) => isUnder(pathname, m)))

  const tab = (label: string, href: string, Icon: typeof Trophy, active: boolean, badge = false) => (
    <Link to={href} className={tabClass(active)} aria-current={active ? 'page' : undefined}>
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
      {label}
      {badge && <span className="absolute top-1 left-1/2 ml-2 h-2 w-2 rounded-full bg-[#FEFE6A] ring-2 ring-card" aria-label="unread notifications" />}
    </Link>
  )

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch px-1">
          {tab('Sessions', '/sessions', CalendarDays, isUnder(pathname, '/sessions') || isUnder(pathname, '/match-schedule') || isUnder(pathname, '/today'))}
          {tab('Leaderboard', '/leaderboard', Trophy, isUnder(pathname, '/leaderboard'))}

          <Link
            to="/"
            aria-label="Home"
            aria-current={pathname === '/' ? 'page' : undefined}
            className={`${tabClass(pathname === '/')} justify-end pb-1.5 pt-0`}
          >
            <span className="-mt-6 mb-0.5 block h-[52px] w-[52px] overflow-hidden rounded-full border-[3px] border-card bg-primary shadow-[0_4px_12px_rgba(15,10,24,0.3)]">
              <img src={appLogo} alt="" className="h-full w-full object-cover" />
            </span>
            Home
          </Link>

          {tab('Gallery', '/gallery', Camera, isUnder(pathname, '/gallery'))}
          {tab('Profile', '/profile', UserRound, isUnder(pathname, '/profile'), unreadCount > 0)}

          {staff &&
            (role === 'admin' ? (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                className={tabClass(adminActive, true)}
              >
                <Shield className="h-[22px] w-[22px]" strokeWidth={adminActive ? 2.4 : 2} aria-hidden="true" />
                Admin
              </button>
            ) : (
              <Link to="/admin" className={tabClass(adminActive, true)} aria-current={adminActive ? 'page' : undefined}>
                <Shield className="h-[22px] w-[22px]" strokeWidth={adminActive ? 2.4 : 2} aria-hidden="true" />
                Admin
              </Link>
            ))}
        </div>
      </nav>

      {role === 'admin' && (
        <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Admin pages" showTitle={false}>
          <ul className="space-y-1">
            {ADMIN_PAGES.map(({ label, href, icon: Icon, match }) => {
              const active = match.some((m) => isUnder(pathname, m))
              return (
                <li key={href}>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); navigate(href) }}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3.5 text-left text-[15px] transition-colors ${
                      active ? 'bg-primary-subtle font-bold text-primary-ink' : 'font-medium hover:bg-muted'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-primary-ink' : 'text-muted-foreground'}`} aria-hidden="true" />
                    {label}
                  </button>
                </li>
              )
            })}
          </ul>
        </BottomSheet>
      )}
    </>
  )
}

export default BottomTabBar
