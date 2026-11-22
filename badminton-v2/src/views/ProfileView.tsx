import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { usePastSeasonCards, useSeasonBadges, useSeasonStats, type PastSeasonCard, type SeasonStatsLoad } from '@/hooks/useSeasonStats'
import { useSeasonStatus } from '@/hooks/useSeasonStatus'
import { useNotifications } from '@/contexts/NotificationContext'
import { supabase } from '@/lib/supabase'
import { userTopic } from '@/lib/liveChannel'
import { listenLive } from '@/hooks/useLiveChannel'
import { boardScope, localToday } from '@/lib/season'
import { seasonStartLine, seasonSummaryLine } from '@/lib/seasonCopy'
import { SeasonSections, SectionError } from '@/components/profile/SeasonSections'
import { resizeImageFile } from '@/lib/imageResize'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/contexts/ThemeContext'
import { Camera } from 'lucide-react'
import { APP_BUILD_STAMP } from '@/lib/appBuild'
import { copyText } from '@/lib/copyText'

/**
 * The build this browser is running, so a bug report can name a commit. Tapping
 * copies it — a player pasting one line beats asking them to screenshot a page.
 */
function BuildStamp() {
  async function handleCopy() {
    if (await copyText(APP_BUILD_STAMP)) {
      toast.success('Version copied')
      return
    }

    // Some browsers refuse both copy paths. Showing the text is still useful —
    // it can be read out or long-pressed — so this is not worth an error toast.
    toast.info(APP_BUILD_STAMP)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy this app version"
      className="mx-auto block select-all rounded-md px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted"
    >
      {APP_BUILD_STAMP}
    </button>
  )
}

interface NicknameRow {
  nickname: string | null
  avatar_url: string | null
}

const MAX_AVATAR_DIM = 1024
const MAX_AVATAR_BYTES = 1 * 1024 * 1024 // enforced after client-side resize/compression below
const MAX_AVATAR_INPUT_BYTES = 20 * 1024 * 1024 // reject absurdly large originals before we even try to process them

/**
 * "Your 2026 season · 21 sessions · 88 games", opening that season's page. No board place: computing it
 * would mean a full past-season board read on every profile open; the place lives on the year page.
 */
function PastSeasonLink({ card }: { card: PastSeasonCard }) {
  return (
    <Link
      to={`/profile/season/${card.season.id}`}
      className="flex min-h-11 w-full items-center gap-3 rounded-[14px] border border-gold/35 bg-gold/[0.06] px-3.5 py-3 text-left transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-[22px] leading-none" aria-hidden="true">🏆</span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm font-bold text-foreground">Your {card.season.id} season</b>
        <span className="text-xs text-muted-foreground tabular-nums">{seasonSummaryLine(card.sessions, card.games)}</span>
      </span>
      <span className="text-xl leading-none text-gold-ink" aria-hidden="true">›</span>
    </Link>
  )
}

function PastSeasons({ load }: { load: ReturnType<typeof usePastSeasonCards> }) {
  if (load.error) return <SectionError what="your past seasons" onRetry={load.refresh} />
  if (load.cards === null) return <div className="h-16 rounded-[14px] bg-muted animate-pulse" />
  if (load.cards.length === 0) return null
  return (
    <div className="space-y-2">
      {load.cards.map((card) => <PastSeasonLink key={card.season.id} card={card} />)}
    </div>
  )
}

