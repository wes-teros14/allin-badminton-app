// Simulates a live session on DEV: N phones watching the courts while the admin
// finishes and starts games. Compares the two ways phones learn about changes:
//
//   --mode changes    Postgres Changes (the app before migration 089)
//   --mode broadcast  Realtime Broadcast topics (the app after 089)
//
// Each phone behaves like the live board / player view:
//   * one realtime channel for the session (+ its own user channel)
//   * on a change: wait 300 ms + up to 700 ms jitter, then refetch
//     sessions + matches (+ profiles when the 60 s name cache expires)
//   * a 30 s safety poll doing the same refetch
// The admin finishes one game per court every --game-seconds and starts the
// next, writing a match_results row, exactly like markDone in useAdminActions.
//
// The session's matches and results are snapshotted first and restored at the
// end, so DEV is left as it was.
//
// Usage:
//   node scripts/loadtest/session-sim.mjs --mode broadcast --minutes 20
//   options: --devices 20 --game-seconds 240 --session <id>
//
// Database-side cost is read separately (pg_stat_statements on DEV): reset it
// before the run, read it after.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SUPABASE_URL, ANON_KEY, SERVICE_KEY } from './env.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
)
const MODE = args.mode ?? 'broadcast'
const MINUTES = Number(args.minutes ?? 20)
const DEVICES = Number(args.devices ?? 20)
const GAME_SECONDS = Number(args['game-seconds'] ?? 240)
const SESSION_ID = args.session ?? 'bce6f898-c4cd-4334-9d38-54cd7a1df91f'
if (!['changes', 'broadcast'].includes(MODE)) throw new Error('--mode changes|broadcast')

const POLL_MS = 30_000
const PROFILE_TTL_MS = 60_000
const ACCOUNTS = [
  'admin', 'multiple-john', 'multiple-jane', 'multiple-joe',
  's1-alex', 's1-jamie', 's1-sam', 's1-wei', 's2-marcus', 's2-dana', 's2-kim', 's2-raj',
].map((n) => `${n}@test.local`)
// DEV has these 12 accounts; devices beyond 12 reuse one (a second phone signed in as the same player).

const opts = { auth: { persistSession: false, autoRefreshToken: true } }
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => Date.now()

// ---------------------------------------------------------------- metrics
const metrics = {
  requests: [],          // { t, what, ms, ok }
  deliveries: [],        // { write, device, ms }
  statuses: [],          // { t, device, status }
  writes: [],            // { t, kind }
}
let lastWriteAt = null
let running = true
function record(what, ms, ok) { metrics.requests.push({ t: now(), what, ms, ok }) }

async function timed(what, promise) {
  const t0 = now()
  try {
    const res = await promise
    record(what, now() - t0, !res.error)
    return res
  } catch (e) {
    record(what, now() - t0, false)
    return { error: e }
  }
}

// ---------------------------------------------------------------- snapshot / restore
const { data: snapshot, error: snapErr } = await admin
  .from('matches')
  .select('id, status, court_number, started_at, queue_position, duration_seconds')
  .eq('session_id', SESSION_ID)
if (snapErr) throw snapErr
const createdResultMatchIds = new Set()
console.log(`[sim] mode=${MODE} devices=${DEVICES} minutes=${MINUTES} game=${GAME_SECONDS}s session=${SESSION_ID} matches=${snapshot.length}`)

async function restore() {
  if (createdResultMatchIds.size) {
    await admin.from('match_results').delete().in('match_id', [...createdResultMatchIds])
  }
  for (const m of snapshot) {
    await admin.from('matches').update({
      status: m.status, court_number: m.court_number, started_at: m.started_at,
      queue_position: m.queue_position, duration_seconds: m.duration_seconds,
    }).eq('id', m.id)
  }
  console.log('[sim] DEV session restored')
}

