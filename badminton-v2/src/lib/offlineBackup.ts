/**
 * The offline backup: one standalone, read-only HTML file of a session's
 * schedule, for running the night by hand if the internet or the server goes
 * down (chosen 2026-10-09, temporary_files/offline-backup-button-poc.html).
 *
 * Pure: takes the data, returns the document. Nothing in the file loads from
 * the network, so it opens in Chrome on Android with no connection.
 *
 * Two copies. The moderator copy has no levels, because moderators cannot see
 * levels in the app. The admin copy adds them and says to keep it private.
 */

export interface BackupPlayer {
  id: string
  name: string
  /** Only set for the admin copy. */
  level?: number | null
}

export interface BackupGame {
  queuePosition: number
  courtNumber: number | null
  status: 'done' | 'live' | 'queued'
  team1: readonly [string, string]
  team2: readonly [string, string]
  /** For a finished game: which pair took it, or a draw (1–1). */
  outcome: 'team1' | 'team2' | 'draw' | null
}

export interface BackupSession {
  name: string
  date: string
  time: string | null
  venue: string | null
  courtCount: number
  courtLabels: Record<number, string>
  /** The admin's ★ subs for the night (sessions.sub_picks). */
  subPicks: readonly string[]
}

export interface BackupInput {
  session: BackupSession
  players: BackupPlayer[]
  games: BackupGame[]
  withLevels: boolean
  /** e.g. "3:05 PM", shown in the banner. */
  exportedAt: string
}

/** How many names each queued game suggests as a sub. */
export const SUBS_SHOWN = 5

