import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ConnectionStatus } from '@/lib/realtimePolicy'
import { createLiveRegistry, isAbout, type LiveClientLike, type LiveMessage } from '@/lib/liveChannel'

const registry = createLiveRegistry(supabase as unknown as LiveClientLike)

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
