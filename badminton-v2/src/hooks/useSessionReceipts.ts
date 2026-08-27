import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { resizeImageFile } from '@/lib/imageResize'
import {
  buildReceiptPath,
  MAX_RECEIPT_BYTES,
  MAX_RECEIPT_DIM,
  MAX_RECEIPT_INPUT_BYTES,
  RECEIPT_SIGNED_URL_TTL,
  RECEIPTS_BUCKET,
  formatBytes,
} from '@/lib/receipts'

export interface SessionReceipt {
  id: string
  playerId: string
  sessionId: string
  storagePath: string
  note: string | null
  uploadedAt: string
  dismissedAt: string | null
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

function mapRow(r: ReceiptRow): SessionReceipt {
  return {
    id: r.id,
    playerId: r.player_id,
    sessionId: r.session_id,
    storagePath: r.storage_path,
    note: r.note,
    uploadedAt: r.uploaded_at,
    dismissedAt: r.dismissed_at,
  }
}

/**
 * Mint a short-lived signed URL for a private receipt object.
 *
 * The `receipts` bucket is private (migration 076), so getPublicUrl()
 * is NOT usable here -- on a private bucket it returns an address that
 * resolves to nothing and fails silently. Signing uses the caller's own
 * JWT against the storage SELECT policy, so no service-role key is
 * needed: a player signs their own, an admin signs anyone's.
 */
export async function signReceiptUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, RECEIPT_SIGNED_URL_TTL)
  if (error) return null
  return data?.signedUrl ?? null
}

/** Sign many paths at once, preserving order. Failures map to null. */
export async function signReceiptUrls(storagePaths: string[]): Promise<Array<string | null>> {
  if (storagePaths.length === 0) return []
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrls(storagePaths, RECEIPT_SIGNED_URL_TTL)
  if (error || !data) return storagePaths.map(() => null)
  return data.map((d) => d.signedUrl ?? null)
}

interface SessionReceiptsState {
  receipts: SessionReceipt[]
  activeReceiptCount: number
  isLoading: boolean
  isUploading: boolean
  uploadReceipt: (file: File, note: string) => Promise<boolean>
  deleteReceipt: (receipt: SessionReceipt) => Promise<boolean>
  refresh: () => Promise<void>
}

/**
 * The signed-in player's own receipts for one session.
 *
 * RLS restricts SELECT to `player_id = auth.uid()`, so this hook can
 * never surface another player's receipts even if asked to.
 */
export function useSessionReceipts(
  sessionId: string | undefined,
  playerId: string | undefined,
  onChange?: () => void,
): SessionReceiptsState {
  const [receipts, setReceipts] = useState<SessionReceipt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)

  const refresh = useCallback(async () => {
    if (!sessionId || !playerId) { setReceipts([]); setIsLoading(false); return }

    const { data, error } = await supabase
      .from('session_receipts')
      .select('id, player_id, session_id, storage_path, note, uploaded_at, dismissed_at')
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .order('uploaded_at', { ascending: false })

    if (error) { toast.error(error.message); setIsLoading(false); return }

    setReceipts(((data ?? []) as ReceiptRow[]).map(mapRow))
    setIsLoading(false)
  }, [sessionId, playerId])

  useEffect(() => { void refresh() }, [refresh])

  /**
   * Storage object FIRST, row second.
   *
   * If the upload succeeds but the insert fails we roll the object back,
   * so a failure can never leave a stored image with no row pointing at
   * it -- that image would be unreachable and undeletable forever, since
   * storage_path is the only record of where it lives.
   */
  async function uploadReceipt(file: File, note: string): Promise<boolean> {
    if (!sessionId || !playerId) return false

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return false
    }
    if (file.size > MAX_RECEIPT_INPUT_BYTES) {
      toast.error(`That image is too large (max ${formatBytes(MAX_RECEIPT_INPUT_BYTES)})`)
      return false
    }

    setIsUploading(true)
    try {
      // The registration is the receipt's true parent, and RLS checks it
      // is still unconfirmed at write time -- this is what closes the race
      // where an admin confirms while this form is open.
      const { data: regData, error: regError } = await supabase
        .from('session_registrations')
        .select('id, paid')
        .eq('session_id', sessionId)
        .eq('player_id', playerId)
        .maybeSingle()

      if (regError) { toast.error(regError.message); return false }
      const registration = regData as { id: string; paid: boolean } | null
      if (!registration) { toast.error('You are not registered for this session'); return false }
      if (registration.paid) {
        toast.error('Your payment is already confirmed — no receipt needed')
        await refresh()
        return false
      }

      const resized = await resizeImageFile(file, MAX_RECEIPT_DIM, MAX_RECEIPT_BYTES)
      if (resized.size > MAX_RECEIPT_BYTES) {
        toast.error('Could not compress that image enough — please try a smaller one')
        return false
      }

      const receiptId = crypto.randomUUID()
      const path = buildReceiptPath(playerId, sessionId, receiptId)

      // No upsert: every receipt is a fresh UUID, so an interrupted retry
      // can never clobber an existing one.
      const { error: uploadError } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, resized, { contentType: 'image/jpeg' })
      if (uploadError) { toast.error(uploadError.message); return false }

      const trimmed = note.trim()
      const { error: insertError } = await supabase.from('session_receipts').insert({
        id: receiptId,
        registration_id: registration.id,
        session_id: sessionId,
        player_id: playerId,
        storage_path: path,
        note: trimmed.length > 0 ? trimmed : null,
      } as never)

      if (insertError) {
        // Roll the object back so we never strand an unreferenced image.
        await supabase.storage.from(RECEIPTS_BUCKET).remove([path])
        toast.error(insertError.message)
        return false
      }

      await refresh()
      onChange?.()
      toast.success('Receipt submitted — awaiting confirmation')
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process image')
      return false
    } finally {
      setIsUploading(false)
    }
  }

  /**
   * Storage object FIRST, row second -- see the module note. Deleting the
   * row first would discard storage_path, the only record of where the
   * image lives, stranding it permanently (FR-030).
   */
  async function deleteReceipt(receipt: SessionReceipt): Promise<boolean> {
    const { error: storageError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .remove([receipt.storagePath])
    if (storageError) {
      toast.error(`Could not remove the receipt image: ${storageError.message}`)
      return false
    }

    const { error } = await supabase.from('session_receipts').delete().eq('id', receipt.id)
    if (error) { toast.error(error.message); return false }

    await refresh()
    onChange?.()
    toast.success('Receipt removed')
    return true
  }

  return {
    receipts,
    activeReceiptCount: receipts.filter((r) => r.dismissedAt === null).length,
    isLoading,
    isUploading,
    uploadReceipt,
    deleteReceipt,
    refresh,
  }
}
