// scripts/schedule/schedule.ts — make a session's match schedule from the command line, with the app's own engine.
//
// Same engine, same defaults and same settings → options mapping as the admin Match Generator panel
// (src/lib/generatorSettings.ts). `save` writes exactly what the panel's Lock button writes: the matches in
// queue order, status `schedule_locked`, and the settings into `sessions.generator_settings`.
//
//   npm run schedule -- sessions                       list recent sessions (pick one by date or id prefix)
//   npm run schedule -- show <session>                 roster, courts, saved settings, presets
//   npm run schedule -- generate <session> [options]   run the engine, print it, keep it as the draft
//   npm run schedule -- save <session> --confirm       lock the draft into the session (only from registration_closed)
//
// Target: Neon `dev` by default; add --prod for the live database. Connection strings are read at runtime from
// badminton-v2/.env.schedule (NEON_DEV_URL=..., NEON_PROD_URL=...) or the same names in the environment, are
// checked against each branch's endpoint, and are never printed.
//
// <session>: a date (2026-11-22), an id or id prefix, or `next` (the soonest session that is not complete).
//
// generate options (later ones win):
//   --preset "<name>"         start from a saved generator preset instead of the defaults
//   --from <session>          start from another session's saved settings (pins/wishlist not copied)
//   --set key=value           any setting, e.g. --set maxSpreadLimit=3 --set numMatches=14 (repeatable)
//   --disable k1,k2 / --enable k1,k2   switch scoring weights off/on (sent to the engine as 0)
//   --pin "A,B v C,D"         fix the next opening game (repeatable, in game order, at most court count)
//   --wish "a-b, c-d"         wishlist pairs (nickname or slug)
//   --no-pins / --no-wish     clear pins/wishlist inherited from --from
//   --quick                   200 trials x 10 starts instead of the panel's 2000 x 50 (for trying ideas)
//
// Drafts live in <repo>/temporary_files/schedule-drafts/ (gitignored). `save` refuses when the roster changed
// since the draft was made, when the session already has matches, or when its status is not registration_closed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import {
  computeMatchType,
  forcedOpeningRepeats,
  generateScheduleOptimized,
  type AuditData,
  type GeneratedMatch,
  type PinnedMatch,
  type PlayerInput,
} from '../../src/lib/matchGenerator'
import {
  DEFAULT_GENERATOR_SETTINGS,
  WEIGHT_KEYS,
  buildGenerateOptions,
  buildRosterVersion,
  countPinnedPrefix,
  effectiveNumMatches,
  resolveWishlist,
  toPresetSettings,
  type GeneratorSettings,
} from '../../src/lib/generatorSettings'
import { validateMatchPlayers, validateSchedulePlayers } from '../../src/lib/matchPlayers'
import { disambiguateDisplayNames, formatDisplayName } from '../../src/lib/formatDisplayName'
import { buildRegisteredPlayers } from '../../src/lib/registeredPlayers'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(HERE, '..', '..') // badminton-v2/
const DRAFT_DIR = resolve(APP_ROOT, '..', 'temporary_files', 'schedule-drafts')

const TARGETS = {
  dev: { envKey: 'NEON_DEV_URL', endpoint: 'ep-blue-recipe-aodxyifb', label: 'Neon dev' },
  prod: { envKey: 'NEON_PROD_URL', endpoint: 'ep-small-river-aox8dd9u', label: 'Neon PRODUCTION (live site)' },
} as const
type Target = keyof typeof TARGETS

// ---------------------------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------------------------
interface Args { positional: string[]; flags: Map<string, string[]> }

const BOOLEAN_FLAGS = new Set(['prod', 'confirm', 'quick', 'no-pins', 'no-wish', 'json'])

function parseArgs(argv: string[]): Args {
  const positional: string[] = []
  const flags = new Map<string, string[]>()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2)
      let value: string
      if (eq > 0) value = a.slice(eq + 1)
      else if (BOOLEAN_FLAGS.has(name)) value = 'true'
      else {
        value = argv[++i]
        if (value === undefined) fail(`--${name} needs a value`)
      }
      flags.set(name, [...(flags.get(name) ?? []), value])
    } else positional.push(a)
  }
  return { positional, flags }
}

