import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const MAX_CHARS = 1000
const PH_LOCALE = 'en-PH'
const PH_TZ = 'Asia/Manila'

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString(PH_LOCALE, { timeZone: PH_TZ, month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString(PH_LOCALE, { timeZone: PH_TZ, hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date} · ${time}`
}

function BulletinBoard({ isAdmin }: { isAdmin: boolean }) {
  const [content, setContent] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('announcements')
      .select('content, updated_at')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        setContent((data as { content: string | null; updated_at: string } | null)?.content ?? null)
        setUpdatedAt((data as { content: string | null; updated_at: string } | null)?.updated_at ?? null)
        setIsLoading(false)
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('announcements')
      .update({ content: draft.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (error) {
      toast.error(error.message)
    } else {
      setContent(draft.trim() || null)
      setUpdatedAt(new Date().toISOString())
      setEditing(false)
    }
    setSaving(false)
  }

  function handleEdit() {
    setDraft(content ?? '')
    setEditing(true)
  }

  function handleCancel() {
    setEditing(false)
    setDraft('')
  }

  if (isLoading) {
    return <div className="h-24 bg-muted rounded-xl animate-pulse" />
  }

  return (
    <div className="w-full max-w-sm bg-card border border-border rounded-xl px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">📌 Notice Board</p>
        {isAdmin && !editing && (
          <button
            onClick={handleEdit}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {content ? 'Edit' : '+ Add'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            rows={15}
            placeholder="Write an announcement..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{draft.length}/{MAX_CHARS}</p>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex-1 py-2 rounded-lg border border-border text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : content ? (
        <div className="space-y-2">
          <p className="text-sm whitespace-pre-wrap">{content}</p>
          {updatedAt && (
            <p className="text-xs text-muted-foreground">Updated {formatUpdatedAt(updatedAt)}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No announcements.</p>
      )}
    </div>
  )
}

export function HomeView() {
  const { user, role, isLoading } = useAuth()

  function signIn() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/` },
    })
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-primary">Badminton Gang</h1>
          <p className="text-muted-foreground text-sm">Game Na Kahit Walang Warm Up</p>
        </div>
        <button
          onClick={signIn}
          className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 px-6 pt-10 pb-16">
      <img src="/pp-logo.jpeg" alt="PP" className="w-20 h-20 rounded-full object-cover" />
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">Welcome back!</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Check <span className="font-medium text-foreground">Sessions</span> to register and see your schedule.
        </p>
      </div>
      <BulletinBoard isAdmin={role === 'admin'} />
    </div>
  )
}

export default HomeView
