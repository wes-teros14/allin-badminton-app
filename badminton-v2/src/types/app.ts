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
