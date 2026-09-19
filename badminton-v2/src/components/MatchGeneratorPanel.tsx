import { useState, useEffect, useRef, useId, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useRegisteredPlayers } from '@/hooks/useRegisteredPlayers'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { disambiguateDisplayNames, formatDisplayName } from '@/lib/formatDisplayName'
import { validateMatchPlayers } from '@/lib/matchPlayers'
import { assignSlot, EMPTY_SLOTS, type MatchSlots, type SlotKey } from '@/lib/matchSlots'
import { renderPlayerOptions } from '@/components/playerOptions'
import type { Json } from '@/types/database'
import {
  generateScheduleOptimized,
  DEFAULT_WEIGHTS,
  computeMatchType,
  forcedOpeningRepeats,
  type GeneratedMatch,
  type AuditData,
  type PinnedMatch,
} from '@/lib/matchGenerator'

const MATCH_TYPE_COLOR: Record<string, string> = {
  "Men's Doubles":   'text-red-500',
  "Women's Doubles": 'text-pink-500',
  'Mixed Doubles':   'text-green-500',
  '2Mvs2F Doubles':  'text-blue-900',
  '3-1 Doubles':     'text-blue-400',
}

interface Props {
  sessionId: string
  sessionStatus?: string
  onLock?: (matches: GeneratedMatch[]) => Promise<boolean>
  rosterVersion?: number
  courtCount?: number
}

function countPinnedPrefix(rows: Array<MatchSlots | null> | undefined): number {
  let n = 0
  for (const row of rows ?? []) {
    if (!row) break
    n++
  }
  return n
}

interface Settings {
  // Match Rules
  numMatches: number
  maxConsecutiveGames: number
  maxSpreadLimit: number
  disableGenderRules: boolean
  // Fixed opening games: index i = game i+1; null = engine picks. Always a
  // prefix — game 2 cannot be pinned unless game 1 is.
  pinnedGames: Array<MatchSlots | null>
  // Optimizer
  numTrials: number
  numStarts: number
  wishlistStr: string
  idealRestGames: number
  earlyRestWindow: number
  // Scoring Weights
  streakWeight: number
  imbalancePenalty: number
  wishlistReward: number
  repeatPartnerPenalty: number
  fairnessWeight: number
  spreadPenalty: number
  mixedDoublesPenalty: number
  genderSplitPenalty: number
  unevenGenderPenalty: number
  restSpacingPenalty: number
  earlyRestReward: number
  openingRepeatPenalty: number
  disabledWeights: string[]
}

const DEFAULTS: Settings = {
  numMatches: 20,
  maxConsecutiveGames: 1,
  maxSpreadLimit: 2,
  disableGenderRules: false,
  pinnedGames: [],
  idealRestGames: 2,
  earlyRestWindow: 20,
  numTrials: 2000,
  numStarts: 50,
  wishlistStr: '',
  streakWeight: DEFAULT_WEIGHTS.streakWeight,
  imbalancePenalty: DEFAULT_WEIGHTS.imbalancePenalty,
  wishlistReward: DEFAULT_WEIGHTS.wishlistReward,
  repeatPartnerPenalty: DEFAULT_WEIGHTS.repeatPartnerPenalty,
  fairnessWeight: DEFAULT_WEIGHTS.fairnessWeight,
  spreadPenalty: DEFAULT_WEIGHTS.spreadPenalty,
  mixedDoublesPenalty: DEFAULT_WEIGHTS.mixedDoublesPenalty,
  genderSplitPenalty: DEFAULT_WEIGHTS.genderSplitPenalty,
  unevenGenderPenalty: DEFAULT_WEIGHTS.unevenGenderPenalty,
  restSpacingPenalty: DEFAULT_WEIGHTS.restSpacingPenalty,
  earlyRestReward: DEFAULT_WEIGHTS.earlyRestReward,
  openingRepeatPenalty: DEFAULT_WEIGHTS.openingRepeatPenalty,
  disabledWeights: [],
}

type WeightKey = 'fairnessWeight' | 'streakWeight' | 'spreadPenalty' | 'unevenGenderPenalty'
  | 'genderSplitPenalty' | 'repeatPartnerPenalty' | 'mixedDoublesPenalty' | 'imbalancePenalty'
  | 'restSpacingPenalty' | 'openingRepeatPenalty' | 'wishlistReward' | 'earlyRestReward'

// Four families the 12 scoring weights fall into — same grouping picked in
// the empty-state/preset critique review, chosen over a flat 12-item grid
// because that blew past the >4-visible-options guideline.
//
// max/step are a guessed comfortable tuning range for the paired slider
// (docs/visual/match-generator-input-consistency-options.html, Option A) —
// roughly 2-3x each weight's default. The number input stays unbounded, so
// typing past the slider's max still works; the slider is a quick-feel
// accelerator, not a hard ceiling.
const WEIGHT_GROUPS: Array<{ name: string; items: Array<{ key: WeightKey; label: string; help: string; max: number; step: number }> }> = [
  {
    name: 'Fairness & Pacing',
    items: [
      { key: 'fairnessWeight',   label: 'Fairness Penalty',        help: 'Per game count gap (highest priority)', max: 10000, step: 100 },
      { key: 'streakWeight',     label: 'Fatigue Penalty',         help: 'Per game over max consecutive', max: 3000, step: 50 },
      { key: 'spreadPenalty',    label: 'Level Gap Penalty',       help: 'Per match where the skill spread across all 4 players exceeds Max Skill Gap (e.g. levels 3,4,9,10 → spread=7). Fires once per violation.', max: 2000, step: 50 },
      { key: 'imbalancePenalty', label: 'Level Imbalance Penalty', help: 'Per level diff between the two teams (e.g. team1=7 vs team2=11 → diff=4). Measures how competitive the match is.', max: 1000, step: 25 },
    ],
  },
  {
    name: 'Gender Rules',
    items: [
      { key: 'unevenGenderPenalty', label: 'Uneven Gender Penalty', help: 'Per 3M+1F or 3F+1M match', max: 1000, step: 25 },
      { key: 'genderSplitPenalty',  label: '2M vs 2F Penalty',      help: 'Per MM vs FF match (gender-separated teams)', max: 1000, step: 25 },
      { key: 'mixedDoublesPenalty', label: 'Mixed Doubles Penalty', help: 'Per MF vs MF match', max: 500, step: 25 },
    ],
  },
  {
    name: 'Rest & Opening',
    items: [
      { key: 'repeatPartnerPenalty', label: 'Repeat Partner Penalty', help: 'Per repeat partnership', max: 1000, step: 25 },
      { key: 'restSpacingPenalty',   label: 'Rest Spacing Penalty',   help: 'Per deviation from ideal rest games between matches', max: 200, step: 10 },
      { key: 'openingRepeatPenalty', label: 'First-on-Court Repeat',  help: 'Games 1..court count all start together. Charged per game short of the opening window (court count x 2) when one of those players is back on inside it, so a wider gap always costs less. With 14-15 players at least one such repeat is forced — what this changes is which one the engine picks.', max: 2000, step: 50 },
    ],
  },
  {
    name: 'Rewards',
    items: [
      { key: 'wishlistReward',  label: 'Wishlist Reward',    help: 'Per wishlist pair granted', max: 1000, step: 25 },
      { key: 'earlyRestReward', label: 'Clean Start Reward', help: 'Bonus per player appearance in the first N games (Early Rest Window) where rest gap ≥ ideal', max: 1000, step: 25 },
    ],
  },
]