function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------------------------------------------
function readEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

async function connect(target: Target): Promise<pg.Client> {
  const { envKey, endpoint } = TARGETS[target]
  const url = process.env[envKey] ?? readEnvFile(join(APP_ROOT, '.env.schedule'))[envKey]
  if (!url) fail(`${envKey} is not set (put it in badminton-v2/.env.schedule)`)
  let host: string
  try { host = new URL(url).hostname } catch { fail(`${envKey} is not a valid connection URL`) }
  if (!host.startsWith(endpoint)) fail(`refusing: ${envKey} does not point at the ${target} endpoint (${endpoint})`)
  const client = new pg.Client({ connectionString: url.replace(/sslmode=require/, 'sslmode=verify-full') })
  await client.connect()
  return client
}

// ---------------------------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------------------------
interface SessionRow {
  id: string
  name: string
  date: string
  time: string | null
  venue: string | null
  status: string
  court_count: number
  generator_settings: Partial<GeneratorSettings> | null
}

const SESSION_COLS = `id, name, date::text as date, time, venue, status::text as status, court_count, generator_settings`

async function findSession(db: pg.Client, ref: string): Promise<SessionRow> {
  let rows: SessionRow[]
  if (ref === 'next') {
    rows = (await db.query(
      `select ${SESSION_COLS} from sessions where status <> 'complete' order by date asc, time asc nulls last limit 1`,
    )).rows
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(ref)) {
    rows = (await db.query(`select ${SESSION_COLS} from sessions where date = $1 order by time`, [ref])).rows
  } else if (/^[0-9a-f-]{4,36}$/i.test(ref)) {
    rows = (await db.query(`select ${SESSION_COLS} from sessions where id::text like $1`, [`${ref.toLowerCase()}%`])).rows
  } else fail(`"${ref}" is not a date, an id prefix or "next"`)
  if (rows.length === 0) fail(`no session matches "${ref}"`)
  if (rows.length > 1) {
    fail(`"${ref}" matches ${rows.length} sessions: ${rows.map((r) => `${r.id.slice(0, 8)} ${r.name}`).join(', ')} — use an id prefix`)
  }
  return rows[0]
}

/** Same rows and same merge as useRegisteredPlayers (registration override ?? profile). */
async function loadRoster(db: pg.Client, sessionId: string): Promise<PlayerInput[]> {
  const regs = (await db.query(
    `select player_id, gender::text as gender, level from session_registrations where session_id = $1`,
    [sessionId],
  )).rows
  if (regs.length === 0) return []
  const profiles = (await db.query(
    `select id, name_slug, nickname, gender::text as gender, level from profiles where id = any($1::uuid[])`,
    [regs.map((r) => r.player_id)],
  )).rows
  return buildRegisteredPlayers(regs, profiles)
}

function nameLabels(players: PlayerInput[]): Map<string, string> {
  return disambiguateDisplayNames(players.map((p) => ({
    id: p.id, nameSlug: p.nameSlug, displayName: formatDisplayName(p.nickname, p.nameSlug),
  })))
}

/** Finds one registered player by display name, nickname or slug; a unique prefix is enough. */
function resolvePlayer(name: string, players: PlayerInput[], labels: Map<string, string>): string {
  const q = name.trim().toLowerCase()
  const keys = (p: PlayerInput) => [labels.get(p.id) ?? '', p.nickname ?? '', p.nameSlug].map((k) => k.toLowerCase()).filter(Boolean)
  const exact = players.filter((p) => keys(p).includes(q))
  if (exact.length === 1) return exact[0].id
  const prefix = players.filter((p) => keys(p).some((k) => k.startsWith(q)))
  if (prefix.length === 1) return prefix[0].id
  if (exact.length + prefix.length === 0) fail(`"${name}" is not registered for this session`)
  fail(`"${name}" is ambiguous: ${[...new Set([...exact, ...prefix])].map((p) => labels.get(p.id)).join(', ')}`)
}

// ---------------------------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------------------------
const NUMERIC_KEYS = Object.entries(DEFAULT_GENERATOR_SETTINGS)
  .filter(([, v]) => typeof v === 'number').map(([k]) => k) as Array<keyof GeneratorSettings>

