// Checks the 089 Broadcast setup on DEV:
//   1. a logged-out client can join a private session:<id> channel and receives a match change
//   2. a logged-in player receives user:<own id> but is refused user:<someone else>
//   3. a client cannot send on a private channel
// Usage: node scripts/loadtest/probe-broadcast.mjs
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, ANON_KEY, SERVICE_KEY } from './env.mjs'

const SESSION_ID = process.argv[2] ?? 'bce6f898-c4cd-4334-9d38-54cd7a1df91f'
const opts = { auth: { persistSession: false, autoRefreshToken: false } }

const admin = createClient(SUPABASE_URL, SERVICE_KEY, opts)
const anon = createClient(SUPABASE_URL, ANON_KEY, opts)
const player = createClient(SUPABASE_URL, ANON_KEY, opts)

function join(client, topic) {
  return new Promise((res) => {
    const got = []
    const ch = client.channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, (m) => got.push(m.payload))
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          res({ ch, status, err: err?.message, got })
        }
      })
  })
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const { data: login, error: loginErr } = await player.auth.signInWithPassword({ email: 's1-alex@test.local', password: 'Test1234!' })
if (loginErr) throw loginErr
await player.realtime.setAuth(login.session.access_token)
const me = login.user.id
const { data: other } = await admin.from('profiles').select('id').neq('id', me).limit(1).single()

const a = await join(anon, `session:${SESSION_ID}`)
const p = await join(player, `user:${me}`)
const x = await join(player, `user:${other.id}`)
console.log('anon  session topic  :', a.status, a.err ?? '')
console.log('player own user topic:', p.status, p.err ?? '')
console.log('player OTHER user    :', x.status, x.err ?? '')

// Trigger: touch one match (no-op update fires the trigger) and the player's stats row if any.
const { data: m } = await admin.from('matches').select('id, queue_position').eq('session_id', SESSION_ID).limit(1).single()
await admin.from('matches').update({ queue_position: m.queue_position }).eq('id', m.id)
const { data: reg } = await admin.from('session_registrations').select('session_id, player_id, paid').eq('player_id', me).limit(1).maybeSingle()
if (reg) await admin.from('session_registrations').update({ paid: reg.paid }).eq('session_id', reg.session_id).eq('player_id', me)
await wait(4000)
console.log('anon received        :', JSON.stringify(a.got))
console.log('player received      :', JSON.stringify(p.got))
console.log('other-user received  :', JSON.stringify(x.got), '(must be empty)')

// Can a client send? A second listener must NOT receive the spoof.
const listener = createClient(SUPABASE_URL, ANON_KEY, opts)
const l = await join(listener, `session:${SESSION_ID}`)
const send = await a.ch.send({ type: 'broadcast', event: 'changed', payload: { table: 'matches', spoof: true } })
await wait(3000)
console.log('anon send result     :', send, '| other listener got spoof?', l.got.some((g) => g.spoof), '(must be false)')
await listener.removeAllChannels()

for (const c of [anon, player]) await c.removeAllChannels()
process.exit(0)