export interface SubSuggestion {
  playerId: string
  playedBefore: number
  isPick: boolean
  playsNextRound: boolean
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const playersOf = (g: BackupGame) => [...g.team1, ...g.team2]

/**
 * Who could step in for a game, without using levels: anyone not in it and
 * not on another court at the same time (the same round: each run of
 * `courtCount` games in queue order). The admin's ★ picks come first, then players who are not due on
 * court the very next round, then fewest games played before this one.
 */
export function suggestSubs(game: BackupGame, games: BackupGame[], players: BackupPlayer[], session: BackupSession): SubSuggestion[] {
  const courts = Math.max(1, session.courtCount)
  // Rounds by position in the queue, not by game number: numbers can have gaps
  // (a removed game), and "Game 2 and Game 3" may be the pair that starts together.
  const ordered = [...games].sort((a, b) => a.queuePosition - b.queuePosition)
  const roundOf = new Map(ordered.map((g, i) => [g.queuePosition, Math.floor(i / courts)]))
  const round = (g: BackupGame) => roundOf.get(g.queuePosition) ?? -1
  const busy = new Set(games.filter((g) => round(g) === round(game)).flatMap(playersOf))
  const nextRound = new Set(games.filter((g) => round(g) === round(game) + 1).flatMap(playersOf))
  const name = new Map(players.map((p) => [p.id, p.name]))

  return players
    .filter((p) => !busy.has(p.id))
    .map((p) => ({
      playerId: p.id,
      playedBefore: games.filter((g) => g.queuePosition < game.queuePosition && playersOf(g).includes(p.id)).length,
      isPick: session.subPicks.includes(p.id),
      playsNextRound: nextRound.has(p.id),
    }))
    .sort((a, b) =>
      Number(b.isPick) - Number(a.isPick) ||
      Number(a.playsNextRound) - Number(b.playsNextRound) ||
      a.playedBefore - b.playedBefore ||
      (name.get(a.playerId) ?? '').localeCompare(name.get(b.playerId) ?? ''),
    )
    .slice(0, SUBS_SHOWN)
}

/** "backup-october-palo-oct-4-3-05pm.html", with "-admin" for the admin copy. */
export function backupFileName(sessionName: string, date: string, exportedAt: string, withLevels: boolean): string {
  const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const parts = [slug(sessionName) || 'session', slug(day), slug(exportedAt)].filter(Boolean)
  return `backup-${parts.join('-')}${withLevels ? '-admin' : ''}.html`
}

const STYLE = `
:root{--bg:#FAF7FB;--fg:#1B1220;--card:#fff;--muted:#F1ECF6;--mfg:#6B5F73;--border:#E7E0EC;--ink:#6F3E87;--win:#15803D;--live:#B45309;--gold:#8A6A00}
@media (prefers-color-scheme:dark){:root{--bg:#0F0A18;--fg:#fff;--card:#1A1025;--muted:#1E1230;--mfg:#B39DBB;--border:#2D1A40;--ink:#D8B4F0;--win:#4ADE80;--live:#F5B84A;--gold:#FEFE6A}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.4}
.wrap{max-width:560px;margin:0 auto}.head{padding:18px 16px 12px;border-bottom:1px solid var(--border)}h1{margin:0;font-size:1.25rem}
.meta{color:var(--mfg);font-size:.82rem}.banner{margin-top:10px;background:var(--muted);border-radius:10px;padding:8px 10px;font-size:.78rem;color:var(--mfg)}.banner b{color:var(--fg)}
nav{position:sticky;top:0;display:flex;gap:6px;padding:8px 16px;background:var(--bg);border-bottom:1px solid var(--border)}
nav a{flex:1;text-align:center;min-height:40px;display:grid;place-items:center;border-radius:9px;border:1px solid var(--border);color:var(--fg);text-decoration:none;font-size:.8rem;font-weight:600;background:var(--card)}
section{padding:14px 16px 6px;scroll-margin-top:58px}h2{margin:0 0 10px;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mfg)}
.now{display:grid;grid-template-columns:1fr 1fr;gap:8px}.court{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px;font-size:.84rem}
.court .l{font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--live);font-weight:700}.next{margin-top:8px;font-size:.8rem;color:var(--mfg)}.next b{color:var(--fg)}
.game{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px}.game.done{opacity:.78}
.top{display:flex;align-items:baseline;gap:8px}.c{font-size:.76rem;color:var(--mfg)}.tag{margin-left:auto;font-size:.66rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:2px 8px;border:1px solid var(--border);color:var(--mfg)}
.tag.live{color:var(--live);border-color:currentColor}.tag.done{color:var(--win);border-color:currentColor}
.pairs{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;margin-top:6px;font-size:.86rem}.vs{font-size:.68rem;color:var(--mfg)}.r{text-align:right}
.won{color:var(--win);font-weight:700}.won::after{content:" \\2713"}.subs{margin-top:8px;border-top:1px dashed var(--border);padding-top:6px;font-size:.76rem;color:var(--mfg)}.subs b{color:var(--fg)}
.subs i{font-style:normal;opacity:.8}.star{color:var(--gold)}
.lvl{display:inline-block;font-size:.64rem;font-weight:700;border-radius:4px;padding:0 4px;margin-left:3px;background:var(--muted);color:var(--ink)}
table{width:100%;border-collapse:collapse;font-size:.82rem;font-variant-numeric:tabular-nums}th{text-align:left;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mfg);padding:6px 4px;border-bottom:1px solid var(--border)}
td{padding:7px 4px;border-bottom:1px solid var(--border);vertical-align:top}.num{text-align:right}.gl span{display:inline-block;margin:0 4px 2px 0;padding:0 6px;border-radius:6px;border:1px solid var(--border)}
.gl span.d{color:var(--mfg);text-decoration:line-through}.gl span.n{border-color:var(--ink);color:var(--ink);font-weight:700}.foot{padding:14px 16px 30px;font-size:.74rem;color:var(--mfg)}
`

/** The whole backup document. Every user-entered string is escaped. */
export function buildOfflineBackupHtml({ session, players, games, withLevels, exportedAt }: BackupInput): string {
  const byId = new Map(players.map((p) => [p.id, p]))
  const ordered = [...games].sort((a, b) => a.queuePosition - b.queuePosition)

  const nm = (id: string) => {
    const p = byId.get(id)
    const star = session.subPicks.includes(id) ? '<span class="star">★</span> ' : ''
    const level = withLevels && p?.level != null ? `<span class="lvl">L${p.level}</span>` : ''
    return `${star}${esc(p?.name ?? 'Player')}${level}`
  }
  const pair = (ids: readonly string[], won: boolean) => `<span class="${won ? 'won' : ''}">${ids.map(nm).join(' &amp; ')}</span>`
  const courtName = (c: number | null) => (c == null ? '' : esc(session.courtLabels[c] ?? `Court ${c}`))

  const when = [
    new Date(`${session.date}T${session.time ?? '00:00'}`).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      ...(session.time ? { hour: 'numeric', minute: '2-digit' } : {}),
    }),
    session.venue ? esc(session.venue) : null,
  ].filter(Boolean).join(' · ')

  const live = ordered.filter((g) => g.status === 'live')
  const queued = ordered.filter((g) => g.status === 'queued')

  const tag = (g: BackupGame) =>
    g.status === 'done' ? (g.outcome === 'draw' ? 'Draw' : 'Done') : g.status === 'live' ? 'Playing' : 'Queued'

  const card = (g: BackupGame) => {
    const subs = g.status === 'queued'
      ? suggestSubs(g, ordered, players, session)
        .map((s) => `${nm(s.playerId)} <i>(${s.playedBefore} played${s.playsNextRound ? ', plays next' : ''})</i>`)
        .join(' · ')
      : ''
    return `<div class="game ${g.status}"><div class="top"><b>Game ${g.queuePosition}</b> <span class="c">${courtName(g.courtNumber)}</span>
<span class="tag ${g.status}">${tag(g)}</span></div>
<div class="pairs"><div>${pair(g.team1, g.status === 'done' && g.outcome === 'team1')}</div><div class="vs">vs</div><div class="r">${pair(g.team2, g.status === 'done' && g.outcome === 'team2')}</div></div>
${g.status === 'queued' ? `<div class="subs"><b>If someone can’t play:</b> ${subs || 'nobody free'}</div>` : ''}</div>`
  }

  const nowBlock = live.length > 0
    ? `<div class="now">${live.map((g) => `<div class="court"><div class="l">${courtName(g.courtNumber) || 'Court'} · Playing</div><b>Game ${g.queuePosition}</b><br>${g.team1.map(nm).join(' &amp; ')}<br><span class="vs">vs</span><br>${g.team2.map(nm).join(' &amp; ')}</div>`).join('')}</div>`
    : `<p class="next">No game was on court when this was saved.</p>`
  const upNext = queued.length > 0
    ? `<div class="next">Up next: ${queued.slice(0, 2).map((g) => `<b>Game ${g.queuePosition}</b>`).join(' then ')}</div>`
    : ''

  const rows = players.map((p) => {
    const mine = ordered.filter((g) => playersOf(g).includes(p.id))
    const nextQ = mine.find((g) => g.status !== 'done')?.queuePosition
    const done = mine.filter((g) => g.status === 'done').length
    const list = mine.map((g) => `<span class="${g.status === 'done' ? 'd' : g.queuePosition === nextQ ? 'n' : ''}">G${g.queuePosition}</span>`).join('')
    return `<tr><td>${nm(p.id)}</td><td class="gl">${list || '—'}</td><td class="num">${done}/${mine.length}</td></tr>`
  }).join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Backup · ${esc(session.name)}</title><style>${STYLE}</style></head><body><div class="wrap">
<div class="head"><h1>${esc(session.name)}</h1><div class="meta">${when}</div>
<div class="banner"><b>Backup copy, saved ${esc(exportedAt)}.</b> Read-only: it doesn’t change when games finish. When the app is back, enter results and swaps there.${withLevels ? ' <b>Admin copy: contains levels, keep it private.</b>' : ''}</div></div>
<nav><a href="#now">Now</a><a href="#schedule">Schedule</a><a href="#players">Players</a></nav>
<section id="now"><h2>On court when saved</h2>${nowBlock}${upNext}</section>
<section id="schedule"><h2>Schedule · ${ordered.length} games</h2>${ordered.map(card).join('')}</section>
<section id="players"><h2>Players · ${players.length}</h2><table><thead><tr><th>Player</th><th>Games</th><th class="num">Done</th></tr></thead><tbody>${rows}</tbody></table></section>
<div class="foot">Saved from the badminton app. Open with Chrome; works without internet.</div></div></body></html>`
}