function applySet(settings: GeneratorSettings, assignment: string): void {
  const eq = assignment.indexOf('=')
  if (eq < 1) fail(`--set needs key=value, got "${assignment}"`)
  const key = assignment.slice(0, eq).trim() as keyof GeneratorSettings
  const raw = assignment.slice(eq + 1).trim()
  if (NUMERIC_KEYS.includes(key)) {
    const n = Number(raw)
    if (!Number.isFinite(n)) fail(`${key} must be a number, got "${raw}"`)
    ;(settings as unknown as Record<string, number>)[key] = n
  } else if (key === 'disableGenderRules') {
    if (!['true', 'false'].includes(raw)) fail('disableGenderRules must be true or false')
    settings.disableGenderRules = raw === 'true'
  } else if (key === 'wishlistStr') {
    settings.wishlistStr = raw
  } else {
    fail(`unknown setting "${key}". Known: ${[...NUMERIC_KEYS, 'disableGenderRules', 'wishlistStr'].join(', ')}`)
  }
}

function splitList(values: string[] | undefined): string[] {
  return (values ?? []).flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean)
}

async function buildSettings(
  db: pg.Client, args: Args, session: SessionRow, players: PlayerInput[], labels: Map<string, string>,
): Promise<GeneratorSettings> {
  const settings: GeneratorSettings = structuredClone(DEFAULT_GENERATOR_SETTINGS)

  const presetName = args.flags.get('preset')?.at(-1)
  if (presetName) {
    const rows = (await db.query(`select name, settings from generator_presets where lower(name) = lower($1)`, [presetName])).rows
    if (rows.length === 0) {
      const all = (await db.query(`select name from generator_presets order by name`)).rows.map((r) => r.name)
      fail(`no preset "${presetName}". Presets: ${all.join(', ') || '(none)'}`)
    }
    Object.assign(settings, toPresetSettings({ ...settings, ...rows[0].settings }))
  }

  const fromRef = args.flags.get('from')?.at(-1)
  if (fromRef) {
    const from = await findSession(db, fromRef)
    if (!from.generator_settings) fail(`session ${from.id.slice(0, 8)} has no saved settings`)
    // Pins and wishlist name that week's players; copy them only if everyone is still registered.
    Object.assign(settings, from.generator_settings)
    const registered = new Set(players.map((p) => p.id))
    const pinsOk = (settings.pinnedGames ?? []).every((row) => !row || Object.values(row).every((id) => registered.has(id)))
    if (!pinsOk) {
      console.log(`note: --from pins dropped (a pinned player is not registered here)`)
      settings.pinnedGames = []
    }
  }

  for (const s of args.flags.get('set') ?? []) applySet(settings, s)

  const weightKeys = WEIGHT_KEYS as readonly string[]
  for (const key of splitList(args.flags.get('disable'))) {
    if (!weightKeys.includes(key)) fail(`--disable: unknown weight "${key}". Weights: ${weightKeys.join(', ')}`)
    if (!settings.disabledWeights.includes(key)) settings.disabledWeights = [...settings.disabledWeights, key]
  }
  for (const key of splitList(args.flags.get('enable'))) {
    settings.disabledWeights = settings.disabledWeights.filter((k) => k !== key)
  }

  if (args.flags.has('no-wish')) settings.wishlistStr = ''
  const wish = args.flags.get('wish')
  if (wish) settings.wishlistStr = wish.join(', ')

  if (args.flags.has('no-pins')) settings.pinnedGames = []
  const pins = args.flags.get('pin')
  if (pins) {
    settings.pinnedGames = pins.map((text) => {
      const sides = text.split(/\s+(?:v|vs)\s+/i)
      const team = (side: string | undefined) => (side ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const t1 = team(sides[0]), t2 = team(sides[1])
      if (sides.length !== 2 || t1.length !== 2 || t2.length !== 2) fail(`--pin "${text}": write it as "A,B v C,D"`)
      const [t1p1, t1p2, t2p1, t2p2] = [...t1, ...t2].map((n) => resolvePlayer(n, players, labels))
      return { t1p1, t1p2, t2p1, t2p2 }
    })
  }
  if (countPinnedPrefix(settings.pinnedGames) > session.court_count) {
    fail(`${countPinnedPrefix(settings.pinnedGames)} pinned games but only ${session.court_count} court(s) — pins are the games that start together`)
  }

  if (args.flags.has('quick')) {
    settings.numTrials = 200
    settings.numStarts = 10
  }
  return settings
}

/** Mirrors the panel's resolvePinnedMatches: hard errors fail, soft problems warn. */
function resolvePins(settings: GeneratorSettings, players: PlayerInput[], labels: Map<string, string>, courtCount: number): PinnedMatch[] {
  const rows = settings.pinnedGames.slice(0, courtCount)
  const registered = new Set(players.map((p) => p.id))
  const levelOf = new Map(players.map((p) => [p.id, p.level ?? 5]))
  const seen = new Map<string, number>()
  const pins: PinnedMatch[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) break
    const game = i + 1
    const ids = [row.t1p1, row.t1p2, row.t2p1, row.t2p2]
    if (ids.some((id) => !id)) fail(`Game ${game}: a pin needs all four players`)
    const v = validateMatchPlayers(ids, (id) => labels.get(id) ?? 'This player')
    if (!v.ok) fail(`Game ${game}: ${v.message}`)
    const missing = ids.find((id) => !registered.has(id))
    if (missing) fail(`Game ${game}: a pinned player is no longer registered`)
    for (const id of ids) {
      const earlier = seen.get(id)
      if (earlier !== undefined) console.log(`warning: ${labels.get(id)} is in both Game ${earlier} and Game ${game} — they start at the same time`)
      seen.set(id, game)
    }
    const levels = ids.map((id) => Math.round(levelOf.get(id) ?? 5))
    const spread = Math.max(...levels) - Math.min(...levels)
    if (spread > settings.maxSpreadLimit) console.log(`warning: Game ${game} exceeds the skill gap limit (spread ${spread})`)
    pins.push({ team1: [row.t1p1, row.t1p2], team2: [row.t2p1, row.t2p2] })
  }
  return pins
}

