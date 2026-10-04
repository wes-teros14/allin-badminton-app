import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { baseProfileSlug, profileDisplayName } from '@/lib/profileSlug'

/**
 * Makes sure the signed-in user has a `profiles` row.
 *
 * The `on_auth_user_created` trigger is meant to create it, but prod has had
 * logins with no profile (found 2026-10-04: an account created 2026-05-14
 * with no row). Such a player can sign in yet is invisible on /players and
 * never sees the Register button, because every player screen keys off the
 * profile. Runs on every sign-in from AuthContext, so any entry point heals.
 */
export async function ensureProfile(user: User): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('id', user.id)
    .maybeSingle()
  if (readError) throw readError

  const email = user.email ?? null

  if (existing) {
    const row = existing as { id: string; email: string | null }
    if (email && row.email !== email) {
      const { error } = await supabase.from('profiles').update({ email } as never).eq('id', user.id)
      if (error) throw error
    }
    return
  }

  const baseSlug = baseProfileSlug(profileDisplayName(user.user_metadata, user.email))

  let { error } = await supabase
    .from('profiles')
    .insert({ id: user.id, name_slug: baseSlug, email, role: 'player' } as never)

  if (error?.code === '23505' && error.message.includes('name_slug')) {
    const retry = await supabase
      .from('profiles')
      .insert({ id: user.id, name_slug: `${baseSlug}-${user.id.slice(0, 6)}`, email, role: 'player' } as never)
    error = retry.error
  }

  // The trigger created the row between our read and our insert.
  if (error?.code === '23505' && error.message.includes('pkey')) return

  if (error) throw error
}
