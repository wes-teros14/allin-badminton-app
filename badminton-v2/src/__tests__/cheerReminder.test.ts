import { describe, it, expect } from 'vitest'
import { cheersReminderLabel, owedCheerCount } from '@/lib/cheerReminder'

const match = (gameNumber: number, given: string[] = []) => ({
  gameNumber,
  players: [{ playerId: 'a' }, { playerId: 'b' }, { playerId: 'c' }],
  cheersGivenTo: given,
})

describe('owedCheerCount', () => {
  it('counts the cheers still to give across matches', () => {
    expect(owedCheerCount([match(3), match(5, ['a'])])).toBe(5)
  })

  it('is zero with nothing pending', () => {
    expect(owedCheerCount([])).toBe(0)
  })
})

describe('cheersReminderLabel', () => {
  it('names the game when only one is waiting', () => {
    expect(cheersReminderLabel([match(3)])).toBe('Game 3 done · 3 cheers to give')
  })

  it('counts games once they stack', () => {
    expect(cheersReminderLabel([match(3), match(5)])).toBe('2 games done · 6 cheers to give')
  })

  it('uses the singular for the last cheer', () => {
    expect(cheersReminderLabel([match(3, ['a', 'b'])])).toBe('Game 3 done · 1 cheer to give')
  })

  it('is empty when nothing is owed', () => {
    expect(cheersReminderLabel([])).toBe('')
  })
})
