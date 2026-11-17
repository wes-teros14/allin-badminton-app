import { describe, expect, it, vi } from 'vitest'
import { neonDataBaseUrl, routeDataCalls } from '@/lib/dataRouter'

function fakes() {
  const authClient = {
    auth: { getSession: vi.fn() },
    storage: { from: vi.fn(() => 'auth-storage') },
    channel: vi.fn(() => 'auth-channel'),
    from: vi.fn(() => 'auth-from'),
    rpc: vi.fn(() => 'auth-rpc'),
    schema: vi.fn(() => 'auth-schema'),
  }
  const dataClient = {
    from: vi.fn(function (this: unknown) { return this === dataClient ? 'data-from' : 'WRONG-THIS' }),
    rpc: vi.fn(function (this: unknown) { return this === dataClient ? 'data-rpc' : 'WRONG-THIS' }),
    schema: vi.fn(function (this: unknown) { return this === dataClient ? 'data-schema' : 'WRONG-THIS' }),
  }
  return { authClient, dataClient }
}

describe('routeDataCalls', () => {
  it('sends from(), rpc() and schema() to the data client, bound to it', () => {
    const { authClient, dataClient } = fakes()
    const client = routeDataCalls(authClient, dataClient)
    expect(client.from('profiles' as never)).toBe('data-from')
    expect(client.rpc('unfinish_match' as never)).toBe('data-rpc')
    expect(client.schema('public' as never)).toBe('data-schema')
    expect(authClient.from).not.toHaveBeenCalled()
    expect(authClient.rpc).not.toHaveBeenCalled()
  })

  it('keeps auth, storage and channel on the Supabase client', () => {
    const { authClient, dataClient } = fakes()
    const client = routeDataCalls(authClient, dataClient)
    expect(client.auth).toBe(authClient.auth)
    expect(client.storage.from('avatars' as never)).toBe('auth-storage')
    expect(client.channel('x' as never)).toBe('auth-channel')
  })

  it('a later patch of client.from (the page-only test trick) still wins', () => {
    const { authClient, dataClient } = fakes()
    const client = routeDataCalls(authClient, dataClient) as { from: unknown }
    const patched = vi.fn(() => 'patched')
    client.from = patched
    expect((client.from as () => string)()).toBe('patched')
  })
})

describe('neonDataBaseUrl', () => {
  it.each([
    ['https://ep-x.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb/rest/v1', 'https://ep-x.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb'],
    ['https://ep-x.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb/rest/v1/', 'https://ep-x.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb'],
    ['https://ep-x.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb', 'https://ep-x.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb'],
    ['https://ep-x.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb/', 'https://ep-x.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb'],
  ])('%s → base for supabase-js (which appends /rest/v1)', (input, expected) => {
    expect(neonDataBaseUrl(input)).toBe(expected)
  })
})
