// Simulates a live session against a Neon branch (Neon migration, rehearsal): N phones watching
// the courts while the admin finishes and starts games — the Neon counterpart of session-sim.mjs.
//
// Each phone does what the app does on Neon (src/lib/neonLiveChannel.ts + useRealtime):
//   * its own Realtime connection with two live queries on live_messages: session:<id> and user:<id>
//   * on a new row: wait 300 ms + up to 700 ms jitter, then refetch sessions + matches through the
//     Data API (+ profiles when the 60 s name cache expires)
//   * a 30 s safety poll doing the same refetch
// The admin finishes one game per court every --game-seconds and starts the next through the Data
// API (matches update + match_results insert), so every trigger fires as in a real session.
// A sampler counts the database's backends every 15 s.
//
// Tokens: phones and admin get JWTs signed with a test key that must be in the branch's JWKS
// (rehearsal only — never add it to production's). Realtime passes are sealed in-process with the
// branch's REALTIME secret (what the seal Function does).
//
// It does NOT restore the session: run it only on a disposable copy and restore the branch after
// (`neon branches restore <branch> ^self@<start time>`).
//
// Usage (all inputs from a folder that holds secrets and ids, never from the repo):
//   LOADTEST_DIR=<dir> node scripts/loadtest/session-sim-neon.mjs --endpoint ep-xxxx --data-api <url> \
//     --session <id> [--devices 20 --minutes 15 --game-seconds 120]
//   <dir> holds: .env (NEON_REALTIME_URL, NEON_REALTIME_SECRET), .cs (direct connection string),
//   loadtest-private.pem, loadtest-cast.json ({players:[ids], admin:id}).
import { createClient } from '@supabase/supabase-js'
import { createRealtime, rawSql } from '@neon/realtime/server'
import { SignJWT, importPKCS8 } from 'jose'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const pg = require('pg')

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
)
const DIR = process.env.LOADTEST_DIR
const ENDPOINT = args.endpoint
const DATA_API = args['data-api']
const SESSION_ID = args.session
const DEVICES = Number(args.devices ?? 20)
const MINUTES = Number(args.minutes ?? 15)
const GAME_SECONDS = Number(args['game-seconds'] ?? 120)

