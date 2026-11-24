/**
 * Drawn icons for the app's cheer types and awards, in place of their emoji.
 *
 * The emoji stays the data key (it is stored on cheer types and award boards, and toasts still use it as
 * text); this component is what puts a picture on screen. One icon set and one stroke weight, so a cheer
 * looks the same in the picker, on the profile and on the leaderboard. An emoji with no mapping falls back
 * to itself, so a new cheer type or award never renders blank.
 */

import type { LucideIcon } from 'lucide-react'
import {
  BicepsFlexed,
  CalendarCheck,
  Dices,
  Flame,
  Handshake,
  Shield,
  Swords,
  Target,
  Wind,
  Bird,
  Zap,
} from 'lucide-react'
import { CHEER_CATEGORIES } from '@/lib/cheerTypes'

type Glyph = { Icon: LucideIcon; color: string }

const CHEER_ICONS: Partial<Record<string, LucideIcon>> = {
  offense: Swords,
  defense: Shield,
  technique: Target,
  movement: Wind,
  good_sport: Handshake,
  solid_effort: BicepsFlexed,
}

/** Strip the emoji variation selector so '⚔️' and '⚔' are the same key. */
const norm = (emoji: string) => emoji.replace(/️/g, '')

const BY_EMOJI = new Map<string, Glyph>()
for (const c of CHEER_CATEGORIES) {
  const Icon = CHEER_ICONS[c.slug]
  if (Icon) BY_EMOJI.set(norm(c.emoji), { Icon, color: c.color })
}
// Award boards (lib/awardBoards.ts). Colours sit in the same family as the cheer colours.
BY_EMOJI.set('📅', { Icon: CalendarCheck, color: '#8A8FE0' })
BY_EMOJI.set('🔥', { Icon: Flame, color: '#E0574B' })
BY_EMOJI.set('🐦', { Icon: Bird, color: '#48B39B' })
BY_EMOJI.set('⚡', { Icon: Zap, color: '#E8B33C' })
BY_EMOJI.set('🎲', { Icon: Dices, color: '#C77DD8' })

export function glyphFor(emoji: string): Glyph | null {
  return BY_EMOJI.get(norm(emoji)) ?? null
}

/**
 * The icon for a cheer or award emoji, in its own colour. `swatch` sets it on a tinted square, used where the
 * icon leads a tappable row. The colour is darkened in the light theme (`.glyph-ink` in index.css) — the
 * palette was tuned on the dark card, and the yellow and teal drop below 3:1 on white.
 */
export function GlyphIcon({
  emoji,
  size = 18,
  swatch = false,
  className = '',
}: {
  emoji: string
  size?: number
  swatch?: boolean
  className?: string
}) {
  const glyph = glyphFor(emoji)
  if (!glyph) {
    return (
      <span className={`leading-none ${className}`} style={{ fontSize: size }} aria-hidden="true">
        {emoji}
      </span>
    )
  }
  const { Icon, color } = glyph
  const icon = (
    <Icon
      aria-hidden="true"
      width={size}
      height={size}
      strokeWidth={2}
      className={`glyph-ink shrink-0 ${swatch ? '' : className}`}
      style={{ ['--glyph' as string]: color }}
    />
  )
  if (!swatch) return icon
  return (
    <span
      aria-hidden="true"
      className={`glyph-swatch grid shrink-0 place-items-center rounded-lg ${className}`}
      style={{ ['--glyph' as string]: color, width: size + 14, height: size + 14 }}
    >
      {icon}
    </span>
  )
}
