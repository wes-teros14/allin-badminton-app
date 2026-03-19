interface Props {
  status: 'connected' | 'reconnecting' | 'disconnected'
  onRefresh: () => void
}

export function LiveIndicator({ status, onRefresh }: Props) {
  if (status === 'connected') return null

  if (status === 'reconnecting') {
    return (
      <div className="absolute top-3 right-4 z-40 flex items-center gap-2 text-amber-400 text-xs font-semibold tracking-wide">
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        Reconnecting…
      </div>
    )
  }

  // disconnected
  return (
    <div className="absolute top-3 right-4 z-40 flex items-center gap-3">
      <span className="text-xs text-muted-foreground font-medium tracking-wide">Offline</span>
      <button
        onClick={onRefresh}
        className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold text-foreground hover:bg-white/10 transition-colors"
      >
        Refresh
      </button>
    </div>
  )
}
