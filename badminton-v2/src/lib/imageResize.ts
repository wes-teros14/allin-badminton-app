/**
 * Client-side image downscale + JPEG compression.
 *
 * Moved verbatim out of ProfileView.tsx, where it was the avatar
 * upload's private helper, so the receipt upload can reuse it instead
 * of carrying a second copy. The byte-quality ladder is already proven
 * on this app's target devices -- do not "improve" it casually.
 *
 * createImageBitmap honours EXIF orientation in the browsers this app
 * targets, so rotated phone photos come out upright without extra work.
 */
export async function resizeImageFile(file: File, maxDim: number, maxBytes: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser cannot process images')
  ctx.drawImage(bitmap, 0, 0, width, height)

  let quality = 0.92
  let blob: Blob | null = null
  for (let attempt = 0; attempt < 6; attempt++) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('Failed to process image')
    if (blob.size <= maxBytes) break
    quality -= 0.15
  }
  if (!blob) throw new Error('Failed to process image')
  return blob
}
