import { describe, expect, it } from 'vitest'
import { bestPlacing, newPodiumPlacings, type RankSnapshot } from '@/lib/podiumCelebration'

describe('newPodiumPlacings', () => {
  it('celebrates a player who has just entered the top 3', () => {
    const placings = newPodiumPlacings({ wins: 5 }, { wins: 3 })
    expect(placings).toEqual([{ board: 'wins', rank: 3, previousRank: 5 }])
  })

  it('celebrates a player who was not placed at all before', () => {
    const placings = newPodiumPlacings({ wins: null }, { wins: 2 })
    expect(placings).toEqual([{ board: 'wins', rank: 2, previousRank: null }])
  })

  it('celebrates an improvement within the podium', () => {
    expect(newPodiumPlacings({ wins: 3 }, { wins: 1 })).toEqual([
      { board: 'wins', rank: 1, previousRank: 3 },
    ])
  })

  it('says nothing when the place is unchanged', () => {
    expect(newPodiumPlacings({ wins: 2 }, { wins: 2 })).toEqual([])
  })

  it('says nothing when the place got worse', () => {
    expect(newPodiumPlacings({ wins: 1 }, { wins: 3 })).toEqual([])
  })

  it('says nothing for a rank outside the podium', () => {
    expect(newPodiumPlacings({ wins: 9 }, { wins: 4 })).toEqual([])
  })

  it('says nothing when the player dropped off the board entirely', () => {
    expect(newPodiumPlacings({ wins: 2 }, { wins: null })).toEqual([])
  })

  // The three silences that stop this being obnoxious on the day it ships.
  it('is silent on the very first run, when there is no previous snapshot', () => {
    const current: RankSnapshot = { wins: 1, pairs: 2, 'cheers:good_sport': 1 }
    expect(newPodiumPlacings(null, current)).toEqual([])
  })

  it('is silent for a board the previous snapshot never watched', () => {
    // Adding a seventh cheer category must not congratulate everyone already in
    // its top 3.
    expect(newPodiumPlacings({ wins: 4 }, { wins: 4, 'cheers:new_category': 1 })).toEqual([])
  })

  it('distinguishes an unwatched board from an unplaced one', () => {
    const unwatched = newPodiumPlacings({ wins: 4 }, { wins: 4, pairs: 1 })
    const unplaced = newPodiumPlacings({ wins: 4, pairs: null }, { wins: 4, pairs: 1 })

    expect(unwatched).toEqual([])
    expect(unplaced).toEqual([{ board: 'pairs', rank: 1, previousRank: null }])
  })

  it('orders several new placings best-first, headline boards breaking a tie', () => {
    const placings = newPodiumPlacings(
      { wins: null, pairs: null, 'cheers:good_sport': null },
      { wins: 2, pairs: 1, 'cheers:good_sport': 1 },
    )

    expect(placings.map((p) => p.board)).toEqual(['pairs', 'cheers:good_sport', 'wins'])
  })
})

describe('bestPlacing', () => {
  it('picks the best of several so only one celebration plays', () => {
    const placings = newPodiumPlacings(
      { wins: null, pairs: null },
      { wins: 3, pairs: 1 },
    )
    expect(bestPlacing(placings)).toEqual({ board: 'pairs', rank: 1, previousRank: null })
  })

  it('returns null when nothing is new', () => {
    expect(bestPlacing([])).toBeNull()
  })
})
