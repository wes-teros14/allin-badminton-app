/**
 * The awards on the Awards tab: their names, stated once.
 *
 * Pure and dependency-free so the celebration rules (podiumCelebration) can name
 * award boards without pulling in the data layer, and the Awards tab, the card
 * and the toast all print the same words.
 */

export const AWARD_BOARDS = [
  { key: 'joined', emoji: '📅', label: 'Most Sessions Joined', short: 'Joined', measure: 'sessions joined' },
  { key: 'attendance-streak', emoji: '🔥', label: 'Attendance Streak', short: 'Streak', measure: 'sessions in a row' },
  { key: 'early-bird', emoji: '🐦', label: 'Registration Early Bird', short: 'Early', measure: 'early-registration points' },
  { key: 'win-streak', emoji: '⚡', label: 'Win Streak', short: 'Wins', measure: 'wins in a row' },
  { key: 'giant-slayer', emoji: '🎲', label: 'Against the Odds', short: 'Odds', measure: 'upsets as the underdog' },
] as const

export type AwardKey = (typeof AWARD_BOARDS)[number]['key']
export type AwardBoardInfo = (typeof AWARD_BOARDS)[number]

export function awardBoard(key: AwardKey): AwardBoardInfo {
  return AWARD_BOARDS.find((a) => a.key === key)!
}

export function isAwardKey(value: string | null | undefined): value is AwardKey {
  return AWARD_BOARDS.some((a) => a.key === value)
}
