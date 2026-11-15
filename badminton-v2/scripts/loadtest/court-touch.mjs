// DEV helper: put the first queued game of a session on a court, or send it back.
// Usage: node scripts/loadtest/court-touch.mjs <sessionId> start|undo
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SERVICE_KEY } from './env.mjs'
const [sessionId, action] = process.argv.slice(2)
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
if (action === 'start') {
  const { data: m } = await db.from('matches').select('id, queue_position').eq('session_id', sessionId).eq('status', 'queued').order('queue_position').limit(1).single()
  const { error } = await db.from('matches').update({ status: 'playing', court_number: 1, started_at: new Date().toISOString() }).eq('id', m.id)
  console.log(new Date().toISOString(), 'started game', m.queue_position, error?.message ?? 'ok')
} else {
  const { data: m } = await db.from('matches').select('id, queue_position').eq('session_id', sessionId).eq('status', 'playing').order('queue_position').limit(1).single()
  const { error } = await db.from('matches').update({ status: 'queued', court_number: null, started_at: null }).eq('id', m.id)
  console.log(new Date().toISOString(), 'returned game', m.queue_position, error?.message ?? 'ok')
}
