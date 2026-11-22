import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {}, usesNeonData: true }))

import { isGalleryOpen } from '@/lib/galleryApi'

// Same rule as gallery_session_open (scripts/neon/migrations/093_gallery_open_until_closed.sql).
describe('isGalleryOpen', () => {
  it('is open while the session is in progress', () => {
    expect(isGalleryOpen({ status: 'in_progress', closed_at: null })).toBe(true)
  })

  it('stays open after Finish Session until the admin closes it', () => {
    expect(isGalleryOpen({ status: 'complete', closed_at: null })).toBe(true)
  })

  it('locks once the session is closed', () => {
    expect(isGalleryOpen({ status: 'complete', closed_at: '2026-11-22T15:00:00Z' })).toBe(false)
  })

  it('is closed before the session starts', () => {
    expect(isGalleryOpen({ status: 'schedule_locked', closed_at: null })).toBe(false)
    expect(isGalleryOpen({ status: 'registration_open', closed_at: null })).toBe(false)
  })
})
