import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { RECEIPTS_BUCKET } from '@/lib/receipts'
import type { SessionReceipt } from '@/hooks/useSessionReceipts'

export interface RosterPlayer {
  registrationId: string
  playerId: string
  nameSlug: string
  nickname: string | null
  gender: 'M' | 'F' | null
  level: number | null
  /** Payment CONFIRMED by an admin. Sole input to revenue — do not repurpose. */
  paid: boolean
  /** Non-dismissed receipts. Feeds the derived "awaiting confirmation" state. */
  activeReceiptCount: number
  /** Includes dismissed ones, so the admin can still audit them. */
  totalReceiptCount: number
}

export interface UnregisteredPlayer {
  id: string
  nameSlug: string
  nickname: string | null
}

interface RegistrationRow {
  id: string
  player_id: string
  gender: 'M' | 'F' | null
  level: number | null
  paid: boolean | null
}

interface ReceiptRow {
  id: string
  player_id: string
  session_id: string
  storage_path: string
  note: string | null
  uploaded_at: string
  dismissed_at: string | null
}

interface RosterState {
  players: RosterPlayer[]
  unregisteredPlayers: UnregisteredPlayer[]
  isLoading: boolean
  addPlayer: (playerId: string) => Promise<void>
  removePlayer: (registrationId: string) => Promise<void>
  updateSessionOverride: (registrationId: string, gender: 'M' | 'F' | null, level: number | null) => Promise<void>
  updatePaid: (registrationId: string, paid: boolean) => Promise<void>
  receiptsFor: (playerId: string) => SessionReceipt[]
  dismissReceipt: (receiptId: string) => Promise<void>
}