// ---------------------------------------------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------------------------------------------
function settingsDiff(settings: Partial<GeneratorSettings>, labels: Map<string, string>): string[] {
  const out: string[] = []
  for (const [k, def] of Object.entries(DEFAULT_GENERATOR_SETTINGS)) {
    const v = (settings as Record<string, unknown>)[k]
    if (v === undefined) continue
    if (k === 'pinnedGames') {
      const rows = (v as GeneratorSettings['pinnedGames']).filter(Boolean)
      rows.forEach((r, i) => r && out.push(`pin game ${i + 1}: ${labels.get(r.t1p1) ?? r.t1p1} & ${labels.get(r.t1p2) ?? r.t1p2} v ${labels.get(r.t2p1) ?? r.t2p1} & ${labels.get(r.t2p2) ?? r.t2p2}`))
      continue
    }
    if (JSON.stringify(v) !== JSON.stringify(def)) out.push(`${k} = ${JSON.stringify(v)} (default ${JSON.stringify(def)})`)
  }
  return out
}

function printRoster(players: PlayerInput[], labels: Map<string, string>): void {
  const sorted = [...players].sort((a, b) => (labels.get(a.id) ?? '').localeCompare(labels.get(b.id) ?? ''))
  const m = players.filter((p) => p.gender === 'M').length
  const f = players.filter((p) => p.gender === 'F').length
  console.log(`\nRoster: ${players.length} players (${m} M, ${f} F${players.length - m - f ? `, ${players.length - m - f} no gender` : ''})`)
  for (const p of sorted) console.log(`  ${(labels.get(p.id) ?? '').padEnd(22)} ${p.gender ?? '-'}  L${p.level ?? '?'}`)
}

