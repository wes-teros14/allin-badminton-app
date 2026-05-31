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
  return Array.from({ length: courtCount }, (_, index) => {
    const courtNumber = index + 1

    return {
      courtNumber,
      label: labels[courtNumber] || defaultCourtLabel(courtNumber),
      current: currentByCourt.get(courtNumber) ?? null,
      next: queued[index] ?? null,
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
