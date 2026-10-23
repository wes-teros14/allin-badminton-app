import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export interface Player {
  id: string
  nameSlug: string
  email: string | null
  nickname: string | null
  gender: 'M' | 'F' | null
  level: number | null
  role: string
  isActive: boolean
  /** Shared walk-in login, kept off every all-time board (migration 087). */
  isGuest: boolean
}

interface ProfileRow {
  id: string
  name_slug: string
  email: string | null
  nickname: string | null
  gender: 'M' | 'F' | null
  level: number | null
  role: string
  is_active: boolean | null
  is_guest: boolean
}

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function fetchPlayers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name_slug, email, nickname, gender, level, role, is_active, is_guest')
      .order('name_slug')
    if (error) { toast.error(error.message); return }
    setPlayers(
      ((data ?? []) as ProfileRow[]).map((p) => ({
        id: p.id,
        nameSlug: p.name_slug,
        email: p.email ?? null,
        nickname: p.nickname ?? null,
        gender: p.gender ?? null,
        level: p.level ?? null,
        role: p.role,
        isActive: p.is_active ?? true,
        isGuest: p.is_guest,
      }))
    )
    setIsLoading(false)
  }

  useEffect(() => { fetchPlayers() }, [])

  async function updatePlayer(id: string, updates: Partial<Pick<Player, 'gender' | 'level' | 'nickname'>>) {
    const { error } = await supabase.from('profiles').update(updates as Record<string, unknown>).eq('id', id)
    if (error) { toast.error(error.message); return }
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p))
  }

  async function setActive(id: string, isActive: boolean) {
    const { error } = await supabase.from('profiles').update({ is_active: isActive } as Record<string, unknown>).eq('id', id)
    if (error) { toast.error(error.message); return }
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, isActive } : p))
  }

  async function setGuest(id: string, isGuest: boolean) {
    const { error } = await supabase.from('profiles').update({ is_guest: isGuest } as Record<string, unknown>).eq('id', id)
    if (error) { toast.error(error.message); return }
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, isGuest } : p))
  }

  return { players, isLoading, updatePlayer, setActive, setGuest }
}
