import { describe, it, expect } from 'vitest'
import { awardBoardKey, newPodiumPlacings, WATCHED_BOARDS } from '@/lib/podiumCelebration'
import { boardHref, boardTab, boardTitle, cardHeadline, cardLabel } from '@/lib/celebrationLabels'
import { AWARD_BOARDS } from '@/lib/awardBoards'

const slayer = awardBoardKey('giant-slayer')

describe('award boards in the celebration', () => {
  it('watches all five awards', () => {
    for (const a of AWARD_BOARDS) expect(WATCHED_BOARDS).toContain(awardBoardKey(a.key))
  })

  it('stays silent the first time an award board appears in the snapshot', () => {
    // Saved before awards were watched: the board is absent, so a current 1st is not news.
    expect(newPodiumPlacings({ wins: 4 }, { wins: 4, [slayer]: 1 })).toEqual([])
  })

  it('celebrates a climb onto the award podium', () => {
    const [p] = newPodiumPlacings({ [slayer]: 4 }, { [slayer]: 2 })
    expect(p).toMatchObject({ board: slayer, kind: 'podium', rank: 2, previousRank: 4 })
    expect(cardHeadline(p)).toBe('2nd place!')
  })

  it('reports a drop on an award like on any other board', () => {
    const [p] = newPodiumPlacings({ [slayer]: 2 }, { [slayer]: 4 })
    expect(p).toMatchObject({ kind: 'drop', rank: 4, previousRank: 2 })
    expect(cardLabel(p).detail).toBe('Now 4th on Giant Slayer')
  })

  it('says nothing when a player falls off an award board entirely', () => {
    expect(newPodiumPlacings({ [awardBoardKey('win-streak')]: 3 }, { [awardBoardKey('win-streak')]: null })).toEqual([])
  })
})

describe('award labels', () => {
  it('names the award and links straight to it', () => {
    expect(boardTitle(slayer)).toBe('Giant Slayer')
    expect(boardTab(slayer)).toBe('awards')
    expect(boardHref(slayer)).toBe('/leaderboard?tab=awards&award=giant-slayer')
    expect(boardHref('wins')).toBe('/leaderboard?tab=wins')
  })

  it('describes what a podium award measures', () => {
    const [p] = newPodiumPlacings({ [awardBoardKey('joined')]: null }, { [awardBoardKey('joined')]: 1 })
    expect(cardLabel(p)).toEqual({ title: 'Most Sessions Joined', detail: 'Most Sessions Joined · sessions joined' })
  })
})