// ---------------------------------------------------------------- devices
async function startDevice(index) {
  const email = ACCOUNTS[index % ACCOUNTS.length]
  const client = createClient(SUPABASE_URL, ANON_KEY, opts)
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'Test1234!' })
  if (error) throw new Error(`${email}: ${error.message}`)
  await client.realtime.setAuth(data.session.access_token)
  const userId = data.user.id
  const profileCache = { at: 0 }
  let coalesceTimer = null
  let waitingForWrite = null

  async function refetch() {
    const [, matches] = await Promise.all([
      timed('sessions', client.from('sessions').select('id, status, court_count, court_1_label, court_2_label, split_match_scoring').eq('id', SESSION_ID).maybeSingle()),
      timed('matches', client.from('matches')
        .select('id, queue_position, status, court_number, started_at, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
        .eq('session_id', SESSION_ID).order('queue_position')),
    ])
    if (now() - profileCache.at > PROFILE_TTL_MS && matches.data) {
      const ids = [...new Set(matches.data.flatMap((m) => [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]))]
      const res = await timed('profiles', client.from('profiles').select('id, name_slug, nickname, avatar_url').in('id', ids))
      if (!res.error) profileCache.at = now()
    }
  }

  function onChange() {
    if (lastWriteAt && waitingForWrite !== lastWriteAt) {
      waitingForWrite = lastWriteAt
      metrics.deliveries.push({ write: lastWriteAt, device: index, ms: now() - lastWriteAt })
    }
    if (coalesceTimer) return
    coalesceTimer = setTimeout(() => { coalesceTimer = null; void refetch() }, 300 + Math.random() * 700)
  }
  const onStatus = (status) => { if (running) metrics.statuses.push({ t: now(), device: index, status }) }

  const channels = []
  if (MODE === 'changes') {
    channels.push(client.channel(`live-board-${SESSION_ID}-${index}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `session_id=eq.${SESSION_ID}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_results' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${SESSION_ID}` }, onChange)
      .subscribe(onStatus))
    channels.push(client.channel(`notifications-rt-${userId}-${index}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {})
      .subscribe())
  } else {
    channels.push(client.channel(`session:${SESSION_ID}`, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, ({ payload }) => {
        if (['matches', 'match_results', 'sessions'].includes(payload?.table)) onChange()
      })
      .subscribe(onStatus))
    channels.push(client.channel(`user:${userId}`, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, () => {})
      .subscribe())
  }

  await refetch()
  const pollTimer = setInterval(() => { void refetch() }, POLL_MS + Math.random() * 1000)
  return {
    async stop() {
      clearInterval(pollTimer)
      clearTimeout(coalesceTimer)
      await client.removeAllChannels()
      await client.auth.signOut()
    },
  }
}

// ---------------------------------------------------------------- admin
async function finishAndStart(court) {
  const { data: playing } = await admin.from('matches').select('id, started_at')
    .eq('session_id', SESSION_ID).eq('status', 'playing').eq('court_number', court).limit(1).maybeSingle()
  lastWriteAt = now()
  metrics.writes.push({ t: lastWriteAt, kind: `court ${court}` })
  if (playing) {
    await admin.from('matches').update({ status: 'complete', duration_seconds: GAME_SECONDS }).eq('id', playing.id)
    await admin.from('match_results').insert({ match_id: playing.id, winning_pair_index: Math.random() < 0.5 ? 1 : 2, game_number: 1 })
    createdResultMatchIds.add(playing.id)
  }
  let { data: next } = await admin.from('matches').select('id').eq('session_id', SESSION_ID).eq('status', 'queued')
    .order('queue_position').limit(1).maybeSingle()
  if (!next) {
    // Out of games: recycle the finished ones so the session keeps going.
    await admin.from('match_results').delete().in('match_id', [...createdResultMatchIds])
    await admin.from('matches').update({ status: 'queued', court_number: null, started_at: null })
      .eq('session_id', SESSION_ID).eq('status', 'complete')
    ;({ data: next } = await admin.from('matches').select('id').eq('session_id', SESSION_ID).eq('status', 'queued')
      .order('queue_position').limit(1).maybeSingle())
  }
  if (next) {
    await admin.from('matches').update({ status: 'playing', court_number: court, started_at: new Date().toISOString() }).eq('id', next.id)
  }
}

// ---------------------------------------------------------------- run
const devices = []
let interrupted = false
process.on('SIGINT', () => { interrupted = true })
try {
  // Start from a clean board: everything queued.
  await admin.from('matches').update({ status: 'queued', court_number: null, started_at: null }).eq('session_id', SESSION_ID)
  for (let i = 0; i < DEVICES; i++) {
    devices.push(await startDevice(i))
    await sleep(300)
  }
  console.log(`[sim] ${devices.length} devices connected`)
  await sleep(5000)

  const { data: session } = await admin.from('sessions').select('court_count').eq('id', SESSION_ID).single()
  const courts = session.court_count ?? 2
  const endAt = now() + MINUTES * 60_000
  // Stagger courts so games finish at different times, like a real session.
  const stagger = (GAME_SECONDS * 1000) / courts
  for (let c = 1; c <= courts; c++) await finishAndStart(c)
  let tick = 0
  while (now() < endAt && !interrupted) {
    await sleep(stagger)
    const court = (tick % courts) + 1
    await finishAndStart(court)
    tick++
    process.stdout.write(`\r[sim] ${Math.round((endAt - now()) / 1000)} s left, ${metrics.writes.length} game changes, ${metrics.requests.length} requests   `)
  }
} finally {
  running = false
  console.log('\n[sim] stopping devices')
  for (const d of devices) await d.stop().catch(() => {})
  await restore()
}

// ---------------------------------------------------------------- report
const q = (arr, p) => (arr.length ? arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(p * arr.length))] : null)
const byWhat = {}
for (const r of metrics.requests) (byWhat[r.what] ??= []).push(r)
const summary = {
  mode: MODE, devices: DEVICES, minutes: MINUTES, gameSeconds: GAME_SECONDS,
  gameChanges: metrics.writes.length,
  requests: metrics.requests.length,
  requestsPerMinute: +(metrics.requests.length / MINUTES).toFixed(1),
  failedRequests: metrics.requests.filter((r) => !r.ok).length,
  latencyMs: Object.fromEntries(Object.entries(byWhat).map(([k, v]) => {
    const ms = v.map((r) => r.ms)
    return [k, { n: v.length, p50: q(ms, 0.5), p95: q(ms, 0.95), max: Math.max(...ms) }]
  })),
  deliveryMs: (() => {
    const ms = metrics.deliveries.map((d) => d.ms)
    return { n: ms.length, expected: metrics.writes.length * DEVICES, p50: q(ms, 0.5), p95: q(ms, 0.95), max: ms.length ? Math.max(...ms) : null }
  })(),
  disconnects: metrics.statuses.filter((s) => s.status !== 'SUBSCRIBED').length,
}
console.log(JSON.stringify(summary, null, 2))
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), 'results')
mkdirSync(outDir, { recursive: true })
const file = resolve(outDir, `sim-${MODE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
writeFileSync(file, JSON.stringify({ summary, metrics }, null, 0))
console.log(`[sim] wrote ${file}`)
process.exit(0)
