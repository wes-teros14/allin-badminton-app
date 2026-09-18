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

  it('says nothing when the player dropped off the board entirely', () => {
    // Reported as nothing even now that drops exist: "down N places" needs a
    // place to have landed on, and they have none.
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

  it('announces a multi-place climb', () => {
    expect(newPodiumPlacings({ wins: 9 }, { wins: 6 }, { wins: 4 }).map(shape)).toEqual([
      'wins:climb:6',
    ])
  })

  // Personal best was removed: the app has no rank history, so it could not
  // honestly claim one. Improving on a previous best is now simply a climb.
  it('calls an all-time best a climb, because a best cannot be claimed', () => {
    expect(newPodiumPlacings({ wins: 9 }, { wins: 6 }, { wins: 9 }).map(shape)).toEqual([
      'wins:climb:6',
    ])
  })

  it('announces a climb of a single place', () => {
    // The threshold is 1 by product decision: any improvement is worth saying.
    expect(newPodiumPlacings({ wins: 7 }, { wins: 6 }, { wins: 4 }).map(shape)).toEqual([
      'wins:climb:6',
    ])
  })

  it('still uses bestEver to tell an arrival from a return', () => {
    // The personal-best trigger is gone, but bestEver is not: without it these
    // two cases are indistinguishable, and a returning player would be told they
    // had just made the board.
    const arrival = newPodiumPlacings({ wins: null }, { wins: 8 }, {})
    const ret = newPodiumPlacings({ wins: null }, { wins: 8 }, { wins: 6 })

    expect(arrival.map(shape)).toEqual(['wins:first-appearance:8'])
    expect(ret).toEqual([])
  })

  it('says nothing when a player holds their non-podium place', () => {
    expect(newPodiumPlacings({ wins: 6 }, { wins: 6 }, { wins: 6 })).toEqual([])
  })
})

// A reversal of the original "never report bad news" rule, made deliberately.
describe('newPodiumPlacings — drops', () => {
  it('reports a drop of a single place', () => {
    expect(newPodiumPlacings({ wins: 6 }, { wins: 7 }, { wins: 4 }).map(shape)).toEqual([
      'wins:drop:7',
    ])
  })

  it('reports a drop out of the podium', () => {
    expect(newPodiumPlacings({ wins: 2 }, { wins: 5 }, { wins: 2 }).map(shape)).toEqual([
      'wins:drop:5',
    ])
  })

  it('reports a drop that stays inside the podium', () => {
    // Still a medallist. The card keeps the bronze border; only the rule cares
    // that this was a drop.
    expect(newPodiumPlacings({ wins: 1 }, { wins: 3 }, { wins: 1 }).map(shape)).toEqual([
      'wins:drop:3',
    ])
  })

  it('puts a climb ahead of a drop when a session produces both', () => {
    const placings = newPodiumPlacings(
      { wins: 9, pairs: 4 },
      { wins: 6, pairs: 7 },
      { wins: 4, pairs: 4 },
    )
    expect(placings.map(shape)).toEqual(['wins:climb:6', 'pairs:drop:7'])
  })
})

describe('newPodiumPlacings — precedence', () => {
  it('reports a podium rather than the climb it also is', () => {
    expect(newPodiumPlacings({ wins: 9 }, { wins: 2 }, { wins: 9 }).map(shape)).toEqual([
      'wins:podium:2',
    ])
  })

  it('reports a first appearance rather than nothing', () => {
    expect(newPodiumPlacings({ wins: null }, { wins: 7 }, {}).map(shape)).toEqual([
      'wins:first-appearance:7',
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
      'cheers:good_sport:climb:5',
      'wins:climb:6',
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

describe('cardHeadline — movement wording', () => {
  it('uses the singular for a one-place gain', () => {
    expect(cardHeadline({ board: 'wins', kind: 'climb', rank: 6, previousRank: 7 }))
      .toBe('Up 1 place!')
  })

  it('uses the plural for a larger gain', () => {
    expect(cardHeadline({ board: 'wins', kind: 'climb', rank: 6, previousRank: 10 }))
      .toBe('Up 4 places!')
  })
})

describe('cardHeadline — drop wording', () => {
  it('uses the singular for a one-place drop', () => {
    expect(cardHeadline({ board: 'wins', kind: 'drop', rank: 7, previousRank: 6 }))
      .toBe('Down 1 place')
  })

  it('uses the plural for a larger drop', () => {
    expect(cardHeadline({ board: 'wins', kind: 'drop', rank: 9, previousRank: 6 }))
      .toBe('Down 3 places')
  })

  // The card, animation and confetti are shared with a celebration by decision.
  // The punctuation is the one place that does not follow.
  it('does not punctuate a loss like good news', () => {
    expect(cardHeadline({ board: 'wins', kind: 'drop', rank: 9, previousRank: 6 })).not.toContain('!')
    expect(cardHeadline({ board: 'wins', kind: 'climb', rank: 6, previousRank: 9 })).toContain('!')
  })
})
