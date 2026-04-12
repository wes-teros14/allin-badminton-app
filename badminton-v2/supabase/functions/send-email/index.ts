// Supabase Edge Function: send-email
// Handles all transactional emails via Resend API.
// Called by database triggers (pg_net) and pg_cron jobs.
//
// Email types:
//   payment_confirmed         — admin marked player as paid
//   session_full              — session reached max_players (fan-out to all registrants)
//   schedule_ready            — session status → schedule_locked (fan-out to all registrants)
//   session_reminder_2day     — cron: sessions 2 days away (fan-out)
//   registration_followup_24hr — cron: unpaid registrations 24hr old

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
// Shared secret used by DB triggers to authenticate calls to this function.
// Must match the 'function_auth_secret' row in public.app_config.
// Set via: npx supabase secrets set FUNCTION_AUTH_SECRET=<random-string>
const FUNCTION_AUTH_SECRET = Deno.env.get('FUNCTION_AUTH_SECRET')!

// Update FROM_ADDRESS to your verified Resend domain.
// For dev testing, use the Resend test address: onboarding@resend.dev
const FROM_ADDRESS = 'onboarding@resend.dev'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

type EmailType =
  | 'payment_confirmed'
  | 'session_full'
  | 'schedule_ready'
  | 'session_reminder_2day'
  | 'registration_followup_24hr'

interface EmailRequest {
  type: EmailType
  payload: Record<string, string>
}

interface SessionRow {
  id: string
  name: string
  date: string
  time: string | null
  venue: string | null
  price: number | null
  status: string
}

interface ProfileRow {
  id: string
  email: string | null
  nickname: string | null
  name_slug: string
}

// ─────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Verify caller is our own DB trigger (bearer = FUNCTION_AUTH_SECRET)
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${FUNCTION_AUTH_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: EmailRequest
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  try {
    switch (body.type) {
      case 'payment_confirmed':
        await handlePaymentConfirmed(body.payload)
        break
      case 'session_full':
        await handleSessionFull(body.payload)
        break
      case 'schedule_ready':
        await handleScheduleReady(body.payload)
        break
      case 'session_reminder_2day':
        await handleSessionReminder2Day(body.payload)
        break
      case 'registration_followup_24hr':
        await handleRegistrationFollowup24Hr(body.payload)
        break
      default:
        return new Response('Unknown email type', { status: 400 })
    }
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error(`[send-email] Error handling ${body.type}:`, err)
    return new Response('Internal error', { status: 500 })
  }
})

// ─────────────────────────────────────────────────────────────────
// Deduplication
// Inserts a row into email_logs. Returns false if already sent.
// ─────────────────────────────────────────────────────────────────

async function acquireSendSlot(
  emailType: string,
  idempotencyKey: string,
  recipientEmail: string
): Promise<boolean> {
  const { error } = await supabase
    .from('email_logs')
    .insert({ email_type: emailType, idempotency_key: idempotencyKey, recipient_email: recipientEmail })

  if (error) {
    if (error.code === '23505') return false // unique constraint — already sent
    throw error
  }
  return true
}

// ─────────────────────────────────────────────────────────────────
// Resend API call
// ─────────────────────────────────────────────────────────────────

async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend API error ${res.status}: ${body}`)
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function displayName(profile: ProfileRow): string {
  return profile.nickname ?? profile.name_slug
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

async function getSession(sessionId: string): Promise<SessionRow | null> {
  const { data } = await supabase
    .from('sessions')
    .select('id, name, date, time, venue, price, status')
    .eq('id', sessionId)
    .single()
  return data
}

async function getProfile(playerId: string): Promise<ProfileRow | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, nickname, name_slug')
    .eq('id', playerId)
    .single()
  return data
}

async function getSessionRegistrants(sessionId: string): Promise<ProfileRow[]> {
  const { data: registrations } = await supabase
    .from('session_registrations')
    .select('player_id')
    .eq('session_id', sessionId)

  if (!registrations?.length) return []

  const playerIds = registrations.map((r: { player_id: string }) => r.player_id)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, nickname, name_slug')
    .in('id', playerIds)

  return (profiles ?? []) as ProfileRow[]
}

// ─────────────────────────────────────────────────────────────────
// Handler: payment_confirmed
// Single email to the player whose payment was confirmed.
// ─────────────────────────────────────────────────────────────────

async function handlePaymentConfirmed(payload: Record<string, string>) {
  const { registration_id, session_id, player_id } = payload

  const [profile, session] = await Promise.all([
    getProfile(player_id),
    getSession(session_id),
  ])

  if (!profile?.email || !session) return

  const slot = await acquireSendSlot('payment_confirmed', registration_id, profile.email)
  if (!slot) return

  const name = displayName(profile)
  const dateStr = formatDate(session.date)
  const details = [
    session.venue && session.venue,
    session.time && session.time,
    session.price && `$${session.price}`,
  ].filter(Boolean).join('\n')

  await sendEmail({
    to: profile.email,
    subject: `Payment confirmed — ${session.name}`,
    html: `
      <p>Hi ${name},</p>
      <p>Your payment for <strong>${session.name}</strong> has been confirmed. You're all set!</p>
      <p>
        <strong>Session details:</strong><br>
        ${dateStr}<br>
        ${session.venue ? `${session.venue}<br>` : ''}
        ${session.time ? `${session.time}<br>` : ''}
        ${session.price ? `$${session.price}<br>` : ''}
      </p>
      <p>See you on the court!</p>
    `,
    text: `Hi ${name},\n\nYour payment for ${session.name} (${dateStr}) has been confirmed. You're all set!\n\n${details}\n\nSee you on the court!`,
  })
}

