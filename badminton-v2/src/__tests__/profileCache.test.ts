import { describe, expect, it } from 'vitest'
import {
  commitProfileFetch,
  createProfileCache,
  planProfileFetch,
  PROFILE_CACHE_TTL_MS,
  type CachedProfile,
} from '@/lib/profileCache'

function profile(id: string, nickname: string | null = null): CachedProfile {
  return { id, name_slug: `${id}-slug`, nickname, avatar_url: null }
}

describe('planProfileFetch', () => {
  it('fetches every id on a cold cache', () => {
    const cache = createProfileCache()

    expect(planProfileFetch(cache, ['a', 'b'], 1_000)).toEqual({
      ids: ['a', 'b'],
      isFullRefresh: true,
    })
  })

  it('de-duplicates ids — the same player appears in several matches', () => {
    const cache = createProfileCache()

    expect(planProfileFetch(cache, ['a', 'b', 'a', 'b', 'a'], 1_000).ids).toEqual(['a', 'b'])
  })

  it('skips the round trip entirely once everyone is cached and fresh', () => {
    const cache = createProfileCache()
    const plan = planProfileFetch(cache, ['a', 'b'], 1_000)
    commitProfileFetch(cache, [profile('a'), profile('b')], plan, 1_000)

    expect(planProfileFetch(cache, ['a', 'b'], 1_000 + PROFILE_CACHE_TTL_MS - 1)).toEqual({
      ids: [],
      isFullRefresh: false,
    })
  })

  it('fetches only the unseen id when a player is substituted in', () => {
    const cache = createProfileCache()
    const plan = planProfileFetch(cache, ['a', 'b'], 1_000)
    commitProfileFetch(cache, [profile('a'), profile('b')], plan, 1_000)

    // 'c' has just been swapped into a queued match.
    expect(planProfileFetch(cache, ['a', 'b', 'c'], 2_000)).toEqual({
      ids: ['c'],
      isFullRefresh: false,
    })
  })

  it('re-reads everyone once the TTL expires, so an edited nickname propagates', () => {
    const cache = createProfileCache()
    const plan = planProfileFetch(cache, ['a', 'b'], 1_000)
    commitProfileFetch(cache, [profile('a'), profile('b')], plan, 1_000)

    expect(planProfileFetch(cache, ['a', 'b'], 1_000 + PROFILE_CACHE_TTL_MS)).toEqual({
      ids: ['a', 'b'],
      isFullRefresh: true,
    })
  })

  it('asks for nothing when there are no players', () => {
    expect(planProfileFetch(createProfileCache(), [], 1_000)).toEqual({
      ids: [],
      isFullRefresh: false,
    })
  })
})

describe('commitProfileFetch', () => {
  it('stores rows so they can be read back by id', () => {
    const cache = createProfileCache()
    const plan = planProfileFetch(cache, ['a'], 1_000)
    commitProfileFetch(cache, [profile('a', 'Ana')], plan, 1_000)

    expect(cache.entries.get('a')?.nickname).toBe('Ana')
  })

  it('overwrites an existing row, so a re-read picks up an edit', () => {
    const cache = createProfileCache()
    const cold = planProfileFetch(cache, ['a'], 1_000)
    commitProfileFetch(cache, [profile('a', 'Ana')], cold, 1_000)

    const later = 1_000 + PROFILE_CACHE_TTL_MS
    const refresh = planProfileFetch(cache, ['a'], later)
    commitProfileFetch(cache, [profile('a', 'Ana C.')], refresh, later)

    expect(cache.entries.get('a')?.nickname).toBe('Ana C.')
  })

  it('does NOT restart the TTL on a partial top-up', () => {
    const cache = createProfileCache()
    const cold = planProfileFetch(cache, ['a'], 0)
    commitProfileFetch(cache, [profile('a')], cold, 0)

    // A substitution 59s in tops up one id. If that reset the clock, the next
    // full re-read would be pushed to 119s and an edit could hide indefinitely
    // behind a trickle of substitutions.
    const subAt = PROFILE_CACHE_TTL_MS - 1_000
    const topUp = planProfileFetch(cache, ['a', 'b'], subAt)
    commitProfileFetch(cache, [profile('b')], topUp, subAt)

    expect(planProfileFetch(cache, ['a', 'b'], PROFILE_CACHE_TTL_MS)).toEqual({
      ids: ['a', 'b'],
      isFullRefresh: true,
    })
  })

  it('restarts the TTL on a full refresh — which is why the caller must not commit a failed fetch', () => {
    const cache = createProfileCache()
    const plan = planProfileFetch(cache, ['a'], 5_000)
    commitProfileFetch(cache, [profile('a')], plan, 5_000)

    expect(cache.fetchedAt).toBe(5_000)
    expect(planProfileFetch(cache, ['a'], 5_000 + 1).ids).toEqual([])
  })
})