function printSchedule(matches: GeneratedMatch[], players: PlayerInput[], labels: Map<string, string>, courtCount: number, pinCount: number): void {
  const n = (id: string) => labels.get(id) ?? id.slice(0, 8)
  const genderMap = new Map(players.map((p) => [p.id, p.gender ?? 'M']))
  console.log(`\nSchedule (${matches.length} games; games 1-${courtCount} start together)`)
  for (const [i, m] of matches.entries()) {
    const type = m.type || computeMatchType(m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2, genderMap)
    const t1 = `${n(m.team1Player1)} & ${n(m.team1Player2)}`
    const t2 = `${n(m.team2Player1)} & ${n(m.team2Player2)}`
    const tag = i < pinCount ? ' [pinned]' : ''
    console.log(`  ${String(i + 1).padStart(2)}  ${t1.padEnd(32)} v  ${t2.padEnd(32)} ${String(m.team1Level).padStart(2)}-${String(m.team2Level).padEnd(2)} ${type}${tag}`)
  }

  // Per player: which games, and the shortest rest between two of them.
  console.log(`\nPer player (games · shortest rest between games)`)
  const gamesOf = new Map<string, number[]>(players.map((p) => [p.id, []]))
  matches.forEach((m, i) => [m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2].forEach((id) => gamesOf.get(id)?.push(i + 1)))
  const rows = [...gamesOf.entries()].sort((a, b) => n(a[0]).localeCompare(n(b[0])))
  for (const [id, games] of rows) {
    const gaps = games.slice(1).map((g, i) => g - games[i] - 1)
    const minRest = gaps.length ? Math.min(...gaps) : null
    console.log(`  ${n(id).padEnd(22)} ${String(games.length).padStart(2)} games  [${games.join(', ')}]${minRest !== null ? `  rest ≥ ${minRest}` : ''}`)
  }
}

function printAudit(audit: AuditData, courtCount: number, playerCount: number): void {
  const forced = forcedOpeningRepeats(courtCount, playerCount)
  console.log(`\nAudit`)
  console.log(`  score ${Math.round(audit.score)}`)
  console.log(`  participation gap ${audit.participationGap} · back-to-back violations ${audit.streakViolations} · repeat partners ${audit.repeatPartners}`)
  console.log(`  level gaps (team diff total) ${audit.levelGaps} · wide-spread games ${audit.wideGaps}`)
  console.log(`  mixed ${audit.mixedDoubles} · MM v FF ${audit.genderSplitMatches} · 3-1 ${audit.unevenGenderMatches}`)
  console.log(`  rest-spacing deviations ${audit.restSpacingDeviations} · clean early gaps ${audit.earlyRestClean}`)
  console.log(`  first-on-court repeats ${audit.openingRepeats} (forced minimum ${forced}) · wishes granted ${audit.wishesGranted}`)
}

// ---------------------------------------------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------------------------------------------
interface Draft {
  target: Target
  sessionId: string
  sessionName: string
  rosterVersion: string
  courtCount: number
  settings: GeneratorSettings
  matches: GeneratedMatch[]
  audit: AuditData
  createdAt: string
}

const draftPath = (target: Target, sessionId: string) => join(DRAFT_DIR, `${target}-${sessionId}.json`)

// ---------------------------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------------------------
async function cmdSessions(db: pg.Client, args: Args): Promise<void> {
  const limit = Number(args.flags.get('limit')?.at(-1) ?? 12)
  const rows = (await db.query(
    `select s.id, s.name, s.date::text as date, s.time, s.status::text as status, s.court_count,
            (select count(*) from session_registrations r where r.session_id = s.id)::int as players,
            (select count(*) from matches m where m.session_id = s.id)::int as games,
            s.generator_settings is not null as has_settings
       from sessions s order by s.date desc, s.time desc nulls last limit $1`,
    [limit],
  )).rows
  console.log(`\n  id        date        status                players games courts  name`)
  for (const r of rows) {
    console.log(`  ${r.id}  ${r.date}  ${r.status.padEnd(20)}  ${String(r.players).padStart(7)} ${String(r.games).padStart(5)} ${String(r.court_count).padStart(6)}  ${r.name}`)
  }
}

