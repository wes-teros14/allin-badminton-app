#!/usr/bin/env node
// scripts/neon/apply.mjs — build the app schema on a Neon branch.
//
//   NEON_DATABASE_URL="$(neon cs <branch> --project-id <id>)" node scripts/neon/apply.mjs [steps...]
//
// Steps (default: all, in this order):
//   pre         scripts/neon/pre.sql        auth.* helpers + Supabase shims
//   migrations  supabase/migrations/*.sql   in filename order, each in its own transaction
//   transform   scripts/neon/transform.sql  remove shims, repoint FKs, anon -> anonymous, Broadcast -> live_messages
//   grants      scripts/neon/grants.sql     explicit grants (never trust defaults)
//   verify      scripts/neon/verify.sql     assertions; raises on the first failure
//
// Phase 2 swaps `migrations` for a pg_dump of prod's public schema + data; pre/transform/grants
// are written against the catalog, not the migration text, so they serve both paths.
//
// MIGRATIONS_FROM=045 resumes the migrations step at that file (each file commits on its own).
//
// The connection string comes only from the environment and is never printed.
// Needs `pg` (npm i -D pg, or NODE_PATH pointing at a folder that has it).

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const pg = require('pg')

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..') // badminton-v2/
const url = process.env.NEON_DATABASE_URL
if (!url) {
  console.error('NEON_DATABASE_URL is not set')
  process.exit(2)
}

const CRLF = /\r\n/g

// Read SQL as LF. A Windows checkout (core.autocrlf=true) has CRLF files; applied as-is, every
// function body keeps the carriage returns and its prosrc no longer matches prod's.
const readSql = (f) => fs.readFileSync(f, 'utf8').replace(CRLF, '\n')

// Text-level edits for what no catalog transform can fix: extensions Neon must not load.
// pg_cron is replaced by the cron.* shim in pre.sql; pg_net was dropped by migration 083.
const preprocessMigration = (sql) =>
  sql.replace(/create\s+extension\s+if\s+not\s+exists\s+(pg_cron|pg_net)\s*;/gi, '-- [neon] skipped: $&')

const steps = process.argv.slice(2)
const all = ['pre', 'migrations', 'transform', 'grants', 'verify']
const run = steps.length ? steps : all
for (const s of run) if (!all.includes(s)) throw new Error(`unknown step ${s}`)

const client = new pg.Client({ connectionString: url.replace(/sslmode=require/, 'sslmode=verify-full') })
await client.connect()
client.on('notice', (n) => console.log(`  notice: ${n.message}`))

async function runFile(label, sql) {
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    console.log(`ok   ${label}`)
  } catch (e) {
    await client.query('rollback').catch(() => {})
    console.error(`FAIL ${label}: ${e.code ?? ''} ${e.message}`)
    if (e.position) {
      const p = Number(e.position)
      console.error('     near: ' + JSON.stringify(sql.slice(Math.max(0, p - 120), p + 80)))
    }
    await client.end()
    process.exit(1)
  }
}

for (const step of run) {
  if (step === 'migrations') {
    const dir = path.join(root, 'supabase', 'migrations')
    const from = process.env.MIGRATIONS_FROM ?? ''
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql') && f >= from).sort()
    for (const f of files) await runFile(`migrations/${f}`, preprocessMigration(readSql(path.join(dir, f))))
  } else {
    await runFile(`${step}.sql`, readSql(path.join(here, `${step}.sql`)))
  }
}
await client.end()