export function useRoster(sessionId: string | undefined, onChange?: () => void): RosterState {
  const [players, setPlayers] = useState<RosterPlayer[]>([])
  const [unregisteredPlayers, setUnregisteredPlayers] = useState<UnregisteredPlayer[]>([])
  const [receiptsByPlayer, setReceiptsByPlayer] = useState<Map<string, SessionReceipt[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  async function fetchRoster() {
    if (!sessionId) return

    // Fetch registrations including session-specific gender/level overrides
    const { data: regs, error: regsError } = await supabase
      .from('session_registrations')
      .select('id, player_id, gender, level, paid')
      .eq('session_id', sessionId)

    if (regsError) { toast.error(regsError.message); return }

    const regsFull = (regs ?? []) as RegistrationRow[]
    const registrations = regsFull.map((r) => ({ id: r.id, player_id: r.player_id }))
    const registeredIds = registrations.map((r) => r.player_id)

    // Receipts for this session. RLS returns all rows to an admin and none to
    // anyone else, so this is safe to call unconditionally.
    const { data: receiptData } = await supabase
      .from('session_receipts')
      .select('id, player_id, session_id, storage_path, note, uploaded_at, dismissed_at')
      .eq('session_id', sessionId)
      .order('uploaded_at', { ascending: false })

    const receiptMap = new Map<string, SessionReceipt[]>()
    for (const row of (receiptData ?? []) as ReceiptRow[]) {
      const list = receiptMap.get(row.player_id) ?? []
      list.push({
        id: row.id,
        playerId: row.player_id,
        sessionId: row.session_id,
        storagePath: row.storage_path,
        note: row.note,
        uploadedAt: row.uploaded_at,
        dismissedAt: row.dismissed_at,
      })
      receiptMap.set(row.player_id, list)
    }

    // Profile defaults (name, gender, level)
    const registeredProfiles =
      registeredIds.length > 0
        ? ((await supabase.from('profiles').select('id, name_slug, nickname, gender, level').in('id', registeredIds)).data ?? []) as
            { id: string; name_slug: string; nickname: string | null; gender: 'M' | 'F' | null; level: number | null }[]
        : []

    // All known players for "Add player" list (includes admins who can also play)
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name_slug, nickname')
      .eq('is_active', true)

    if (profilesError) { toast.error(profilesError.message); return }

    const playerProfiles = (allProfiles ?? []) as { id: string; name_slug: string; nickname: string | null }[]
    const profileMap = new Map(registeredProfiles.map((p) => [p.id, p]))

    const rosterPlayers: RosterPlayer[] = regsFull.map((r) => {
      const p = profileMap.get(r.player_id)
      const playerReceipts = receiptMap.get(r.player_id) ?? []
      return {
        registrationId: r.id,
        playerId: r.player_id,
        nameSlug: p?.name_slug ?? r.player_id,
        nickname: p?.nickname ?? null,
        gender: (r.gender ?? p?.gender ?? null) as 'M' | 'F' | null,
        level: r.level ?? p?.level ?? null,
        paid: r.paid ?? false,
        activeReceiptCount: playerReceipts.filter((x) => x.dismissedAt === null).length,
        totalReceiptCount: playerReceipts.length,
      }
    })

    const unregistered: UnregisteredPlayer[] = playerProfiles
      .filter((p) => !registeredIds.includes(p.id))
      .map((p) => ({ id: p.id, nameSlug: p.name_slug, nickname: p.nickname ?? null }))

    setPlayers(rosterPlayers)
    setUnregisteredPlayers(unregistered)
    setReceiptsByPlayer(receiptMap)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchRoster()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`roster:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_registrations', filter: `session_id=eq.${sessionId}` }, fetchRoster)
      // Second listener on the SAME channel so the payment panel reflects a
      // player's upload without a manual refresh (migration 077 adds the table
      // to the realtime publication — without that this is silently inert).
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_receipts', filter: `session_id=eq.${sessionId}` }, fetchRoster)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function addPlayer(playerId: string) {
    if (!sessionId) return
    const { error } = await supabase.from('session_registrations').insert({ session_id: sessionId, player_id: playerId, source: 'admin' })
    if (error) { toast.error(error.message); return }
    await fetchRoster()
    onChange?.()
  }

  /**
   * Removing a registration cascades its session_receipts rows away — and those
   * rows hold storage_path, the ONLY record of where each image lives. A DB
   * cascade cannot touch Storage, so deleting the registration first would
   * strand the images in the bucket permanently: unreachable, undeletable, and
   * still readable by anyone whose storage RLS matches the path.
   *
   * Storage objects first, row second. Same rule as deleteReceipt and the
   * session-delete path in AdminView.
   */
  async function removePlayer(registrationId: string) {
    const { data: receiptRows, error: receiptError } = await supabase
      .from('session_receipts')
      .select('storage_path')
      .eq('registration_id', registrationId)

    if (receiptError) { toast.error(receiptError.message); return }

    const paths = ((receiptRows ?? []) as { storage_path: string }[]).map((r) => r.storage_path)
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from(RECEIPTS_BUCKET).remove(paths)
      if (storageError) {
        toast.error(`Could not remove this player's receipt images: ${storageError.message}`)
        return
      }
    }

    const { error } = await supabase.from('session_registrations').delete().eq('id', registrationId)
    if (error) { toast.error(error.message); return }
    await fetchRoster()
    onChange?.()
  }

  // Writes session-specific gender/level override (does NOT touch profiles)
  async function updateSessionOverride(registrationId: string, gender: 'M' | 'F' | null, level: number | null) {
    const { error } = await supabase
      .from('session_registrations')
      .update({ gender, level } as never)
      .eq('id', registrationId)
    if (error) { toast.error(error.message); return }
    setPlayers((prev) => prev.map((p) => p.registrationId === registrationId ? { ...p, gender, level } : p))
    onChange?.()
  }

  /**
   * The ONLY writer of `paid`. Setting true is an admin's explicit
   * confirmation; nothing a player does can reach this.
   */
  async function updatePaid(registrationId: string, paid: boolean) {
    const { error } = await supabase
      .from('session_registrations')
      .update({ paid } as never)
      .eq('id', registrationId)
    if (error) { toast.error(error.message); return }
    setPlayers((prev) => prev.map((p) => p.registrationId === registrationId ? { ...p, paid } : p))
    onChange?.()
  }

  function receiptsFor(playerId: string): SessionReceipt[] {
    return receiptsByPlayer.get(playerId) ?? []
  }

  /**
   * Dismissal never deletes. The image and row are retained so the admin can
   * still audit what was submitted; the receipt simply stops counting toward
   * the derived "awaiting confirmation" state.
   */
  async function dismissReceipt(receiptId: string) {
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('session_receipts')
      .update({ dismissed_at: new Date().toISOString(), dismissed_by: userData.user?.id ?? null } as never)
      .eq('id', receiptId)
    if (error) { toast.error(error.message); return }
    await fetchRoster()
    toast.success('Receipt dismissed')
  }

  return {
    players,
    unregisteredPlayers,
    isLoading,
    addPlayer,
    removePlayer,
    updateSessionOverride,
    updatePaid,
    receiptsFor,
    dismissReceipt,
  }
}
