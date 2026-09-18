/**
 * Hosts the celebration for the whole player app: the card, then the offer.
 *
 * Mounted once from PlayerLayout so a celebration can appear over any screen the
 * player happens to be on. It never navigates by itself — the toast offers the
 * trip and the player decides. Overriding a tap someone just made, or a refresh,
 * is the one thing this feature must not do.
 */

import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { CelebrationCard } from '@/components/CelebrationCard'
import { useLeaderboardCelebration } from '@/hooks/useLeaderboardCelebration'
import { boardTab, cardLabel, toastLine } from '@/lib/celebrationLabels'
import type { NewPlacing } from '@/lib/podiumCelebration'

export function LeaderboardCelebration() {
  const { announcement, dismiss } = useLeaderboardCelebration()
  const navigate = useNavigate()
  const [shown, setShown] = useState<NewPlacing[] | null>(null)

  const offerTheBoard = useCallback((achievements: NewPlacing[]) => {
    const best = achievements[0]
    if (!best) return

    toast(toastLine(best, achievements.length - 1), {
      description: achievements.length > 1 ? 'Tap to see your best one' : 'Tap to see the board',
      duration: 8000,
      action: {
        label: 'View',
        // The sweep was already armed when the card appeared, so arriving here
        // and arriving later under their own steam land in the same state.
        onClick: () => navigate(`/leaderboard?tab=${boardTab(best.board)}`),
      },
    })
  }, [navigate])

  const handleCardDone = useCallback(() => {
    const achievements = shown
    setShown(null)
    dismiss()
    if (achievements) offerTheBoard(achievements)
  }, [shown, dismiss, offerTheBoard])

  // Latch the announcement so the card keeps rendering its own content while it
  // plays out, even once the hook has moved on.
  if (announcement && !shown) setShown(announcement.achievements)

  if (!shown) return null

  return (
    <CelebrationCard
      achievements={shown}
      boardLabel={cardLabel}
      onDone={handleCardDone}
    />
  )
}

export default LeaderboardCelebration