async function cmdShow(db: pg.Client, session: SessionRow): Promise<void> {
  const players = await loadRoster(db, session.id)
  const labels = nameLabels(players)
  printSessionHeader(session)
  printRoster(players, labels)
  if (players.length >= 4) {
    const games = effectiveNumMatches(DEFAULT_GENERATOR_SETTINGS, players.length)
    console.log(`\nDefaults would make ${games} games → ${(games * 4 / players.length).toFixed(2)} each`)
  }
  if (session.generator_settings) {
    const diff = settingsDiff(session.generator_settings, labels)
    console.log(`\nSaved settings (vs defaults): ${diff.length ? '' : 'all defaults'}`)
    for (const line of diff) console.log(`  ${line}`)
  } else console.log(`\nSaved settings: none`)
  const presets = (await db.query(`select name from generator_presets order by name`)).rows.map((r) => r.name)
  console.log(`Presets: ${presets.join(', ') || '(none)'}`)
  const games = (await db.query(`select count(*)::int as n from matches where session_id = $1`, [session.id])).rows[0].n
  if (games > 0) console.log(`This session already has ${games} games in the database.`)
}

function printSessionHeader(session: SessionRow): void {
  console.log(`\n${session.name} — ${session.date}${session.time ? ` ${session.time}` : ''}${session.venue ? ` @ ${session.venue}` : ''}`)
  console.log(`id ${session.id} · status ${session.status} · ${session.court_count} court(s)`)
}

async function cmdGenerate(db: pg.Client, target: Target, session: SessionRow, args: Args): Promise<void> {
  const players = await loadRoster(db, session.id)
  if (players.length < 4) fail(`only ${players.length} registered — need at least 4`)
  const labels = nameLabels(players)
  const settings = await buildSettings(db, args, session, players, labels)

  // Same data guard as the panel's Generate button.
  const issues = players.flatMap((p) => {
    const missing = [p.level == null && 'level', !settings.disableGenderRules && !p.gender && 'gender'].filter(Boolean)
    return missing.length ? [`${labels.get(p.id)} (no ${missing.join(', ')})`] : []
  })
  if (issues.length) fail(`fix player data first: ${issues.join(' · ')}`)

  const unresolved = resolveWishlist(settings.wishlistStr, players).unresolved
  if (unresolved.length) console.log(`warning: wishlist entries not matched to registered players: ${unresolved.join(', ')}`)

  const pins = resolvePins(settings, players, labels, session.court_count)
  printSessionHeader(session)
  const diff = settingsDiff(settings, labels)
  console.log(`Settings vs defaults: ${diff.length ? '' : 'all defaults'}`)
  for (const line of diff) console.log(`  ${line}`)

  const started = Date.now()
  const result = generateScheduleOptimized(players, buildGenerateOptions(settings, players, session.court_count, pins))
  console.log(`(engine: ${settings.numTrials} trials x ${settings.numStarts} starts, ${((Date.now() - started) / 1000).toFixed(1)} s)`)

  printSchedule(result.matches, players, labels, session.court_count, pins.length)
  printAudit(result.audit, session.court_count, players.length)

  // The engine drops a game it cannot fill rather than failing; the panel does not say so either.
  const requested = effectiveNumMatches(settings, players.length)
  if (result.matches.length < requested) {
    console.log(`\nwarning: asked for ${requested} games, got ${result.matches.length}. Usually the skill-gap limit ` +
      `(maxSpreadLimit=${settings.maxSpreadLimit}) leaves a player with no valid foursome — check who has fewer games.`)
  }

  const draft: Draft = {
    target,
    sessionId: session.id,
    sessionName: session.name,
    rosterVersion: buildRosterVersion(players),
    courtCount: session.court_count,
    settings,
    matches: result.matches,
    audit: result.audit,
    createdAt: new Date().toISOString(),
  }
  mkdirSync(DRAFT_DIR, { recursive: true })
  writeFileSync(draftPath(target, session.id), JSON.stringify(draft, null, 2))
  console.log(`\nDraft kept. To lock exactly this schedule: npm run schedule -- save ${session.id}${target === 'prod' ? ' --prod' : ''} --confirm`)
}

