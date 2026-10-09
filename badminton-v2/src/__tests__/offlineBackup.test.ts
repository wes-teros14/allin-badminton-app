import { describe, it, expect } from 'vitest'
import { backupFileName, buildOfflineBackupHtml, suggestSubs, type BackupGame, type BackupInput, type BackupSession } from '@/lib/offlineBackup'

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

describe('suggestSubs', () => {
  it('leaves out everyone on court in the same round', () => {
    const ids = suggestSubs(games[2], games, players, session).map((s) => s.playerId)
    // Round 2 is games 3 and 4: A B E I C D F G are busy.
    expect(ids.sort()).toEqual(['H', 'J'])
  })

  it('groups rounds by queue order, so a gap in game numbers does not shift them', () => {
    // Game 1 was removed: games 2 and 3 start together, then 4 and 5.
    const gapped = [game(2, 'ABCD'), game(3, 'EFGH'), game(4, 'ABEI'), game(5, 'CDFJ')]
    const ids = suggestSubs(gapped[0], gapped, players, session).map((s) => s.playerId)
    expect(ids.sort()).toEqual(['I', 'J'])
  })

  it('puts ★ picks first, then those not playing next, then fewest games', () => {
    const more = [...games, game(5, 'HABC'), game(6, 'DEFG')]
    const s = { ...session, subPicks: ['J'] }
    const subs = suggestSubs(more[2], more, players, s)
    expect(subs[0]).toMatchObject({ playerId: 'J', isPick: true })
    expect(subs.find((x) => x.playerId === 'H')).toMatchObject({ playsNextRound: true })
  })
})

describe('buildOfflineBackupHtml', () => {
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

  it('marks the winner, the live game and suggests subs only for queued games', () => {
    const html = buildOfflineBackupHtml(input())
    expect(html).toContain('<span class="won">PA &amp; PB</span>')
    expect(html).toContain('Court 2 · Playing')
    expect((html.match(/If someone can’t play/g) ?? []).length).toBe(2)
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
