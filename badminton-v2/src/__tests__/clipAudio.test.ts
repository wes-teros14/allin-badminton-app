import { describe, expect, it } from 'vitest'
import { encodeWav, normalisePeak, trimSilence } from '@/lib/clipAudio'

const RATE = 1000 // small rate keeps the arrays readable: padding is 80 samples

describe('trimSilence', () => {
  it('drops leading and trailing silence but keeps the padding', () => {
    const samples = new Float32Array(1000)
    samples.fill(0.5, 400, 500)
    const trimmed = trimSilence(samples, RATE)
    expect(trimmed.length).toBe(100 + 80 + 80)
    expect(trimmed[80]).toBe(0.5)
  })

  it('never pads past either end', () => {
    const samples = new Float32Array(100).fill(0.5)
    expect(trimSilence(samples, RATE).length).toBe(100)
  })

  it('returns nothing for pure silence', () => {
    expect(trimSilence(new Float32Array(500), RATE).length).toBe(0)
  })
})

describe('normalisePeak', () => {
  it('scales the loudest sample to the target', () => {
    const out = normalisePeak(new Float32Array([0.1, -0.3, 0.2]))
    expect(Math.max(...out.map(Math.abs))).toBeCloseTo(0.9)
    expect(out[1]).toBeCloseTo(-0.9)
  })

  it('leaves silence alone', () => {
    expect([...normalisePeak(new Float32Array(3))]).toEqual([0, 0, 0])
  })
})

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM header and two bytes per sample', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1]), 22050)
    const view = new DataView(wav.buffer)
    const text = (o: number) => String.fromCharCode(...wav.slice(o, o + 4))
    expect(wav.length).toBe(44 + 6)
    expect([text(0), text(8), text(12), text(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data'])
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(22050)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(6)
    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([0, 32767, -32768])
  })
})
