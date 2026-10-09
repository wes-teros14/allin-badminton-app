import { supabase } from '@/lib/supabase'
import { disambiguateDisplayNames, formatDisplayName } from '@/lib/formatDisplayName'
import { getMatchOutcome } from '@/lib/matchResults'
import type { BackupGame, BackupInput, BackupPlayer } from '@/lib/offlineBackup'

type SessionRow = {
  name: string
  date: string
  time: string | null
  venue: string | null
  court_count: number | null
  court_1_label: string | null
  court_2_label: string | null
  sub_picks: string[] | null
}

type MatchRow = {
  queue_position: number
  court_number: number | null
  status: 'queued' | 'playing' | 'complete'
  team1_player1_id: string
  team1_player2_id: string
  team2_player1_id: string
  team2_player2_id: string
  match_results: Array<{ winning_pair_index: number; game_number: number | null }> | null
}

/**
 * Everything the offline backup needs, read fresh at the moment of export so
 * the file reflects the courts as they are now. Levels are only read for the
 * admin copy: a moderator copy never even asks for them.
 */
export async function fetchOfflineBackupData(
  sessionId: string,
  withLevels: boolean,
): Promise<Omit<BackupInput, 'exportedAt'>> {
  const [sessionRes, matchesRes, regsRes] = await Promise.all([
    supabase
      .from('sessions')
      .select('name, date, time, venue, court_count, court_1_label, court_2_label, sub_picks')
      .eq('id', sessionId)
      .single(),
    supabase
      .from('matches')
      .select('queue_position, court_number, status, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, match_results(winning_pair_index, game_number)')
      .eq('session_id', sessionId)
      .order('queue_position', { ascending: true }),
    supabase
      .from('session_registrations')
      .select(withLevels ? 'player_id, registered_at, level' : 'player_id, registered_at')
      .eq('session_id', sessionId)
      .order('registered_at', { ascending: true }),
  ])
  if (sessionRes.error) throw sessionRes.error
  if (matchesRes.error) throw matchesRes.error
  if (regsRes.error) throw regsRes.error

  const s = sessionRes.data as unknown as SessionRow
  const matches = (matchesRes.data ?? []) as unknown as MatchRow[]
  const regs = (regsRes.data ?? []) as unknown as Array<{ player_id: string; level?: number | null }>

  // Anyone in a game, registered or not (an admin can sub in a non-registrant).
  const ids = [...new Set([
    ...regs.map((r) => r.player_id),
    ...matches.flatMap((m) => [m.team1_player1_id, m.team1_player2_id, m.team2_player1_id, m.team2_player2_id]),
  ])]
  const profilesRes = ids.length > 0
    ? await supabase.from('profiles').select(withLevels ? 'id, nickname, name_slug, level' : 'id, nickname, name_slug').in('id', ids)
    : { data: [], error: null }
  if (profilesRes.error) throw profilesRes.error
  const profiles = (profilesRes.data ?? []) as unknown as Array<{ id: string; nickname: string | null; name_slug: string; level?: number | null }>
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const names = disambiguateDisplayNames(profiles.map((p) => ({ id: p.id, nameSlug: p.name_slug, displayName: formatDisplayName(p.nickname, p.name_slug) })))
  const sessionLevel = new Map(regs.map((r) => [r.player_id, r.level ?? null]))

  const players: BackupPlayer[] = ids.map((id) => ({
    id,
    name: names.get(id) ?? 'Player',
    // The same rule the roster uses: the session override, else the profile level.
    ...(withLevels ? { level: sessionLevel.get(id) ?? profileById.get(id)?.level ?? null } : {}),
  }))

  const games: BackupGame[] = matches.map((m) => ({
    queuePosition: m.queue_position,
    courtNumber: m.court_number,
    status: m.status === 'complete' ? 'done' : m.status === 'playing' ? 'live' : 'queued',
    team1: [m.team1_player1_id, m.team1_player2_id],
    team2: [m.team2_player1_id, m.team2_player2_id],
    outcome: m.status === 'complete' ? getMatchOutcome(m.match_results) : null,
  }))

  return {
    session: {
      name: s.name,
      date: s.date,
      time: s.time,
      venue: s.venue,
      courtCount: s.court_count ?? 2,
      courtLabels: { 1: s.court_1_label ?? 'Court 1', 2: s.court_2_label ?? 'Court 2' },
      subPicks: s.sub_picks ?? [],
    },
    players,
    games,
    withLevels,
  }
}
