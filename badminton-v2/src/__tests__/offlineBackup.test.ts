import { describe, it, expect } from 'vitest'
import { backupFileName, buildOfflineBackupHtml, rankBackupSubs, type BackupGame, type BackupInput, type BackupSession } from '@/lib/offlineBackup'

const session: BackupSession = {
  name: 'October Palo', date: '2026-10-04', time: '14:00', venue: 'Gameville',
  courtCount: 2, courtLabels: { 1: 'Court 1', 2: 'Court 2' }, subPicks: [],
}
const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map((id) => ({ id, name: `P${id}`, level: 3 }))
const game = (q: number, ids: string, status: BackupGame['status'] = 'queued', outcome: BackupGame['outcome'] = null): BackupGame => ({
  queuePosition: q, courtNumber: status === 'queued' ? null : ((q - 1) % 2) + 1, status,
  team1: [ids[0], ids[1]], team2: [ids[2], ids[3]], outcome,
})
// Round 1 = games 1-2, round 2 = games 3-4.
const games = [game(1, 'ABCD', 'done', 'team1'), game(2, 'EFGH', 'live'), game(3, 'ABEI'), game(4, 'CDFG')]
const input = (over: Partial<BackupInput> = {}): BackupInput =>
  ({ session, players, games, withLevels: false, exportedAt: '3:05 PM', ...over })

describe('rankBackupSubs (the app’s Subs panel rules)', () => {
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort()

  it('for a queued game, leaves out who is on court and the games just before and after it', () => {
    // Game 3: its own ABEI, on court EFGH, next game CDFG. Only J is free.
    expect(ids(rankBackupSubs(games[2], games, players, session))).toEqual(['J'])
  })

  it('for a playing game, leaves out who is on court and the next game to start', () => {
    // Game 2 is on court (EFGH); game 3 (ABEI) starts next. C, D and J are free.
    expect(ids(rankBackupSubs(games[1], games, players, session))).toEqual(['C', 'D', 'J'])
  })

  const twelve = [...players, { id: 'K', name: 'PK', level: 3 }, { id: 'L', name: 'PL', level: 3 }]

  it('ranks the closest level to the player who is out, after the ★ picks (admin copy)', () => {
    const lv = twelve.map((p) => ({ ...p, level: ({ A: 2, J: 5, K: 2 } as Record<string, number>)[p.id] ?? 3 }))
    // Game 3 frees J (5), K (2) and L (3). A is level 2.
    expect(rankBackupSubs(games[2], games, lv, session, 'A').map((r) => r.id)).toEqual(['K', 'L', 'J'])
    expect(rankBackupSubs(games[2], games, lv, { ...session, subPicks: ['J'] }, 'A')[0]).toMatchObject({ id: 'J', isPick: true })
  })

  it('without levels (moderator copy), a player’s list is the game’s list', () => {
    const noLevels = twelve.map(({ id, name }) => ({ id, name }))
    expect(rankBackupSubs(games[2], games, noLevels, session, 'A')).toEqual(rankBackupSubs(games[2], games, noLevels, session))
  })
})

describe('buildOfflineBackupHtml', () => {
  it('has a Who’s out? button per player, each with its own ranked list', () => {
    const html = buildOfflineBackupHtml(input())
    // Game 3: radio k1 (nobody out, checked) + one per player; the buttons are their labels.
    expect(html).toContain('<input type="radio" name="g3" id="g3k1" class="k1" checked>')
    expect(html).toContain('<label class="k2" for="g3k2"><span class="n">PA</span><span class="o">Out</span></label>')
    expect(html).toContain('Best subs for PA (1)')
    // A playing game has the panel too; a finished one does not.
    expect(html).toContain('for="g2k2"')
    expect(html).not.toContain('for="g1k2"')
    // The admin copy shows levels on the buttons and rows, like the app.
    expect(buildOfflineBackupHtml(input({ withLevels: true }))).toContain('<span class="lv">Lv 3</span>')
  })

  it('lists at most the top 3 subs, and says how many there are', () => {
    // Twenty extra players, all free for game 3.
    const many = [...players, ...Array.from({ length: 20 }, (_, i) => ({ id: `X${i}`, name: `PX${i}`, level: 3 }))]
    const html = buildOfflineBackupHtml(input({ players: many }))
    const game3 = html.slice(html.indexOf('id="g3k1"'), html.indexOf('id="g4k1"'))
    expect(game3).toContain('Subs (top 3 of 21)')
    const panel = game3.slice(game3.indexOf('class="p k1"'), game3.indexOf('class="p k2"'))
    expect((panel.match(/<li>/g) ?? []).length).toBe(3)
  })

  it('has no levels in the moderator copy, and levels in the admin copy', () => {
    expect(buildOfflineBackupHtml(input())).not.toContain('class="lvl"')
    const admin = buildOfflineBackupHtml(input({ withLevels: true }))
    expect(admin).toContain('<span class="lvl">L3</span>')
    expect(admin).toContain('keep it private')
  })

  it('escapes names and venue', () => {
    const html = buildOfflineBackupHtml(input({
      players: players.map((p) => (p.id === 'A' ? { ...p, name: '<img src=x onerror=alert(1)>' } : p)),
      session: { ...session, venue: 'Tom & Jerry’s "Court"' },
    }))
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('Tom &amp; Jerry’s &quot;Court&quot;')
  })

  it('marks the winner, the live game and has a subs panel for playing and queued games', () => {
    const html = buildOfflineBackupHtml(input())
    expect(html).toContain('<span class="won">PA &amp; PB</span>')
    expect(html).toContain('<span class="tag live">Playing</span>')
    // Game 2 (playing), games 3 and 4 (queued); not game 1 (done).
    expect((html.match(/Who’s out\?/g) ?? []).length).toBe(3)
  })

  it('switches sections with tabs, not #links (which do not scroll in a downloaded file)', () => {
    const html = buildOfflineBackupHtml(input())
    expect(html).toContain('<input type="radio" name="tab" id="tab-schedule" checked>')
    expect(html).toContain('<label for="tab-players">Players</label>')
    expect(html).not.toContain('href="#')
  })

  it('loads nothing from the network', () => {
    const html = buildOfflineBackupHtml(input())
    expect(html).not.toMatch(/<(script|link|img)\b/)
    expect(html).not.toMatch(/https?:\/\//)
  })
})

describe('backupFileName', () => {
  it('names the session, day and time, with -admin for the admin copy', () => {
    expect(backupFileName('October Palo', '2026-10-04', '3:05 PM', false)).toBe('backup-october-palo-oct-4-3-05-pm.html')
    expect(backupFileName('October Palo', '2026-10-04', '3:05 PM', true)).toBe('backup-october-palo-oct-4-3-05-pm-admin.html')
  })
})
