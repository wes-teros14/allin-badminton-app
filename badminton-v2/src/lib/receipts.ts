/**
 * Limits and path construction for payment receipt images.
 *
 * These ceilings are usability guards, not security boundaries -- the
 * worst case they prevent is a player storing a few extra of their own
 * images. They are deliberately not duplicated as RLS predicates, which
 * would need a counting subquery on every insert for no real gain.
 */

/** Bucket is PRIVATE (migration 076). Reads require a signed URL. */
export const RECEIPTS_BUCKET = 'receipts'

/** How long a minted signed URL stays valid, in seconds. */
export const RECEIPT_SIGNED_URL_TTL = 60

export const MAX_RECEIPTS_PER_SESSION = 5

/**
 * Larger than the avatar's 1024 on purpose: a receipt has to stay
 * legible enough to read a transaction amount and reference number,
 * whereas an avatar only has to look right at 72px.
 */
export const MAX_RECEIPT_DIM = 1600

/** Ceiling after client-side compression. */
export const MAX_RECEIPT_BYTES = 800 * 1024

/** Reject absurdly large originals before we even try to process them. */
export const MAX_RECEIPT_INPUT_BYTES = 20 * 1024 * 1024

/** Matches the CHECK constraint on session_receipts.note. */
export const MAX_RECEIPT_NOTE_LENGTH = 140

/**
 * Storage path for one receipt image.
 *
 * playerId MUST be the first segment. The storage RLS ownership
 * predicate is `(storage.foldername(name))[1] = auth.uid()::text`,
 * copied from the avatars bucket -- reorder these segments and every
 * player silently loses access to their own uploads.
 */
export function buildReceiptPath(playerId: string, sessionId: string, receiptId: string): string {
  return `${playerId}/${sessionId}/${receiptId}.jpg`
}

/** Human-readable size for error messages. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}
