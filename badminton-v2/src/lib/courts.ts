export interface CourtSlot<T> {
  courtNumber: number
  label: string
  current: T | null
  next: T | null
}

type SessionCourtLabels = {
  court_1_label?: string | null
  court_2_label?: string | null
}

export function normalizeCourtCount(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 2
  return Math.max(1, Math.trunc(value as number))
}

export function defaultCourtLabel(courtNumber: number) {
  return `Court ${courtNumber}`
}

export function buildCourtLabels(
  courtCount: number,
  session: SessionCourtLabels | null = null,
): Record<number, string> {
  const labels: Record<number, string> = {}

  for (let courtNumber = 1; courtNumber <= courtCount; courtNumber += 1) {
    if (courtNumber === 1) {
      labels[courtNumber] = session?.court_1_label || defaultCourtLabel(courtNumber)
      continue
    }

    if (courtNumber === 2) {
      labels[courtNumber] = session?.court_2_label || defaultCourtLabel(courtNumber)
      continue
    }

    labels[courtNumber] = defaultCourtLabel(courtNumber)
  }

  return labels
}

export function buildCourtSlots<T>(
  courtCount: number,
  labels: Record<number, string>,
  currentByCourt: Map<number, T>,
  queued: T[],
): CourtSlot<T>[] {
  const courtNumbers = Array.from({ length: courtCount }, (_, index) => index + 1)
  const idle = courtNumbers.filter((courtNumber) => !currentByCourt.has(courtNumber))

  return courtNumbers.map((courtNumber) => {
    const idleIndex = idle.indexOf(courtNumber)

    return {
      courtNumber,
      label: labels[courtNumber] || defaultCourtLabel(courtNumber),
      current: currentByCourt.get(courtNumber) ?? null,
      /**
       * There is one shared queue, and its head goes to whichever court frees
       * up next. Idle courts are filled first, in court order — that is what
       * Start Session does (buildStartingCourtAssignments) — so the k-th idle
       * court previews the k-th queued game, and a busy court previews the
       * first game no idle court will take.
       *
       * When every court is busy (most of a night) that is the queue head on
       * every court, as before. Giving *idle* courts the head too put "Game 1"
       * on both courts before the first game started (prod, 2026-10-09).
       * `queued[index]` (by court number, not by idle order) was wrong the other
       * way: a promise for court 2 that the queue never keeps.
       */
      next: queued[idleIndex >= 0 ? idleIndex : idle.length] ?? null,
    }
  })
}

export function findFirstOpenCourtNumber(courtCount: number, occupiedCourtNumbers: number[]): number | null {
  const occupied = new Set(occupiedCourtNumbers)

  for (let courtNumber = 1; courtNumber <= courtCount; courtNumber += 1) {
    if (!occupied.has(courtNumber)) return courtNumber
  }

  return null
}

export function buildStartingCourtAssignments<T extends { id: string }>(matches: T[], courtCount: number) {
  return matches.slice(0, courtCount).map((match, index) => ({
    id: match.id,
    courtNumber: index + 1,
  }))
}
