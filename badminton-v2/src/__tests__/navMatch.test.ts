import { describe, expect, it } from 'vitest'
import { isUnder } from '@/lib/navMatch'

/**
 * The nav bar decides which tab is underlined by matching the current path
 * against each tab's base. `/session/:id` (admin session manager) and
 * `/sessions` (player list) differ by one character, so the matcher has to
 * compare whole segments — a raw `startsWith` lit Admin on the player's own
 * Sessions page.
 */
describe('isUnder', () => {
  it('matches the base itself and anything beneath it', () => {
    expect(isUnder('/sessions', '/sessions')).toBe(true)
    expect(isUnder('/sessions/abc-123', '/sessions')).toBe(true)
    expect(isUnder('/finance/abc-123', '/finance')).toBe(true)
  })

  it('does not treat a longer sibling segment as a child', () => {
    // The regression: '/sessions'.startsWith('/session') is true.
    expect(isUnder('/sessions', '/session')).toBe(false)
    expect(isUnder('/sessions/abc-123', '/session')).toBe(false)
  })

  it('still matches the admin session manager', () => {
    expect(isUnder('/session/abc-123', '/session')).toBe(true)
  })

  it('does not match an unrelated path', () => {
    expect(isUnder('/leaderboard', '/sessions')).toBe(false)
    expect(isUnder('/', '/sessions')).toBe(false)
  })
})

/** The tab set as the nav bar computes it, so the assertions read like the UI. */
function activeTabs(pathname: string): string[] {
  const tabs: Array<[string, boolean]> = [
    ['Sessions', isUnder(pathname, '/sessions')],
    ['Leaderboard', isUnder(pathname, '/leaderboard')],
    ['My Profile', isUnder(pathname, '/profile')],
    ['Admin', isUnder(pathname, '/admin') || isUnder(pathname, '/session')],
    ['Players', isUnder(pathname, '/players')],
    ['Inventory', isUnder(pathname, '/inventory')],
    ['Finance', isUnder(pathname, '/finance')],
    ['Payment Settings', isUnder(pathname, '/payment-settings')],
  ]
  return tabs.filter(([, active]) => active).map(([label]) => label)
}

describe('nav bar highlighting', () => {
  it('underlines exactly one tab on every route', () => {
    expect(activeTabs('/sessions')).toEqual(['Sessions'])
    expect(activeTabs('/sessions/abc-123')).toEqual(['Sessions'])
    expect(activeTabs('/session/abc-123')).toEqual(['Admin'])
    expect(activeTabs('/admin')).toEqual(['Admin'])
    expect(activeTabs('/leaderboard')).toEqual(['Leaderboard'])
    expect(activeTabs('/profile')).toEqual(['My Profile'])
    expect(activeTabs('/players')).toEqual(['Players'])
    expect(activeTabs('/inventory')).toEqual(['Inventory'])
    expect(activeTabs('/finance')).toEqual(['Finance'])
    expect(activeTabs('/finance/abc-123')).toEqual(['Finance'])
    expect(activeTabs('/payment-settings')).toEqual(['Payment Settings'])
  })

  it('underlines nothing on routes with no tab of their own', () => {
    expect(activeTabs('/')).toEqual([])
    expect(activeTabs('/today')).toEqual([])
    expect(activeTabs('/match-schedule/session/abc-123')).toEqual([])
  })
})
