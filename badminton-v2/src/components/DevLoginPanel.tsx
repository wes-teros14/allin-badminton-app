import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

type DevAccount = { label: string; email: string; password: string }
type DevGroup = { heading: string; accounts: DevAccount[] }

const DEV_GROUPS: DevGroup[] = [
  {
    heading: 'Core',
    accounts: [
      { label: 'Admin',          email: 'admin@test.local',         password: 'Test1234!' },
      { label: 'Multiple John',  email: 'multiple-john@test.local', password: 'Test1234!' },
      { label: 'Multiple Jane',  email: 'multiple-jane@test.local', password: 'Test1234!' },
      { label: 'Multiple Joe',   email: 'multiple-joe@test.local',  password: 'Test1234!' },
    ],
  },
  {
    heading: 'Session 1',
    accounts: [
      { label: 'S1 Alex Tan',   email: 's1-alex@test.local',   password: 'Test1234!' },
      { label: 'S1 Jamie Lee',  email: 's1-jamie@test.local',  password: 'Test1234!' },
      { label: 'S1 Sam Wong',   email: 's1-sam@test.local',    password: 'Test1234!' },
      { label: 'S1 Wei Chen',   email: 's1-wei@test.local',    password: 'Test1234!' },
    ],
  },
  {
    heading: 'Session 2',
    accounts: [
      { label: 'S2 Marcus Lim', email: 's2-marcus@test.local', password: 'Test1234!' },
      { label: 'S2 Dana Park',  email: 's2-dana@test.local',   password: 'Test1234!' },
      { label: 'S2 Kim Soo',    email: 's2-kim@test.local',    password: 'Test1234!' },
      { label: 'S2 Raj Patel',  email: 's2-raj@test.local',    password: 'Test1234!' },
    ],
  },
]

export function DevLoginPanel() {
  if (!import.meta.env.DEV) return null
  return <DevLoginPanelInner />
}

function DevLoginPanelInner() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loginAs(email: string, password: string) {
    setLoading(email)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else setOpen(false)
    setLoading(null)
  }

  async function signOut() {
    setLoading('signout')
    await supabase.auth.signOut()
    setLoading(null)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-background border border-border rounded-xl shadow-lg p-4 w-52 space-y-3 max-h-[80vh] overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dev Login</p>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{error}</p>
          )}

          {user ? (
            <div className="space-y-2">
              <p className="text-xs text-foreground truncate">Logged in as:<br /><span className="font-medium">{user.email}</span></p>
              <button
                onClick={signOut}
                disabled={loading === 'signout'}
                className="w-full py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-50"
              >
                {loading === 'signout' ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {DEV_GROUPS.map((group) => (
                <div key={group.heading}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    {group.heading}
                  </p>
                  <div className="space-y-1">
                    {group.accounts.map((a) => (
                      <button
                        key={a.email}
                        onClick={() => loginAs(a.email, a.password)}
                        disabled={loading !== null}
                        className="w-full py-1.5 px-3 rounded-lg border border-border text-xs text-foreground font-semibold hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors disabled:opacity-50 text-left"
                      >
                        {loading === a.email ? 'Logging in…' : a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center"
        title="Dev Login"
      >
        DEV
      </button>
    </div>
  )
}
