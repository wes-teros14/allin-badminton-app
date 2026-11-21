#!/usr/bin/env node
// scripts/neon/run-prod.mjs — run one SQL file (or -e "<sql>") on Neon `production`, in one transaction.
// ONLY with the owner's OK for that exact change (project rule: dev first, then production with OK).
//
//   NEON_DATABASE_URL="$(neon connection-string production --project-id lucky-heart-02739020)" \
//     node scripts/neon/run-prod.mjs --yes-production scripts/neon/migrations/092_session_photos.sql
//
// Refuses unless the host is production's endpoint and --yes-production is passed. The connection
// string comes only from the environment and is never printed.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const pg = createRequire(import.meta.url)('pg')
const PROD_ENDPOINT = 'ep-small-river-aox8dd9u'
const args = process.argv.slice(2)
if (args[0] !== '--yes-production') {
  console.error('refusing: pass --yes-production (owner OK required)')
  process.exit(2)
}
const url = process.env.NEON_DATABASE_URL ?? ''
if (!url || !new URL(url).hostname.startsWith(PROD_ENDPOINT)) {
  console.error('refusing: not the production endpoint')
  process.exit(2)
}
const sql = args[1] === '-e' ? args[2] : fs.readFileSync(args[1], 'utf8').replace(/\r\n/g, '\n')
const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query('begin')
  const res = await client.query(sql)
  await client.query('commit')
  for (const r of [res].flat()) if (r.rows?.length) console.table(r.rows)
  console.log('ok (production)')
} catch (e) {
  await client.query('rollback')
  console.error('rolled back:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
