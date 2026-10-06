import { describe, it, expect } from 'vitest'
import { currentWinRuns, rankWinStreaks, type WinStreakMatch } from '@/lib/winStreak'
import type { MatchOutcome } from '@/lib/matchResults'

let clock = 0
/** A and B against C and D, unless other players are given. */
function match(outcome: MatchOutcome | null, players: [string, string, string, string] = ['A', 'B', 'C', 'D']): WinStreakMatch {
  clock += 1
  return {
    matchId: `m${clock}`,
    endedAt: new Date(Date.UTC(2026, 0, 1, 0, clock)).toISOString(),
    team1: [players[0], players[1]],
    team2: [players[2], players[3]],
    outcome,
  }
}

describe('currentWinRuns', () => {
  it('counts the run back from the newest match', () => {
    const runs = currentWinRuns([match('team2'), match('team1'), match('team1'), match('team1')])
    expect(runs.get('A')).toBe(3)
    expect(runs.get('C')).toBe(0)
  })

  it('ends a run on a draw as well as a loss', () => {
    const runs = currentWinRuns([match('team1'), match('team1'), match('draw'), match('team1')])
    expect(runs.get('A')).toBe(1)
  })

  it('skips an abandoned match instead of ending the run', () => {
    const runs = currentWinRuns([match('team1'), match(null), match('team1')])
    expect(runs.get('A')).toBe(2)
  })

  it('replays matches in the order they ended, not the order given', () => {
    const early = match('team2')
    const late = match('team1')
    expect(currentWinRuns([late, early]).get('A')).toBe(1)
  })

  it('follows each player through different partners', () => {
    const runs = currentWinRuns([
      match('team1', ['A', 'B', 'C', 'D']),
      match('team2', ['C', 'D', 'A', 'E']),
      match('team1', ['A', 'C', 'B', 'D']),
    ])
    expect(runs.get('A')).toBe(3)
    expect(runs.get('B')).toBe(0)
  })
})

describe('rankWinStreaks', () => {
  const runOf = (player: string, wins: number) =>
    Array.from({ length: wins }, () => match('team1', [player, `${player}-p`, 'X', 'Y']))

  it('places the longest current runs, dense, and hides runs under the minimum', () => {
    const ranked = rankWinStreaks([...runOf('A', 5), ...runOf('B', 4), ...runOf('C', 4), ...runOf('D', 2)], {
      eligible: new Set(['A', 'B', 'C', 'D']),
    })
    expect(ranked).toEqual([
      { playerId: 'A', run: 5, place: 1 },
      { playerId: 'B', run: 4, place: 2 },
      { playerId: 'C', run: 4, place: 2 },
    ])
  })

  it('leaves out players who are not eligible', () => {
    const ranked = rankWinStreaks([...runOf('A', 6), ...runOf('B', 3)], { eligible: new Set(['B']) })
    expect(ranked).toEqual([{ playerId: 'B', run: 3, place: 1 }])
  })

  it('cuts by places, not rows', () => {
    const ranked = rankWinStreaks(
      [...runOf('A', 9), ...runOf('B', 8), ...runOf('C', 7), ...runOf('D', 7), ...runOf('E', 6)],
      { eligible: new Set(['A', 'B', 'C', 'D', 'E']) },
    )
    expect(ranked.map((e) => e.playerId)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('is empty when nobody is on a run of 3', () => {
    expect(rankWinStreaks(runOf('A', 2))).toEqual([])
  })
})
