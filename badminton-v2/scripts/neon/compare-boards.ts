// READ-ONLY. Rehearsal check (Neon migration): do the app's OWN leaderboard fetchers produce the same boards when
// their queries are answered by Neon's Data API as when they are answered PostgREST-style from the same rows?
//
//   reference  raw tables read over a direct connection (the branch is a byte-identical prod copy) and served by
//              the in-memory PostgREST-style builder from scripts/xmas2026/dump-prod-boards.ts
//   neon       the real Neon Data API, with a signed-in token (sub = an admin profile) signed by a test key that
//              must be in the branch's JWKS (rehearsal only)
//
// Prints only counts and hashes; the full outputs go to the files you name (keep them out of the repo).
//
//   NODE_PATH=<dir with pg> REHEARSAL_DIR=<dir> npx vite-node scripts/neon/compare-boards.ts -- reference <out.json>
//   NODE_PATH=<dir with pg> REHEARSAL_DIR=<dir> NEON_DATA_API=<url> npx vite-node scripts/neon/compare-boards.ts -- neon <out.json>
//   <dir> holds .cs (direct connection string), loadtest-private.pem, loadtest-cast.json ({admin}).
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const [mode, outFile] = process.argv.slice(2).filter((a) => a !== '--')
if (!['reference', 'neon'].includes(mode) || !outFile) throw new Error('usage: <reference|neon> <out.json>')
const DIR = process.env.REHEARSAL_DIR
if (!DIR) throw new Error('REHEARSAL_DIR is not set')

const TABLES = ['player_stats', 'profiles', 'sessions', 'session_registrations', 'matches', 'match_results', 'player_cheer_stats', 'player_pair_stats', 'cheers']

// ---- reference: the in-memory PostgREST-style builder (same as dump-prod-boards.ts) ----
async function referenceFrom() {
  const require = createRequire(import.meta.url)
  const pg = require('pg')
  const cs = readFileSync(join(DIR!, '.cs'), 'utf8').trim()
  if (/supabase\.co/.test(cs)) throw new Error('refusing: not a Neon branch')
  const client = new pg.Client({ connectionString: cs.replace(/sslmode=require/, 'sslmode=verify-full') })
  await client.connect()
  // Match PostgREST's JSON: timestamps as ISO strings, numerics as numbers where the API returns numbers.
  const T: Record<string, any[]> = {}
  for (const t of TABLES) T[t] = (await client.query(`select to_jsonb(x) j from public.${t} x`)).rows.map((r: any) => r.j)
  await client.end()

  const FK: Record<string, Record<string, { table: string; local: string; remote: string; many: boolean }>> = {
    matches: { match_results: { table: 'match_results', local: 'id', remote: 'match_id', many: true },
               sessions: { table: 'sessions', local: 'session_id', remote: 'id', many: false } },
    session_registrations: { sessions: { table: 'sessions', local: 'session_id', remote: 'id', many: false } },
  }
  return function from(table: string) {
    let rows = () => T[table].map((r) => ({ ...r }))
    const filters: Array<(r: any) => boolean> = []
    const orders: Array<[string, boolean]> = []
    let lim: number | null = null, rng: [number, number] | null = null, head = false, count = false
    let pick: string[] | null = null
    const inner: string[] = []
    const get = (r: any, col: string) => col.includes('.') ? r[col.split('.')[0]]?.[col.split('.')[1]] : r[col]
    const b: any = {
      select(cols: string, opts?: { count?: string; head?: boolean }) {
        head = !!opts?.head; count = opts?.count === 'exact'
        const embeds = [...cols.matchAll(/(\w+)(!inner)?\(([^)]*)\)/g)]
        const plain = cols.replace(/(\w+)(!inner)?\(([^)]*)\)/g, '').split(',').map((c) => c.trim()).filter(Boolean)
        pick = plain.includes('*') ? null : [...plain, ...embeds.map((e) => e[1])]
        const base = rows
        rows = () => base().map((r) => {
          for (const [, name, inn, sub] of embeds) {
            const fk = FK[table][name]
            const subCols = sub.split(',').map((c) => c.trim())
            const shape = (x: any) => Object.fromEntries(subCols.map((c) => [c, x[c]]))
            const hits = T[fk.table].filter((x) => x[fk.remote] === r[fk.local]).map(shape)
            r[name] = fk.many ? hits : hits[0] ?? null
            if (inn && !inner.includes(name)) inner.push(name)
          }
          return r
        })
        return b
      },
      eq(c: string, v: any) { filters.push((r) => get(r, c) === v); return b },
      gt(c: string, v: any) { filters.push((r) => get(r, c) > v); return b },
      gte(c: string, v: any) { filters.push((r) => get(r, c) >= v); return b },
      in(c: string, v: any[]) { const s = new Set(v); filters.push((r) => s.has(get(r, c))); return b },
      not(c: string, op: string, v: any) { if (op !== 'is' || v !== null) throw new Error('unsupported not'); filters.push((r) => get(r, c) != null); return b },
      order(c: string, o?: { ascending?: boolean }) { orders.push([c, o?.ascending !== false]); return b },
      limit(n: number) { lim = n; return b },
      range(a: number, z: number) { rng = [a, z]; return b },
      then(res: any, rej: any) {
        try {
          let out = rows().filter((r) => inner.every((n) => r[n] != null)).filter((r) => filters.every((f) => f(r)))
          out.sort((x, y) => { for (const [c, asc] of orders) { const a = x[c], z = y[c]; if (a === z) continue; return (a < z ? -1 : 1) * (asc ? 1 : -1) } return 0 })
          const total = out.length
          if (rng) out = out.slice(rng[0], rng[1] + 1)
          if (lim != null) out = out.slice(0, lim)
          if (pick) out = out.map((r) => Object.fromEntries(pick!.map((k) => [k, r[k]])))
          return Promise.resolve({ data: head ? null : out, error: null, count: count ? total : null }).then(res, rej)
        } catch (e) { return Promise.resolve({ data: null, error: e, count: null }).then(res, rej) }
      },
    }
    return b
  }
}

