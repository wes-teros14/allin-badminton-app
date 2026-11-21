import { describe, expect, it } from 'vitest'
import { fitWithin, PHOTO_EDGE, THUMB_EDGE } from '@/lib/galleryImage'

describe('fitWithin', () => {
  it('shrinks the long edge to the limit, keeping the shape', () => {
    expect(fitWithin(4032, 3024, PHOTO_EDGE)).toEqual({ width: 1280, height: 960 })
    expect(fitWithin(3024, 4032, PHOTO_EDGE)).toEqual({ width: 960, height: 1280 })
    expect(fitWithin(4032, 3024, THUMB_EDGE)).toEqual({ width: 400, height: 300 })
  })

  it('never enlarges a small photo', () => {
    expect(fitWithin(800, 600, PHOTO_EDGE)).toEqual({ width: 800, height: 600 })
  })

  it('never returns a zero side for extreme panoramas', () => {
    expect(fitWithin(20000, 10, THUMB_EDGE)).toEqual({ width: 400, height: 1 })
  })
})
