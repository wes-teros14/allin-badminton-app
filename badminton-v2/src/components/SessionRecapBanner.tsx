import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface RecapData {
  sessionId: string
  sessionName: string
  sessionDate: string
  wins: number
  losses: number
  bestPartnerName: string | null
  nemesisName: string | null
}

export function SessionRecapBanner() {
  const { user } = useAuth()
  const [recap, setRecap] = useState<RecapData | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      // Find most recent completed session this player was registered in
      const { data: regs } = await supabase
        .from('session_registrations')
        .select('session_id')
        .eq('player_id', user!.id)

      if (cancelled || !regs?.length) return

      const sessionIds = (regs as Array<{ session_id: string }>).map(r => r.session_id)

      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, name, date')
        .in('id', sessionIds)
        .eq('status', 'complete')
        .order('date', { ascending: false })
        .limit(1)

      if (cancelled || !sessions?.length) return
      const session = (sessions as Array<{ id: string; name: string; date: string }>)[0]

      // Skip if already dismissed
      if (localStorage.getItem(`recap_seen_${session.id}`)) return

      // Compute this player's wins/losses in that session
      const { data: matchRows } = await supabase
        .from('matches')
        .select('id, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id')
        .eq('session_id', session.id)
        .or(`team1_player1_id.eq.${user!.id},team1_player2_id.eq.${user!.id},team2_player1_id.eq.${user!.id},team2_player2_id.eq.${user!.id}`)

      if (cancelled || !matchRows?.length) return

      const mRows = matchRows as Array<{
        id: string
        team1_player1_id: string; team1_player2_id: string
        team2_player1_id: string; team2_player2_id: string
      }>

      const matchIds = mRows.map(m => m.id)
      const { data: results } = await supabase
        .from('match_results')
        .select('match_id, winning_pair_index')
        .in('match_id', matchIds)

      if (cancelled) return

      const resultMap = new Map(
        ((results ?? []) as Array<{ match_id: string; winning_pair_index: number }>)
          .map(r => [r.match_id, r.winning_pair_index])
      )

      let wins = 0, losses = 0
      const partnerWins = new Map<string, number>()
      const nemesisLosses = new Map<string, number>()

      for (const m of mRows) {
        const result = resultMap.get(m.id)
        if (result === undefined) continue
        const onTeam1 = m.team1_player1_id === user!.id || m.team1_player2_id === user!.id
        const won = onTeam1 ? result === 1 : result === 2
        if (won) {
          wins++
          const partnerId = onTeam1
            ? (m.team1_player1_id === user!.id ? m.team1_player2_id : m.team1_player1_id)
            : (m.team2_player1_id === user!.id ? m.team2_player2_id : m.team2_player1_id)
          partnerWins.set(partnerId, (partnerWins.get(partnerId) ?? 0) + 1)
        } else {
          losses++
          // Track opponents (both) who beat us
          const opp1 = onTeam1 ? m.team2_player1_id : m.team1_player1_id
          const opp2 = onTeam1 ? m.team2_player2_id : m.team1_player2_id
          nemesisLosses.set(opp1, (nemesisLosses.get(opp1) ?? 0) + 1)
          nemesisLosses.set(opp2, (nemesisLosses.get(opp2) ?? 0) + 1)
        }
      }

      // Find best partner and nemesis IDs
      let bestPartnerId: string | null = null
      let bestCount = 0
      for (const [id, count] of partnerWins) {
        if (count > bestCount) { bestCount = count; bestPartnerId = id }
      }

      let nemesisId: string | null = null
      let nemesisCount = 0
      for (const [id, count] of nemesisLosses) {
        if (count > nemesisCount) { nemesisCount = count; nemesisId = id }
      }

      // Resolve names in one batch
      const idsToFetch = [...new Set([bestPartnerId, nemesisId].filter(Boolean) as string[])]
      let nameMap = new Map<string, string>()
      if (idsToFetch.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name_slug, nickname')
          .in('id', idsToFetch)
        if (profs) {
          for (const p of profs as Array<{ id: string; name_slug: string; nickname: string | null }>) {
            nameMap.set(p.id, p.nickname ?? p.name_slug)
          }
        }
      }

      const bestPartnerName = bestPartnerId ? (nameMap.get(bestPartnerId) ?? null) : null
      const nemesisName = nemesisId ? (nameMap.get(nemesisId) ?? null) : null

      if (cancelled) return
      if (wins + losses === 0) return // no recorded results, skip recap

      setRecap({ sessionId: session.id, sessionName: session.name, sessionDate: session.date, wins, losses, bestPartnerName, nemesisName })
    }

    load()
    return () => { cancelled = true }
  }, [user?.id])

  if (!recap) return null

  function dismiss() {
    localStorage.setItem(`recap_seen_${recap!.sessionId}`, '1')
    setRecap(null)
  }

  const formattedDate = recap.sessionDate
    ? new Date(recap.sessionDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/^(\w{3})/, '$1.')
    : ''
  const winRate = recap.wins + recap.losses > 0
    ? Math.round((recap.wins / (recap.wins + recap.losses)) * 100)
    : 0

  return (
    <div className="mx-4 mt-3 mb-1 px-4 py-3 rounded-lg bg-muted border border-border flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-foreground">🏸 {recap.sessionName} · {formattedDate}</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {recap.wins}W {recap.losses}L · {winRate}% win rate
          {recap.bestPartnerName && ` · 🤝 ${recap.bestPartnerName}`}
          {recap.nemesisName && ` · 😤 ${recap.nemesisName}`}
        </p>
      </div>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0">&times;</button>
    </div>
  )
}
