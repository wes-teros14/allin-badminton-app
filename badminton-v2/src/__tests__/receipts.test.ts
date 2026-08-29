import { describe, expect, it } from 'vitest'
import {
  buildReceiptPath,
  formatBytes,
  MAX_RECEIPT_BYTES,
  MAX_RECEIPT_DIM,
  MAX_RECEIPT_NOTE_LENGTH,
  MAX_RECEIPTS_PER_SESSION,
  RECEIPT_SIGNED_URL_TTL,
} from '@/lib/receipts'

describe('buildReceiptPath', () => {
  const player = '11111111-1111-1111-1111-111111111111'
  const session = '22222222-2222-2222-2222-222222222222'
  const receipt = '33333333-3333-3333-3333-333333333333'

  /**
   * This is the test that matters. Storage RLS checks ownership with
   * `(storage.foldername(name))[1] = auth.uid()::text`, so if playerId
   * ever stops being the FIRST segment, every player silently loses
   * access to their own uploads and admins lose the delete path.
   */
  it('puts playerId in the first path segment', () => {
    expect(buildReceiptPath(player, session, receipt).split('/')[0]).toBe(player)
  })

  it('nests session then receipt id, with a .jpg extension', () => {
    expect(buildReceiptPath(player, session, receipt)).toBe(`${player}/${session}/${receipt}.jpg`)
  })

  it('produces a distinct path per receipt so an upload can never overwrite another', () => {
    const a = buildReceiptPath(player, session, receipt)
    const b = buildReceiptPath(player, session, '44444444-4444-4444-4444-444444444444')
    expect(a).not.toBe(b)
  })
})

describe('receipt limits', () => {
  it('allows a receipt to be larger and higher-resolution than an avatar', () => {
    // Avatars are 1024px / 1MB. A receipt must stay legible enough to
    // read an amount and reference number.
    expect(MAX_RECEIPT_DIM).toBeGreaterThan(1024)
  })

  it('keeps the compressed ceiling small enough for a slow mobile connection', () => {
    expect(MAX_RECEIPT_BYTES).toBeLessThanOrEqual(1024 * 1024)
  })

  it('matches the note length to the database CHECK constraint', () => {
    expect(MAX_RECEIPT_NOTE_LENGTH).toBe(140)
  })

  it('caps receipts per session at a small number', () => {
    expect(MAX_RECEIPTS_PER_SESSION).toBeGreaterThan(1)
    expect(MAX_RECEIPTS_PER_SESSION).toBeLessThanOrEqual(10)
  })

  it('expires signed URLs quickly enough that a leaked address is inert', () => {
    expect(RECEIPT_SIGNED_URL_TTL).toBeLessThanOrEqual(300)
  })
})

describe('formatBytes', () => {
  it('renders KB below a megabyte', () => {
    expect(formatBytes(800 * 1024)).toBe('800 KB')
  })

  it('renders MB at or above a megabyte', () => {
    expect(formatBytes(20 * 1024 * 1024)).toBe('20.0 MB')
  })
})