// ---------------------------------------------------------------- guards
if (!DIR || !ENDPOINT || !DATA_API || !SESSION_ID) throw new Error('need LOADTEST_DIR, --endpoint, --data-api, --session')
const env = Object.fromEntries(readFileSync(join(DIR, '.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const CS = readFileSync(join(DIR, '.cs'), 'utf8').trim()
for (const [name, value] of [['data API', DATA_API], ['realtime', env.NEON_REALTIME_URL], ['database', CS]]) {
  if (/supabase\.co/.test(value)) throw new Error(`${name} points at Supabase — refusing`)
  if (!value.includes(ENDPOINT)) throw new Error(`${name} is not on endpoint ${ENDPOINT} — refusing`)
}
const cast = JSON.parse(readFileSync(join(DIR, 'loadtest-cast.json'), 'utf8'))
const signingKey = await importPKCS8(readFileSync(join(DIR, 'loadtest-private.pem'), 'utf8'), 'ES256')
const LIVE_SQL = 'SELECT id, msg FROM public.live_messages WHERE topic = $1'
const dataBase = DATA_API.replace(/\/+$/, '').replace(/\/rest\/v1$/, '')

const POLL_MS = 30_000
const PROFILE_TTL_MS = 60_000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => Date.now()

async function tokenFor(sub) {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: process.env.TEST_KID ?? 'loadtest-rehearsal-1', typ: 'JWT' })
    .setSubject(sub).setAudience('authenticated').setIssuedAt().setExpirationTime('3h').sign(signingKey)
}
function dataClient(token) {
  return createClient(dataBase, token, { accessToken: async () => token, auth: { persistSession: false } })
}

// ---------------------------------------------------------------- metrics
const metrics = { requests: [], deliveries: [], writes: [], backends: [], errors: [] }
let lastWriteAt = null
function record(what, ms, ok, detail) {
  metrics.requests.push({ t: now(), what, ms, ok })
  if (!ok && metrics.errors.length < 50) metrics.errors.push({ what, detail: String(detail).slice(0, 200) })
}
async function timed(what, promise) {
  const t0 = now()
  try {
    const res = await promise
    record(what, now() - t0, !res.error, res.error?.message)
    return res
  } catch (e) {
    record(what, now() - t0, false, e)
    return { error: e }
  }
}

// ---------------------------------------------------------------- devices
async function startDevice(index) {
  const userId = cast.players[index % cast.players.length]
  const client = dataClient(await tokenFor(userId))
  const realtime = createRealtime({ secret: env.NEON_REALTIME_SECRET, db: 'neondb', url: env.NEON_REALTIME_URL })
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

  const subs = []
  for (const topic of [`session:${SESSION_ID}`, `user:${userId}`]) {
    const t0 = now()
    const sub = await realtime.subscribe(rawSql(LIVE_SQL, [topic]), { materialize: false })
    let baseline = true
    sub.onUpdate((u) => {
      if (u.type === 'rows') { baseline = false; return }
      if (baseline) return
      const tables = u.changes.flatMap((c) => (c.type === 'upsert' ? [c.row?.msg?.table] : []))
      if (topic.startsWith('session:') && tables.some((t) => ['matches', 'match_results', 'sessions'].includes(t))) onChange()
    })
    subs.push(sub)
    record(`subscribe ${topic.split(':')[0]}`, now() - t0, true)
  }

  await refetch()
  const pollTimer = setInterval(() => { void refetch() }, POLL_MS + Math.random() * 1000)
  return {
    async stop() {
      clearInterval(pollTimer)
      clearTimeout(coalesceTimer)
      for (const s of subs) s.unsubscribe()
      realtime.close()
    },
  }
}

// ---------------------------------------------------------------- admin
const admin = dataClient(await tokenFor(cast.admin))
async function finishAndStart(court) {
  const { data: playing } = await timed('admin read', admin.from('matches').select('id, started_at')
    .eq('session_id', SESSION_ID).eq('status', 'playing').eq('court_number', court).limit(1).maybeSingle())
  lastWriteAt = now()
  metrics.writes.push({ t: lastWriteAt, kind: `court ${court}` })
  if (playing) {
    await timed('admin finish', admin.from('matches').update({ status: 'complete', duration_seconds: GAME_SECONDS }).eq('id', playing.id))
    await timed('admin result', admin.from('match_results').insert({ match_id: playing.id, winning_pair_index: Math.random() < 0.5 ? 1 : 2, game_number: 1 }))
  }
  let { data: next } = await timed('admin read', admin.from('matches').select('id').eq('session_id', SESSION_ID).eq('status', 'queued')
    .order('queue_position').limit(1).maybeSingle())
  if (!next) {
    // Out of games: recycle the finished ones so the session keeps going.
    await timed('admin recycle', admin.from('match_results').delete().in('match_id', (await admin.from('matches').select('id').eq('session_id', SESSION_ID).eq('status', 'complete')).data?.map((m) => m.id) ?? []))
    await timed('admin recycle', admin.from('matches').update({ status: 'queued', court_number: null, started_at: null }).eq('session_id', SESSION_ID).eq('status', 'complete'))
    ;({ data: next } = await admin.from('matches').select('id').eq('session_id', SESSION_ID).eq('status', 'queued').order('queue_position').limit(1).maybeSingle())
  }
  if (next) {
    await timed('admin start', admin.from('matches').update({ status: 'playing', court_number: court, started_at: new Date().toISOString() }).eq('id', next.id))
  }
}

// ---------------------------------------------------------------- backend sampler
const sampler = new pg.Client({ connectionString: CS.replace(/sslmode=require/, 'sslmode=verify-full') })
await sampler.connect()
async function sampleBackends(label) {
  const { rows } = await sampler.query(`
    select coalesce(nullif(usename, ''), backend_type) who, coalesce(nullif(application_name, ''), '-') app, count(*)::int n
    from pg_stat_activity where pid <> pg_backend_pid() group by 1, 2 order by 3 desc`)
  metrics.backends.push({ t: now(), label, total: rows.reduce((a, r) => a + r.n, 0), rows })
}

// ---------------------------------------------------------------- run
const devices = []
let interrupted = false
process.on('SIGINT', () => { interrupted = true })
const startedAt = new Date().toISOString()
console.log(`[sim-neon] start ${startedAt} endpoint=${ENDPOINT} devices=${DEVICES} minutes=${MINUTES} game=${GAME_SECONDS}s`)
await sampleBackends('before')
const samplerTimer = setInterval(() => { void sampleBackends('during').catch(() => {}) }, 15_000)
try {
  // A copied finished session already has results; clear them so recording a result works (disposable copy).
  const { data: sessionMatches } = await admin.from('matches').select('id').eq('session_id', SESSION_ID)
  await timed('admin reset', admin.from('match_results').delete().in('match_id', (sessionMatches ?? []).map((m) => m.id)))
  await timed('admin reset', admin.from('matches').update({ status: 'queued', court_number: null, started_at: null }).eq('session_id', SESSION_ID))
  for (let i = 0; i < DEVICES; i++) {
    devices.push(await startDevice(i))
    await sleep(300)
  }
  console.log(`[sim-neon] ${devices.length} devices connected`)
  await sleep(5000)
  await sampleBackends('connected')
  const courts = 2
  const endAt = now() + MINUTES * 60_000
  const stagger = (GAME_SECONDS * 1000) / courts
  for (let c = 1; c <= courts; c++) await finishAndStart(c)
  let tick = 0
  while (now() < endAt && !interrupted) {
    await sleep(stagger)
    await finishAndStart((tick % courts) + 1)
    tick++
    process.stdout.write(`\r[sim-neon] ${Math.round((endAt - now()) / 1000)} s left, ${metrics.writes.length} game changes, ${metrics.requests.length} requests   `)
  }
} finally {
  clearInterval(samplerTimer)
  await sampleBackends('end').catch(() => {})
  console.log('\n[sim-neon] stopping devices')
  for (const d of devices) await d.stop().catch(() => {})
  await sleep(3000)
  await sampleBackends('after').catch(() => {})
  await sampler.end()
}

// ---------------------------------------------------------------- report
const q = (arr, p) => (arr.length ? arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(p * arr.length))] : null)
const byWhat = {}
for (const r of metrics.requests) (byWhat[r.what] ??= []).push(r)
const totals = metrics.backends.map((b) => b.total)
const summary = {
  startedAt, endedAt: new Date().toISOString(), devices: DEVICES, minutes: MINUTES, gameSeconds: GAME_SECONDS,
  gameChanges: metrics.writes.length,
  requests: metrics.requests.length,
  requestsPerMinute: +(metrics.requests.length / MINUTES).toFixed(1),
  failedRequests: metrics.requests.filter((r) => !r.ok).length,
  firstErrors: metrics.errors.slice(0, 5),
  latencyMs: Object.fromEntries(Object.entries(byWhat).map(([k, v]) => {
    const ms = v.map((r) => r.ms)
    return [k, { n: v.length, p50: q(ms, 0.5), p95: q(ms, 0.95), max: Math.max(...ms) }]
  })),
  deliveryMs: (() => {
    const ms = metrics.deliveries.map((d) => d.ms)
    return { n: ms.length, expected: metrics.writes.length * DEVICES, p50: q(ms, 0.5), p95: q(ms, 0.95), max: ms.length ? Math.max(...ms) : null }
  })(),
  backends: {
    before: metrics.backends.find((b) => b.label === 'before')?.total,
    connected: metrics.backends.find((b) => b.label === 'connected')?.total,
    maxDuring: totals.length ? Math.max(...totals) : null,
    after: metrics.backends.find((b) => b.label === 'after')?.total,
    atPeak: metrics.backends.slice().sort((a, b) => b.total - a.total)[0]?.rows,
  },
}
console.log(JSON.stringify(summary, null, 2))
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), 'results')
mkdirSync(outDir, { recursive: true })
const file = resolve(outDir, `sim-neon-${startedAt.replace(/[:.]/g, '-')}.json`)
writeFileSync(file, JSON.stringify({ summary, metrics }, null, 0))
console.log(`[sim-neon] wrote ${file}`)
process.exit(0)
