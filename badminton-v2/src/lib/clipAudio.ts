/**
 * Turns a recording or an uploaded audio file into a short, level WAV clip for
 * the court announcer.
 *
 * WAV because every phone plays it: an iPhone recording (MP4/AAC) and an
 * Android one (WebM/Opus) come out as the same format, so the tablet never
 * meets a clip it cannot decode. At 22.05 kHz mono a one-second name is ~44 KB.
 *
 * The three sample functions are pure (tested in node); `processClip` needs a
 * browser for decoding and resampling.
 */

export const CLIP_SAMPLE_RATE = 22_050
export const MAX_INPUT_BYTES = 5 * 1024 * 1024
export const MIN_CLIP_SECONDS = 0.2
export const MAX_CLIP_SECONDS = 4

/** Below this absolute amplitude a sample counts as silence. */
const SILENCE_THRESHOLD = 0.02
/** Kept either side of the speech so the first consonant is not clipped. */
const PADDING_SECONDS = 0.08

/** Drops leading and trailing silence, keeping a little padding. */
export function trimSilence(samples: Float32Array, sampleRate: number, paddingSeconds = PADDING_SECONDS): Float32Array {
  let first = -1
  let last = -1
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= SILENCE_THRESHOLD) {
      if (first === -1) first = i
      last = i
    }
  }
  if (first === -1) return new Float32Array(0)
  const pad = Math.round(paddingSeconds * sampleRate)
  return samples.slice(Math.max(0, first - pad), Math.min(samples.length, last + pad + 1))
}

/** Scales so the loudest sample reaches `target`, so quiet and loud recordings match. */
export function normalisePeak(samples: Float32Array, target = 0.9): Float32Array {
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  if (peak === 0) return samples.slice()
  const gain = target / peak
  return samples.map((s) => s * gain)
}

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  text(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return bytes
}

/** A message that is safe to show the admin as is. */
export class ClipError extends Error {}

function extensionOf(name: string | undefined): string {
  const match = name?.match(/\.([a-z0-9]+)$/i)
  return match ? `.${match[1].toLowerCase()}` : 'audio'
}

/**
 * Decodes, mixes to mono, resamples, trims and levels a recording or upload.
 * Throws `ClipError` with a readable message when the file cannot be used.
 */
export async function processClip(input: Blob, fileName?: string): Promise<Blob> {
  if (input.size > MAX_INPUT_BYTES) throw new ClipError('That file is over 5 MB. A name needs only a few seconds.')

  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await input.arrayBuffer())
  } catch {
    throw new ClipError(`Can’t read that ${extensionOf(fileName)} file — it may be damaged, or a type this phone can’t play. Try MP3, M4A or WAV.`)
  } finally {
    void ctx.close()
  }

  const frames = Math.max(1, Math.ceil(decoded.duration * CLIP_SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, frames, CLIP_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded // a mono destination downmixes every channel
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()

  const trimmed = trimSilence(rendered.getChannelData(0), CLIP_SAMPLE_RATE)
  const seconds = trimmed.length / CLIP_SAMPLE_RATE
  if (seconds < MIN_CLIP_SECONDS) throw new ClipError('Too quiet — nothing was heard. Try again closer to the mic.')
  if (seconds > MAX_CLIP_SECONDS) throw new ClipError(`That clip is ${seconds.toFixed(1)} s long. Keep it to the name only (under ${MAX_CLIP_SECONDS} s).`)

  return new Blob([encodeWav(normalisePeak(trimmed), CLIP_SAMPLE_RATE)], { type: 'audio/wav' })
}
