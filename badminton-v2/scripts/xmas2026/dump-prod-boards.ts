// READ-ONLY. Pulls raw prod tables with SELECTs (Management API, token read from .env.prod at runtime),
// then runs the app's OWN leaderboard fetchers on an in-memory copy, so every rank is the app's logic.
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = 'D:/ZZWES/wApps/Badminton_v2_app/badminton-v2'
const PROD_REF = 'ensdfitpeyreunihkqkh'
const token = readFileSync(`${ROOT}/.env.prod`, 'utf8').match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*['"]?([^'"\r\n]+)/m)?.[1]
if (!token) throw new Error('no SUPABASE_ACCESS_TOKEN in .env.prod')

async function sql(query: string): Promise<any[]> {
  if (!/^\s*select/i.test(query)) throw new Error('read-only: SELECT only')
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROD_REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`)
  return r.json()
}

const T: Record<string, any[]> = {}
for (const t of ['player_stats', 'profiles', 'sessions', 'session_registrations', 'matches', 'match_results', 'player_cheer_stats']) {
  T[t] = await sql(`select * from public.${t}`)
}
console.log('rows:', Object.entries(T).map(([k, v]) => `${k}=${v.length}`).join(' '))

// ---- minimal in-memory PostgREST-style builder: covers exactly the calls the board fetchers make ----
const FK: Record<string, Record<string, { table: string; local: string; remote: string; many: boolean }>> = {
  matches: { match_results: { table: 'match_results', local: 'id', remote: 'match_id', many: true },
             sessions: { table: 'sessions', local: 'session_id', remote: 'id', many: false } },
  session_registrations: { sessions: { table: 'sessions', local: 'session_id', remote: 'id', many: false } },
}
function from(table: string) {
  let rows = () => T[table].map((r) => ({ ...r }))
  const filters: Array<(r: any) => boolean> = []
  const orders: Array<[string, boolean]> = []
  let lim: number | null = null, rng: [number, number] | null = null, head = false, count = false
  const inner: string[] = []
  const get = (r: any, col: string) => col.includes('.') ? r[col.split('.')[0]]?.[col.split('.')[1]] : r[col]
  const b: any = {
    select(cols: string, opts?: { count?: string; head?: boolean }) {
      head = !!opts?.head; count = opts?.count === 'exact'
      const embeds = [...cols.matchAll(/(\w+)(!inner)?\(([^)]*)\)/g)]
      const base = rows
      rows = () => base().map((r) => {
        for (const [, name, inn] of embeds) {
          const fk = FK[table][name]
          const hits = T[fk.table].filter((x) => x[fk.remote] === r[fk.local])
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
        return Promise.resolve({ data: head ? null : out, error: null, count: count ? total : null }).then(res, rej)
      } catch (e) { return Promise.resolve({ data: null, error: e, count: null }).then(res, rej) }
    },
  }
  return b
}

const { supabase } = await import(`${ROOT}/src/lib/supabase`)
;(supabase as any).from = from
;(supabase as any).rpc = () => { throw new Error('rpc not mocked') }

const { fetchAllTimeLeaderboard, fetchCheerLeaderboard, fetchPairLeaderboard } = await import(`${ROOT}/src/lib/leaderboardData`)
const { fetchAwardsLeaderboard } = await import(`${ROOT}/src/lib/awardsLeaderboard`)
const { fetchEligiblePlayerIds } = await import(`${ROOT}/src/lib/boardEligibility`)
const { rankCheerShares } = await import(`${ROOT}/src/lib/cheerShare`)
const { CHEER_CATEGORIES } = await import(`${ROOT}/src/lib/cheerTypes`)
const { formatDisplayName } = await import(`${ROOT}/src/lib/formatDisplayName`)

const individual = await fetchAllTimeLeaderboard()
const pairs = await fetchPairLeaderboard()
const awards = await fetchAwardsLeaderboard()
const cheerRows = await fetchCheerLeaderboard()
const eligible = [...(await fetchEligiblePlayerIds())]
const cheers = CHEER_CATEGORIES.map((c: any) => ({
  slug: c.slug, name: c.name,
  rows: rankCheerShares(cheerRows.map((e: any) => ({ playerId: e.player_id, categoryCount: c.of(e), totalReceived: e.cheers_received }))),
}))
const names: Record<string, string> = {}
for (const p of T.profiles) names[p.id] = formatDisplayName(p.nickname, p.name_slug)
const lastSessionDate = T.sessions.filter((s) => s.status === 'complete').map((s) => s.date).sort().at(-1)
const awardsOut = awards.map((a: any) => ({ key: a.key, label: a.label, rows: a.rows.map((r: any) => ({ ...r, unit: a.unit(r.value), shown: a.format ? a.format(r.value) : String(r.value) })) }))

writeFileSync(process.argv[2], JSON.stringify({ lastSessionDate, eligible, names, individual, pairs, awards: awardsOut, cheers }, null, 1))
console.log('individual', individual.length, '| pairs', pairs.length, '| awards', awards.map((a: any) => `${a.key}:${a.rows.length}`).join(' '),
  '| cheers', cheers.map((c: any) => `${c.slug}:${c.rows.length}`).join(' '), '| eligible', eligible.length, '| last session', lastSessionDate)
