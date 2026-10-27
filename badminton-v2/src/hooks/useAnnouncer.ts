import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildCall, phraseText, detectNewGames, snapshot, type NewGame, type SeenGames } from '@/lib/announcer'
import { clipUrl, fetchAnnouncerClips } from '@/hooks/useAnnouncerClips'
import { trimSilence } from '@/lib/clipAudio'
import type { CourtSlot } from '@/lib/courts'
import type { CourtMatchDisplay } from '@/hooks/useCourtState'

/**
 * The live board's court announcer (migration 088). When a game starts on a
 * court, plays "Court 2 … AJ … and … Jaz … versus … Sim … and … Kurt" from
 * prerecorded clips.
 *
 * Clips are downloaded when the announcer is switched on and kept in the Cache
 * API, so the call plays from the tablet even when the venue wifi drops. A
 * re-recorded clip has a new `updated_at`, hence a new URL, hence a fresh
 * download on the next switch-on.
 *
 * Browsers only play sound after a tap, so switching on is always a tap. The
 * on/off choice is remembered per tablet; after a reload the board asks for one
 * tap to turn sound back on.
 */

export type AnnouncerStatus = 'off' | 'locked' | 'loading' | 'ready' | 'error'

const STORAGE_KEY = 'announcer:on'
const CACHE_NAME = 'announcer-clips'
/**
 * Pause between the words of one call. Kept short, and each clip is re-trimmed
 * tighter on load (`PLAYBACK_PADDING_SECONDS`), because the saved clips carry
 * 80 ms of padding at each end: with a 120 ms gap on top, every word boundary
 * was ~0.3 s and the call dragged (owner, 2026-10-26).
 */
const GAP_SECONDS = 0.04
const PLAYBACK_PADDING_SECONDS = 0.02
/** Each call is said this many times, with a pause in between, so a missed hearing is caught. */
const CALL_REPEATS = 3
const REPEAT_GAP_SECONDS = 0.7
/** Pause after a call before the next court's call. */
const CALL_GAP_SECONDS = 0.8
/** No pause before the court number, the game number, "and" and name2 (buildCall positions 1, 3, 5, 6), so "Court 1", "Game 5" and "name1 and name2" run together. */
const TIGHT_GAP_SECONDS = 0
/** Where the computer voice takes a breath: before team 1's first name and before "versus" (buildCall positions 4, 7). */
const COMMA_BEFORE_INDEXES = new Set([4, 7])
const TIGHT_BEFORE_INDEXES = new Set([1, 3, 5, 6])

function readRemembered(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}
function remember(on: boolean) {
  try { if (on) localStorage.setItem(STORAGE_KEY, '1'); else localStorage.removeItem(STORAGE_KEY) } catch { /* private mode */ }
}

async function fetchClipBytes(url: string): Promise<ArrayBuffer> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const hit = await cache.match(url)
    if (hit) return await hit.arrayBuffer()
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await cache.put(url, res.clone())
    return await res.arrayBuffer()
  } catch (e) {
    // No Cache API (e.g. an http origin): fetch straight through.
    if (typeof caches === 'undefined') {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.arrayBuffer()
    }
    throw e
  }
}

/** Drops cached clips that are no longer current (re-recorded or deleted). */
async function pruneCache(keep: Set<string>) {
  try {
    const cache = await caches.open(CACHE_NAME)
    for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req)
  } catch { /* best effort */ }
}

/**
 * Computer voice for a missing clip. Capped in time: some browsers never fire
 * `end` (no voices installed), and a promise that never settles would stall the
 * queue and silence every later call.
 */
function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') { resolve(); return }
    const cap = setTimeout(resolve, 1500 + text.length * 120)
    const done = () => { clearTimeout(cap); resolve() }
    const u = new SpeechSynthesisUtterance(text)
    u.onend = done
    u.onerror = done
    speechSynthesis.speak(u)
  })
}

/** Re-trims a decoded clip to a tighter padding, so words run together naturally. */
function tighten(ctx: AudioContext, buffer: AudioBuffer): AudioBuffer {
  const samples = trimSilence(buffer.getChannelData(0), buffer.sampleRate, PLAYBACK_PADDING_SECONDS)
  if (samples.length === 0) return buffer
  const out = ctx.createBuffer(1, samples.length, buffer.sampleRate)
  out.getChannelData(0).set(samples)
  return out
}

