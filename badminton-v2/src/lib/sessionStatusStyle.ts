/**
 * Shared pill styling per session status, matching the colors MySessionsView
 * already uses for the player-facing session list, so admin and player views
 * agree on what each status looks like.
 */
const PILL_CLASSNAMES: Record<string, string> = {
  setup: 'border-border bg-secondary text-muted-foreground',
  registration_open: 'border-primary bg-primary text-primary-foreground',
  registration_closed: 'border-border bg-secondary text-muted-foreground',
  schedule_locked: 'border-[#FFB200]/40 bg-[#FFB200]/10 text-[#FFB200]',
  in_progress: 'border-destructive/50 bg-destructive text-white',
  complete: 'border-border bg-secondary/60 text-muted-foreground',
}

const DEFAULT_PILL_CLASSNAME = 'border-border bg-secondary text-muted-foreground'

export function sessionStatusPillClassName(status: string): string {
  return PILL_CLASSNAMES[status] ?? DEFAULT_PILL_CLASSNAME
}