// ---- neon: the real Data API with a signed-in test token ----
async function neonClient() {
  const url = process.env.NEON_DATA_API
  if (!url || /supabase\.co/.test(url)) throw new Error('NEON_DATA_API must be a Neon Data API URL')
  const { SignJWT, importPKCS8 } = await import('jose')
  const { createClient } = await import('@supabase/supabase-js')
  const { singleObjectFetch } = await import('@/lib/singleObjectFetch')
  const cast = JSON.parse(readFileSync(join(DIR!, 'loadtest-cast.json'), 'utf8'))
  const key = await importPKCS8(readFileSync(join(DIR!, 'loadtest-private.pem'), 'utf8'), 'ES256')
  const token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: process.env.TEST_KID ?? 'loadtest-rehearsal-1', typ: 'JWT' })
    .setSubject(cast.admin).setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(key)
  return createClient(url.replace(/\/+$/, '').replace(/\/rest\/v1$/, ''), token, {
    accessToken: async () => token,
    global: { fetch: singleObjectFetch() },
    auth: { persistSession: false },
  })
}

const { supabase } = await import('@/lib/supabase')
if (mode === 'reference') {
  ;(supabase as any).from = await referenceFrom()
  ;(supabase as any).rpc = () => { throw new Error('rpc not mocked') }
} else {
  const neon = await neonClient()
  const probe = await neon.from('player_stats').select('player_id').limit(1)
  if (probe.error) throw new Error(`Neon Data API refused the test token: ${JSON.stringify(probe.error)}`)
  ;(supabase as any).from = neon.from.bind(neon)
  ;(supabase as any).rpc = neon.rpc.bind(neon)
}

const { fetchAllTimeLeaderboard, fetchCheerLeaderboard, fetchPairLeaderboard } = await import('@/lib/leaderboardData')
const { fetchAwardsLeaderboard } = await import('@/lib/awardsLeaderboard')
const { fetchEligiblePlayerIds } = await import('@/lib/boardEligibility')
const { rankCheerShares } = await import('@/lib/cheerShare')
const { CHEER_CATEGORIES } = await import('@/lib/cheerTypes')

const individual = await fetchAllTimeLeaderboard()
const pairs = await fetchPairLeaderboard()
const awards = await fetchAwardsLeaderboard()
const cheerRows = await fetchCheerLeaderboard()
const eligible = [...(await fetchEligiblePlayerIds())].sort()
const cheers = CHEER_CATEGORIES.map((c: any) => ({
  slug: c.slug,
  rows: rankCheerShares(cheerRows.map((e: any) => ({ playerId: e.player_id, categoryCount: c.of(e), totalReceived: e.cheers_received }))),
}))
const awardsOut = awards.map((a: any) => ({ key: a.key, rows: a.rows }))
const result = { eligible, individual, pairs, awards: awardsOut, cheers }

const hash = (v: unknown) => createHash('md5').update(JSON.stringify(v)).digest('hex').slice(0, 12)
writeFileSync(outFile, JSON.stringify(result))
console.log(JSON.stringify({
  mode,
  eligible: [eligible.length, hash(eligible)],
  individual: [individual.length, hash(individual)],
  pairs: [pairs.length, hash(pairs)],
  awards: awardsOut.map((a: any) => `${a.key}:${a.rows.length}:${hash(a.rows)}`),
  cheers: cheers.map((c: any) => `${c.slug}:${c.rows.length}:${hash(c.rows)}`),
}))
