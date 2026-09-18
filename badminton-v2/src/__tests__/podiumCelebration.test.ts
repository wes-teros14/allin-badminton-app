import { describe, expect, it } from 'vitest'
import {
  bestPlacing,
  newPodiumPlacings,
  type BestEver,
  type RankSnapshot,
} from '@/lib/podiumCelebration'
import { cardHeadline } from '@/lib/celebrationLabels'

/** Terser assertions: the board, the kind and the rank are what matter. */
const shape = (p: { board: string; kind: string; rank: number }) => `${p.board}:${p.kind}:${p.rank}`

describe('newPodiumPlacings — podium', () => {
  it('celebrates a player who has just entered the top 3', () => {
    expect(newPodiumPlacings({ wins: 5 }, { wins: 3 }, { wins: 5 })).toEqual([
      { board: 'wins', kind: 'podium', rank: 3, previousRank: 5 },
    ])
  })

  it('celebrates a player who was not placed at all before', () => {
    expect(newPodiumPlacings({ wins: null }, { wins: 2 })).toEqual([
      { board: 'wins', kind: 'podium', rank: 2, previousRank: null },
    ])
  })

  it('celebrates an improvement within the podium', () => {
    expect(newPodiumPlacings({ wins: 3 }, { wins: 1 }, { wins: 3 })).toEqual([
      { board: 'wins', kind: 'podium', rank: 1, previousRank: 3 },
    ])
  })

  it('says nothing when the place is unchanged', () => {
    expect(newPodiumPlacings({ wins: 2 }, { wins: 2 }, { wins: 2 })).toEqual([])
  })

  it('says nothing when the place got worse', () => {
    expect(newPodiumPlacings({ wins: 1 }, { wins: 3 }, { wins: 1 })).toEqual([])
  })

  it('says nothing when the player dropped off the board entirely', () => {
    expect(newPodiumPlacings({ wins: 2 }, { wins: null }, { wins: 2 })).toEqual([])
  })
})

// The three silences. Without these the feature congratulates the whole roster
// the day it ships.
describe('newPodiumPlacings — the silences', () => {
  it('is silent on the very first run, when there is no previous snapshot', () => {
    const current: RankSnapshot = { wins: 1, pairs: 2, 'cheers:good_sport': 1 }
    expect(newPodiumPlacings(null, current)).toEqual([])
  })

  it('is silent for a board the previous snapshot never watched', () => {
    expect(newPodiumPlacings({ wins: 4 }, { wins: 4, 'cheers:good_sport': 1 })).toEqual([])
  })

  it('distinguishes an unwatched board from an unplaced one', () => {
    const unwatched = newPodiumPlacings({ wins: 4 }, { wins: 4, pairs: 1 })
    const unplaced = newPodiumPlacings({ wins: 4, pairs: null }, { wins: 4, pairs: 1 })

    expect(unwatched).toEqual([])
    expect(unplaced.map(shape)).toEqual(['pairs:podium:1'])
  })
})

describe('newPodiumPlacings — non-podium achievements', () => {
  it('announces a first appearance on a board', () => {
    // Never placed, never had a best: this is genuinely their first time.
    expect(newPodiumPlacings({ wins: null }, { wins: 8 }, {}).map(shape)).toEqual([
      'wins:first-appearance:8',
    ])
  })

  it('does not call a return to the board a first appearance', () => {
    // They held 7th once, fell off, and are back. The board is not new to them.
    const back = newPodiumPlacings({ wins: null }, { wins: 9 }, { wins: 7 })
    expect(back).toEqual([])
  })

  it('announces a personal best outside the podium', () => {
    expect(newPodiumPlacings({ wins: 9 }, { wins: 6 }, { wins: 9 }).map(shape)).toEqual([
      'wins:personal-best:6',
    ])
  })

  it('announces a multi-place climb', () => {
    // Worse than their best ever, so not a personal best — but still a real gain.
    expect(newPodiumPlacings({ wins: 9 }, { wins: 6 }, { wins: 4 }).map(shape)).toEqual([
      'wins:climb:6',
    ])
  })

  it('announces a climb of a single place', () => {
    // The threshold is 1 by product decision: any improvement is worth saying.
    expect(newPodiumPlacings({ wins: 7 }, { wins: 6 }, { wins: 4 }).map(shape)).toEqual([
      'wins:climb:6',
    ])
  })

  it('says nothing when a player holds their non-podium place', () => {
    expect(newPodiumPlacings({ wins: 6 }, { wins: 6 }, { wins: 6 })).toEqual([])
  })
})

describe('newPodiumPlacings — precedence', () => {
  it('reports a podium rather than the personal best it also is', () => {
    expect(newPodiumPlacings({ wins: 9 }, { wins: 2 }, { wins: 9 }).map(shape)).toEqual([
      'wins:podium:2',
    ])
  })

  it('reports a first appearance rather than the personal best it also is', () => {
    expect(newPodiumPlacings({ wins: null }, { wins: 7 }, {}).map(shape)).toEqual([
      'wins:first-appearance:7',
    ])
  })

  it('reports a personal best rather than the climb it also is', () => {
    // 10 -> 5 is both a five-place climb and their best ever. The stronger wins.
    expect(newPodiumPlacings({ wins: 10 }, { wins: 5 }, { wins: 8 }).map(shape)).toEqual([
      'wins:personal-best:5',
    ])
  })

  it('orders a mixed set by kind first, then rank, then board', () => {
    const previous: RankSnapshot = { wins: 9, pairs: null, 'cheers:good_sport': 8 }
    const current: RankSnapshot = { wins: 6, pairs: 2, 'cheers:good_sport': 5 }
    const best: BestEver = { wins: 9, 'cheers:good_sport': 8 }

    // Kind leads, so the podium is first. Then rank: 5th beats 6th, which puts
    // the cheer category ahead of the headline board — board order only breaks a
    // tie that rank has not already settled.
    expect(newPodiumPlacings(previous, current, best).map(shape)).toEqual([
      'pairs:podium:2',
      'cheers:good_sport:personal-best:5',
      'wins:personal-best:6',
    ])
  })

  it('puts the headline boards ahead of cheer categories at an equal placing', () => {
    const placings = newPodiumPlacings(
      { wins: null, pairs: null, 'cheers:good_sport': null },
      { wins: 1, pairs: 1, 'cheers:good_sport': 1 },
    )
    expect(placings.map((p) => p.board)).toEqual(['wins', 'pairs', 'cheers:good_sport'])
  })
})

describe('bestPlacing', () => {
  it('picks the best of several so only one celebration plays', () => {
    const placings = newPodiumPlacings({ wins: null, pairs: null }, { wins: 3, pairs: 1 })
    expect(bestPlacing(placings)).toEqual({
      board: 'pairs', kind: 'podium', rank: 1, previousRank: null,
    })
  })

  it('returns null when nothing is new', () => {
    expect(bestPlacing([])).toBeNull()
  })
})

describe('cardHeadline — climb wording', () => {
  it('uses the singular for a one-place gain', () => {
    expect(cardHeadline({ board: 'wins', kind: 'climb', rank: 6, previousRank: 7 }))
      .toBe('Up 1 place!')
  })

  it('uses the plural for a larger gain', () => {
    expect(cardHeadline({ board: 'wins', kind: 'climb', rank: 6, previousRank: 10 }))
      .toBe('Up 4 places!')
  })
})
