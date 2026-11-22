import { BADGE_HOLD_SESSIONS, seasonWindow, type BoardScope } from '@/lib/season'
import { fetchCompletedSessions } from '@/lib/seasonData'
import { fetchCheerLeaderboard, type CheerLeaderboardEntry } from '@/lib/leaderboardData'
import { fetchAwardsLeaderboard, type AwardEntry } from '@/lib/awardsLeaderboard'
import { rankCheerShares } from '@/lib/cheerShare'
import { CHEER_CATEGORIES } from '@/lib/cheerTypes'
import type { AwardKey } from '@/lib/awardBoards'
import type { CheerTypeSlug } from '@/types/app'

export interface Badge {
  emoji: string
  label: string
}

/** Profile badge wording for each cheer category's sole 1st place. */
const CHEER_BADGE_LABELS: Record<CheerTypeSlug, string> = {
  offense: 'Top Offense',
  defense: 'Top Defense',
  technique: 'Top Technique',
  movement: 'Top Movement',
  good_sport: 'Top Good Sport',
  solid_effort: 'Top Solid Effort',
}

/** Awards that badge their 1st place (shared on a tie). The attendance streak has never had a badge. */
const AWARD_BADGE_KEYS: readonly AwardKey[] = ['joined', 'early-bird', 'win-streak', 'giant-slayer']

/**
 * The badges a player holds, read straight from the season's boards so a badge always matches a
 * holder there. Cheer badges need a sole 1st place (a tie gives none); award badges go to every
 * player on 1st place. `unlocked: false` is the early-season hold: no badges yet.
 */
export function badgesFor(
  playerId: string,
  input: { cheerRows: readonly CheerLeaderboardEntry[]; awards: readonly AwardEntry[]; unlocked: boolean },
): Badge[] {
  if (!input.unlocked) return []
  const badges: Badge[] = []

  for (const category of CHEER_CATEGORIES) {
    const ranked = rankCheerShares(
      input.cheerRows.map((c) => ({
        playerId: c.player_id,
        categoryCount: category.of(c),
        totalReceived: c.cheers_received,
      })),
      { maxPlaces: 1 },
    )
    if (ranked.length === 1 && ranked[0].playerId === playerId) {
      badges.push({ emoji: category.emoji, label: CHEER_BADGE_LABELS[category.slug] })
    }
  }

  for (const key of AWARD_BADGE_KEYS) {
    const award = input.awards.find((a) => a.key === key)
    if (award?.rows.some((r) => r.rank === 1 && r.playerId === playerId)) {
      badges.push({ emoji: award.emoji, label: award.label })
    }
  }

  return badges
}

/**
 * A player's badges for a season. In the current season they stay hidden until it has
 * BADGE_HOLD_SESSIONS played sessions; a past season is always unlocked.
 */
export async function fetchSeasonBadges(playerId: string, scope: BoardScope): Promise<Badge[]> {
  if (scope.isCurrent) {
    const played = await fetchCompletedSessions(seasonWindow(scope.season))
    if (played.length < BADGE_HOLD_SESSIONS) return []
  }
  const [cheerRows, awards] = await Promise.all([fetchCheerLeaderboard(scope), fetchAwardsLeaderboard(scope)])
  return badgesFor(playerId, { cheerRows, awards, unlocked: true })
}