// ─────────────────────────────────────────────────────────────────
// Handler: session_full
// Fan-out email to all registered players.
// ─────────────────────────────────────────────────────────────────

async function handleSessionFull(payload: Record<string, string>) {
  const { session_id } = payload

  const [session, profiles] = await Promise.all([
    getSession(session_id),
    getSessionRegistrants(session_id),
  ])

  if (!session) return

  const dateStr = formatDate(session.date)

  for (const profile of profiles) {
    if (!profile.email) continue

    const key = `${profile.id}:${session_id}`
    const slot = await acquireSendSlot('session_full', key, profile.email)
    if (!slot) continue

    const name = displayName(profile)

    await sendEmail({
      to: profile.email,
      subject: `We're all good to go! — ${session.name}`,
      html: `
        <p>Hi ${name},</p>
        <p>Great news — <strong>${session.name}</strong> is now fully booked!</p>
        <p>
          ${dateStr}<br>
          ${session.venue ? `${session.venue}<br>` : ''}
          ${session.time ? `${session.time}<br>` : ''}
        </p>
        <p>Match schedules will be sent when they're ready. See you on the court!</p>
      `,
      text: `Hi ${name},\n\nGreat news — ${session.name} (${dateStr}) is fully booked! Match schedules will be sent when ready.\n\n${session.venue ? `${session.venue}\n` : ''}${session.time ? `${session.time}\n` : ''}\nSee you on the court!`,
    })
  }
}

// ─────────────────────────────────────────────────────────────────
// Handler: schedule_ready
// Fan-out email to all registered players when match schedules are locked.
// ─────────────────────────────────────────────────────────────────

async function handleScheduleReady(payload: Record<string, string>) {
  const { session_id } = payload

  const [session, profiles] = await Promise.all([
    getSession(session_id),
    getSessionRegistrants(session_id),
  ])

  if (!session) return

  const dateStr = formatDate(session.date)

  for (const profile of profiles) {
    if (!profile.email) continue

    const key = `${profile.id}:${session_id}`
    const slot = await acquireSendSlot('schedule_ready', key, profile.email)
    if (!slot) continue

    const name = displayName(profile)

    await sendEmail({
      to: profile.email,
      subject: `Match schedules are ready — ${session.name}`,
      html: `
        <p>Hi ${name},</p>
        <p>The match schedule for <strong>${session.name}</strong> is ready!</p>
        <p>
          ${dateStr}<br>
          ${session.venue ? `${session.venue}<br>` : ''}
          ${session.time ? `${session.time}<br>` : ''}
        </p>
        <p>Log in to the app to view your court assignments and match schedule.</p>
        <p>See you on the court!</p>
      `,
      text: `Hi ${name},\n\nThe match schedule for ${session.name} (${dateStr}) is ready!\n\nLog in to the app to view your court assignments and match schedule.\n\n${session.venue ? `${session.venue}\n` : ''}${session.time ? `${session.time}\n` : ''}\nSee you on the court!`,
    })
  }
}

// ─────────────────────────────────────────────────────────────────
// Handler: session_reminder_2day
// Cron: finds sessions 2 days from run_date, emails all registrants.
// ─────────────────────────────────────────────────────────────────

