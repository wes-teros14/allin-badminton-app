// App-level domain types
// These are hand-written (not generated); add types as features are implemented.

export type UserRole = 'admin' | 'player'

export type SessionStatus =
  | 'setup'
  | 'registration_open'
  | 'registration_closed'
  | 'schedule_locked'
  | 'in_progress'
  | 'complete'

export type MatchStatus = 'queued' | 'playing' | 'complete'

export type CheerTypeSlug = 'offense' | 'defense' | 'technique' | 'movement' | 'good_sport' | 'solid_effort'

export interface CheerType {
  id: string
  slug: CheerTypeSlug
  name: string
  emoji: string
}
