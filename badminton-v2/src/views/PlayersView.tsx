import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { usePlayers } from '@/hooks/usePlayers'

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

type StatusFilter = 'all' | 'active' | 'inactive'

function matchesSearch(value: string | null | undefined, query: string) {
  return (value ?? '').toLowerCase().includes(query)
}

function genderLabel(gender: 'M' | 'F' | null) {
  if (gender === 'M') return 'Male'
  if (gender === 'F') return 'Female'
  return 'Unspecified'
}

function statusBadgeVariant(isActive: boolean) {
  return isActive ? 'default' : 'outline'
}

function NicknameCell({
  id,
  initial,
  onSave,
  className,
}: {
  id: string
  initial: string | null
  onSave: (id: string, val: string | null) => Promise<void>
  className?: string
}) {
  const [value, setValue] = useState(initial ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = value !== (initial ?? '')

  async function handleBlur() {
    if (!dirty) return
    setSaving(true)
    setSaved(false)
    await onSave(id, value.trim() || null)
    setSaving(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1200)
  }

  return (
    <div className={cn('space-y-1', className)}>
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add nickname"
        disabled={saving}
        className="h-8 min-w-0 bg-background text-sm"
      />
      <p className="min-h-4 text-[11px] text-muted-foreground">
        {saving ? 'Saving...' : saved ? 'Saved' : dirty ? 'Save on blur' : '\u00A0'}
      </p>
    </div>
  )
}

function GenderToggle({
  value,
  onChange,
}: {
  value: 'M' | 'F' | null
  onChange: (value: 'M' | 'F' | null) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-input bg-background p-0.5">
      {([
        ['M', 'Male'],
        ['F', 'Female'],
      ] as const).map(([code, label]) => {
        const active = value === code
        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(active ? null : code)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            aria-pressed={active}
            title={label}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}

function PlayerStatusButton({
  isActive,
  onToggle,
}: {
  isActive: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      onClick={onToggle}
    >
      {isActive ? 'Active' : 'Inactive'}
    </Button>
  )
}

function PlayerCard({
  player,
  onSaveNickname,
  onUpdatePlayer,
  onToggleActive,
}: {
  player: {
    id: string
    nameSlug: string
    email: string | null
    nickname: string | null
    gender: 'M' | 'F' | null
    level: number | null
    isActive: boolean
  }
  onSaveNickname: (id: string, nickname: string | null) => Promise<void>
  onUpdatePlayer: (id: string, updates: { gender?: 'M' | 'F' | null; level?: number | null }) => Promise<void>
  onToggleActive: (id: string, isActive: boolean) => Promise<void>
}) {
  return (
    <Card
      className={cn(
        'md:hidden',
        player.isActive ? 'border-border bg-card' : 'border-border bg-muted/20'
      )}
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold text-foreground">{player.nameSlug}</p>
            <p className="truncate text-sm text-muted-foreground">{player.email ?? 'No email'}</p>
          </div>
          <Badge variant={statusBadgeVariant(player.isActive)}>
            {player.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <NicknameCell
          id={player.id}
          initial={player.nickname}
          onSave={onSaveNickname}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Gender
            </p>
            <GenderToggle
              value={player.gender}
              onChange={(gender) => onUpdatePlayer(player.id, { gender })}
            />
            <p className="text-xs text-muted-foreground">{genderLabel(player.gender)}</p>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Level
            </span>
            <select
              value={player.level ?? ''}
              onChange={(e) => onUpdatePlayer(player.id, { level: e.target.value ? +e.target.value : null })}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Not set</option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">1 = Beginner, 10 = Advanced</p>
          </label>
        </div>

        <PlayerStatusButton
          isActive={player.isActive}
          onToggle={() => onToggleActive(player.id, !player.isActive)}
        />
      </CardContent>
    </Card>
  )
}

export function PlayersView() {
  const { players, isLoading, updatePlayer, setActive } = usePlayers()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  async function saveNickname(id: string, nickname: string | null) {
    await updatePlayer(id, { nickname })
  }

  const activeCount = players.filter((player) => player.isActive).length
  const inactiveCount = players.length - activeCount
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const visiblePlayers = [...players]
    .filter((player) => {
      if (statusFilter === 'active') return player.isActive
      if (statusFilter === 'inactive') return !player.isActive
      return true
    })
    .filter((player) => {
      if (!normalizedQuery) return true
      return (
        matchesSearch(player.nameSlug, normalizedQuery) ||
        matchesSearch(player.nickname, normalizedQuery) ||
        matchesSearch(player.email, normalizedQuery)
      )
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      const aNick = Boolean(a.nickname)
      const bNick = Boolean(b.nickname)
      if (aNick !== bNick) return aNick ? -1 : 1
      return (a.nickname ?? a.nameSlug).localeCompare(b.nickname ?? b.nameSlug)
    })

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Players</h1>
            <Badge>{activeCount} active</Badge>
            <Badge variant="outline">{inactiveCount} inactive</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage player details, skill levels, and roster status.
          </p>
        </div>

        <Link
          to="/admin"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to Admin
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'All'],
                ['active', 'Active'],
                ['inactive', 'Inactive'],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={statusFilter === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, nickname, or email"
              className="w-full lg:max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : players.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No players yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Players will appear here once profiles are created.
              </p>
            </div>
          ) : visiblePlayers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No matching players.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search or status filter.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {visiblePlayers.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    onSaveNickname={saveNickname}
                    onUpdatePlayer={updatePlayer}
                    onToggleActive={setActive}
                  />
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[18%]">Player</TableHead>
                      <TableHead className="w-[22%]">Email</TableHead>
                      <TableHead className="w-[22%]">Nickname</TableHead>
                      <TableHead className="w-[14%]">Gender</TableHead>
                      <TableHead className="w-[12%]">
                        <div className="flex flex-col">
                          <span>Level</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            1 = Beginner, 10 = Advanced
                          </span>
                        </div>
                      </TableHead>
                      <TableHead className="w-[12%]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiblePlayers.map((player) => (
                      <TableRow
                        key={player.id}
                        className={cn(
                          player.isActive ? 'bg-card' : 'bg-muted/20',
                          'align-top'
                        )}
                      >
                        <TableCell className="py-3">
                          <div className="space-y-1">
                            <p className="max-w-[180px] truncate font-medium text-foreground">
                              {player.nameSlug}
                            </p>
                            <Badge variant={statusBadgeVariant(player.isActive)}>
                              {player.isActive ? 'Active roster' : 'Inactive roster'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px] py-3 text-muted-foreground">
                          <span className="block truncate">{player.email ?? 'No email'}</span>
                        </TableCell>
                        <TableCell className="py-3">
                          <NicknameCell
                            id={player.id}
                            initial={player.nickname}
                            onSave={saveNickname}
                            className="max-w-[220px]"
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="space-y-1">
                            <GenderToggle
                              value={player.gender}
                              onChange={(gender) => updatePlayer(player.id, { gender })}
                            />
                            <p className="text-xs text-muted-foreground">
                              {genderLabel(player.gender)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <select
                            value={player.level ?? ''}
                            onChange={(e) => updatePlayer(player.id, { level: e.target.value ? +e.target.value : null })}
                            className="h-8 w-24 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <option value="">Not set</option>
                            {LEVELS.map((level) => (
                              <option key={level} value={level}>
                                {level}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="py-3">
                          <PlayerStatusButton
                            isActive={player.isActive}
                            onToggle={() => setActive(player.id, !player.isActive)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PlayersView