async function handleSessionReminder2Day(payload: Record<string, string>) {
  const { run_date } = payload // 'YYYY-MM-DD'

  // Calculate target date: run_date + 2 days
  const target = new Date(run_date)
  target.setDate(target.getDate() + 2)
  const targetDate = target.toISOString().split('T')[0]

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, name, date, time, venue, price, status')
    .eq('date', targetDate)
    .in('status', ['registration_open', 'registration_closed', 'schedule_locked', 'in_progress'])

  for (const session of (sessions ?? []) as SessionRow[]) {
    const profiles = await getSessionRegistrants(session.id)
    const dateStr = formatDate(session.date)

    for (const profile of profiles) {
      if (!profile.email) continue

      const key = `${profile.id}:${session.id}:${run_date}`
      const slot = await acquireSendSlot('session_reminder_2day', key, profile.email)
      if (!slot) continue

      const name = displayName(profile)

      await sendEmail({
        to: profile.email,
        subject: `Reminder: ${session.name} is in 2 days`,
        html: `
          <p>Hi ${name},</p>
          <p>Just a reminder — <strong>${session.name}</strong> is happening in 2 days!</p>
          <p>
            ${dateStr}<br>
            ${session.venue ? `${session.venue}<br>` : ''}
            ${session.time ? `${session.time}<br>` : ''}
            ${session.price ? `$${session.price}<br>` : ''}
          </p>
          <p>See you on the court!</p>
        `,
        text: `Hi ${name},\n\nJust a reminder — ${session.name} is in 2 days!\n\n${dateStr}\n${session.venue ? `${session.venue}\n` : ''}${session.time ? `${session.time}\n` : ''}${session.price ? `$${session.price}\n` : ''}\nSee you on the court!`,
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Handler: registration_followup_24hr
// Cron: finds registrations 24-25hr old, paid=false, session still open.
// ─────────────────────────────────────────────────────────────────

async function handleRegistrationFollowup24Hr(payload: Record<string, string>) {
  const { run_at } = payload // 'YYYY-MM-DDTHH:00:00'

  const runTime = new Date(run_at)
  // Window: registrations from 25hr ago to 24hr ago relative to run_at
  const windowEnd = new Date(runTime.getTime() - 24 * 60 * 60 * 1000)
  const windowStart = new Date(runTime.getTime() - 25 * 60 * 60 * 1000)

  const { data: registrations } = await supabase
    .from('session_registrations')
    .select('id, player_id, session_id, registered_at')
    .eq('paid', false)
    .gte('registered_at', windowStart.toISOString())
    .lt('registered_at', windowEnd.toISOString())

  for (const reg of (registrations ?? []) as { id: string; player_id: string; session_id: string; registered_at: string }[]) {
    // Only send if session is still open for registration
    const { data: session } = await supabase
      .from('sessions')
      .select('id, name, date, time, venue, price, status')
      .eq('id', reg.session_id)
      .eq('status', 'registration_open')
      .maybeSingle()

    if (!session) continue

    const profile = await getProfile(reg.player_id)
    if (!profile?.email) continue

    // Key: registration_id + run hour — prevents re-firing next hour
    const hourKey = run_at.slice(0, 13) // 'YYYY-MM-DDTHH'
    const key = `${reg.id}:${hourKey}`
    const slot = await acquireSendSlot('registration_followup_24hr', key, profile.email)
    if (!slot) continue

    const name = displayName(profile)
    const dateStr = formatDate(session.date)

    await sendEmail({
      to: profile.email,
      subject: `Payment reminder — ${session.name}`,
      html: `
        <p>Hi ${name},</p>
        <p>You're registered for <strong>${session.name}</strong> but payment hasn't been confirmed yet.</p>
        <p>
          ${dateStr}<br>
          ${session.venue ? `${session.venue}<br>` : ''}
          ${session.time ? `${session.time}<br>` : ''}
          ${session.price ? `$${session.price}<br>` : ''}
        </p>
        <p>Please arrange payment to secure your spot. If you've already paid, you can ignore this email — we'll update your status shortly.</p>
      `,
      text: `Hi ${name},\n\nYou're registered for ${session.name} (${dateStr}) but payment hasn't been confirmed yet.\n\n${session.venue ? `${session.venue}\n` : ''}${session.time ? `${session.time}\n` : ''}${session.price ? `$${session.price}\n` : ''}\nPlease arrange payment to secure your spot. If you've already paid, ignore this — we'll update your status shortly.`,
    })
  }
}
