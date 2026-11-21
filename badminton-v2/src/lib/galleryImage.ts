/**
 * Shrinks a Gallery photo on the phone, before upload (owner decision 2026-11-20: 1280 px long
 * edge, about 150 KB; originals are not kept).
 *
 * WebP where the browser can encode it, else JPEG: a browser that can't encode WebP silently
 * hands back a PNG from toBlob, so the type is checked, not assumed. createImageBitmap honours
 * EXIF orientation, so rotated phone photos come out upright (same as imageResize.ts).
 */
export const PHOTO_EDGE = 1280
export const THUMB_EDGE = 400 // a third of a 390 px phone at 3x density
const PHOTO_MAX_BYTES = 260_000
const THUMB_MAX_BYTES = 45_000

export type GalleryImage = {
  photo: Blob
  thumb: Blob
  type: 'image/webp' | 'image/jpeg'
  width: number
  height: number
}

/** Size that fits `edge` on the long side, never upscaled. */
export function fitWithin(width: number, height: number, edge: number): { width: number; height: number } {
  const scale = Math.min(1, edge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function encode(bitmap: ImageBitmap, edge: number, maxBytes: number, preferWebp: boolean) {
  const size = fitWithin(bitmap.width, bitmap.height, edge)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser cannot process images')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, size.width, size.height)

  let type: GalleryImage['type'] = preferWebp ? 'image/webp' : 'image/jpeg'
  let blob: Blob | null = null
  for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5]) {
    blob = await toBlob(canvas, type, quality)
    if (!blob) throw new Error('Could not process this photo')
    if (blob.type !== type) {
      // No WebP encoder here: start over in JPEG.
      type = 'image/jpeg'
      blob = await toBlob(canvas, type, quality)
      if (!blob) throw new Error('Could not process this photo')
    }
    if (blob.size <= maxBytes) break
  }
  return { blob: blob as Blob, type, ...size }
}

export async function prepareGalleryImage(file: File): Promise<GalleryImage> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo')
  const bitmap = await createImageBitmap(file)
  try {
    const photo = await encode(bitmap, PHOTO_EDGE, PHOTO_MAX_BYTES, true)
    // The thumbnail uses the photo's format so both files share one content type.
    const thumb = await encode(bitmap, THUMB_EDGE, THUMB_MAX_BYTES, photo.type === 'image/webp')
    return { photo: photo.blob, thumb: thumb.blob, type: photo.type, width: photo.width, height: photo.height }
  } finally {
    bitmap.close()
  }
}
