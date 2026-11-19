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

import { getEligibleSubstitutes, rankSubstitutes, type RankedSub, type SubMatch } from '@/lib/substitutes'

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

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** Rows each subs list shows; the header still says how many are eligible (owner's call, 2026-11-19). */
export const SUBS_SHOWN = 3

const playersOf = (g: BackupGame) => [...g.team1, ...g.team2]

/** A backup game in the shape the app's sub logic reads; its id is the game number. */
const asSubMatch = (g: BackupGame): SubMatch => ({
  id: String(g.queuePosition),
  gameNumber: g.queuePosition,
  t1p1Id: g.team1[0],
  t1p2Id: g.team1[1],
  t2p1Id: g.team2[0],
  t2p2Id: g.team2[1],
})

/**
 * The subs for a playing or queued game, worked out exactly as the app's Subs
 * panel does (lib/substitutes.ts), with the courts as they were when the file
 * was saved. Not eligible: anyone on court, in the game just before or after
 * this one, or in this game. Order: the admin's ★ picks, then (with
 * `outPlayerId`) the closest level to the player who is out, then fewest games
 * tonight, then most rest before their own next game.
 *
 * The moderator copy carries no levels, so it skips the level step: its order
 * for each player is the same.
 */
export function rankBackupSubs(
  game: BackupGame,
  games: BackupGame[],
  players: BackupPlayer[],
  session: BackupSession,
  outPlayerId: string | null = null,
): RankedSub[] {
  const ordered = [...games].sort((a, b) => a.queuePosition - b.queuePosition)
  const onCourt = ordered.filter((g) => g.status === 'live').map(asSubMatch)
  const queued = ordered.filter((g) => g.status === 'queued').map(asSubMatch)
  const target = asSubMatch(game)
  const candidates = players.map((p) => ({ id: p.id, displayName: p.name }))
  return rankSubstitutes({
    target,
    eligible: getEligibleSubstitutes(target, onCourt, queued, candidates),
    allMatches: ordered.map(asSubMatch),
    queued,
    levels: new Map(players.map((p) => [p.id, p.level ?? null])),
    outPlayerId,
    picks: [...session.subPicks],
  })
}

/** The app's level label: "Lv 3", "Lv 3 (same)", "Lv 4 (+1)", "Lv ?". */
function levelText(r: RankedSub, outLevel: number | null): string {
  if (r.level == null) return 'Lv ?'
  if (outLevel == null) return `Lv ${r.level}`
  const d = r.level - outLevel
  if (d === 0) return `Lv ${r.level} (same)`
  return `Lv ${r.level} (${d > 0 ? '+' : '−'}${Math.abs(d)})`
}

/** "backup-october-palo-oct-4-3-05pm.html", with "-admin" for the admin copy. */
export function backupFileName(sessionName: string, date: string, exportedAt: string, withLevels: boolean): string {
  const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const parts = [slug(sessionName) || 'session', slug(day), slug(exportedAt)].filter(Boolean)
  return `backup-${parts.join('-')}${withLevels ? '-admin' : ''}.html`
}

const STYLE = `
:root{--bg:#FAF7FB;--fg:#1B1220;--card:#fff;--muted:#F1ECF6;--mfg:#6B5F73;--border:#E7E0EC;--ink:#6F3E87;--win:#15803D;--live:#B45309;--gold:#8A6A00;--out:#B91C1C}
@media (prefers-color-scheme:dark){:root{--bg:#0F0A18;--fg:#fff;--card:#1A1025;--muted:#1E1230;--mfg:#B39DBB;--border:#2D1A40;--ink:#D8B4F0;--win:#4ADE80;--live:#F5B84A;--gold:#FEFE6A;--out:#F87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.4}
.wrap{max-width:560px;margin:0 auto}.head{padding:18px 16px 12px;border-bottom:1px solid var(--border)}h1{margin:0;font-size:1.25rem}
.meta{color:var(--mfg);font-size:.82rem}.banner{margin-top:10px;background:var(--muted);border-radius:10px;padding:8px 10px;font-size:.78rem;color:var(--mfg)}.banner b{color:var(--fg)}
nav{position:sticky;top:0;display:flex;gap:6px;padding:8px 16px;background:var(--bg);border-bottom:1px solid var(--border)}
nav label{flex:1;cursor:pointer;text-align:center;min-height:40px;display:grid;place-items:center;border-radius:9px;border:1px solid var(--border);color:var(--fg);font-size:.8rem;font-weight:600;background:var(--card)}
.wrap>input{position:absolute;opacity:0;pointer-events:none}.wrap>section{display:none}
#tab-schedule:checked~#schedule,#tab-players:checked~#players{display:block}
#tab-schedule:checked~nav [for=tab-schedule],#tab-players:checked~nav [for=tab-players]{background:var(--ink);border-color:var(--ink);color:var(--card)}
section{padding:14px 16px 6px}h2{margin:0 0 10px;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mfg)}
.game{position:relative;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px}.game.done{opacity:.78}
.top{display:flex;align-items:baseline;gap:8px}.c{font-size:.76rem;color:var(--mfg)}.tag{margin-left:auto;font-size:.66rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:2px 8px;border:1px solid var(--border);color:var(--mfg)}
.tag.live{color:var(--live);border-color:currentColor}.tag.done{color:var(--win);border-color:currentColor}
.pairs{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;margin-top:6px;font-size:.86rem}.vs{font-size:.68rem;color:var(--mfg)}.r{text-align:right}
.won{color:var(--win);font-weight:700}.won::after{content:" \\2713"}.star{color:var(--gold)}
.subs{margin-top:10px;border:1px solid var(--border);border-radius:9px;padding:9px 10px}
.subs .h{margin:0 0 6px;font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mfg)}
.subs .hint{margin:-2px 0 4px;font-size:.7rem;color:var(--mfg)}.subs .clear{float:right;cursor:pointer;color:var(--ink);text-transform:none;letter-spacing:0}
.game>input{position:absolute;opacity:0;pointer-events:none}
.out{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:10px}
.out label{min-width:0;cursor:pointer;border:1px solid var(--border);border-radius:7px;padding:6px 2px;text-align:center;font-size:.76rem;font-weight:600;line-height:1.2}
.out .n{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.out .lv,.out .o{display:block;font-size:.68rem;font-weight:400;color:var(--mfg)}.out .o{display:none;color:var(--out);font-weight:700}
.subs>.p{display:none}.subs ol{list-style:none;margin:0;padding:0}
.subs li{display:grid;grid-template-columns:1rem 1fr;gap:0 8px;align-items:center;padding:6px 0;border-top:1px solid var(--border)}.subs li:first-child{border-top:0}
.subs .i{font-size:.76rem;font-weight:700;color:var(--mfg);font-variant-numeric:tabular-nums}.subs .nm{margin:0;font-size:.88rem;font-weight:600;line-height:1.2}
.subs .mt{margin:0;font-size:.7rem;color:var(--mfg)}.subs .mt b{color:var(--fg)}.subs li:first-child .i,.subs li:first-child .nm{color:var(--ink)}
.subs .none{margin:0;font-size:.76rem;font-style:italic;color:var(--mfg)}
${[1, 2, 3, 4, 5].map((k) => `.game>input.k${k}:checked~.subs>.p.k${k}{display:block}`).join('')}
${[2, 3, 4, 5].map((k) => `.game>input.k${k}:checked~.subs .out .k${k}`).join(',')}{border-color:var(--out);background:color-mix(in srgb,var(--out) 10%,transparent)}
${[2, 3, 4, 5].map((k) => `.game>input.k${k}:checked~.subs .out .k${k} .lv`).join(',')}{display:none}
${[2, 3, 4, 5].map((k) => `.game>input.k${k}:checked~.subs .out .k${k} .o`).join(',')}{display:block}
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


  const tag = (g: BackupGame) =>
    g.status === 'done' ? (g.outcome === 'draw' ? 'Draw' : 'Done') : g.status === 'live' ? 'Playing' : 'Queued'

  const plain = (id: string) => esc(byId.get(id)?.name ?? 'Player')

  /** One ranked list, laid out like the app's Subs panel rows (read-only: no Sub in or ★ buttons). */
  const subRows = (g: BackupGame, out: string | null) => {
    const rows = rankBackupSubs(g, ordered, players, session, out)
    const outLevel = out ? byId.get(out)?.level ?? null : null
    const list = rows.slice(0, SUBS_SHOWN).map((r, i) => {
      const meta = [
        withLevels ? (r.levelGap === 0 ? `<b>${levelText(r, outLevel)}</b>` : levelText(r, outLevel)) : null,
        `${r.games} ${r.games === 1 ? 'game' : 'games'}`,
        r.nextGame == null ? '<b>done tonight</b>' : `next G${r.nextGame}`,
      ].filter(Boolean).join(' · ')
      return `<li><span class="i">${i + 1}</span><div><p class="nm">${esc(r.displayName)}${r.isPick ? ' <span class="star">★</span>' : ''}</p><p class="mt">${meta}</p></div></li>`
    }).join('')
    const count = rows.length > SUBS_SHOWN ? `top ${SUBS_SHOWN} of ${rows.length}` : String(rows.length)
    return { count, html: rows.length ? `<ol>${list}</ol>` : '<p class="none">No eligible substitutes right now</p>' }
  }

  /**
   * A playing or queued game gets the app's Subs panel: "Who's out?" with the
   * four players, then the ranked list. No script (the file loads and runs
   * nothing): hidden radios k1 (nobody out) to k5 (one per player), the four
   * buttons are their labels, and CSS shows the list whose radio is checked.
   */
  const card = (g: BackupGame) => {
    const top = `<div class="top"><b>Game ${g.queuePosition}</b> <span class="c">${courtName(g.courtNumber)}</span>
<span class="tag ${g.status}">${tag(g)}</span></div>`
    const pairs = `<div class="pairs"><div>${pair(g.team1, g.status === 'done' && g.outcome === 'team1')}</div><div class="vs">vs</div><div class="r">${pair(g.team2, g.status === 'done' && g.outcome === 'team2')}</div></div>`
    if (g.status === 'done') return `<div class="game ${g.status}">${top}
${pairs}</div>`

    const four = playersOf(g)
    const id = (k: number) => `g${g.queuePosition}k${k}`
    const radios = [1, 2, 3, 4, 5]
      .map((n) => `<input type="radio" name="g${g.queuePosition}" id="${id(n)}" class="k${n}"${n === 1 ? ' checked' : ''}>`)
      .join('')
    const outButtons = four.map((pid, i) => {
      const level = byId.get(pid)?.level
      return `<label class="k${i + 2}" for="${id(i + 2)}"><span class="n">${plain(pid)}</span>${withLevels ? `<span class="lv">Lv ${level ?? '?'}</span>` : ''}<span class="o">Out</span></label>`
    }).join('')
    const all = subRows(g, null)
    const panels = [
      `<div class="p k1"><p class="h">Subs (${all.count})</p>${all.count !== '0' ? `<p class="hint">Tap who’s out to ${withLevels ? 'rank by level' : 'see their subs'}.</p>` : ''}${all.html}</div>`,
      ...four.map((pid, i) => {
        const list = subRows(g, pid)
        return `<div class="p k${i + 2}"><p class="h">Best subs for ${plain(pid)} (${list.count})<label class="clear" for="${id(1)}">Clear</label></p>${list.html}</div>`
      }),
    ].join('')
    return `<div class="game ${g.status}">${radios}${top}
${pairs}
<div class="subs"><p class="h">Who’s out?</p><div class="out">${outButtons}</div>${panels}</div></div>`
  }

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
${/* Tabs, not jump links: a #fragment does not scroll in a file opened from Downloads (2026-11-19). Radios + CSS, no script. */ ''}<input type="radio" name="tab" id="tab-schedule" checked><input type="radio" name="tab" id="tab-players">
<nav><label for="tab-schedule">Schedule</label><label for="tab-players">Players</label></nav>
<section id="schedule"><h2>Schedule · ${ordered.length} games</h2>${ordered.map(card).join('')}</section>
<section id="players"><h2>Players · ${players.length}</h2><table><thead><tr><th>Player</th><th>Games</th><th class="num">Done</th></tr></thead><tbody>${rows}</tbody></table></section>
<div class="foot">Saved from the badminton app. Open with Chrome; works without internet.</div></div></body></html>`
}
