#!/usr/bin/env node
// scripts/neon/run-dev.mjs — run one SQL file (or -e "<sql>") on the Neon `dev` branch ONLY, in one
// transaction, printing any result rows. Refuses unless the connection host is dev's endpoint.
//
//   NEON_DATABASE_URL="$(neon cs dev)" node scripts/neon/run-dev.mjs scripts/neon/seed-dev.sql
//
// The connection string comes only from the environment and is never printed.
// Needs `pg` (npm i -D pg, or NODE_PATH pointing at a folder that has it), like apply.mjs.
import fs from 'node:fs'
import { createRequire } from "node:module"
const pg = createRequire(import.meta.url)("pg")
const DEV_ENDPOINT = 'ep-blue-recipe-aodxyifb'
// Without NEON_DATABASE_URL, fall back to NEON_DEV_URL from badminton-v2/.env.schedule (the scheduler's
// file), so a PC without the Neon CLI can still run dev SQL. The value is never printed.
function devUrlFromScheduleFile() {
  const file = new URL('../../.env.schedule', import.meta.url)
  if (!fs.existsSync(file)) return ''
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('NEON_DEV_URL='))
  return line ? line.slice('NEON_DEV_URL='.length).trim().replace(/^["']|["']$/g, '') : ''
}
const url = process.env.NEON_DATABASE_URL || devUrlFromScheduleFile()
if (!new URL(url).hostname.startsWith(DEV_ENDPOINT)) {
  console.error('refusing: not the dev endpoint')
  process.exit(2)
}
const sql = process.argv[2] === '-e' ? process.argv[3] : fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n')
const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query('begin')
  const res = await client.query(sql)
  await client.query('commit')
  for (const r of [res].flat()) if (r.rows?.length) console.table(r.rows)
  console.log('ok')
} catch (e) {
  await client.query('rollback')
  console.error('rolled back:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