// Everything in Settings except this session's specific players: pinned
// games name particular registrants, and the wishlist is particular pairs
// (e.g. "wes-yelli"). A preset is a scoring philosophy, not this week's
// roster, so saving/loading one never touches either field.
type PresetSettings = Omit<Settings, 'pinnedGames' | 'wishlistStr'>

function toPresetSettings(settings: Settings): PresetSettings {
  const { pinnedGames: _pinnedGames, wishlistStr: _wishlistStr, ...rest } = settings
  return rest
}

interface GeneratorPreset {
  id: string
  name: string
  settings: PresetSettings
}

export function buildRosterVersion(players: Array<{ id: string; gender: 'M' | 'F' | null; level: number | null }>): string {
  return players
    .map((player) => `${player.id}:${player.gender ?? ''}:${player.level ?? ''}`)
    .sort()
    .join('|')
}

export function MatchGeneratorPanel({ sessionId, sessionStatus, onLock, rosterVersion, courtCount = 2 }: Props) {
  const { user } = useAuth()
  const { players, isLoading } = useRegisteredPlayers(sessionId, rosterVersion)
  const [stage, setStage] = useState<'idle' | 'generating' | 'preview' | 'locking' | 'locked'>('idle')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [matches, setMatches] = useState<GeneratedMatch[]>([])
  const [audit, setAudit] = useState<AuditData | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [weightDrafts, setWeightDrafts] = useState<Partial<Record<keyof Settings, string>>>({})
  const [confirmingLock, setConfirmingLock] = useState(false)
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousRosterVersionRef = useRef<string | null>(null)
  const [lockedMatchMeta, setLockedMatchMeta] = useState<Array<{ id: string; status: string }>>([])
  const [editingGameNumber, setEditingGameNumber] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<MatchSlots>(EMPTY_SLOTS)
  // How many leading games in `matches` were pinned when they were produced.
  const [appliedPinCount, setAppliedPinCount] = useState(0)
  const [pinsOpen, setPinsOpen] = useState(false)
  const pinnedCount = countPinnedPrefix(settings.pinnedGames)
  const wishlistInputId = useId()

  // Named presets (docs/visual/match-generator-presets-options.html, Option
  // C) — global, not per-session, so the admin builds this list up once and
  // reuses it every week.
  const [presets, setPresets] = useState<GeneratorPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<'defaults' | string>('defaults')
  const [presetNameDraft, setPresetNameDraft] = useState<string | null>(null)
  const [savingPreset, setSavingPreset] = useState(false)
  const [confirmingDeletePreset, setConfirmingDeletePreset] = useState(false)
  const deletePresetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const presetNameInputId = useId()

  const loadPresets = useCallback(async () => {
    const { data, error } = await supabase
      .from('generator_presets')
      .select('id, name, settings')
      .order('name')
    if (error) {
      toast.error(`Could not load presets: ${error.message}`)
      return
    }
    setPresets((data ?? []) as unknown as GeneratorPreset[])
  }, [])

  useEffect(() => { loadPresets() }, [loadPresets])

  useEffect(() => {
    return () => { if (deletePresetTimerRef.current) clearTimeout(deletePresetTimerRef.current) }
  }, [])

  function applyPreset(id: string) {
    setSelectedPresetId(id)
    setConfirmingDeletePreset(false)
    if (id === 'defaults') {
      setSettings((prev) => ({ ...prev, ...toPresetSettings(DEFAULTS) }))
      return
    }
    const preset = presets.find((p) => p.id === id)
    if (preset) setSettings((prev) => ({ ...prev, ...preset.settings }))
  }

  async function savePreset() {
    const name = (presetNameDraft ?? '').trim()
    if (!name) return
    setSavingPreset(true)
    const { data, error } = await supabase
      .from('generator_presets')
      .insert({ name, settings: toPresetSettings(settings), created_by: user?.id ?? null })
      .select('id, name, settings')
      .single()
    setSavingPreset(false)
    if (error) {
      toast.error(`Could not save preset: ${error.message}`)
      return
    }
    const saved = data as unknown as GeneratorPreset
    setPresets((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedPresetId(saved.id)
    setPresetNameDraft(null)
    toast.success(`Saved preset "${saved.name}"`)
  }

  async function deleteSelectedPreset() {
    if (selectedPresetId === 'defaults') return
    if (!confirmingDeletePreset) {
      setConfirmingDeletePreset(true)
      deletePresetTimerRef.current = setTimeout(() => setConfirmingDeletePreset(false), 5000)
      return
    }
    if (deletePresetTimerRef.current) clearTimeout(deletePresetTimerRef.current)
    setConfirmingDeletePreset(false)
    const id = selectedPresetId
    const { error } = await supabase.from('generator_presets').delete().eq('id', id)
    if (error) {
      toast.error(`Could not delete preset: ${error.message}`)
      return
    }
    setPresets((prev) => prev.filter((p) => p.id !== id))
    setSelectedPresetId('defaults')
  }

  // A pin that is set but out of sight would silently fix game 1 every week.
  useEffect(() => {
    if (pinnedCount > 0) setPinsOpen(true)
  }, [pinnedCount])

  // Load existing locked matches from DB if session is already locked
  useEffect(() => {
    if (sessionStatus !== 'schedule_locked') return
    async function loadLocked() {
      const [matchesRes, sessionRes] = await Promise.all([
        supabase.from('matches').select('*').eq('session_id', sessionId).order('queue_position'),
        supabase.from('sessions').select('generator_settings').eq('id', sessionId).single(),
      ])
      if (!matchesRes.error && matchesRes.data) {
        const rows = matchesRes.data as Array<{
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
      if (!sessionRes.error && sessionRes.data?.generator_settings) {
        const loaded = sessionRes.data.generator_settings as Partial<Settings>
        setSettings((prev) => ({ ...prev, ...loaded }))
        setAppliedPinCount(countPinnedPrefix(loaded.pinnedGames))
      }
    }
    loadLocked()
  }, [sessionId, sessionStatus])

  // Cleanup lock confirm timer on unmount
  useEffect(() => {
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
      if (generateTimerRef.current) clearTimeout(generateTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const currentRosterVersion = buildRosterVersion(players)

    if (sessionStatus !== 'registration_closed') {
      previousRosterVersionRef.current = currentRosterVersion
      return
    }

    const previousRosterVersion = previousRosterVersionRef.current
    previousRosterVersionRef.current = currentRosterVersion

    if (previousRosterVersion == null || previousRosterVersion === currentRosterVersion) {
      return
    }

    if (generateTimerRef.current) {
      clearTimeout(generateTimerRef.current)
      generateTimerRef.current = null
    }

    setIsRegenerating(false)
    setMatches([])
    setAudit(null)
    setEditingGameNumber(null)
    setStage((currentStage) => (
      currentStage === 'preview' || currentStage === 'generating' ? 'idle' : currentStage
    ))
  }, [players, sessionStatus])

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
        await supabase.from('sessions').update({ generator_settings: settings as unknown as Json }).eq('id', sessionId)
        setStage('locked')
      } else {
        setStage('preview')
      }
    }
  }

  const effectiveNumMatches =
    settings.numMatches > 0 ? settings.numMatches : Math.ceil((players.length * 8) / 4)
  const targetGames = players.length >= 4
    ? (effectiveNumMatches * 4) / players.length
    : null

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

    const pinnedMatches = resolvePinnedMatches()
    if (pinnedMatches === null) return

    if (generateTimerRef.current) {
      clearTimeout(generateTimerRef.current)
      generateTimerRef.current = null
    }

    const fromPreview = stage === 'preview'
    if (fromPreview) {
      setIsRegenerating(true)
    } else {
      setStage('generating')
    }

    // Defer computation so React can render the loading state first
    generateTimerRef.current = setTimeout(() => {
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

      const w = (key: string, value: number) =>
        settings.disabledWeights.includes(key) ? 0 : value
      const scoreWeights = {
        streakWeight: w('streakWeight', settings.streakWeight),
        imbalancePenalty: w('imbalancePenalty', settings.imbalancePenalty),
        wishlistReward: w('wishlistReward', settings.wishlistReward),
        repeatPartnerPenalty: w('repeatPartnerPenalty', settings.repeatPartnerPenalty),
        fairnessWeight: w('fairnessWeight', settings.fairnessWeight),
        spreadPenalty: w('spreadPenalty', settings.spreadPenalty),
        mixedDoublesPenalty: w('mixedDoublesPenalty', settings.mixedDoublesPenalty),
        genderSplitPenalty: w('genderSplitPenalty', settings.genderSplitPenalty),
        unevenGenderPenalty: w('unevenGenderPenalty', settings.unevenGenderPenalty),
        restSpacingPenalty: w('restSpacingPenalty', settings.restSpacingPenalty),
        earlyRestReward: w('earlyRestReward', settings.earlyRestReward),
        openingRepeatPenalty: w('openingRepeatPenalty', settings.openingRepeatPenalty),
      }

      try {
        const result = generateScheduleOptimized(players, {
          numMatches: effectiveNumMatches,
          courtCount,
          maxConsecutiveGames: settings.maxConsecutiveGames,
          maxSpreadLimit: settings.maxSpreadLimit,
          disableGenderRules: settings.disableGenderRules,
          wishlistPairs,
          weights: scoreWeights,
          numTrials: settings.numTrials,
          numStarts: settings.numStarts,
          idealRestGames: settings.idealRestGames,
          earlyRestWindow: settings.earlyRestWindow,
          pinnedMatches,
        })
        setMatches(result.matches)
        setAudit(result.audit)
        setAppliedPinCount(pinnedMatches.length)
        setStage('preview')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not generate a schedule')
        if (!fromPreview) setStage('idle')
      }
      setIsRegenerating(false)
      generateTimerRef.current = null
    }, 50)
  }

  /**
   * Turns the settings rows into engine pins. Returns null (after a toast)
   * when a pin cannot be honoured; soft problems only warn.
   */
  function resolvePinnedMatches(): PinnedMatch[] | null {
    const rows = settings.pinnedGames.slice(0, courtCount)
    const registered = new Set(players.map((p) => p.id))
    const levelOf = new Map(players.map((p) => [p.id, p.level ?? 5]))
    const pins: PinnedMatch[] = []
    const seen = new Map<string, number>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) break
      const game = i + 1
      const ids = [row.t1p1, row.t1p2, row.t2p1, row.t2p2]

      if (ids.some((id) => !id)) {
        toast.error(`Game ${game}: fill all four slots or untick Pin`)
        return null
      }
      const validation = validateMatchPlayers(ids, (id) => nameMap.get(id) ?? 'This player')
      if (!validation.ok) {
        toast.error(`Game ${game}: ${validation.message}`)
        return null
      }
      const missing = ids.find((id) => !registered.has(id))
      if (missing) {
        toast.error(`Game ${game}: ${nameMap.get(missing) ?? 'a pinned player'} is no longer registered`)
        return null
      }

      for (const id of ids) {
        const earlier = seen.get(id)
        if (earlier !== undefined) {
          toast.warning(`${nameMap.get(id) ?? 'A player'} is in both Game ${earlier} and Game ${game} — they start at the same time`)
        }
        seen.set(id, game)
      }
      const levels = ids.map((id) => Math.round(levelOf.get(id) ?? 5))
      const spread = Math.max(...levels) - Math.min(...levels)
      if (spread > settings.maxSpreadLimit) {
        toast.warning(`Game ${game} exceeds the skill gap limit (spread ${spread})`)
      }

      pins.push({ team1: [row.t1p1, row.t1p2], team2: [row.t2p1, row.t2p2] })
    }
    return pins
  }

  function setPinnedGame(index: number, slots: MatchSlots | null) {
    setSettings((prev) => {
      const next = [...prev.pinnedGames]
      while (next.length <= index) next.push(null)
      next[index] = slots
      // Keep pins a prefix: unpinning game N also unpins everything after it.
      if (slots === null) next.length = index
      return { ...prev, pinnedGames: next }
    })
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

    const validation = validateMatchPlayers(
      [editForm.t1p1, editForm.t1p2, editForm.t2p1, editForm.t2p2],
      (id) => nameMap.get(id) ?? 'This player',
    )
    if (!validation.ok) { toast.error(validation.message); return }

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

  // Qualify players who share a nickname, so "Alexis & Alexis" in the preview
  // always means two different people and never reads as a duplicate.
  const nameMap = disambiguateDisplayNames(
    players.map((p) => ({ id: p.id, nameSlug: p.nameSlug, displayName: formatDisplayName(p.nickname, p.nameSlug) }))
  )
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

            {/* Presets — a saved scoring philosophy, reused across weeks.
                Never touches pinnedGames/wishlistStr; see toPresetSettings. */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <select
                  aria-label="Settings preset"
                  className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
                  value={selectedPresetId}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '__save__') {
                      setPresetNameDraft('')
                      e.target.value = selectedPresetId
                      return
                    }
                    applyPreset(v)
                  }}
                >
                  <option value="defaults">Preset: Defaults</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>Preset: {p.name}</option>
                  ))}
                  <option value="__save__">+ Save current as new preset…</option>
                </select>
                {selectedPresetId !== 'defaults' && (
                  <Button
                    type="button"
                    variant={confirmingDeletePreset ? 'destructive' : 'outline'}
                    className="h-8 shrink-0 px-2 text-xs"
                    onClick={deleteSelectedPreset}
                  >
                    {confirmingDeletePreset ? 'Confirm?' : 'Delete'}
                  </Button>
                )}
              </div>
              {presetNameDraft !== null && (
                <div className="flex items-center gap-2">
                  <Label htmlFor={presetNameInputId} className="sr-only">New preset name</Label>
                  <Input
                    id={presetNameInputId}
                    autoFocus
                    placeholder="Preset name, e.g. Tournament night"
                    value={presetNameDraft}
                    onChange={(e) => setPresetNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setPresetNameDraft(null) }}
                    className="h-8 flex-1 text-xs"
                  />
                  <Button type="button" className="h-8 shrink-0 px-3 text-xs" disabled={!presetNameDraft.trim() || savingPreset} onClick={savePreset}>
                    Save
                  </Button>
                  <Button type="button" variant="outline" className="h-8 shrink-0 px-3 text-xs" onClick={() => setPresetNameDraft(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>

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
                <p className="text-xs -mt-1 text-muted-foreground">
                  ~{Number.isInteger(targetGames) ? targetGames : targetGames.toFixed(1)} games each
                </p>
              )}
              <SliderField
                label="Max Consecutive Games"
                value={settings.maxConsecutiveGames}
                min={1} max={5}
                onChange={(v) => set('maxConsecutiveGames', v)}
              />
              <SliderField
                label="Ideal Rest Between Games"
                value={settings.idealRestGames}
                min={0} max={5}
                onChange={(v) => set('idealRestGames', v)}
              />
              <SliderField
                label="Clean Start Window (games)"
                value={settings.earlyRestWindow}
                min={1} max={50}
                onChange={(v) => set('earlyRestWindow', v)}
              />
              <SliderField
                label="Max Skill Gap per Match"
                value={settings.maxSpreadLimit}
                min={0} max={9}
                onChange={(v) => set('maxSpreadLimit', v)}
                help="Max allowed spread between the highest and lowest player level in a single match (across all 4 players). Matches exceeding this count as a Skill Gap Violation."
              />

              <CheckField
                label="Disable Gender Rules"
                checked={settings.disableGenderRules}
                onChange={(v) => set('disableGenderRules', v)}
                help="When checked, gender is ignored when forming matches — any 4 players can be grouped together. Gender-based penalties (Mixed Doubles, 2Mvs2F, 3-1 uneven) are not applied. Auto-enabled if any player has no gender assigned."
              />
            </div>

            <hr />

            {/* Fixed Opening Games — rare, so closed unless something is pinned */}
            <details open={pinsOpen} onToggle={(e) => setPinsOpen(e.currentTarget.open)}>
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground select-none">
                Fixed Opening Games {pinsOpen ? '▲' : '▼'}
                {pinnedCount > 0 && (
                  <span className="ml-2 rounded border border-gold/40 px-1 text-[10px] font-bold tracking-wide text-gold-ink">
                    {pinnedCount} pinned
                  </span>
                )}
              </summary>
              <p className="mt-1 mb-2 text-[11px] text-muted-foreground">
                Pick the players for the games that start together. The engine fills the rest around them.
              </p>
              <div className="space-y-2">
              {Array.from({ length: courtCount }, (_, i) => {
                const slots = settings.pinnedGames[i] ?? null
                const previousPinned = i === 0 || settings.pinnedGames[i - 1] != null
                return (
                  <div key={i} className="rounded-md border p-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <CheckField
                        label="Pin"
                        checked={slots !== null}
                        disabled={!previousPinned}
                        help={previousPinned ? undefined : `Pin Game ${i} first`}
                        onChange={(v) => setPinnedGame(i, v ? EMPTY_SLOTS : null)}
                      />
                      <span className="font-medium">Game {i + 1}</span>
                      <span className="ml-auto text-muted-foreground">{slots ? 'fixed' : 'engine picks'}</span>
                    </div>
                    {slots && (
                      <FourSlotPicker
                        value={slots}
                        onChange={(next) => setPinnedGame(i, next)}
                        players={players}
                        name={name}
                      />
                    )}
                  </div>
                )
              })}
              </div>
            </details>

            <hr />

            {/* Optimizer */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Optimizer
              </p>

              <SliderField
                label="Optimizer Restarts"
                value={settings.numStarts}
                min={1} max={30} step={1}
                onChange={(v) => set('numStarts', v)}
              />

              <SliderField
                label="Trials per Restart"
                value={settings.numTrials}
                min={10} max={5000} step={10}
                onChange={(v) => set('numTrials', v)}
              />

              <div className="space-y-1">
                <Label htmlFor={wishlistInputId} className="text-xs">
                  Partner Wishlist
                  <span className="ml-1 text-muted-foreground font-normal">(slug1-slug2, slug3-slug4)</span>
                </Label>
                <Input
                  id={wishlistInputId}
                  placeholder="e.g. wes-yelli, aj-czarina"
                  value={settings.wishlistStr}
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
              {WEIGHT_GROUPS.map((group) => (
                <div key={group.name} className="mt-3 first:mt-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                    {group.name}
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2">
                    {group.items.map(({ key, label, help, max, step }) => {
                      const genderKey = key === 'mixedDoublesPenalty' || key === 'genderSplitPenalty' || key === 'unevenGenderPenalty'
                      const autoDisabled = genderKey && settings.disableGenderRules
                      const manuallyDisabled = settings.disabledWeights.includes(key)
                      const disabled = autoDisabled || manuallyDisabled
                      return (
                        <div key={key} className={`space-y-1 ${disabled ? 'opacity-40' : ''}`}>
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={!manuallyDisabled}
                              disabled={autoDisabled}
                              onChange={() => {
                                setSettings((prev) => ({
                                  ...prev,
                                  disabledWeights: manuallyDisabled
                                    ? prev.disabledWeights.filter((k) => k !== key)
                                    : [...prev.disabledWeights, key],
                                }))
                              }}
                              className="h-4 w-4 rounded accent-primary"
                            />
                            {label}
                            <HelpPopover text={help} />
                          </label>
                          <Input
                            type="number"
                            aria-label={`${label} value`}
                            value={weightDrafts[key] ?? settings[key]}
                            onChange={(e) => {
                              const raw = e.target.value
                              setWeightDrafts((prev) => ({ ...prev, [key]: raw }))
                              if (raw !== '' && !Number.isNaN(+raw)) {
                                set(key, +raw)
                              }
                            }}
                            onBlur={() => {
                              setWeightDrafts((prev) => {
                                if (!(key in prev)) return prev
                                const raw = prev[key]
                                if (raw === '' || raw === undefined || Number.isNaN(+raw)) {
                                  set(key, 0)
                                }
                                const next = { ...prev }
                                delete next[key]
                                return next
                              })
                            }}
                            className="h-7 text-xs"
                            disabled={disabled}
                          />
                          <input
                            type="range"
                            aria-label={`${label} slider`}
                            min={0} max={max} step={step}
                            value={Math.min(Math.max(settings[key], 0), max)}
                            disabled={disabled}
                            onChange={(e) => set(key, +e.target.value)}
                            className="w-full accent-primary disabled:opacity-50"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </details>
          </div>
        )}

        {/* ── Generate Buttons ───────────────────────────────── */}
        {stage === 'idle' ? (
          <Button onClick={handleGenerate} disabled={players.length < 4} className="w-full">
            {`Generate Schedule (${settings.numStarts}×${settings.numTrials})`}
          </Button>
        ) : stage === 'generating' ? (
          <div className="space-y-2">
            <div className="text-xs text-center text-muted-foreground animate-pulse">
              {`Running ${settings.numStarts}×${settings.numTrials} trials…`}
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
                : `Generate Again (${settings.numStarts}×${settings.numTrials})`}
            </Button>

            {/* Engine Audit Report */}
            {audit && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <AuditMetric label="Optimizer Score"       value={audit.score.toLocaleString()} highlight />
                  {/* Shown against its floor. The opening window holds more
                      seats than the roster at 14-15 players, so some repeats are
                      forced — a bare count makes an optimal schedule look broken. */}
                  {(() => {
                    const floor = forcedOpeningRepeats(courtCount, players.length)
                    const atFloor = audit.openingRepeats <= floor
                    return (
                      <AuditMetric
                        label={`First-on-Court Repeats (by game ${courtCount * 2})`}
                        value={floor > 0 ? `${audit.openingRepeats} / min ${floor}` : audit.openingRepeats}
                        delta={atFloor
                          ? { text: floor === 0 ? 'None' : 'Best possible', good: true }
                          : { text: `${audit.openingRepeats - floor} avoidable`, good: false }}
                      />
                    )
                  })()}
                  <AuditMetric label="Game Count Violations" value={audit.participationGap} delta={audit.participationGap === 0 ? { text: 'Perfect', good: true } : { text: 'Uneven', good: false }} />
                  <AuditMetric label="Streak Violations"     value={audit.streakViolations} />
                  <AuditMetric label="Partners Repeated"     value={audit.repeatPartners} />
                  <AuditMetric label="Wishes Granted"        value={audit.wishesGranted} />
                  <AuditMetric label="Skill Gap Violations"  value={audit.wideGaps} delta={audit.wideGaps === 0 ? { text: 'Consistent', good: true } : { text: 'Poor Quality', good: false }} />
                  <AuditMetric label="Mixed Doubles"          value={audit.mixedDoubles} />
                  <AuditMetric label="2M vs 2F"                value={audit.genderSplitMatches} />
                  <AuditMetric label="Uneven Gender (3+1)"     value={audit.unevenGenderMatches} />
                  <AuditMetric label="Rest Spacing Deviations" value={audit.restSpacingDeviations} />
                  <AuditMetric label="Clean Start Reward" value={audit.earlyRestClean} delta={audit.earlyRestClean > 0 ? { text: '+bonus', good: true } : undefined} />
                </div>

                <details className="rounded-md border p-2 text-xs">
                  <summary className="cursor-pointer font-semibold select-none">Scoring Math ▼</summary>
                  <div className="mt-2 space-y-1 font-mono">
                    <ScoringRow label={`Base score (${matches.length} × 500)`} value={matches.length * 500} />
                    <ScoringRow label={`Level Imbalance (${audit.levelGaps} × ${settings.imbalancePenalty})`}       value={-(audit.levelGaps * settings.imbalancePenalty)} />
                    <ScoringRow label={`Participation Gap (${audit.participationGap} × ${settings.fairnessWeight})`} value={-(audit.participationGap * settings.fairnessWeight)} />
                    <ScoringRow label={`Fatigue (${audit.streakViolations} × ${settings.streakWeight})`}             value={-(audit.streakViolations * settings.streakWeight)} />
                    <ScoringRow label={`Repeat Partners (${audit.repeatPartners} × ${settings.repeatPartnerPenalty})`} value={-(audit.repeatPartners * settings.repeatPartnerPenalty)} />
                    <ScoringRow label={`Skill Gap Violations (${audit.wideGaps} × ${settings.spreadPenalty})`}       value={-(audit.wideGaps * settings.spreadPenalty)} />
                    <ScoringRow label={`Mixed Doubles (${audit.mixedDoubles} × ${settings.mixedDoublesPenalty})`}       value={-(audit.mixedDoubles * settings.mixedDoublesPenalty)} />
                    <ScoringRow label={`Rest Spacing (${audit.restSpacingDeviations} × ${settings.restSpacingPenalty})`} value={-(audit.restSpacingDeviations * settings.restSpacingPenalty)} />
                    <ScoringRow label={`First-on-Court Repeats (${audit.openingRepeats} × ${settings.openingRepeatPenalty}+)`} value={-(audit.openingRepeats * settings.openingRepeatPenalty)} />
                    <ScoringRow label={`Clean Start Reward (${audit.earlyRestClean} × ${settings.earlyRestReward})`} value={audit.earlyRestClean * settings.earlyRestReward} />
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
                  <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Player Participation ({countParticipants(matches)}/{players.length})
                  </p>
                  <ParticipationChart matches={matches} nameMap={nameMap} allPlayerIds={players.map((p) => p.id)} />
                </div>
                <div>
                  <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">Match Type Summary</p>
                  <MatchTypeChart matches={matches} />
                </div>
                <div>
                  <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">Consecutive Game Audit</p>
                  <ConsecutiveAudit matches={matches} nameMap={nameMap} />
                </div>
                <div>
                  <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Rest Spacing Grid
                    <span className="ml-1 font-normal normal-case text-muted-foreground">(ideal rest: {settings.idealRestGames})</span>
                  </p>
                  <RestSpacingChart matches={matches} nameMap={nameMap} idealRestGames={settings.idealRestGames} />
                </div>
              </div>
            )}

            {/* Partner Pairing Summary */}
            {matches.length > 0 && (
              <details className="rounded-md border p-2 text-xs">
                <summary className="cursor-pointer font-semibold select-none">Partner Pairing Summary ▼</summary>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <PartnerPairChart matches={matches} nameMap={nameMap} />
                </div>
              </details>
            )}

            {/* Match Breakdown */}
            {matches.length > 0 && (
              <details className="rounded-md border p-2 text-xs">
                <summary className="cursor-pointer font-semibold select-none">Match Breakdown ▼</summary>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="py-1 pr-2">#</th>
                        <th className="py-1 pr-2">Type</th>
                        <th className="py-1 pr-2">Lvl</th>
                        <th className="py-1 pr-2">Gap</th>
                        <th className="py-1">Teams</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((m) => {
                        const gap = Math.abs(m.team1Level - m.team2Level)
                        return (
                          <tr key={m.gameNumber} className="border-b last:border-0">
                            <td className="py-1 pr-2 font-medium">{m.gameNumber}</td>
                            <td className="py-1 pr-2">{m.type}</td>
                            <td className="py-1 pr-2">{m.team1Level}v{m.team2Level}</td>
                            <td className={`py-1 pr-2 ${gap > 2 ? 'text-red-500' : gap > 0 ? 'text-amber-500' : 'text-green-500'}`}>{gap}</td>
                            <td className="py-1 text-muted-foreground">
                              {name(m.team1Player1)}&nbsp;+&nbsp;{name(m.team1Player2)} vs {name(m.team2Player1)}&nbsp;+&nbsp;{name(m.team2Player2)}
                            </td>
                          </tr>
                        )
                      })}
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
                  {m.gameNumber <= appliedPinCount && <PinnedChip />}
                  <span className={`text-xs font-semibold mr-2 ${MATCH_TYPE_COLOR[m.type] ?? 'text-muted-foreground'}`}>[{m.type}]</span>
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

            {/* Audit panels — live, recomputed from current matches + players */}
            {matches.length > 0 && players.length > 0 && (() => {
              const genderMap = new Map(players.map((p) => [p.id, p.gender ?? 'M']))
              const enrichedMatches = matches.map((m) => ({
                ...m,
                type: computeMatchType(m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2, genderMap),
              }))
              return (
                <div className="grid grid-cols-1 gap-4 text-xs">
                  <div>
                    <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      Player Participation ({countParticipants(enrichedMatches)}/{players.length})
                    </p>
                    <ParticipationChart matches={enrichedMatches} nameMap={nameMap} allPlayerIds={players.map((p) => p.id)} />
                  </div>
                  <div>
                    <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">Match Type Summary</p>
                    <MatchTypeChart matches={enrichedMatches} />
                  </div>
                  <div>
                    <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">Consecutive Game Audit</p>
                    <ConsecutiveAudit matches={enrichedMatches} nameMap={nameMap} />
                  </div>
                  <div>
                    <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      Rest Spacing Grid
                      <span className="ml-1 font-normal normal-case text-muted-foreground">(ideal rest: {settings.idealRestGames})</span>
                    </p>
                    <RestSpacingChart matches={enrichedMatches} nameMap={nameMap} idealRestGames={settings.idealRestGames} />
                  </div>
                </div>
              )
            })()}

            {/* Partner Pairing Summary */}
            {matches.length > 0 && (
              <details className="rounded-md border p-2 text-xs">
                <summary className="cursor-pointer font-semibold select-none">Partner Pairing Summary ▼</summary>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <PartnerPairChart matches={matches} nameMap={nameMap} />
                </div>
              </details>
            )}

            {(() => {
              const genderMap = new Map(players.map((p) => [p.id, p.gender ?? 'M']))
              return (
                <ul className="space-y-1 max-h-[500px] overflow-y-auto">
                  {matches.map((m, idx) => {
                    const meta = lockedMatchMeta[idx]
                    const isQueued = !meta || meta.status === 'queued'
                    const isEditing = editingGameNumber === m.gameNumber
                    const matchType = computeMatchType(m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2, genderMap)
                    return (
                      <li key={m.gameNumber} className="py-1.5 border-b last:border-0">
                        {isEditing ? (
                          <div className="space-y-2 text-xs">
                            <p className="font-medium text-muted-foreground">Game {m.gameNumber} — Edit Players</p>
                            <FourSlotPicker value={editForm} onChange={setEditForm} players={players} name={name} />
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7 text-xs" onClick={() => handleEditSave(m.gameNumber)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleEditCancel}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span>
                              <span className="font-medium text-muted-foreground mr-2">{m.gameNumber}.</span>
                              {m.gameNumber <= appliedPinCount && <PinnedChip />}
                              <span className={`text-xs font-semibold mr-2 ${MATCH_TYPE_COLOR[matchType] ?? 'text-muted-foreground'}`}>[{matchType}]</span>
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
              )
            })()}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Small reusable field components
// ---------------------------------------------------------------------------

/**
 * Tap-to-reveal replacement for a bare `title=` tooltip
 * (docs/visual/match-generator-help-options.html, Option A) — hover-only
 * help is unreachable on the touch device this panel is meant to run on.
 */
function HelpPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="What does this do?"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] font-bold leading-none ${
          open ? 'border-primary-ink text-primary-ink bg-primary-subtle' : 'border-muted-foreground text-muted-foreground'
        }`}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-5 z-10 w-56 rounded-lg border border-primary-ink bg-popover p-2.5 text-[11.5px] font-normal leading-snug normal-case tracking-normal text-popover-foreground shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  )
}

function SliderField({
  label, value, min, max, step = 1, disabled = false, help, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  help?: string
  onChange: (v: number) => void
}) {
  const inputId = useId()
  const numberId = useId()
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId} className={`flex items-center gap-1 text-xs ${disabled ? 'opacity-50' : ''}`}>
          {label}
          {help && <HelpPopover text={help} />}
        </Label>
        <input
          id={numberId}
          aria-label={`${label} value`}
          type="number"
          min={min} max={max} step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') return
            const n = +raw
            if (!Number.isNaN(n)) onChange(n)
          }}
          className="h-6 w-16 shrink-0 rounded border bg-background px-1.5 text-right text-xs disabled:opacity-50"
        />
      </div>
      <input
        id={inputId}
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
  label, checked, disabled = false, help, onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  help?: string
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
      {help && <HelpPopover text={help} />}
    </label>
  )
}

function PinnedChip() {
  return (
    <span className="mr-2 rounded border border-gold/40 px-1 text-[10px] font-bold uppercase tracking-wide text-gold-ink">
      Pinned
    </span>
  )
}

/**
 * Four dropdowns in Team 1 / Team 2 boxes. Picking a player who already holds
 * another slot swaps the two, so no one has to be parked on a stranger first;
 * the swapped pair flashes briefly so the second move is not missed.
 */
function FourSlotPicker({
  value, onChange, players, name,
}: {
  value: MatchSlots
  onChange: (next: MatchSlots) => void
  players: Array<{ id: string }>
  name: (id: string) => string
}) {
  const [flashed, setFlashed] = useState<SlotKey[]>([])
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current) }, [])

  const inMatch = new Set([value.t1p1, value.t1p2, value.t2p1, value.t2p2].filter(Boolean))

  const handleChange = (key: SlotKey, id: string) => {
    const { next, swappedWith } = assignSlot(value, key, id)
    onChange(next)
    if (swappedWith) {
      setFlashed([key, swappedWith])
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setFlashed([]), 1200)
    }
  }

  const renderSelect = (key: SlotKey, slotIndex: number) => (
    <select
      key={key}
      value={value[key]}
      onChange={(e) => handleChange(key, e.target.value)}
      className={`player-select w-full h-8 rounded border bg-background text-foreground px-2 text-xs transition-colors ${
        flashed.includes(key) ? 'border-court2 ring-1 ring-court2' : 'border-input'
      }`}
    >
      <option value="">— P{slotIndex + 1} —</option>
      {renderPlayerOptions(players, inMatch, value[key], (p) => name(p.id))}
    </select>
  )
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
      <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-2 space-y-1">
        <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1">Team 1</p>
        {renderSelect('t1p1', 0)}
        {renderSelect('t1p2', 1)}
      </div>
      <span className="text-xs font-bold text-muted-foreground text-center">vs</span>
      <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-2 space-y-1">
        <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide mb-1">Team 2</p>
        {renderSelect('t2p1', 0)}
        {renderSelect('t2p2', 1)}
      </div>
    </div>
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

function countParticipants(matches: GeneratedMatch[]): number {
  const ids = new Set<string>()
  for (const m of matches) {
    ids.add(m.team1Player1)
    ids.add(m.team1Player2)
    ids.add(m.team2Player1)
    ids.add(m.team2Player2)
  }
  return ids.size
}

function ParticipationChart({
  matches, nameMap, allPlayerIds,
}: {
  matches: GeneratedMatch[]
  nameMap: Map<string, string>
  allPlayerIds?: string[]
}) {
  const counts = new Map<string, number>()
  for (const id of allPlayerIds ?? []) {
    counts.set(id, 0)
  }
  for (const m of matches) {
    for (const id of [m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2]) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, c]) => c), 1)
  return (
    <div className="space-y-1">
      {entries.map(([id, count]) => (
        <div key={id} className="flex items-center gap-2">
          <span className={`w-20 truncate text-right text-[11px] shrink-0 ${count === 0 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{nameMap.get(id) ?? id}</span>
          <div className="flex-1 bg-muted rounded h-4 overflow-hidden">
            <div
              className={`h-4 rounded ${count === 0 ? 'bg-red-500' : 'bg-primary'}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className={`w-4 text-[11px] shrink-0 ${count === 0 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>{count}</span>
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
    '2Mvs2F Doubles':  'bg-blue-900',
    '3-1 Doubles':     'bg-blue-400',
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

function PartnerPairChart({
  matches, nameMap,
}: {
  matches: GeneratedMatch[]
  nameMap: Map<string, string>
}) {
  const counts = new Map<string, number>()
  for (const m of matches) {
    for (const pair of [[m.team1Player1, m.team1Player2], [m.team2Player1, m.team2Player2]]) {
      const key = [...pair].sort().join('|')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, c]) => c), 1)
  return (
    <div className="space-y-1">
      {entries.map(([key, count]) => {
        const [id1, id2] = key.split('|')
        const label = `${nameMap.get(id1) ?? id1} & ${nameMap.get(id2) ?? id2}`
        const isHigh = count > 1 && count >= max / 2
        return (
          <div key={key} className="flex items-center gap-2">
            <span className={`w-40 truncate text-right text-[11px] shrink-0 ${isHigh ? 'text-orange-500 font-semibold' : 'text-muted-foreground'}`} title={label}>
              {label}
            </span>
            <div className="flex-1 bg-muted rounded h-4 overflow-hidden">
              <div
                className={`h-4 rounded ${isHigh ? 'bg-orange-500' : 'bg-slate-400'}`}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className={`w-4 text-[11px] shrink-0 ${isHigh ? 'text-orange-500 font-semibold' : 'text-muted-foreground'}`}>{count}</span>
          </div>
        )
      })}
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

function RestSpacingChart({
  matches, nameMap, idealRestGames,
}: {
  matches: GeneratedMatch[]
  nameMap: Map<string, string>
  idealRestGames: number
}) {
  const numGames = matches.length
  const idealGap = idealRestGames + 1

  // Build per-player game index sets
  const playerGames = new Map<string, Set<number>>()
  for (const m of matches) {
    for (const id of [m.team1Player1, m.team1Player2, m.team2Player1, m.team2Player2]) {
      if (!playerGames.has(id)) playerGames.set(id, new Set())
      playerGames.get(id)!.add(m.gameNumber)
    }
  }

  // Sort players by first game appearance
  const players = [...playerGames.entries()].sort((a, b) => {
    const aFirst = Math.min(...a[1])
    const bFirst = Math.min(...b[1])
    return aFirst - bFirst
  })

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* Header row: game numbers */}
        <div className="flex items-center gap-0 mb-1">
          <span className="w-20 shrink-0" />
          {Array.from({ length: numGames }, (_, i) => (
            <span key={i} className="w-5 text-center text-[9px] text-muted-foreground">{i + 1}</span>
          ))}
        </div>
        {/* Player rows */}
        {players.map(([id, gameSet]) => {
          const sortedGames = [...gameSet].sort((a, b) => a - b)
          return (
            <div key={id} className="flex items-center gap-0 mb-0.5">
              <span className="w-20 truncate text-right text-[10px] text-muted-foreground shrink-0 pr-1">
                {nameMap.get(id) ?? id}
              </span>
              {Array.from({ length: numGames }, (_, i) => {
                const g = i + 1
                const plays = gameSet.has(g)
                let dotColor = ''
                if (plays) {
                  // Find previous game to compute gap
                  const prev = sortedGames.filter(x => x < g).at(-1)
                  if (prev === undefined) {
                    dotColor = 'bg-primary' // first game, no gap to judge
                  } else {
                    const gap = g - prev
                    const under = idealGap - gap  // positive = rested less than ideal
                    if (under <= 0) dotColor = 'bg-green-500'        // rested enough or more
                    else if (under === 1) dotColor = 'bg-amber-400'  // 1 less than ideal
                    else dotColor = 'bg-red-500'                      // 2+ less than ideal
                  }
                }
                return (
                  <div key={g} className="w-5 flex items-center justify-center">
                    {plays
                      ? <div className={`w-3 h-3 rounded-full ${dotColor}`} title={`Game ${g}`} />
                      : <div className="w-1 h-1 rounded-full bg-muted" />
                    }
                  </div>
                )
              })}
            </div>
          )
        })}
        {/* Legend */}
        <div className="flex items-center gap-3 mt-2 pl-20 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Ideal or more rest</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> 1 game short</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> 2+ games short</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> First game</span>
        </div>
      </div>
    </div>
  )
}
