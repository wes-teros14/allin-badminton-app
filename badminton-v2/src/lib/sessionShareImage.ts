import { supabase } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { firstOnCourtGames } from '@/lib/matchGenerator'
import { normalizeCourtCount } from '@/lib/courts'
import { splitSessionNotes } from '@/views/MySessionsView'

// ---------------------------------------------------------------------------
// Session share image
//
// An admin posts the session to the group chat as one picture: the session's
// details plus the games that open the night ("First on court" — one per
// court, the same set MatchBoard captions). The picture is drawn on a canvas in
// the browser, so there is no server, no library and no cost.
// ---------------------------------------------------------------------------

export interface SharePlayer {
  name: string
  avatarUrl: string | null
}

export interface ShareGame {
  /** `matches.queue_position` — the number the app shows as "Game N". */
  gameNumber: number
  team1: [SharePlayer, SharePlayer]
  team2: [SharePlayer, SharePlayer]
}

export interface ShareSessionInput {
  name: string
  date: string
  time: string | null
  duration: string | null
  price: number | null
  venue: string | null
  session_notes: string | null
}

export interface ShareContent {
  title: string
  dateLine: string
  /** "3:00 PM · 2 hrs · ₱370"; null when none of the three is set. */
  detailLine: string | null
  venue: string | null
  /** Notes as chips when they split cleanly, otherwise one free-text line. */
  chips: string[]
  noteText: string | null
  games: ShareGame[]
}

/** Same date/time formatting as the session card on /sessions. */
export function buildShareContent(session: ShareSessionInput, games: ShareGame[]): ShareContent {
  const dateLine = new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const time = session.time
    ? new Date(`1970-01-01T${session.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null
  const parts = [
    time,
    session.duration ? `${session.duration} hrs` : null,
    session.price != null ? `₱${session.price}` : null,
  ].filter((p): p is string => p !== null)

  const notes = session.session_notes?.trim() || null
  const chips = notes ? splitSessionNotes(notes) : null

  return {
    title: session.name,
    dateLine,
    detailLine: parts.length > 0 ? parts.join('  ·  ') : null,
    venue: session.venue?.trim() || null,
    chips: chips ?? [],
    noteText: notes && !chips ? notes : null,
    games,
  }
}

export interface QueuedMatchRow {
  queue_position: number
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
}

/**
 * The games that open the night: the first `courtCount` queued games in queue
 * order. Ordered by position in the queue, never by assuming games 1..N exist —
 * `queue_position` can have gaps after a game is removed.
 */
export function pickFirstOnCourt<T extends Pick<QueuedMatchRow, 'queue_position'>>(rows: T[], courtCount: number): T[] {
  return [...rows]
    .sort((a, b) => a.queue_position - b.queue_position)
    .slice(0, firstOnCourtGames(normalizeCourtCount(courtCount)))
}

/** Fetches the first-on-court games with player names and photos. */
export async function fetchFirstOnCourt(sessionId: string, courtCount: number): Promise<ShareGame[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('queue_position, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
    .eq('session_id', sessionId)
    .eq('status', 'queued')
    .order('queue_position')
  if (error) throw new Error(error.message)

  const rows = pickFirstOnCourt((data ?? []) as QueuedMatchRow[], courtCount)
  if (rows.length === 0) return []

  const ids = [...new Set(rows.flatMap((r) => [r.team1_player1_id, r.team1_player2_id, r.team2_player1_id, r.team2_player2_id]))]
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name_slug, nickname, avatar_url')
    .in('id', ids)
  if (profileError) throw new Error(profileError.message)

  type ProfileRow = { id: string; name_slug: string; nickname: string | null; avatar_url: string | null }
  const byId = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]))
  const player = (id: string): SharePlayer => {
    const p = byId.get(id)
    return p
      ? { name: formatDisplayName(p.nickname, p.name_slug), avatarUrl: p.avatar_url }
      : { name: 'Player', avatarUrl: null }
  }

  return rows.map((r) => ({
    gameNumber: r.queue_position,
    team1: [player(r.team1_player1_id), player(r.team1_player2_id)],
    team2: [player(r.team2_player1_id), player(r.team2_player2_id)],
  }))
}

/** File name for the PNG: "badminton-nov-8.png". */
export function shareFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'session'}.png`
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Dark theme tokens from index.css — the image matches the app's dark mode. */
const C = {
  bg: '#0F0A18',
  card: '#1A1025',
  border: '#2D1A40',
  fg: '#FFFFFF',
  muted: '#B39DBB',
  chip: '#1E1230',
  title: '#D8B4F0',
  gold: '#FFB200',
  numberBg: '#2D1B42',
}

const SANS = '"Geist Variable", "Segoe UI", system-ui, -apple-system, sans-serif'
const MONO = 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace'
const WIDTH = 1080
const PAD = 72

/** Same hue rule as Avatar.tsx, so initials match the app. */
function hueFromName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360
  return hash
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Largest size from `max` down to `min` at which `text` fits; ellipsised below that. */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, max: number, min: number, width: number): { text: string; size: number } {
  for (let size = max; size >= min; size -= 2) {
    ctx.font = `${weight} ${size}px ${SANS}`
    if (ctx.measureText(text).width <= width) return { text, size }
  }
  ctx.font = `${weight} ${min}px ${SANS}`
  let cut = text
  while (cut.length > 1 && ctx.measureText(cut + '…').width > width) cut = cut.slice(0, -1)
  return { text: cut + '…', size: min }
}

/** Splits free text into lines no wider than `width` at the current font. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > width) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Loads a player photo for drawing. Resolves null on any failure — including a
 * storage host that refuses cross-origin reads, which would otherwise taint the
 * canvas and make the PNG impossible to export — and the player gets initials.
 */
function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => resolve(null), 5000)
    img.onload = () => { clearTimeout(timer); resolve(img) }
    img.onerror = () => { clearTimeout(timer); resolve(null) }
    img.src = url
  })
}

function drawAvatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, person: SharePlayer, photo: HTMLImageElement | null) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  if (photo) {
    ctx.clip()
    // object-fit: cover
    const scale = Math.max((r * 2) / photo.naturalWidth, (r * 2) / photo.naturalHeight)
    const w = photo.naturalWidth * scale
    const h = photo.naturalHeight * scale
    ctx.drawImage(photo, cx - w / 2, cy - h / 2, w, h)
  } else {
    const trimmed = person.name.trim()
    ctx.fillStyle = `hsl(${hueFromName(trimmed || '?')} 45% 32%)`
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `600 ${Math.round(r * 0.9)}px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(trimmed.charAt(0).toUpperCase() || '?', cx, cy + 2)
  }
  ctx.restore()
}

type Photos = Map<string, HTMLImageElement | null>

/** Paints the card and returns its height. With `paint` false it only measures. */
function layout(ctx: CanvasRenderingContext2D, content: ShareContent, photos: Photos, paint: boolean): number {
  const inner = WIDTH - PAD * 2
  let y = PAD

  if (paint) {
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, WIDTH, ctx.canvas.height)
    ctx.fillStyle = C.gold
    ctx.fillRect(0, 0, 14, ctx.canvas.height)
  }

  // Title
  const title = fitText(ctx, content.title, 700, 72, 44, inner)
  y += title.size
  if (paint) {
    ctx.fillStyle = C.title
    ctx.font = `700 ${title.size}px ${SANS}`
    ctx.fillText(title.text, PAD, y)
  }

  // Detail lines
  const lines = [
    `📅  ${content.dateLine}`,
    content.detailLine ? `🕒  ${content.detailLine}` : null,
    content.venue ? `📍  ${content.venue}` : null,
  ].filter((l): l is string => l !== null)
  for (const line of lines) {
    const fitted = fitText(ctx, line, 400, 38, 28, inner)
    y += 62
    if (paint) {
      ctx.fillStyle = C.fg
      ctx.font = `400 ${fitted.size}px ${SANS}`
      ctx.fillText(fitted.text, PAD, y)
    }
  }

  // Notes: chips when they split cleanly, else wrapped text
  if (content.chips.length > 0) {
    y += 36
    ctx.font = `500 30px ${SANS}`
    const chipH = 60
    let x = PAD
    for (const chip of content.chips) {
      const fitted = fitText(ctx, chip, 500, 30, 24, inner - 44)
      ctx.font = `500 ${fitted.size}px ${SANS}`
      const w = ctx.measureText(fitted.text).width + 44
      if (x > PAD && x + w > WIDTH - PAD) { x = PAD; y += chipH + 14 }
      if (paint) {
        ctx.fillStyle = C.chip
        roundRect(ctx, x, y, w, chipH, 18)
        ctx.fill()
        ctx.fillStyle = C.muted
        ctx.fillText(fitted.text, x + 22, y + 40)
      }
      x += w + 14
    }
    y += chipH
  } else if (content.noteText) {
    ctx.font = `400 30px ${SANS}`
    for (const line of wrapLines(ctx, content.noteText, inner)) {
      y += 44
      if (paint) {
        ctx.fillStyle = C.muted
        ctx.font = `400 30px ${SANS}`
        ctx.fillText(line, PAD, y)
      }
    }
  }

  // First on court
  if (content.games.length > 0) {
    y += 84
    if (paint) {
      ctx.fillStyle = C.gold
      ctx.font = `700 30px ${MONO}`
      ctx.fillText('FIRST ON COURT', PAD, y)
    }
    y += 34

    const rowH = 210
    const r = 34
    for (const g of content.games) {
      if (paint) {
        ctx.fillStyle = C.card
        roundRect(ctx, PAD, y, inner, rowH, 32)
        ctx.fill()
        ctx.strokeStyle = C.border
        ctx.lineWidth = 2
        ctx.stroke()

        // Game number
        ctx.fillStyle = C.numberBg
        roundRect(ctx, PAD + 32, y + 65, 80, 80, 20)
        ctx.fill()
        ctx.fillStyle = C.muted
        ctx.font = `700 36px ${MONO}`
        ctx.textAlign = 'center'
        ctx.fillText(String(g.gameNumber), PAD + 72, y + 118)
        ctx.textAlign = 'left'

        // Faces: A B vs C D
        const left = PAD + 150
        const face = (p: SharePlayer) => photos.get(p.avatarUrl ?? '') ?? null
        drawAvatar(ctx, left + r, y + 66, r, g.team1[0], face(g.team1[0]))
        drawAvatar(ctx, left + r * 3 + 12, y + 66, r, g.team1[1], face(g.team1[1]))
        ctx.fillStyle = C.muted
        ctx.font = `600 28px ${SANS}`
        ctx.fillText('vs', left + r * 4 + 36, y + 76)
        drawAvatar(ctx, left + r * 5 + 84, y + 66, r, g.team2[0], face(g.team2[0]))
        drawAvatar(ctx, left + r * 7 + 96, y + 66, r, g.team2[1], face(g.team2[1]))

        // Names
        const names = `${g.team1[0].name} & ${g.team1[1].name}  vs  ${g.team2[0].name} & ${g.team2[1].name}`
        const fitted = fitText(ctx, names, 700, 40, 26, WIDTH - PAD - 32 - left)
        ctx.fillStyle = C.fg
        ctx.font = `700 ${fitted.size}px ${SANS}`
        ctx.fillText(fitted.text, left, y + 162)
      }
      y += rowH + 20
    }
  }

  return y + PAD
}

/** Draws the share image. Photos that cannot be loaded fall back to initials. */
export async function renderShareImage(content: ShareContent): Promise<Blob> {
  // Canvas text does not wait for web fonts; without this the first draw can
  // silently fall back to the system font.
  try {
    await Promise.all([
      document.fonts.load(`700 40px "Geist Variable"`),
      document.fonts.load(`400 40px "Geist Variable"`),
    ])
  } catch { /* system font is an acceptable fallback */ }

  const urls = [...new Set(content.games.flatMap((g) => [...g.team1, ...g.team2]).map((p) => p.avatarUrl).filter((u): u is string => !!u))]
  const loaded = await Promise.all(urls.map(loadPhoto))
  const photos: Photos = new Map(urls.map((u, i) => [u, loaded[i]]))

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = 10
  const measureCtx = canvas.getContext('2d')
  if (!measureCtx) throw new Error('Canvas is not available')
  canvas.height = Math.ceil(layout(measureCtx, content, photos, false))
  const ctx = canvas.getContext('2d')!
  layout(ctx, content, photos, true)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'))
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export function canShareImage(file: File): boolean {
  return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] })
}

export function canCopyImage(): boolean {
  return typeof window !== 'undefined' && 'ClipboardItem' in window && !!navigator.clipboard?.write
}

export async function copyImage(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export function downloadImage(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
