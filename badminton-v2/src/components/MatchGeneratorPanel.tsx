import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useRegisteredPlayers } from '@/hooks/useRegisteredPlayers'
import { supabase } from '@/lib/supabase'
import {
  generateSchedule,
  generateScheduleOptimized,
  adjustNumMatches,
  DEFAULT_WEIGHTS,
  type GeneratedMatch,
  type AuditData,
  type MatchDecision,
  type GenerateOptions,
} from '@/lib/matchGenerator'

interface Props {
  sessionId: string
  sessionStatus?: string
  onLock?: (matches: GeneratedMatch[]) => Promise<boolean>
}

interface Settings {
  // Match Rules
  numMatches: number
  maxConsecutiveGames: number
  maxSpreadLimit: number
  disableGenderRules: boolean
  // Optimizer
  isIterative: boolean
  numTrials: number
  wishlistStr: string
  // Scoring Weights (shared by generation and optimizer)
  streakWeight: number
  imbalancePenalty: number
  wishlistReward: number
  repeatPartnerPenalty: number
  fairnessWeight: number
  spreadPenalty: number
  mixedDoublesPenalty: number
}

const DEFAULTS: Settings = {
  numMatches: 20,
  maxConsecutiveGames: 1,
  maxSpreadLimit: 3,
  disableGenderRules: false,
  isIterative: true,
  numTrials: 50,
  wishlistStr: '',
  streakWeight: DEFAULT_WEIGHTS.streakWeight,
  imbalancePenalty: DEFAULT_WEIGHTS.imbalancePenalty,
  wishlistReward: DEFAULT_WEIGHTS.wishlistReward,
  repeatPartnerPenalty: DEFAULT_WEIGHTS.repeatPartnerPenalty,
  fairnessWeight: DEFAULT_WEIGHTS.fairnessWeight,
  spreadPenalty: DEFAULT_WEIGHTS.spreadPenalty,
  mixedDoublesPenalty: DEFAULT_WEIGHTS.mixedDoublesPenalty,
}

