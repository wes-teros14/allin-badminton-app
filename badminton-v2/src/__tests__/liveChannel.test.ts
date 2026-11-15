import { describe, expect, it } from 'vitest'
import {
  createLiveRegistry, isAbout, sessionTopic, toConnectionStatus, userTopic,
  type LiveChannelLike, type LiveClientLike, type LiveMessage,
} from '@/lib/liveChannel'

/** A stand-in for the Supabase client: records channels and lets the test drive them. */
function fakeClient() {
  const channels: Array<{
    topic: string
    private: boolean
    emit: (payload: unknown) => void
    setStatus: (status: string) => void
    removed: boolean
  }> = []
  const client: LiveClientLike = {
    channel(topic, opts) {
      let onMessage: (msg: { payload: unknown }) => void = () => {}
      let onStatus: (status: string) => void = () => {}
      const record = {
        topic,
        private: opts.config.private,
        emit: (payload: unknown) => onMessage({ payload }),
        setStatus: (status: string) => onStatus(status),
        removed: false,
      }
      const ch: LiveChannelLike = {
        on(_type, _filter, cb) { onMessage = cb; return ch },
        subscribe(cb) { onStatus = cb; return ch },
      }
      ;(ch as unknown as { record: typeof record }).record = record
      channels.push(record)
      return ch
    },
    removeChannel(ch) {
      ;(ch as unknown as { record: { removed: boolean } }).record.removed = true
    },
  }
  return { client, channels }
}

const matchChange: LiveMessage = { table: 'matches', op: 'UPDATE', status: 'complete' }

describe('topics', () => {
  it('names session and user topics the way the 089 triggers send them', () => {
    expect(sessionTopic('abc')).toBe('session:abc')
    expect(userTopic('u1')).toBe('user:u1')
  })
})

describe('toConnectionStatus', () => {
  it('maps channel states to the app states', () => {
    expect(toConnectionStatus('SUBSCRIBED')).toBe('connected')
    expect(toConnectionStatus('CHANNEL_ERROR')).toBe('disconnected')
    expect(toConnectionStatus('TIMED_OUT')).toBe('disconnected')
    expect(toConnectionStatus('CLOSED')).toBe('disconnected')
    expect(toConnectionStatus('JOINING')).toBe('reconnecting')
  })
})

describe('isAbout', () => {
  it('matches only the listed tables', () => {
    expect(isAbout(matchChange, ['matches', 'sessions'])).toBe(true)
    expect(isAbout({ table: 'session_receipts', op: 'INSERT' }, ['matches'])).toBe(false)
  })

  it('ignores malformed messages', () => {
    expect(isAbout(null, ['matches'])).toBe(false)
    expect(isAbout({} as LiveMessage, ['matches'])).toBe(false)
  })
})

describe('createLiveRegistry', () => {
  it('opens one private channel per topic, shared by every listener', () => {
    const { client, channels } = fakeClient()
    const reg = createLiveRegistry(client)
    const a: LiveMessage[] = []
    const b: LiveMessage[] = []
    reg.listen('session:s1', (m) => a.push(m))
    reg.listen('session:s1', (m) => b.push(m))

    expect(channels).toHaveLength(1)
    expect(channels[0].private).toBe(true)
    channels[0].emit(matchChange)
    expect(a).toEqual([matchChange])
    expect(b).toEqual([matchChange])
  })

  it('closes the channel only when the last listener leaves', () => {
    const { client, channels } = fakeClient()
    const reg = createLiveRegistry(client)
    const stopA = reg.listen('session:s1', () => {})
    const stopB = reg.listen('session:s1', () => {})

    stopA()
    expect(channels[0].removed).toBe(false)
    stopB()
    expect(channels[0].removed).toBe(true)
    expect(reg.openTopics()).toEqual([])
  })

  it('a stop called twice does not close a channel another listener still uses', () => {
    const { client, channels } = fakeClient()
    const reg = createLiveRegistry(client)
    const stopA = reg.listen('session:s1', () => {})
    reg.listen('session:s1', () => {})
    stopA()
    stopA()
    expect(channels[0].removed).toBe(false)
  })

  it('reopens a fresh channel after the topic was closed', () => {
    const { client, channels } = fakeClient()
    const reg = createLiveRegistry(client)
    reg.listen('session:s1', () => {})()
    reg.listen('session:s1', () => {})
    expect(channels).toHaveLength(2)
    expect(channels[1].removed).toBe(false)
  })

  it('tells a late listener the current status at once, then every change', () => {
    const { client, channels } = fakeClient()
    const reg = createLiveRegistry(client)
    reg.listen('session:s1', () => {})
    channels[0].setStatus('SUBSCRIBED')

    const seen: string[] = []
    reg.listen('session:s1', () => {}, (s) => seen.push(s))
    channels[0].setStatus('CHANNEL_ERROR')
    expect(seen).toEqual(['connected', 'disconnected'])
  })

  it('keeps topics apart', () => {
    const { client, channels } = fakeClient()
    const reg = createLiveRegistry(client)
    const got: string[] = []
    reg.listen('session:s1', () => got.push('s1'))
    reg.listen('user:u1', () => got.push('u1'))
    channels[1].emit({ table: 'notifications', op: 'INSERT' })
    expect(got).toEqual(['u1'])
  })
})
