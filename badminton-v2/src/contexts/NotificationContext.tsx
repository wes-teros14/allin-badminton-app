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
}

function cheerLabel(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
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

      const cheers = data.filter((n: { type: string }) => n.type === 'cheer')
      const awards = data.filter((n: { type: string }) => n.type === 'award')

      let message = ''
      if (cheers.length > 0 && awards.length > 0) {
        message = `🎉 ${cheers.length} new cheer${cheers.length !== 1 ? 's' : ''} + ${awards.length} new award${awards.length !== 1 ? 's' : ''}!`
      } else if (cheers.length > 0) {
        message = `🏸 You received ${cheers.length} new cheer${cheers.length !== 1 ? 's' : ''}!`
      } else if (awards.length > 0) {
        message = awards.length === 1
          ? `🏆 New award: ${(awards[0] as { body: string }).body}!`
          : `🏆 ${awards.length} new awards!`
      }

      if (message) {
        setTimeout(() => {
          toast(message, {
            duration: 5000,
            action: {
              label: 'View',
              onClick: () => navigate('/profile'),
            },
          })
        }, 500)
      }
    }

    init()
  }, [user, navigate])

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
          toast(`${emoji} ${cheerLabel(n.title)} cheer from ${n.body}!`, {
            duration: 5000,
            action: {
              label: 'View',
              onClick: () => navigate('/profile'),
            },
          })
        } else if (n.type === 'award') {
          toast(`🏆 New award: ${n.body}!`, {
            duration: 5000,
            action: {
              label: 'View',
              onClick: () => navigate('/profile'),
            },
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, navigate])

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
