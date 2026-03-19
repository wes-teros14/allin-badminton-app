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
}

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function fetchPlayers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name_slug, gender, level, role')
      .order('name_slug')
    if (error) { toast.error(error.message); return }
    setPlayers(
      (data ?? []).map((p: any) => ({
        id: p.id,
        nameSlug: p.name_slug,
        email: p.email ?? null,
        nickname: p.nickname ?? null,
        gender: p.gender ?? null,
        level: p.level ?? null,
        role: p.role,
      }))
    )
    setIsLoading(false)
  }

  useEffect(() => { fetchPlayers() }, [])

  async function updatePlayer(id: string, updates: Partial<Pick<Player, 'gender' | 'level' | 'nickname'>>) {
    const { error } = await supabase.from('profiles').update(updates as never).eq('id', id)
    if (error) { toast.error(error.message); return }
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p))
  }

  return { players, isLoading, updatePlayer }
}