export function MatchGeneratorPanel({ sessionId, sessionStatus, onLock }: Props) {
  const { players, isLoading } = useRegisteredPlayers(sessionId)
  const [stage, setStage] = useState<'idle' | 'generating' | 'preview' | 'locking' | 'locked'>('idle')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [matches, setMatches] = useState<GeneratedMatch[]>([])
  const [audit, setAudit] = useState<AuditData | null>(null)
  const [decisions, setDecisions] = useState<MatchDecision[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [confirmingLock, setConfirmingLock] = useState(false)
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lockedMatchMeta, setLockedMatchMeta] = useState<Array<{ id: string; status: string }>>([])
  const [editingGameNumber, setEditingGameNumber] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ t1p1: '', t1p2: '', t2p1: '', t2p2: '' })

  // Load existing locked matches from DB if session is already locked
  useEffect(() => {
    if (sessionStatus !== 'schedule_locked') return
    async function loadLocked() {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('session_id', sessionId)
        .order('queue_position')
      if (!error && data) {
        const rows = data as Array<{
          id: string
          queue_position: number
          team1_player1_id: string
          team1_player2_id: string
          team2_player1_id: string
          team2_player2_id: string
          status: string
        }>
        setMatches(rows.map((m) => ({
          gameNumber: m.queue_position,
          team1Player1: m.team1_player1_id,
          team1Player2: m.team1_player2_id,
          team2Player1: m.team2_player1_id,
          team2Player2: m.team2_player2_id,
          type: '',
          team1Level: 0,
          team2Level: 0,
        })))
        setLockedMatchMeta(rows.map((m) => ({ id: m.id, status: m.status })))
        setStage('locked')
      }
    }
    loadLocked()
  }, [sessionId, sessionStatus])

  // Cleanup lock confirm timer on unmount
  useEffect(() => {
    return () => { if (lockTimerRef.current) clearTimeout(lockTimerRef.current) }
  }, [])

  async function handleLock() {
    if (!confirmingLock) {
      setConfirmingLock(true)
      lockTimerRef.current = setTimeout(() => setConfirmingLock(false), 5000)
    } else {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
      setConfirmingLock(false)
      setStage('locking')
      const success = onLock ? await onLock(matches) : false
      if (success) {
        setStage('locked')
      } else {
        setStage('preview')
      }
    }
  }

  const effectiveNumMatches =
    settings.numMatches > 0 ? settings.numMatches : Math.ceil((players.length * 8) / 4)
  const adjustedMatches = players.length >= 4
    ? adjustNumMatches(effectiveNumMatches, players.length)
    : effectiveNumMatches
  const targetGames = players.length >= 4
    ? (adjustedMatches * 4) / players.length
    : null
  const wasAdjusted = adjustedMatches !== effectiveNumMatches

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function handleGenerate() {
    // Guard: check for missing gender/level before generating
    const issues: string[] = []
    for (const p of players) {
      const missing: string[] = []
      if (p.level == null) missing.push('level')
      if (!settings.disableGenderRules && !p.gender) missing.push('gender')
      if (missing.length > 0) issues.push(`${p.nameSlug} (no ${missing.join(', ')})`)
    }
    if (issues.length > 0) {
      toast.error(`Fix player data first: ${issues.join(' · ')}`, { duration: 6000 })
      return
    }

    const fromPreview = stage === 'preview'
    if (fromPreview) {
      setIsRegenerating(true)
    } else {
      setStage('generating')
    }

    // Defer computation so React can render the loading state first
    setTimeout(() => {
      // Resolve wishlist: "slug1-slug2, slug3-slug4" → ID pairs
      const nameToId = new Map(players.map((p) => [(p.nickname ?? p.nameSlug).toLowerCase(), p.id]))
      const wishlistPairs: [string, string][] = []
      if (settings.wishlistStr.trim()) {
        for (const pair of settings.wishlistStr.split(',')) {
          const parts = pair.trim().split('-').map((s) => s.trim().toLowerCase())
          if (parts.length === 2) {
            const id1 = nameToId.get(parts[0])
            const id2 = nameToId.get(parts[1])
            if (id1 && id2) wishlistPairs.push([id1, id2])
          }
        }
      }

      const scoreWeights = {
        streakWeight: settings.streakWeight,
        imbalancePenalty: settings.imbalancePenalty,
        wishlistReward: settings.wishlistReward,
        repeatPartnerPenalty: settings.repeatPartnerPenalty,
        fairnessWeight: settings.fairnessWeight,
        spreadPenalty: settings.spreadPenalty,
        mixedDoublesPenalty: settings.mixedDoublesPenalty,
      }

      const genOptions: GenerateOptions = {
        numMatches: adjustedMatches,
        maxConsecutiveGames: settings.maxConsecutiveGames,
        maxSpreadLimit: settings.maxSpreadLimit,
        disableGenderRules: settings.disableGenderRules,
        wishlistPairs,
        weights: scoreWeights,
      }

      if (settings.isIterative) {
        const result = generateScheduleOptimized(players, {
          ...genOptions,
          numTrials: settings.numTrials,
        })
        setMatches(result.matches)
        setAudit(result.audit)
        setDecisions(result.decisions)
      } else {
        const log: MatchDecision[] = []
        setMatches(generateSchedule(players, genOptions, log))
        setAudit(null)
        setDecisions(log)
      }

      setStage('preview')
      setIsRegenerating(false)
    }, 50)
  }

  function handleEditStart(m: GeneratedMatch) {
    setEditingGameNumber(m.gameNumber)
    setEditForm({ t1p1: m.team1Player1, t1p2: m.team1Player2, t2p1: m.team2Player1, t2p2: m.team2Player2 })
  }

  async function handleEditSave(gameNumber: number) {
    const idx = matches.findIndex((m) => m.gameNumber === gameNumber)
    if (idx === -1) { toast.error('Match not found'); return }
    const meta = lockedMatchMeta[idx]
    if (!meta) { toast.error('Match metadata not loaded — please refresh'); return }

    const { error } = await supabase
      .from('matches')
      .update({
        team1_player1_id: editForm.t1p1,
        team1_player2_id: editForm.t1p2,
        team2_player1_id: editForm.t2p1,
        team2_player2_id: editForm.t2p2,
      })
      .eq('id', meta.id)

    if (error) {
      toast.error(error.message)
      return
    }

    setMatches((prev) =>
      prev.map((m, i) =>
        i === idx
          ? { ...m, team1Player1: editForm.t1p1, team1Player2: editForm.t1p2, team2Player1: editForm.t2p1, team2Player2: editForm.t2p2 }
          : m
      )
    )
    setEditingGameNumber(null)
    toast.success('Match updated')
  }

  function handleEditCancel() {
    setEditingGameNumber(null)
  }

  const nameMap = new Map(players.map((p) => [p.id, p.nickname ?? p.nameSlug]))
  const name = (id: string) => nameMap.get(id) ?? id

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading players…</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{players.length} players registered</p>

        {/* Settings toggle */}
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => setShowSettings((v) => !v)}
        >
          {showSettings ? 'Hide Settings ▲' : 'Settings ▼'}
        </button>

        {/* ── Settings Panel ─────────────────────────────────── */}
        {showSettings && (
          <div className="space-y-4 rounded-md border p-3 text-sm">

            {/* Match Rules */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Match Rules
              </p>

              <SliderField
                label="Number of Matches"
                value={effectiveNumMatches}
                min={1} max={50}
                onChange={(v) => set('numMatches', v)}
              />
              {targetGames !== null && (
                <p className={`text-xs -mt-1 ${wasAdjusted ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {wasAdjusted ? `Adjusted to ${adjustedMatches} · ` : ''}{targetGames} games each
                </p>
              )}
              <SliderField
                label="Max Consecutive Games"
                value={settings.maxConsecutiveGames}
                min={1} max={5}
                onChange={(v) => set('maxConsecutiveGames', v)}
              />
              <SliderField
                label="Max Skill Gap per Match"
                value={settings.maxSpreadLimit}
                min={0} max={9}
                onChange={(v) => set('maxSpreadLimit', v)}
              />

              <CheckField
                label="Disable Gender Rules"
                checked={settings.disableGenderRules}
                onChange={(v) => set('disableGenderRules', v)}
              />
            </div>

            <hr />

            {/* Optimizer */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Optimizer
              </p>

              <CheckField
                label="Enable Iterative Optimizer"
                checked={settings.isIterative}
                onChange={(v) => set('isIterative', v)}
              />

              <SliderField
                label="Optimization Trials"
                value={settings.numTrials}
                min={10} max={1000} step={10}
                disabled={!settings.isIterative}
                onChange={(v) => set('numTrials', v)}
              />

              <div className={`space-y-1 ${!settings.isIterative ? 'opacity-50' : ''}`}>
                <Label className="text-xs">
                  Partner Wishlist
                  <span className="ml-1 text-muted-foreground font-normal">(slug1-slug2, slug3-slug4)</span>
                </Label>
                <Input
                  placeholder="e.g. wes-yelli, aj-czarina"
                  value={settings.wishlistStr}
                  disabled={!settings.isIterative}
                  onChange={(e) => set('wishlistStr', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Scoring Weights — controls both generation and optimizer */}
            <hr />
            <details>
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground select-none">
                Scoring Weights ▼
              </summary>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Controls how the engine scores matches. Used by both generation and optimizer.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                {(
                  [
                    { key: 'streakWeight',         label: 'Fatigue Penalty',       help: 'Per game over max consecutive' },
                    { key: 'imbalancePenalty',     label: 'Level Imbalance',        help: 'Per level diff between teams' },
                    { key: 'wishlistReward',       label: 'Wishlist Reward',        help: 'Per wishlist pair granted' },
                    { key: 'repeatPartnerPenalty', label: 'Repeat Partner Penalty', help: 'Per repeat partnership' },
                    { key: 'fairnessWeight',       label: 'Fairness Penalty',       help: 'Per game count gap (highest priority)' },
                    { key: 'spreadPenalty',        label: 'Level Gap Penalty',      help: 'Per match over skill gap limit' },
                    { key: 'mixedDoublesPenalty', label: 'Mixed Doubles Penalty', help: 'Per mixed match (prefer MD/WD)' },
                  ] as const
                ).map(({ key, label, help }) => {
                  const disabled = key === 'mixedDoublesPenalty' && settings.disableGenderRules
                  return (
                    <div key={key} className={`space-y-1 ${disabled ? 'opacity-40' : ''}`}>
                      <Label className="text-xs" title={help}>{label}</Label>
                      <Input
                        type="number"
                        value={settings[key]}
                        onChange={(e) => set(key, +e.target.value)}
                        className="h-7 text-xs"
                        disabled={disabled}
                      />
                    </div>
                  )
                })}
              </div>
            </details>
          </div>
        )}

        {/* ── Generate Buttons ───────────────────────────────── */}
        {stage === 'idle' ? (
          <Button onClick={handleGenerate} disabled={players.length < 4} className="w-full">
            {settings.isIterative ? `Generate Schedule (${settings.numTrials} trials)` : 'Generate Schedule'}
          </Button>
        ) : stage === 'generating' ? (
          <div className="space-y-2">
            <div className="text-xs text-center text-muted-foreground animate-pulse">
              {settings.isIterative ? `Running ${settings.numTrials} trials…` : 'Generating schedule…'}
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-[loading-bar_1.2s_ease-in-out_infinite]" style={{ width: '40%' }} />
            </div>
          </div>
        ) : stage === 'preview' ? (
          <>
            <Button variant="outline" onClick={handleGenerate} disabled={isRegenerating} className="w-full">
              {isRegenerating
                ? <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />Generating…</span>
                : settings.isIterative ? `Generate Again (${settings.numTrials} trials)` : 'Generate Again'}
            </Button>

            {/* Engine Audit Report (iterative mode only) */}
            {audit && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <AuditMetric label="Optimizer Score"       value={audit.score.toLocaleString()} highlight />
                  <AuditMetric label="Game Count Violations" value={audit.participationGap} delta={audit.participationGap === 0 ? { text: 'Perfect', good: true } : { text: 'Uneven', good: false }} />
                  <AuditMetric label="Streak Violations"     value={audit.streakViolations} />
                  <AuditMetric label="Partners Repeated"     value={audit.repeatPartners} />
                  <AuditMetric label="Wishes Granted"        value={audit.wishesGranted} />
                  <AuditMetric label="Skill Gap Violations"  value={audit.wideGaps} delta={audit.wideGaps === 0 ? { text: 'Consistent', good: true } : { text: 'Poor Quality', good: false }} />
                  <AuditMetric label="Mixed Doubles"          value={audit.mixedDoubles} />
                </div>

                <details className="rounded-md border p-2 text-xs">
                  <summary className="cursor-pointer font-semibold select-none">Scoring Math ▼</summary>
                  <div className="mt-2 space-y-1 font-mono">
                    <ScoringRow label="Base score" value={10000} />
                    <ScoringRow label={`Level Imbalance (${audit.levelGaps} × ${settings.imbalancePenalty})`}       value={-(audit.levelGaps * settings.imbalancePenalty)} />
                    <ScoringRow label={`Participation Gap (${audit.participationGap} × ${settings.fairnessWeight})`} value={-(audit.participationGap * settings.fairnessWeight)} />
                    <ScoringRow label={`Fatigue (${audit.streakViolations} × ${settings.streakWeight})`}             value={-(audit.streakViolations * settings.streakWeight)} />
                    <ScoringRow label={`Repeat Partners (${audit.repeatPartners} × ${settings.repeatPartnerPenalty})`} value={-(audit.repeatPartners * settings.repeatPartnerPenalty)} />
                    <ScoringRow label={`Skill Gap Violations (${audit.wideGaps} × ${settings.spreadPenalty})`}       value={-(audit.wideGaps * settings.spreadPenalty)} />
                    <ScoringRow label={`Mixed Doubles (${audit.mixedDoubles} × ${settings.mixedDoublesPenalty})`}       value={-(audit.mixedDoubles * settings.mixedDoublesPenalty)} />
                    <ScoringRow label={`Wishes Granted (${audit.wishesGranted} × ${settings.wishlistReward})`}       value={audit.wishesGranted * settings.wishlistReward} />
                    <div className="border-t pt-1 flex justify-between font-bold text-foreground">
                      <span>Final Score</span><span>{audit.score.toLocaleString()}</span>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* 3-column dashboard — participation, match types, consecutive violations */}
            {matches.length > 0 && (
              <div className="grid grid-cols-1 gap-4 text-xs">
                <div>
                  <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">Player Participation</p>
                  <ParticipationChart matches={matches} nameMap={nameMap} />
                </div>
                <div>
                  <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">Match Type Summary</p>
                  <MatchTypeChart matches={matches} />
                </div>
                <div>
                  <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">Consecutive Game Audit</p>
                  <ConsecutiveAudit matches={matches} nameMap={nameMap} />
                </div>
              </div>
            )}

            {/* Decision Log */}
            {decisions.length > 0 && (
              <details className="rounded-md border p-2 text-xs">
                <summary className="cursor-pointer font-semibold select-none">Decision Log ▼</summary>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="py-1 pr-2">Game</th>
                        <th className="py-1 pr-2">Candidates Evaluated</th>
                        <th className="py-1 pr-2">Best Score</th>
                        <th className="py-1">Selected Players</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decisions.map((d) => (
                        <tr key={d.gameIndex} className="border-b last:border-0">
                          <td className="py-1 pr-2 font-medium">{d.gameIndex}</td>
                          <td className="py-1 pr-2">{d.candidatesEvaluated}</td>
                          <td className="py-1 pr-2">{d.bestScore.toFixed(0)}</td>
                          <td className="py-1 text-muted-foreground">{d.selectedGroup.map((id) => name(id)).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {/* Match list */}
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {matches.map((m) => (
                <li key={m.gameNumber} className="text-sm py-1 border-b last:border-0">
                  <span className="font-medium text-muted-foreground mr-2">{m.gameNumber}.</span>
                  <span className="text-xs text-muted-foreground mr-2">[{m.type}]</span>
                  {name(m.team1Player1)} &amp; {name(m.team1Player2)}
                  <span className="text-muted-foreground mx-1">(L:{m.team1Level})</span>
                  <span className="text-muted-foreground mx-2">vs</span>
                  {name(m.team2Player1)} &amp; {name(m.team2Player2)}
                  <span className="text-muted-foreground mx-1">(L:{m.team2Level})</span>
                </li>
              ))}
            </ul>

            {/* Save & Lock */}
            {onLock && (
              <Button
                variant={confirmingLock ? 'destructive' : 'default'}
                onClick={handleLock}
                className="w-full"
              >
                {confirmingLock ? 'Confirm Lock? (tap again)' : 'Save & Lock Schedule'}
              </Button>
            )}
          </>
        ) : stage === 'locking' ? (
          <div className="space-y-2">
            <div className="text-xs text-center text-muted-foreground animate-pulse">Saving schedule…</div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-[loading-bar_1.2s_ease-in-out_infinite]" style={{ width: '40%' }} />
            </div>
          </div>
        ) : stage === 'locked' ? (
          <>
            <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700">
              <span>🔒</span>
              <span className="font-semibold">Schedule locked — {matches.length} matches queued</span>
            </div>
            <ul className="space-y-1 max-h-[500px] overflow-y-auto">
              {matches.map((m, idx) => {
                const meta = lockedMatchMeta[idx]
                const isQueued = !meta || meta.status === 'queued'
                const isEditing = editingGameNumber === m.gameNumber
                return (
                  <li key={m.gameNumber} className="py-1.5 border-b last:border-0">
                    {isEditing ? (
                      <div className="space-y-2 text-xs">
                        <p className="font-medium text-muted-foreground">Game {m.gameNumber} — Edit Players</p>
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                          <div className="space-y-1">
                            {(['t1p1', 't1p2'] as const).map((key, si) => (
                              <select
                                key={key}
                                value={editForm[key]}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, [key]: e.target.value }))}
                                className="w-full h-8 rounded border border-input bg-background text-foreground px-2 text-xs"
                              >
                                <option value="">— {['Team 1 P1','Team 1 P2'][si]} —</option>
                                {players.map((p) => (
                                  <option key={p.id} value={p.id}>{p.nickname ?? p.nameSlug}</option>
                                ))}
                              </select>
                            ))}
                          </div>
                          <span className="text-xs font-bold text-muted-foreground text-center">vs</span>
                          <div className="space-y-1">
                            {(['t2p1', 't2p2'] as const).map((key, si) => (
                              <select
                                key={key}
                                value={editForm[key]}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, [key]: e.target.value }))}
                                className="w-full h-8 rounded border border-input bg-background text-foreground px-2 text-xs"
                              >
                                <option value="">— {['Team 2 P1','Team 2 P2'][si]} —</option>
                                {players.map((p) => (
                                  <option key={p.id} value={p.id}>{p.nickname ?? p.nameSlug}</option>
                                ))}
                              </select>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleEditSave(m.gameNumber)}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleEditCancel}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          <span className="font-medium text-muted-foreground mr-2">{m.gameNumber}.</span>
                          {name(m.team1Player1)} &amp; {name(m.team1Player2)}
                          <span className="text-muted-foreground mx-2">vs</span>
                          {name(m.team2Player1)} &amp; {name(m.team2Player2)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs shrink-0"
                          disabled={!isQueued}
                          onClick={() => handleEditStart(m)}
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Small reusable field components
// ---------------------------------------------------------------------------

function SliderField({
  label, value, min, max, step = 1, disabled = false, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className={`text-xs ${disabled ? 'opacity-50' : ''}`}>{label}</Label>
        <span className={`text-xs text-muted-foreground ${disabled ? 'opacity-50' : ''}`}>{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-primary disabled:opacity-50"
      />
    </div>
  )
}

function CheckField({
  label, checked, disabled = false, onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={`flex items-center gap-2 text-xs ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary"
      />
      {label}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Audit helper components
// ---------------------------------------------------------------------------

function AuditMetric({
  label, value, delta, highlight = false,
}: {
  label: string
  value: string | number
  delta?: { text: string; good: boolean }
  highlight?: boolean
}) {
  return (
    <div className={`rounded border p-2 space-y-0.5 ${highlight ? 'border-primary/40 bg-primary/5' : ''}`}>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      <p className={`font-bold text-sm ${highlight ? 'text-primary' : ''}`}>{value}</p>
      {delta && (
        <p className={`text-[10px] font-medium ${delta.good ? 'text-green-600' : 'text-amber-600'}`}>
          {delta.text}
        </p>
      )}
    </div>
  )
}

function ScoringRow({ label, value }: { label: string; value: number }) {
  const isBonus = value > 0 && label.includes('Wishes')
  const isPenalty = value < 0
  return (
    <div className={`flex justify-between text-[11px] ${isPenalty ? 'text-red-500' : isBonus ? 'text-green-600' : 'text-muted-foreground'}`}>
      <span>{isPenalty ? '−' : isBonus ? '+' : ''} {label}</span>
      <span>{Math.abs(value).toLocaleString()}</span>
    </div>
  )
}

function ParticipationChart({
  matches, nameMap,
}: {
  matches: GeneratedMatch[]
  nameMap: Map<string, string>
}) {
  const counts = new Map<string, number>()
  for (const m of matches) {
    for (const id of [m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2]) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, c]) => c), 1)
  const colors = ['bg-red-500','bg-blue-500','bg-green-500','bg-yellow-400','bg-purple-500',
                  'bg-orange-500','bg-teal-500','bg-pink-500','bg-lime-500','bg-cyan-500',
                  'bg-rose-600','bg-indigo-500','bg-amber-500','bg-emerald-500','bg-fuchsia-500','bg-sky-500']
  return (
    <div className="space-y-1">
      {entries.map(([id, count], i) => (
        <div key={id} className="flex items-center gap-2">
          <span className="w-20 truncate text-right text-[11px] text-muted-foreground shrink-0">{nameMap.get(id) ?? id}</span>
          <div className="flex-1 bg-muted rounded h-4 overflow-hidden">
            <div
              className={`h-4 rounded ${colors[i % colors.length]}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-4 text-[11px] text-muted-foreground shrink-0">{count}</span>
        </div>
      ))}
    </div>
  )
}

function MatchTypeChart({ matches }: { matches: GeneratedMatch[] }) {
  const counts = new Map<string, number>()
  for (const m of matches) {
    counts.set(m.type, (counts.get(m.type) ?? 0) + 1)
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, c]) => c), 1)
  const colorMap: Record<string, string> = {
    "Men's Doubles":   'bg-red-500',
    "Women's Doubles": 'bg-pink-500',
    'Mixed Doubles':   'bg-green-500',
    'Doubles':         'bg-slate-400',
  }
  return (
    <div className="space-y-1">
      {entries.map(([type, count]) => (
        <div key={type} className="flex items-center gap-2">
          <span className="w-28 truncate text-right text-[11px] text-muted-foreground shrink-0">{type}</span>
          <div className="flex-1 bg-muted rounded h-4 overflow-hidden">
            <div
              className={`h-4 rounded ${colorMap[type] ?? 'bg-slate-400'}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-4 text-[11px] text-muted-foreground shrink-0">{count}</span>
        </div>
      ))}
    </div>
  )
}

function ConsecutiveAudit({
  matches, nameMap,
}: {
  matches: GeneratedMatch[]
  nameMap: Map<string, string>
}) {
  const violations: { player: string; games: string }[] = []
  for (let i = 0; i < matches.length - 1; i++) {
    const cur = matches[i]
    const next = matches[i + 1]
    const curPlayers = new Set([cur.team1Player1, cur.team1Player2, cur.team2Player1, cur.team2Player2])
    for (const id of [next.team1Player1, next.team1Player2, next.team2Player1, next.team2Player2]) {
      if (curPlayers.has(id)) {
        violations.push({ player: nameMap.get(id) ?? id, games: `Games ${cur.gameNumber} & ${next.gameNumber}` })
      }
    }
  }
  if (violations.length === 0) {
    return <p className="text-green-600 text-xs">✅ Clean Schedule — no consecutive games</p>
  }
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-muted-foreground border-b">
          <th className="text-left py-0.5">Player</th>
          <th className="text-left py-0.5">Conflict</th>
        </tr>
      </thead>
      <tbody>
        {violations.map((v, i) => (
          <tr key={i} className="border-b last:border-0">
            <td className="py-0.5">{v.player}</td>
            <td className="py-0.5 text-muted-foreground">{v.games}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