async function cmdSave(db: pg.Client, target: Target, session: SessionRow, args: Args): Promise<void> {
  const file = draftPath(target, session.id)
  if (!existsSync(file)) fail(`no draft for this session on ${target} — run generate first`)
  const draft = JSON.parse(readFileSync(file, 'utf8')) as Draft
  if (draft.target !== target || draft.sessionId !== session.id) fail('draft does not belong to this session/target')

  const players = await loadRoster(db, session.id)
  const labels = nameLabels(players)
  if (buildRosterVersion(players) !== draft.rosterVersion) {
    fail('the roster (players, genders or levels) changed since the draft was made — generate again')
  }
  // A --quick run is for trying ideas (it left back-to-back games in testing) and its trial counts would be
  // stored as the session's settings, so the panel would reuse them after an unlock.
  if (draft.settings.numTrials < DEFAULT_GENERATOR_SETTINGS.numTrials || draft.settings.numStarts < DEFAULT_GENERATOR_SETTINGS.numStarts) {
    fail(`this draft was made with fewer trials than the panel (${draft.settings.numTrials}x${draft.settings.numStarts}) — generate again without --quick`)
  }
  if (draft.courtCount !== session.court_count) fail(`court count changed (${draft.courtCount} → ${session.court_count}) — generate again`)
  const valid = validateSchedulePlayers(draft.matches, (id) => labels.get(id) ?? id)
  if (!valid.ok) fail(valid.message)

  printSessionHeader(session)
  console.log(`Draft from ${draft.createdAt}: ${draft.matches.length} games, score ${Math.round(draft.audit.score)}`)
  if (!args.flags.has('confirm')) {
    console.log(`\nNot saved. Re-run with --confirm to lock it into ${TARGETS[target].label}.`)
    return
  }

  await db.query('begin')
  try {
    const locked = (await db.query(`select status::text as status from sessions where id = $1 for update`, [session.id])).rows[0]
    if (locked.status !== 'registration_closed') {
      throw new Error(`session status is ${locked.status}; the schedule can only be locked from registration_closed (as in the app)`)
    }
    const existing = (await db.query(`select count(*)::int as n from matches where session_id = $1`, [session.id])).rows[0].n
    if (existing > 0) throw new Error(`session already has ${existing} games — unlock it in the app first`)

    // What useSession.lockSchedule inserts: queue_position 1..n and the four players; everything else defaults.
    const values: unknown[] = []
    const tuples = draft.matches.map((m, i) => {
      values.push(session.id, i + 1, m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2)
      const b = i * 6
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`
    })
    await db.query(
      `insert into matches (session_id, queue_position, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id)
       values ${tuples.join(', ')}`,
      values,
    )
    // Then MatchGeneratorPanel.handleLock: status, and the settings that produced it.
    await db.query(
      `update sessions set status = 'schedule_locked', generator_settings = $2::jsonb where id = $1`,
      [session.id, JSON.stringify(draft.settings)],
    )
    await db.query('commit')
  } catch (e) {
    await db.query('rollback')
    fail(`not saved (rolled back): ${(e as Error).message}`)
  }
  const n = (await db.query(`select count(*)::int as n from matches where session_id = $1`, [session.id])).rows[0].n
  console.log(`\nLocked: ${n} games written, status schedule_locked, settings saved (${TARGETS[target].label}).`)
}

// ---------------------------------------------------------------------------------------------------------------
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const [command, ref] = args.positional
  const target: Target = args.flags.has('prod') ? 'prod' : 'dev'
  if (!command || !['sessions', 'show', 'generate', 'save'].includes(command)) {
    console.log('usage: npm run schedule -- <sessions|show|generate|save> [session] [--prod] [options]  (see the header of scripts/schedule/schedule.ts)')
    process.exit(command ? 1 : 0)
  }
  const db = await connect(target)
  console.log(`[${TARGETS[target].label}]`)
  try {
    if (command === 'sessions') return await cmdSessions(db, args)
    if (!ref) fail(`${command} needs a session: a date, an id prefix or "next"`)
    const session = await findSession(db, ref)
    if (command === 'show') return await cmdShow(db, session)
    if (command === 'generate') return await cmdGenerate(db, target, session, args)
    if (command === 'save') return await cmdSave(db, target, session, args)
  } finally {
    await db.end()
  }
}

main().catch((e) => fail((e as Error).message))
