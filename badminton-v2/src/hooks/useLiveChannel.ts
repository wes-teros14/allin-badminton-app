import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ConnectionStatus } from '@/lib/realtimePolicy'
import { createLiveRegistry, isAbout, type LiveClientLike, type LiveMessage } from '@/lib/liveChannel'
import { createNeonLiveRegistry, type NeonSubscriptionLike, type SealedPass } from '@/lib/neonLiveChannel'

const NEON_REALTIME_URL: string | undefined = import.meta.env.VITE_NEON_REALTIME_URL
const NEON_SEAL_URL: string | undefined = import.meta.env.VITE_NEON_SEAL_URL

/** Asks the seal Function for a 60-second pass, sending the sign-in when there is one (user:<id> needs it). */
async function sealPass(topic: string): Promise<SealedPass> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(NEON_SEAL_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ topic }),
  })
  if (!res.ok) throw new Error(`seal ${res.status} for ${topic.split(':')[0]}`)
  return (await res.json()) as SealedPass
}

// Neon Realtime when both URLs are configured (the Neon migration), otherwise Supabase Broadcast.
const registry =
  NEON_REALTIME_URL && NEON_SEAL_URL
    ? createNeonLiveRegistry({
        // Loaded on first use, so the Supabase build does not carry the SDK.
        createClient: async () => {
          const { createRealtimeClient } = await import('@neon/realtime/client')
          const client = createRealtimeClient({ url: NEON_REALTIME_URL })
          return {
            subscribe: (pass) => client.subscribe(pass, { materialize: false }) as unknown as NeonSubscriptionLike,
            close: () => client.close(),
          }
        },
        seal: sealPass,
      })
    : createLiveRegistry(supabase as unknown as LiveClientLike)

/** For effects that listen to a variable number of topics; prefer useLiveChannel. */
export const listenLive = registry.listen

/**
 * Calls `onChange` when the database reports a change on `topic` to one of
 * `tables` (see lib/liveChannel.ts). Pass `null` to listen to nothing.
 * `tables` is compared by content, so an inline array literal is fine.
 */
export function useLiveChannel(
  topic: string | null,
  tables: readonly string[],
  onChange: (message: LiveMessage) => void,
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting')
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const tablesKey = tables.join('|')

  useEffect(() => {
    if (!topic) return
    const wanted = tablesKey.split('|')
    return registry.listen(
      topic,
      (message) => { if (isAbout(message, wanted)) onChangeRef.current(message) },
      setStatus,
    )
  }, [topic, tablesKey])

  return topic ? status : 'reconnecting'
}
