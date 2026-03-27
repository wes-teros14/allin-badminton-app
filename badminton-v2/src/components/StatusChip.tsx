interface Props {
  status: 'playing' | 'next-game' | 'queued' | 'done'
}

const styles: Record<Props['status'], string> = {
  playing:  'bg-primary text-primary-foreground',
  'next-game':'bg-muted-foreground/20 text-muted-foreground',
  queued:   'bg-muted/50 text-muted-foreground',
  done:     'bg-[var(--success)]/20 text-[var(--success)]',
}

const labels: Record<Props['status'], string> = {
  playing:  'Playing',
  'next-game':'Next Game',
  queued:   'Queued',
  done:     'Done',
}

export function StatusChip({ status }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
