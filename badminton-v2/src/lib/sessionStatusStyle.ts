/**
 * Session status as coloured text with a dot, matching the player Sessions card (MySessionsView), so admin
 * and player views agree on what each status looks like. Was a filled pill until the 2026-11-24 pattern
 * ban; the white-on-red "Playing" pill measured 3.7:1 and the schedule-locked yellow was a hard-coded
 * #FFB200 that vanished in the light theme.
 */
const STATUS_STYLE: Record<string, { text: string; dot: string }> = {
  setup: { text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
  registration_open: { text: 'text-primary-ink', dot: 'bg-primary' },
  registration_closed: { text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
  schedule_locked: { text: 'text-gold-ink', dot: 'bg-gold' },
  in_progress: { text: 'text-destructive', dot: 'bg-destructive' },
  complete: { text: 'text-muted-foreground', dot: 'bg-border' },
}

const DEFAULT_STYLE = { text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' }

export function sessionStatusStyle(status: string): { text: string; dot: string } {
  return STATUS_STYLE[status] ?? DEFAULT_STYLE
}
