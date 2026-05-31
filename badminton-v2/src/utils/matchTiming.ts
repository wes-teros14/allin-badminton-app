export function elapsedSecondsFromStartedAt(startedAt: string | null, nowMs = Date.now()): number | null {
  if (!startedAt) return null

  const startedMs = new Date(startedAt).getTime()
  if (!Number.isFinite(startedMs)) return null

  return Math.max(0, Math.floor((nowMs - startedMs) / 1000))
}

export function playingMatchUpdate(courtNumber: number, startedAt = new Date().toISOString()) {
  return { status: 'playing' as const, court_number: courtNumber, started_at: startedAt }
}

export function queuedMatchUpdate(queuePosition?: number) {
  return {
    status: 'queued' as const,
    court_number: null,
    started_at: null,
    ...(queuePosition != null ? { queue_position: queuePosition } : {}),
  }
}

export function completedMatchUpdate(startedAt: string | null, nowMs = Date.now()) {
  const durationSeconds = elapsedSecondsFromStartedAt(startedAt, nowMs)

  return {
    status: 'complete' as const,
    ...(durationSeconds != null ? { duration_seconds: durationSeconds } : {}),
  }
}