export function ProfileView() {
  const { user, isLoading: authLoading } = useAuth()
  // My Profile shows the current season only; past seasons open their own page.
  const [today] = useState(localToday)
  const scope = useMemo(() => boardScope(null, today), [today])
  const seasonStats = useSeasonStats(user?.id, scope)
  const badges = useSeasonBadges(user?.id, scope)
  const pastCards = usePastSeasonCards(user?.id, today)
  const { status, retry: retryStatus } = useSeasonStatus(scope)
  const { refresh } = seasonStats
  const { markAllRead } = useNotifications()
  const { theme } = useTheme()
  const [nickname, setNickname] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [savingNickname, setSavingNickname] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Mark notifications as read when visiting profile
  useEffect(() => { markAllRead() }, [markAllRead])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('nickname, avatar_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const row = data as NicknameRow
        setNickname(row.nickname ?? '')
        setAvatarUrl(row.avatar_url)
      })
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    return listenLive(userTopic(user.id), (message) => {
      if (message.table === 'player_stats') refresh()
    })
  }, [user?.id, refresh])

  async function handleSaveNickname() {
    if (!user) return
    setSavingNickname(true)
    const { error } = await supabase.from('profiles').update({ nickname: nickname.trim() || null } as never).eq('id', user.id)
    if (error) toast.error(error.message)
    else { toast.success('Nickname saved'); setEditingNickname(false) }
    setSavingNickname(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > MAX_AVATAR_INPUT_BYTES) {
      toast.error('Image is too large')
      return
    }

    setUploadingAvatar(true)
    try {
      const resized = await resizeImageFile(file, MAX_AVATAR_DIM, MAX_AVATAR_BYTES)

      const path = `${user.id}/avatar`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, resized, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' })
      if (uploadError) { toast.error(uploadError.message); return }

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const bustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: bustedUrl } as never)
        .eq('id', user.id)
      if (updateError) { toast.error(updateError.message); return }

      setAvatarUrl(bustedUrl)
      toast.success('Profile picture updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process image')
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (authLoading) return <div className="p-6">Loading…</div>

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    )
  }

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Player'

  // The Stats wait for the season status too: with nothing played yet they sit under "Your 2027 season starts
  // with the Nov 22 session", and a failed status read is an error, not zeros without that line.
  const stats: SeasonStatsLoad =
    status.kind === 'error'
      ? { ...seasonStats, error: seasonStats.error ?? new Error('season status failed to load'), refresh: () => { retryStatus(); seasonStats.refresh() } }
      : status.kind === 'loading'
        ? { ...seasonStats, stats: null, cheers: null, isLoading: true }
        : seasonStats
  const lead =
    status.kind === 'ready' && scope.isCurrent && status.played.length === 0
      ? seasonStartLine(scope.season, status.nextDate, 'Your')
      : null

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar url={avatarUrl} name={displayName} size={72} />
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            title="Change profile picture"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold truncate">{displayName}</h1>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          {uploadingAvatar && <p className="text-xs text-muted-foreground mt-0.5">Uploading…</p>}
        </div>
      </div>

      {/* Nickname */}
      <div className="flex items-center gap-2">
        {editingNickname ? (
          <>
            <input
              autoFocus
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Add a nickname…"
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleSaveNickname}
              disabled={savingNickname}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
            >
              {savingNickname ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditingNickname(false)}
              className="px-3 h-9 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditingNickname(true)}
            className="flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors"
            title="Edit nickname"
          >
            <span className="text-muted-foreground">Nickname: </span>
            <span>{nickname || <span className="text-muted-foreground">No nickname set</span>}</span>
            <span className="text-muted-foreground text-xs">edit</span>
          </button>
        )}
      </div>

      {/* Appearance */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border py-1.5 pl-4 pr-1.5">
        <div className="min-w-0">
          <p className="text-sm text-foreground">Appearance</p>
          <p className="text-xs text-muted-foreground">{theme === 'dark' ? 'Dark' : 'Light'}</p>
        </div>
        <ThemeToggle />
      </div>

      {/* Sign out */}
      <button
        onClick={() => supabase.auth.signOut()}
        className="w-full py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
      >
        Sign out
      </button>

      {/* One card per past season played, above this season's sections */}
      <PastSeasons load={pastCards} />

      <SeasonSections scope={scope} stats={stats} badges={badges} lead={lead} />

      <BuildStamp />

    </div>
  )
}

export default ProfileView
