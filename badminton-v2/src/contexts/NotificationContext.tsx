import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'

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

      const rows = data as Array<{ type: string; title: string; body: string | null }>
      const cheers = rows.filter(n => n.type === 'cheer')
      const awards = rows.filter(n => n.type === 'award')

      // Mark all as read immediately so they don't reappear on refresh
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user!.id)
        .is('read_at', null)
      setUnreadCount(0)

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
        const n = payload.new as { type: string; title: string; body: string | null }
        setUnreadCount(c => c + 1)

        if (n.type === 'cheer') {
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
