import { describe, it, expect } from 'vitest'
import { shareInFlight } from '@/lib/inflight'

describe('shareInFlight', () => {
  it('shares one read between concurrent calls on the same key', async () => {
    let reads = 0
    const read = () => { reads++; return Promise.resolve(reads) }
    const [a, b] = await Promise.all([shareInFlight('k-share', read), shareInFlight('k-share', read)])
    expect(reads).toBe(1)
    expect(a).toBe(1)
    expect(b).toBe(1)
  })

  it('does not cache: a call after the read settled reads again', async () => {
    let reads = 0
    const read = () => Promise.resolve(++reads)
    await shareInFlight('k-fresh', read)
    expect(await shareInFlight('k-fresh', read)).toBe(2)
  })

  it('retries after a rejected read', async () => {
    let reads = 0
    const read = () => (++reads === 1 ? Promise.reject(new Error('boom')) : Promise.resolve('ok'))
    await expect(shareInFlight('k-fail', read)).rejects.toThrow('boom')
    await expect(shareInFlight('k-fail', read)).resolves.toBe('ok')
    expect(reads).toBe(2)
  })

  it('does not share between different keys', async () => {
    let reads = 0
    const read = () => Promise.resolve(++reads)
    await Promise.all([shareInFlight('k-a', read), shareInFlight('k-b', read)])
    expect(reads).toBe(2)
  })
})
