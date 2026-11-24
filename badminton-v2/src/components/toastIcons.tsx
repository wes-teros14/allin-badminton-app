/**
 * Icons for the toast library's icon slot, so toast text carries no emoji (2026-11-24 pattern ban).
 * One place for every notification toast: receipts, awards and cheers.
 */

import { Megaphone, Receipt, Trophy } from 'lucide-react'
import { GlyphIcon } from '@/components/GlyphIcon'
import { cheerEmoji } from '@/lib/cheerBacklog'

export const receiptToastIcon = <Receipt className="h-[18px] w-[18px] text-muted-foreground" aria-hidden="true" />

export const awardToastIcon = <Trophy className="h-[18px] w-[18px] text-gold-ink" aria-hidden="true" />

/** A single cheer shows that cheer's own icon; a batch (no slug) shows the generic cheer icon. */
export function cheerToastIcon(slug?: string) {
  return slug
    ? <GlyphIcon emoji={cheerEmoji(slug)} size={18} />
    : <Megaphone className="h-[18px] w-[18px] text-primary-ink" aria-hidden="true" />
}