export function useAnnouncer({
  sessionId,
  courts,
  isLoading,
}: {
  sessionId: string | null
  courts: CourtSlot<CourtMatchDisplay>[]
  isLoading: boolean
}) {
  const [status, setStatus] = useState<AnnouncerStatus>(() => (readRemembered() ? 'locked' : 'off'))
  const [counts, setCounts] = useState({ ready: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const ctxRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef(new Map<string, AudioBuffer>())
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const seenRef = useRef<SeenGames | null>(null)
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const statusRef = useRef(status)
  statusRef.current = status

  const playBuffer = useCallback((buffer: AudioBuffer) => new Promise<void>((resolve) => {
    const ctx = ctxRef.current
    if (!ctx) { resolve(); return }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    // Same reason as `speak`: a suspended context never fires `ended`.
    const cap = setTimeout(resolve, (buffer.duration + 1) * 1000)
    source.onended = () => { clearTimeout(cap); resolve() }
    source.start()
  }), [])

  const pause = (seconds: number) => new Promise<void>((r) => setTimeout(r, seconds * 1000))

  const playCall = useCallback(async (game: NewGame, names: Map<string, string>) => {
    const keys = buildCall(game)
    const buffers = buffersRef.current
    const nameOf = (id: string) => names.get(id) ?? 'player'
    // A word with no recording is spoken by the computer voice; the rest still play from clips.
    const wordOf = (key: string) => (key.startsWith('phrase:') ? phraseText(key) : nameOf(key))
    for (let round = 0; round < CALL_REPEATS; round++) {
      if (round > 0) await pause(REPEAT_GAP_SECONDS)
      for (let index = 0; index < keys.length; index++) {
        if (index > 0) await pause(TIGHT_BEFORE_INDEXES.has(index) ? TIGHT_GAP_SECONDS : GAP_SECONDS)
        const buffer = buffers.get(keys[index])
        if (buffer) { await playBuffer(buffer); continue }
        // Consecutive unrecorded words go in one utterance: each speak() pays the voice engine's start-up lag.
        let end = index
        while (end + 1 < keys.length && !buffers.has(keys[end + 1])) end++
        let text = ''
        for (let i = index; i <= end; i++) text += (i > index ? (COMMA_BEFORE_INDEXES.has(i) ? ', ' : ' ') : '') + wordOf(keys[i])
        await speak(text)
        index = end
      }
    }
    await pause(CALL_GAP_SECONDS)
  }, [playBuffer])

  const announce = useCallback((game: NewGame, names: Map<string, string>) => {
    // One queue, so two courts starting together are called in turn.
    queueRef.current = queueRef.current.then(() => playCall(game, names)).catch(() => {})
    // Test hook: Playwright reads this to confirm a call was queued.
    ;(window as unknown as { __announcerCalls?: NewGame[] }).__announcerCalls?.push(game)
  }, [playCall])

  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && !wakeRef.current) {
        wakeRef.current = await navigator.wakeLock.request('screen')
        wakeRef.current.addEventListener('release', () => { wakeRef.current = null })
      }
    } catch { /* unsupported or refused: the tablet's own screen setting applies */ }
  }, [])

  /** Must run inside a tap: creating/resuming audio is only allowed there. */
  const enable = useCallback(async () => {
    setStatus('loading')
    setError(null)
    remember(true)
    try {
      if (!ctxRef.current) {
        const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        ctxRef.current = new AudioCtx()
      }
      await ctxRef.current.resume()
      void acquireWakeLock()

      const clips = await fetchAnnouncerClips()
      const urls = new Map([...clips].map(([key, clip]) => [key, clipUrl(clip)]))
      const decoded = new Map<string, AudioBuffer>()
      await Promise.all([...urls].map(async ([key, url]) => {
        try {
          decoded.set(key, tighten(ctxRef.current!, await ctxRef.current!.decodeAudioData(await fetchClipBytes(url))))
        } catch { /* that one falls back to the computer voice */ }
      }))
      buffersRef.current = decoded
      void pruneCache(new Set(urls.values()))

      // "14 of 16 names": everyone in this session's games, else every clip.
      let roster: string[] = []
      if (sessionId) {
        const { data } = await supabase
          .from('matches')
          .select('team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
          .eq('session_id', sessionId)
        roster = [...new Set(((data ?? []) as Array<Record<string, string>>).flatMap((m) => Object.values(m)))]
      }
      const names = roster.length > 0 ? roster : [...decoded.keys()].filter((k) => !k.startsWith('phrase:'))
      setCounts({ ready: names.filter((id) => decoded.has(id)).length, total: names.length })
      setStatus('ready')
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }, [acquireWakeLock, sessionId])

  const disable = useCallback(() => {
    remember(false)
    setStatus('off')
    void wakeRef.current?.release()
    wakeRef.current = null
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  }, [])

  // The wake lock drops whenever the tab is hidden; take it back on return.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && statusRef.current === 'ready') void acquireWakeLock() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [acquireWakeLock])

  // Watch every court update, announcer on or off, so switching on later never
  // replays games that started while it was off.
  useEffect(() => {
    if (isLoading) return
    const view = courts.map((c) => ({ courtNumber: c.courtNumber, current: c.current }))
    const started = detectNewGames(seenRef.current, view)
    seenRef.current = snapshot(view)
    if (statusRef.current !== 'ready' || started.length === 0) return
    const names = new Map(courts.flatMap((c) => (c.current ? [...c.current.team1, ...c.current.team2] : [])).map((p) => [p.id, p.name]))
    for (const game of started) announce(game, names)
  }, [courts, isLoading, announce])

  return { status, counts, error, enable, disable }
}
