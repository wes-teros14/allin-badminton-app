import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'
import { formatSessionStamp } from '@/lib/sessionStamp'

interface NotificationState {
  unreadCount: number
  markAllRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationState>({
  unreadCount: 0,
  markAllRead: async () => {},
})

const CHEER_EMOJI: Record<string, string> = {
  offense: '⚔️',
  defense: '🛡️',
  technique: '🎯',
  movement: '💨',
  good_sport: '🤝',
  solid_effort: '💪',
}

const CHEER_LABEL: Record<string, string> = {
  offense: 'Fierce Offense',
  defense: 'Iron Defense',
  technique: 'Smooth Technique',
  movement: 'Swift Movement',
  good_sport: 'Good Sport',
  solid_effort: 'Solid Effort',
}

function cheerLabel(slug: string): string {
  return CHEER_LABEL[slug] ?? slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

interface NotificationRow {
  type: string
  title: string
  body: string | null
  related_id: string | null
}

/**
 * "<session name> · <session date>" for each session id, keyed by id.
 *
 * A receipt notification carries the session NAME in `title` but no date, and
 * a player can hold registrations for two open sessions at once -- so the name
 * alone is not always enough to tell an admin where to look. The date comes
 * from `sessions`, which every admin can already read.
 *
 * A failed or empty lookup yields an empty map on purpose: the caller then
 * falls back to the name already on the notification row, so the toast is
 * never worse than it was before.
 */
async function fetchSessionStamps(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return new Map()

  const { data, error } = await supabase.from('sessions').select('id, name, date').in('id', unique)
  if (error || !data) return new Map()

  const stamps = new Map<string, string>()
  for (const s of data as Array<{ id: string; name: string | null; date: string | null }>) {
    const stamp = formatSessionStamp(s.name, s.date)
    if (stamp) stamps.set(s.id, stamp)
  }
  return stamps
}

/**
 * Admin-only receipt toast (migration 078). One toast for the whole batch,
 * since a full session can produce ~16 uploads at once and sixteen stacked
 * toasts would bury everything else.
 *
 * Shared by the on-mount backlog and the realtime listener so the two can not
 * drift -- the backlog path previously showed no session at all.
 */
function showReceiptToast(
  receipts: NotificationRow[],
  stamps: Map<string, string>,
  navigateTo: (path: string) => void,
) {
  if (receipts.length === 0) return

  const sessionId = receipts[0].related_id
  const sameSession = receipts.every(r => r.related_id === sessionId)

  // Only meaningful when every receipt in the batch is for one session;
  // a mixed batch names none of them rather than naming the wrong one.
  const description = sameSession
    ? (sessionId ? stamps.get(sessionId) : undefined) ?? (receipts[0].title || undefined)
    : undefined

  toast(
    receipts.length === 1
      ? `🧾 ${receipts[0].body} uploaded a payment receipt`
      : `🧾 ${receipts.length} payment receipts uploaded`,
    {
      duration: 20000,
      closeButton: true,
      description,
      action: sameSession && sessionId
        ? { label: 'Review', onClick: () => navigateTo(`/finance/${sessionId}`) }
        : undefined,
    },
  )
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const [unreadCount, setUnreadCount] = useState(0)
  const didInit = useRef(false)

  // On mount: fetch unread notifications and show batch summary toast
  useEffect(() => {
    if (!user || didInit.current) return
    didInit.current = true

    async function init() {
      const { data, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user!.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })

      setUnreadCount(count ?? 0)

      if (!data || data.length === 0) return

      const rows = data as NotificationRow[]
      const cheers = rows.filter(n => n.type === 'cheer')
      const awards = rows.filter(n => n.type === 'award')
      // Admin-only: a player uploaded a payment receipt (migration 078)
      const receipts = rows.filter(n => n.type === 'receipt')

      // Mark all as read immediately so they don't reappear on refresh
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user!.id)
        .is('read_at', null)
      setUnreadCount(0)

      // Resolved before the toasts fire; no-ops (and costs nothing) when the
      // backlog holds no receipts.
      const receiptStamps = await fetchSessionStamps(receipts.map(r => r.related_id))

      setTimeout(() => {
        // Show each cheer individually with full detail
        cheers.forEach((n, i) => {
          const emoji = CHEER_EMOJI[n.title] ?? '🏸'
          setTimeout(() => {
            toast(`${emoji} ${cheerLabel(n.title)} from ${n.body}!`, { duration: 20000, closeButton: true })
          }, i * 200)
        })

        // Batch awards
        if (awards.length === 1) {
          toast(`🏆 New award: ${awards[0].body}!`, {
            duration: 20000,
            closeButton: true,
            className: 'toast-award',
            action: { label: 'View', onClick: () => navigateRef.current('/leaderboard?tab=awards') },
          })
        } else if (awards.length > 1) {
          toast(`🏆 ${awards.length} new awards!`, {
            duration: 20000,
            closeButton: true,
            className: 'toast-award',
            action: { label: 'View', onClick: () => navigateRef.current('/leaderboard?tab=awards') },
          })
        }

        showReceiptToast(receipts, receiptStamps, path => navigateRef.current(path))
      }, 500)
    }

    init()
  }, [user])

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`notifications-rt-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as NotificationRow
        setUnreadCount(c => c + 1)

        if (n.type === 'receipt') {
          // The session date needs one round trip, so the toast lands a moment
          // after the row does. Worth it: without the date, two open sessions
          // are indistinguishable to the admin reading this.
          void fetchSessionStamps([n.related_id]).then(stamps => {
            showReceiptToast([n], stamps, path => navigateRef.current(path))
          })
        } else if (n.type === 'cheer') {
          const emoji = CHEER_EMOJI[n.title] ?? '🏸'
          toast(`${emoji} ${cheerLabel(n.title)} from ${n.body}!`, { duration: 20000, closeButton: true })
        } else if (n.type === 'award') {
          toast(`🏆 New award: ${n.body}!`, {
            duration: 20000,
            closeButton: true,
            className: 'toast-award',
            action: {
              label: 'View',
              onClick: () => navigateRef.current('/leaderboard?tab=awards'),
            },
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Mark all as read
  const markAllRead = useCallback(async () => {
    if (!user || unreadCount === 0) return
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)
    setUnreadCount(0)
  }, [user, unreadCount])

  return (
    <NotificationContext.Provider value={{ unreadCount, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
